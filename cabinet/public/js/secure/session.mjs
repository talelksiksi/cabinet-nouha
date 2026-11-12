/* ═══════════════════════════════════════════
   Espace cabinet — session sécurisée et stockage chiffré
   - écrans : installation, connexion, activation (code d'invitation), déverrouillage, clé des données,
     clé de secours, attente d'autorisation, changement de mot de passe
   - CabinetStore : remplace le stockage du navigateur. L'application lit / écrit comme avant ;
     chaque enregistrement est chiffré ici puis envoyé au serveur, et les modifications des autres
     postes arrivent toutes les 10 secondes.
   - verrouillage automatique après 30 minutes d'inactivité (guide INPDP) : les clés sont effacées de la mémoire
   ═══════════════════════════════════════════ */
import * as C from './crypto.mjs';
import { MODULES, PRESETS, LEVELS, levelOf } from './perms.mjs';

const IDLE_LOCK_MS = 30 * 60e3;
const POLL_MS = 10e3;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ══════════ API ══════════ */
async function api(method, url, body) {
  let r;
  try {
    r = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Cabinet': '1' }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    const e = new Error('Le serveur du cabinet ne répond pas. Vérifiez que le PC du cabinet est allumé et que vous êtes sur le Wi-Fi du cabinet.');
    e.status = 0; e.code = 'offline'; throw e;
  }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(data.message || 'Erreur'); e.status = r.status; e.code = data.error; e.data = data; throw e; }
  return data;
}

/* ══════════ État ══════════ */
const S = { user: null, sess: null, encKey: null, privateKey: null, dek: null, directory: [], status: null, locked: true };

/* ══════════ Stockage chiffré ══════════ */
const ARRAYS = ['patients', 'appointments', 'treatments', 'payments', 'activity', 'requests', 'labs', 'labworks', 'labpayments', 'tasks', 'expenses', 'documents', 'gallery', 'files'];
const LINKED = new Set(['appointments', 'requests', 'treatments', 'files', 'documents', 'payments', 'gallery', 'labworks', 'activity']);
const recs = {};            // collection → Map(id → { json, v, owners })
const memo = {};            // collection → JSON de la vue (invalidée à chaque changement)
const pending = new Map();  // `${c}/${id}` → 'put' | 'del'
let queueRunning = false, cursor = 0, onRemoteChange = () => {};

const coll = c => (recs[c] ||= new Map());
const touch = c => { delete memo[c]; if (c === 'acts' || c === 'clinic') delete memo.settings; };

function ownersForPatient(pid) {
  if (pid == null || pid === '') return [];
  const set = new Set();
  for (const c of ['appointments', 'treatments'])
    for (const r of coll(c).values()) { const o = JSON.parse(r.json); if (String(o.patientId) === String(pid) && o.dentistId) set.add(String(o.dentistId)); }
  return [...set].sort();
}
function ownersFor(c, id, obj) {
  if (c === 'patients') return ownersForPatient(id);
  if (c === 'chart') return ownersForPatient(id);
  if (!LINKED.has(c)) return null;
  const set = new Set(ownersForPatient(obj.patientId));
  if (obj.dentistId) set.add(String(obj.dentistId));
  return [...set].sort();
}
const sameOwners = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

function localPut(c, id, obj) {
  const m = coll(c), json = JSON.stringify(obj), cur = m.get(id);
  const owners = ownersFor(c, id, obj);
  if (cur && cur.json === json && sameOwners(cur.owners, owners)) return false;
  m.set(id, { json, v: cur?.v ?? null, owners });
  touch(c); enqueue(c, id, 'put');
  // un dentiste nouvellement attribué doit pouvoir voir tout le dossier du patient
  if ((c === 'appointments' || c === 'treatments') && obj.patientId != null) refreshPatientOwners(String(obj.patientId));
  return true;
}
function refreshPatientOwners(pid) {
  const want = ownersForPatient(pid);
  const fix = (c, id, rec) => { if (!sameOwners(rec.owners, c === 'patients' || c === 'chart' ? want : ownersFor(c, id, JSON.parse(rec.json)))) { rec.owners = c === 'patients' || c === 'chart' ? want : ownersFor(c, id, JSON.parse(rec.json)); enqueue(c, id, 'put'); } };
  const p = coll('patients').get(pid); if (p) fix('patients', pid, p);
  const ch = coll('chart').get(pid); if (ch) fix('chart', pid, ch);
  for (const c of LINKED) for (const [id, r] of coll(c)) { if (String(JSON.parse(r.json).patientId) === pid) fix(c, id, r); }
}
function localDel(c, id) {
  if (!coll(c).has(id)) return;
  coll(c).delete(id); touch(c); enqueue(c, id, 'del');
}
function enqueue(c, id, op) { pending.set(`${c}/${id}`, op); runQueue(); }

async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (pending.size && S.dek) {
      const [key, op] = pending.entries().next().value;
      pending.delete(key);
      const [c, id] = [key.slice(0, key.indexOf('/')), key.slice(key.indexOf('/') + 1)];
      try {
        if (op === 'del') { await api('DELETE', `/api/records/${c}/${encodeURIComponent(id)}`); continue; }
        const rec = coll(c).get(id); if (!rec) continue;
        const body = { ...(await C.encryptRecord(S.dek, c, id, JSON.parse(rec.json))), owners: rec.owners };
        if (rec.v != null) body.base = rec.v;
        if (c === 'patients') {
          const o = JSON.parse(rec.json);
          body.blind = { phone: await C.blindIndex(S.dek, 'phone', o.phone) };
        }
        const r = await api('PUT', `/api/records/${c}/${encodeURIComponent(id)}`, body);
        rec.v = r.v;
        setSync('ok');
      } catch (e) {
        if (e.status === 409 && e.data?.current) {
          // modifié sur un autre poste : on garde la version la plus récente du serveur
          await applyRemote({ c, id, ...e.data.current });
          notify('Ce dossier venait d\'être modifié sur un autre poste : la dernière version a été rechargée.', 'warning');
          onRemoteChange();
        } else if (e.status === 403) {
          notify(e.message || 'Vous n\'avez pas le droit de modifier ces données.', 'error');
          await pull(true);
          onRemoteChange();
        } else if (e.status === 401) { pending.set(key, op); return lock('expired'); }
        else { pending.set(key, op); setSync('offline'); setTimeout(runQueue, 5000); return; }
      }
    }
  } finally { queueRunning = false; }
}

async function applyRemote(r) {
  const c = r.c, id = r.id;
  if (r.deleted) { if (coll(c).delete(id)) touch(c); return true; }
  const obj = await C.decryptRecord(S.dek, c, id, r);
  const json = JSON.stringify(obj), cur = coll(c).get(id);
  coll(c).set(id, { json, v: r.v, owners: r.owners });
  if (!cur || cur.json !== json) { touch(c); return true; }
  return false;
}

/** Récupère les nouveautés du serveur (toutes au premier appel). */
async function pull(full = false) {
  const res = await api('GET', `/api/records?since=${full ? 0 : cursor}`);
  if (full) { for (const k of Object.keys(recs)) recs[k].clear(); for (const k of Object.keys(memo)) delete memo[k]; }
  let changed = false;
  for (const r of res.records) {
    if (pending.has(`${r.c}/${r.id}`)) continue;              // notre propre modification est en route
    try { changed = (await applyRemote(r)) || changed; } catch (e) { console.warn('Enregistrement illisible', r.c, r.id, e); }
  }
  cursor = Math.max(cursor, res.cursor);
  setSync('ok');
  return changed;
}

const parse = j => JSON.parse(j);
const Store = {
  get(k) {
    if (k === 'staff') return Store.staff();
    if (k === 'chart') {
      if (!memo.chart) { const o = {}; for (const [id, r] of coll('chart')) o[id] = parse(r.json); memo.chart = JSON.stringify(o); }
      return parse(memo.chart);
    }
    if (!ARRAYS.includes(k)) return [];
    if (!memo[k]) memo[k] = '[' + [...coll(k).values()].map(r => r.json).join(',') + ']';
    return parse(memo[k]);
  },
  set(k, value) {
    if (!S.dek || k === 'staff' || k === 'seeded') return;
    if (k === 'chart') {
      const seen = new Set();
      for (const [pid, v] of Object.entries(value || {})) { seen.add(pid); localPut('chart', pid, v); }
      for (const id of [...coll('chart').keys()]) if (!seen.has(id)) localDel('chart', id);
      return;
    }
    if (!ARRAYS.includes(k)) return;
    const seen = new Set();
    for (const item of value || []) {
      if (item == null) continue;
      if (item.id == null) item.id = Store.newId();
      const id = String(item.id); seen.add(id);
      localPut(k, id, item);
    }
    for (const id of [...coll(k).keys()]) if (!seen.has(id)) localDel(k, id);
  },
  /** Recherche rapide sans copie (noms des patients dans les listes). */
  find(k, id) { const r = coll(k).get(String(id)); return r ? parse(r.json) : null; },
  newId() { return Date.now() * 1000 + Math.floor(Math.random() * 1000); },
  getSettings() {
    if (!memo.settings) {
      const clinic = coll('settings').get('clinic'), acts = coll('settings').get('acts');
      memo.settings = JSON.stringify({ ...(clinic ? parse(clinic.json) : {}), ...(acts ? parse(acts.json) : {}) });
    }
    return parse(memo.settings);
  },
  setSettings(d) {
    const { services, cnamCode, ...clinic } = d || {};
    const before = Store.getSettings();
    const actsNew = { services, cnamCode }, actsOld = { services: before.services, cnamCode: before.cnamCode };
    const { services: _s, cnamCode: _c, ...clinicOld } = before;
    if (JSON.stringify(actsNew) !== JSON.stringify(actsOld)) localPut('settings', 'acts', actsNew);
    if (JSON.stringify(clinic) !== JSON.stringify(clinicOld)) localPut('settings', 'clinic', clinic);
    delete memo.settings;
  },
  staff() {
    return S.directory.map(p => {
      const name = p.displayName.replace(/^Dr\.?\s+/i, '');
      const [firstName, ...rest] = name.split(' ');
      return { id: p.id, firstName, lastName: rest.join(' '), role: p.roleLabel || (p.kind === 'admin' ? 'Dentiste' : 'Personnel'), displayName: p.displayName, kind: p.kind };
    });
  },
  pendingWrites: () => pending.size,
};

/* ══════════ Indicateur de synchronisation ══════════ */
let syncState = 'ok';
function setSync(s) {
  if (s === syncState) return; syncState = s;
  const el = document.getElementById('sync-indicator'); if (!el) return;
  el.className = 'sync-indicator ' + s;
  el.title = s === 'ok' ? 'Synchronisé avec le serveur du cabinet' : 'Serveur injoignable : vos modifications partiront dès son retour';
  el.innerHTML = s === 'ok' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-plug-circle-xmark"></i> Hors ligne';
}
const notify = (msg, type = 'info') => (typeof App !== 'undefined' && App.toast) ? App.toast(msg, type) : console.warn(msg);

/* ══════════ Droits ══════════ */
const PAGE_MODULE = {
  dashboard: null, patients: 'patients', 'patient-detail': 'patients', appointments: 'agenda', waiting: 'waiting',
  treatments: 'medical', lab: 'lab', gallery: 'gallery', tasks: 'tasks', payments: 'billing', cash: 'cash',
  acts: 'acts', reports: 'reports', settings: 'settings',
};
const MANAGER_PAGES = ['users', 'journal', 'system'];
function can(module, level = 'view') { return levelOf(S.user, module) >= LEVELS[level]; }
function canPage(page) {
  if (!S.user) return false;
  if (page === 'account') return true;
  if (MANAGER_PAGES.includes(page)) return ['admin', 'superadmin'].includes(S.user.kind);
  if (S.user.kind === 'superadmin') return false;
  if (page === 'dashboard') return true;
  const m = PAGE_MODULE[page];
  if (m === undefined) return false;
  return can(m, page === 'settings' ? 'edit' : 'view');
}
const isDentist = () => !!S.user && S.user.kind !== 'superadmin' && (S.user.kind === 'admin' || /dentist/i.test(S.user.roleLabel || ''));

/* ══════════ Écrans d'accès ══════════ */
const root = () => document.getElementById('auth-root');
function screen(html) {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').style.display = '';
  root().innerHTML = html;
  const first = root().querySelector('input:not([type=hidden]):not([readonly])'); if (first) setTimeout(() => first.focus(), 30);
}
const field = (id, label, type = 'text', extra = '') => `<div class="form-group"><label for="${id}">${label}</label><input id="${id}" type="${type}" ${extra}/></div>`;
const pwFields = (prefix, username = '') => `
  <div class="form-group"><label for="${prefix}-pw">Nouveau mot de passe</label>
    <div class="pass-row"><input id="${prefix}-pw" type="password" autocomplete="new-password" data-user="${esc(username)}"/>
    <button type="button" class="hint-btn" title="Afficher" data-toggle="${prefix}-pw"><i class="fa-solid fa-eye"></i></button></div></div>
  <div class="form-group"><label for="${prefix}-pw2">Confirmer le mot de passe</label><input id="${prefix}-pw2" type="password" autocomplete="new-password"/></div>
  <ul class="pw-rules" id="${prefix}-rules"></ul>
  <button type="button" class="btn-link" data-generate="${prefix}"><i class="fa-solid fa-wand-magic-sparkles"></i> Proposer un mot de passe solide</button>`;
const err = msg => { const el = root().querySelector('.login-error'); if (el) { el.textContent = msg; el.classList.remove('hidden'); } };
const busy = (on, label) => { const b = root().querySelector('button[type=submit]'); if (b) { b.disabled = on; if (label) b.dataset.label ||= b.innerHTML; b.innerHTML = on ? `<i class="fa-solid fa-spinner fa-spin"></i> ${label || ''}` : (b.dataset.label || b.innerHTML); } };

function wirePw(prefix, usernameGetter) {
  const pw = document.getElementById(`${prefix}-pw`), pw2 = document.getElementById(`${prefix}-pw2`), rules = document.getElementById(`${prefix}-rules`);
  const show = () => {
    const r = C.checkPassword(pw.value, usernameGetter());
    const all = ['au moins 12 caractères', 'une majuscule', 'une minuscule', 'un chiffre', 'un symbole (!?@#$%&*…)'];
    rules.innerHTML = all.map(x => `<li class="${pw.value && !r.issues.includes(x) ? 'ok' : ''}"><i class="fa-solid ${pw.value && !r.issues.includes(x) ? 'fa-check' : 'fa-circle'}"></i> ${x}</li>`).join('')
      + r.issues.filter(x => !all.includes(x)).map(x => `<li class="bad"><i class="fa-solid fa-xmark"></i> ${x}</li>`).join('');
  };
  pw.addEventListener('input', show); show();
  root().querySelector(`[data-generate="${prefix}"]`).addEventListener('click', () => {
    const g = C.generatePassword(); pw.value = pw2.value = g; pw.type = 'text'; show();
    notify('Mot de passe proposé : notez-le avant de valider (il ne sera plus affiché).', 'info');
  });
  root().querySelector(`[data-toggle="${prefix}-pw"]`).addEventListener('click', () => { pw.type = pw.type === 'password' ? 'text' : 'password'; });
  return () => {
    const r = C.checkPassword(pw.value, usernameGetter());
    if (!r.ok) throw new Error('Mot de passe trop faible : ' + r.issues.join(', ') + '.');
    if (pw.value !== pw2.value) throw new Error('Les deux mots de passe ne sont pas identiques.');
    return pw.value;
  };
}
const card = (title, sub, body, foot = '') => `
  <div class="login-logo"><div class="login-logo-icon"><i class="fa-solid fa-tooth"></i></div><h1>${title}</h1><p>${sub}</p></div>
  ${body}${foot}`;

function showSetup() {
  screen(card('Installation', 'Création du compte administrateur informatique', `
    <form class="login-form" id="f-setup" autocomplete="off">
      <p class="auth-note">Première mise en service du serveur. Le <b>code d'installation</b> s'affiche dans la fenêtre du serveur (et dans <code>data\\secrets.json</code>).</p>
      ${field('su-token', 'Code d\'installation', 'text', 'autocomplete="off" required')}
      ${field('su-user', 'Identifiant (ex. : talel)', 'text', 'autocapitalize="none" required')}
      ${field('su-name', 'Nom affiché', 'text', 'required placeholder="Talel Ksiksi"')}
      ${pwFields('su', '')}
      <p class="login-error hidden"></p>
      <button type="submit" class="btn-login">Créer le compte <i class="fa-solid fa-arrow-right"></i></button>
    </form>`));
  const getPw = wirePw('su', () => document.getElementById('su-user').value);
  document.getElementById('f-setup').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const password = getPw();
      busy(true, 'Création des clés…');
      const salt = C.newSalt();
      const { authKey, encKey } = await C.deriveKeys(password, salt);
      const r = await api('POST', '/api/setup', { setupToken: v('su-token'), username: v('su-user').toLowerCase(), displayName: v('su-name'), authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS });
      await afterAuth({ ...r, wrappedDek: null, privKeyEnc: null }, encKey);
    } catch (x) { busy(false); err(x.message); }
  });
}
const v = id => document.getElementById(id).value.trim();

function showLogin(message) {
  screen(card('Espace cabinet', 'Dr Nouha Ksiksi · réseau du cabinet', `
    <form class="login-form" id="f-login" autocomplete="on">
      ${field('li-user', '<i class="fa-solid fa-user"></i> Identifiant', 'text', 'autocomplete="username" autocapitalize="none" required')}
      <div class="form-group"><label for="li-pw"><i class="fa-solid fa-lock"></i> Mot de passe</label>
        <div class="pass-row"><input id="li-pw" type="password" autocomplete="current-password" required/>
        <button type="button" class="hint-btn" data-toggle="li-pw" title="Afficher"><i class="fa-solid fa-eye"></i></button></div></div>
      <p class="login-error ${message ? '' : 'hidden'}">${esc(message || '')}</p>
      <button type="submit" class="btn-login">Se connecter <i class="fa-solid fa-arrow-right"></i></button>
      <button type="button" class="btn-link" id="go-invite"><i class="fa-solid fa-key"></i> Première connexion avec un code d'invitation</button>
      ${S.status?.demo ? '<p class="login-hint"><i class="fa-solid fa-flask"></i> Démonstration : données fictives</p>' : '<p class="login-hint"><i class="fa-solid fa-shield-halved"></i> Données chiffrées · accessible uniquement au cabinet</p>'}
    </form>`));
  root().querySelector('[data-toggle="li-pw"]').addEventListener('click', () => { const p = document.getElementById('li-pw'); p.type = p.type === 'password' ? 'text' : 'password'; });
  document.getElementById('go-invite').addEventListener('click', () => showInvite());
  document.getElementById('f-login').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      busy(true, 'Vérification…');
      const username = v('li-user').toLowerCase(), password = document.getElementById('li-pw').value;
      const p = await api('POST', '/api/login/params', { username });
      const { authKey, encKey } = await C.deriveKeys(password, p.kdfSalt, p.kdfIter);
      const r = await api('POST', '/api/login', { username, authKey });
      await afterAuth(r, encKey);
    } catch (x) { busy(false); err(x.message); }
  });
}

function showInvite() {
  screen(card('Activer mon compte', 'Avec le code remis par l\'administrateur', `
    <form class="login-form" id="f-invite" autocomplete="off">
      ${field('iv-user', 'Identifiant', 'text', 'autocapitalize="none" required')}
      ${field('iv-code', 'Code d\'invitation', 'text', 'autocomplete="off" required placeholder="XXXXX-XXXXX-XXXXX-XXXXX"')}
      ${pwFields('iv')}
      <p class="login-error hidden"></p>
      <button type="submit" class="btn-login">Activer <i class="fa-solid fa-arrow-right"></i></button>
      <button type="button" class="btn-link" id="go-login"><i class="fa-solid fa-arrow-left"></i> J'ai déjà un mot de passe</button>
    </form>`));
  const getPw = wirePw('iv', () => document.getElementById('iv-user').value);
  document.getElementById('go-login').addEventListener('click', () => showLogin());
  document.getElementById('f-invite').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const password = getPw();
      const username = v('iv-user').toLowerCase(), code = v('iv-code');
      busy(true, 'Création de vos clés (quelques secondes)…');
      const inviteAuth = await C.inviteAuth(code, username);
      const chk = await api('POST', '/api/invite/check', { username, inviteAuth });
      const salt = C.newSalt();
      const { authKey, encKey } = await C.deriveKeys(password, salt);
      const kp = await C.newUserKeyPair();
      let wrappedDek = null;
      if (chk.inviteDek) wrappedDek = await C.wrapDekFor(await C.unwrapDekFromInvite(chk.inviteDek, code, username), kp.publicJwk);
      const r = await api('POST', '/api/invite/accept', { username, inviteAuth, authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS,
        pubKey: kp.publicJwk, privKeyEnc: await C.lockPrivateKey(kp.privateKey, encKey), wrappedDek });
      await afterAuth(r, encKey);
    } catch (x) { busy(false); err(x.message); }
  });
}

function showUnlock(message) {
  const u = S.sess.user;
  screen(card('Session verrouillée', `${esc(u.displayName)} · ${esc(u.username)}`, `
    <form class="login-form" id="f-unlock">
      <p class="auth-note">${message ? esc(message) : 'Par sécurité, les données ont été retirées de l\'écran. Saisissez votre mot de passe pour reprendre.'}</p>
      <div class="form-group"><label for="ul-pw"><i class="fa-solid fa-lock"></i> Mot de passe</label><input id="ul-pw" type="password" autocomplete="current-password" required/></div>
      <p class="login-error hidden"></p>
      <button type="submit" class="btn-login">Déverrouiller <i class="fa-solid fa-unlock"></i></button>
      <button type="button" class="btn-link" id="ul-out"><i class="fa-solid fa-right-from-bracket"></i> Changer d'utilisateur</button>
    </form>`));
  document.getElementById('ul-out').addEventListener('click', () => logout());
  document.getElementById('f-unlock').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      busy(true, 'Déverrouillage…');
      const { encKey } = await C.deriveKeys(document.getElementById('ul-pw').value, S.sess.kdfSalt, S.sess.kdfIter);
      if (S.sess.privKeyEnc) await C.unlockPrivateKey(S.sess.privKeyEnc, encKey).catch(() => { throw new Error('Mot de passe incorrect.'); });
      else {
        // super-admin (pas de clé privée) : vérification par le serveur
        const p = await api('POST', '/api/login/params', { username: S.sess.user.username });
        const k = await C.deriveKeys(document.getElementById('ul-pw').value, p.kdfSalt, p.kdfIter);
        const r = await api('POST', '/api/login', { username: S.sess.user.username, authKey: k.authKey });
        return afterAuth(r, k.encKey);
      }
      const me = await api('GET', '/api/me');
      await afterAuth(me, encKey);
    } catch (x) { busy(false); err(x.status === 401 ? 'Session expirée : reconnectez-vous.' : x.message); if (x.status === 401) setTimeout(() => showLogin(), 1500); }
  });
}

function showPending() {
  screen(card('Compte activé', 'En attente de l\'accès aux dossiers', `
    <div class="login-form">
      <p class="auth-note"><i class="fa-solid fa-hourglass-half"></i> Votre compte est prêt. L'accès aux dossiers des patients doit être autorisé par le Dr Nouha
      (ou un administrateur du cabinet) depuis son poste. Cela se fait en un clic de son côté.</p>
      <p class="login-error hidden"></p>
      <button type="button" class="btn-login" id="pd-retry"><i class="fa-solid fa-rotate"></i> Vérifier à nouveau</button>
      <button type="button" class="btn-link" id="pd-out"><i class="fa-solid fa-right-from-bracket"></i> Se déconnecter</button>
    </div>`));
  document.getElementById('pd-out').addEventListener('click', () => logout());
  document.getElementById('pd-retry').addEventListener('click', async () => {
    try { const me = await api('GET', '/api/me'); if (me.user.status === 'active') await afterAuth(me, S.encKey); else err('Toujours en attente.'); }
    catch (x) { err(x.message); }
  });
}

function printRecovery(recovery, kind = 'donnees') {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return notify('Autorisez les fenêtres pour imprimer la feuille de secours.', 'warning');
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Feuille de secours — Espace cabinet</title>
    <style>body{font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#111}h1{font-size:22px}
    .k{font:700 26px/1.5 Consolas,monospace;letter-spacing:2px;border:3px solid #16325c;padding:18px;text-align:center;margin:20px 0;word-break:break-all}
    li{margin:6px 0}.w{background:#fff4e5;border-left:5px solid #c9a24b;padding:10px 14px}</style>
    <h1>Feuille de secours — Espace cabinet Dr Nouha Ksiksi</h1>
    <p>${kind === 'donnees' ? 'Clé de secours des <b>données des patients</b>' : 'Clé de <b>sauvegarde</b>'} · créée le ${today}</p>
    <div class="k">${esc(recovery)}</div>
    <div class="w"><b>À conserver sous clé, au cabinet.</b> Ne pas photographier, ne pas envoyer par message.</div>
    <ul>${kind === 'donnees'
      ? '<li>Elle permet de retrouver l\'accès à tous les dossiers si plus aucun administrateur ne connaît son mot de passe.</li><li>Sans cette feuille et sans mot de passe, les données sont <b>définitivement illisibles</b>.</li>'
      : '<li>Elle permet de restaurer une sauvegarde sur un autre ordinateur (avec la clé de secours des données).</li>'}
    </ul><script>window.print()<\/script>`);
  w.document.close();
}

function showBootstrap() {
  screen(card('Clé des données', 'Première mise en service des dossiers', `
    <div class="login-form">
      <p class="auth-note">Vous êtes le premier administrateur du cabinet. L'application va créer la <b>clé qui chiffre tous les dossiers</b>,
      ainsi qu'une <b>clé de secours</b> à imprimer et à garder sous clé au cabinet.</p>
      <p class="login-error hidden"></p>
      <button type="button" class="btn-login" id="bs-go"><i class="fa-solid fa-key"></i> Créer la clé des données</button>
    </div>`));
  document.getElementById('bs-go').addEventListener('click', async () => {
    try {
      const dek = await C.newDek(), recovery = C.newRecoveryKey();
      screen(card('Clé de secours', 'À imprimer maintenant', `
        <div class="login-form">
          <div class="recovery-key">${esc(recovery)}</div>
          <p class="auth-note"><b>Imprimez cette feuille et rangez-la sous clé au cabinet.</b> Sans elle et sans mot de passe, les dossiers seraient définitivement perdus.</p>
          <button type="button" class="btn-secondary wide" id="bs-print"><i class="fa-solid fa-print"></i> Imprimer la feuille de secours</button>
          <label class="check-line"><input type="checkbox" id="bs-ok"/> J'ai imprimé la feuille et je la range en lieu sûr</label>
          <p class="login-error hidden"></p>
          <button type="button" class="btn-login" id="bs-confirm" disabled>Terminer <i class="fa-solid fa-arrow-right"></i></button>
        </div>`));
      document.getElementById('bs-print').addEventListener('click', () => printRecovery(recovery));
      document.getElementById('bs-ok').addEventListener('change', e => { document.getElementById('bs-confirm').disabled = !e.target.checked; });
      document.getElementById('bs-confirm').addEventListener('click', async () => {
        try {
          const r = await api('POST', '/api/keys/bootstrap', { wrappedDek: await C.wrapDekFor(dek, S.sess.pubKey), recoveryDek: await C.wrapDekWithRecovery(dek, recovery) });
          await afterAuth(r, S.encKey);
        } catch (x) { err(x.message); }
      });
    } catch (x) { err(x.message); }
  });
}

function showRecovery() {
  screen(card('Retrouver l\'accès', 'Avec la feuille de secours', `
    <form class="login-form" id="f-rec">
      <p class="auth-note">Votre compte a été réinitialisé. Saisissez la <b>clé de secours</b> imprimée lors de la mise en service,
      ou demandez à un autre administrateur du cabinet de vous autoriser depuis son poste.</p>
      ${field('rc-key', 'Clé de secours', 'text', 'autocomplete="off" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"')}
      <p class="login-error hidden"></p>
      <button type="submit" class="btn-login">Retrouver l'accès <i class="fa-solid fa-unlock"></i></button>
      <button type="button" class="btn-link" id="rc-wait"><i class="fa-solid fa-hourglass-half"></i> Attendre l'autorisation d'un administrateur</button>
    </form>`));
  document.getElementById('rc-wait').addEventListener('click', () => showPending());
  document.getElementById('f-rec').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      busy(true, 'Vérification…');
      const { recoveryDek } = await api('GET', '/api/keys/recovery');
      const dek = await C.unwrapDekWithRecovery(recoveryDek, v('rc-key')).catch(() => { throw new Error('Clé de secours incorrecte.'); });
      const r = await api('POST', '/api/keys/self', { wrappedDek: await C.wrapDekFor(dek, S.sess.pubKey) });
      await afterAuth(r, S.encKey);
    } catch (x) { busy(false); err(x.message); }
  });
}

function showForcedPassword() {
  screen(card('Nouveau mot de passe', 'Renouvellement périodique (tous les 6 mois)', `
    <form class="login-form" id="f-fp">
      <p class="auth-note">Votre mot de passe a plus de 6 mois. Le guide de l'INPDP demande de le renouveler régulièrement.</p>
      <div class="form-group"><label for="fp-cur">Mot de passe actuel</label><input id="fp-cur" type="password" autocomplete="current-password" required/></div>
      ${pwFields('fp', S.sess.user.username)}
      <p class="login-error hidden"></p>
      <button type="submit" class="btn-login">Enregistrer <i class="fa-solid fa-arrow-right"></i></button>
    </form>`));
  const getPw = wirePw('fp', () => S.sess.user.username);
  document.getElementById('f-fp').addEventListener('submit', async e => {
    e.preventDefault();
    try { busy(true, 'Enregistrement…'); await changePassword(document.getElementById('fp-cur').value, getPw()); const me = await api('GET', '/api/me'); await afterAuth(me, S.encKey); }
    catch (x) { busy(false); err(x.message); }
  });
}

/* ══════════ Après authentification ══════════ */
async function afterAuth(sess, encKey) {
  S.sess = sess; S.user = sess.user; S.encKey = encKey;
  const u = sess.user;
  if (u.kind !== 'superadmin') {
    if (u.status === 'pending_key') {
      if (u.kind === 'admin' && !sess.dataKeyReady) return showBootstrap();
      if (u.kind === 'admin') return showRecovery();
      return showPending();
    }
    S.privateKey = await C.unlockPrivateKey(sess.privKeyEnc, encKey);
    S.dek = await C.unwrapDek(sess.wrappedDek, S.privateKey);
  }
  if (sess.mustChangePassword) return showForcedPassword();
  root().innerHTML = card('Espace cabinet', 'Ouverture…', '<div class="login-form"><p class="auth-note"><i class="fa-solid fa-spinner fa-spin"></i> Déchiffrement des dossiers…</p></div>');
  if (S.dek) {
    S.directory = (await api('GET', '/api/directory')).people;
    cursor = 0; await pull(true);
  }
  enterApp();
}

let pollTimer = null, idleTimer = null, lastActivity = Date.now(), backupTimer = null;
function enterApp() {
  S.locked = false;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  App.startSession(S.user);
  clearInterval(pollTimer); clearInterval(idleTimer); clearInterval(backupTimer);
  if (S.dek) pollTimer = setInterval(async () => {
    try {
      const changed = await pull();
      if (Math.random() < 0.1) S.directory = (await api('GET', '/api/directory')).people;
      if (changed) onRemoteChange();
    } catch (e) { if (e.status === 401) lock('expired'); else setSync('offline'); }
  }, POLL_MS);
  idleTimer = setInterval(() => { if (Date.now() - lastActivity > IDLE_LOCK_MS) lock('idle'); }, 20e3);
  refreshBackupBanner(); backupTimer = setInterval(refreshBackupBanner, 5 * 60e3);
  if (S.user.kind === 'admin' && S.dek) autoGrant();
}
for (const ev of ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']) addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true, capture: true });

function wipe() {
  S.dek = null; S.privateKey = null; S.encKey = null; S.directory = [];
  for (const k of Object.keys(recs)) recs[k].clear();
  for (const k of Object.keys(memo)) delete memo[k];
  cursor = 0;
  clearInterval(pollTimer); clearInterval(idleTimer); clearInterval(backupTimer);
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  document.getElementById('modal-overlay')?.classList.add('hidden');
}
async function lock(reason) {
  if (S.locked) return;
  if (pending.size && reason === 'idle') { await runQueue(); }
  S.locked = true;
  wipe();
  if (reason === 'expired') return showLogin('Session expirée : reconnectez-vous.');
  showUnlock(reason === 'idle' ? 'Verrouillage automatique après 30 minutes sans activité.' : null);
}
async function logout() {
  try { if (pending.size) await runQueue(); await api('POST', '/api/logout'); } catch {}
  S.locked = true; wipe(); S.user = null; S.sess = null;
  showLogin();
}

/* Les comptes créés par cet administrateur reçoivent la clé automatiquement ; les autres attendent un clic. */
async function autoGrant() {
  try {
    const { pending: list } = await api('GET', '/api/keys/pending');
    S.pendingAccess = list;
    for (const p of list.filter(p => p.createdBy === S.user.id)) await grant(p.id, p.pubKey, true);
    if (typeof Admin !== 'undefined') Admin.renderPendingBanner();
  } catch {}
}
async function grant(userId, pubKey, silent) {
  await api('POST', '/api/keys/grant', { userId, wrappedDek: await C.wrapDekFor(S.dek, pubKey) });
  S.pendingAccess = (S.pendingAccess || []).filter(p => p.id !== userId);
  S.directory = (await api('GET', '/api/directory')).people;
  if (!silent) notify('Accès aux dossiers autorisé.', 'success');
}

/* ══════════ Sauvegardes : rappel du mardi ══════════ */
async function refreshBackupBanner() {
  try {
    const st = await api('GET', '/api/backup/status');
    S.backup = st;
    const el = document.getElementById('usb-banner');
    if (el) el.classList.toggle('hidden', !st.usbDue);
  } catch {}
}

/* ══════════ Actions d'administration ══════════ */
async function changePassword(current, next) {
  const cur = await C.deriveKeys(current, S.sess.kdfSalt, S.sess.kdfIter);
  const salt = C.newSalt();
  const nk = await C.deriveKeys(next, salt);
  let privKeyEnc = null;
  if (S.sess.privKeyEnc) {
    const priv = await C.unlockPrivateKey(S.sess.privKeyEnc, cur.encKey).catch(() => { throw new Error('Mot de passe actuel incorrect.'); });
    privKeyEnc = await C.lockPrivateKey(priv, nk.encKey);
  }
  await api('POST', '/api/password', { currentAuthKey: cur.authKey, authKey: nk.authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS, privKeyEnc });
  S.encKey = nk.encKey;
  S.sess = { ...S.sess, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS, privKeyEnc: privKeyEnc || S.sess.privKeyEnc, mustChangePassword: false };
}
async function inviteFor(username) {
  const code = C.newInviteCode();
  const inviteAuth = await C.inviteAuth(code, username);
  const inviteDek = S.dek ? await C.wrapDekForInvite(S.dek, code, username) : null;
  return { code, inviteAuth, inviteDek };
}
async function createUser(data) {
  const username = data.username.toLowerCase();
  const inv = await inviteFor(username);
  const r = await api('POST', '/api/users', { ...data, username, inviteAuth: inv.inviteAuth, inviteDek: inv.inviteDek });
  return { user: r.user, code: inv.code, withKey: !!inv.inviteDek };
}
async function resetUser(user) {
  const inv = await inviteFor(user.username);
  const r = await api('POST', `/api/users/${user.id}/reset`, { inviteAuth: inv.inviteAuth, inviteDek: inv.inviteDek });
  return { user: r.user, code: inv.code, withKey: !!inv.inviteDek };
}
async function nextSeq(name) { return api('POST', `/api/seq/${name}`); }

/* ══════════ Démarrage ══════════ */
async function start() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-toggle]'); if (b && root()?.contains(b)) { const i = document.getElementById(b.dataset.toggle); if (i) i.type = i.type === 'password' ? 'text' : 'password'; }
  });
  onRemoteChange = () => {
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    const modalOpen = document.querySelector('.modal[style*="flex"]');
    if (!typing && !modalOpen) App.refreshCurrent(); else App.updateBadges();
  };
  try { S.status = await api('GET', '/api/status'); }
  catch (x) { screen(card('Espace cabinet', 'Serveur injoignable', `<div class="login-form"><p class="login-error">${esc(x.message)}</p><button class="btn-login" onclick="location.reload()">Réessayer</button></div>`)); return; }
  if (S.status.setupNeeded) return showSetup();
  try { S.sess = await api('GET', '/api/me'); S.user = S.sess.user; showUnlock('Session en cours : saisissez votre mot de passe pour déverrouiller.'); }
  catch { showLogin(); }
}

window.CabinetStore = Store;
window.Secure = {
  get user() { return S.user; }, get directory() { return S.directory; }, get backup() { return S.backup; },
  get pendingAccess() { return S.pendingAccess || []; }, get hasDataKey() { return !!S.dek; }, get demo() { return !!S.status?.demo; },
  api, can, canPage, isDentist, logout, lock: () => lock('manual'), changePassword, createUser, resetUser, grant, nextSeq,
  refreshBackupBanner, printRecovery, autoGrant, MODULES, PRESETS, checkPassword: C.checkPassword, generatePassword: C.generatePassword,
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
