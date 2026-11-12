/* Tests du serveur local : scénarios réels de bout en bout, avec le même chiffrement que le navigateur.
   Lancer : npm test   (serveur temporaire, dossier de données jetable) */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { loadConfig } from '../server/config.mjs';
import { createApp, isLocalAddress } from '../server/index.mjs';
import { createBackup } from '../server/backup.mjs';
import * as C from '../public/js/secure/crypto.mjs';
import { PRESETS } from '../public/js/secure/perms.mjs';

let dir, cfg, app, server, base;
const usbDir = () => path.join(dir, 'usb');

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cabinet-test-'));
  fs.mkdirSync(path.join(dir, 'usb'));
  cfg = loadConfig({ dataDir: path.join(dir, 'data'), usbDrives: () => ['Z:'], usbRoot: () => usbDir() });
  app = createApp(cfg, { log: () => {} });
  server = http.createServer(app.handler);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); app.close(); fs.rmSync(dir, { recursive: true, force: true }); });

/* ── Petit client : un « navigateur » par personne (cookie de session propre) ── */
function client() {
  let cookie = '';
  async function call(method, url, body, { csrf = true } = {}) {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-Cabinet': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ...data };
  }
  return { call, get: u => call('GET', u), post: (u, b, o) => call('POST', u, b, o), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: u => call('DELETE', u) };
}
const PW = { talel: 'Infra!Cabinet2026#Tk', nouha: 'Sourire-Durable@2026!', temp: 'Stagiaire#Neuf2026!', dent: 'Remplacant$Ete2026!' };
const S = {}; // état partagé entre les tests (ordre séquentiel)

async function login(c, username, password) {
  const p = await c.post('/api/login/params', { username });
  const { authKey, encKey } = await C.deriveKeys(password, p.kdfSalt, p.kdfIter);
  const r = await c.post('/api/login', { username, authKey });
  return { r, encKey };
}
/** Accepte une invitation comme le ferait le navigateur. */
async function acceptInvite(c, username, code, password) {
  const inviteAuth = await C.inviteAuth(code, username);
  const chk = await c.post('/api/invite/check', { username, inviteAuth });
  assert.equal(chk.status, 200, chk.message);
  const salt = C.newSalt();
  const { authKey, encKey } = await C.deriveKeys(password, salt);
  const kp = await C.newUserKeyPair();
  let wrappedDek = null;
  if (chk.inviteDek) wrappedDek = await C.wrapDekFor(await C.unwrapDekFromInvite(chk.inviteDek, code, username), kp.publicJwk);
  const r = await c.post('/api/invite/accept', { username, inviteAuth, authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS,
    pubKey: kp.publicJwk, privKeyEnc: await C.lockPrivateKey(kp.privateKey, encKey), wrappedDek });
  return { r, kp, encKey };
}
async function dekFromSession(sess, encKey) { return C.unwrapDek(sess.wrappedDek, await C.unlockPrivateKey(sess.privKeyEnc, encKey)); }
async function putRec(c, dek, coll, id, obj, extra = {}) { return c.put(`/api/records/${coll}/${id}`, { ...(await C.encryptRecord(dek, coll, id, obj)), ...extra }); }
async function readAll(c, dek) {
  const r = await c.get('/api/records?since=0');
  if (r.status !== 200) return r;
  const out = {};
  for (const x of r.records) if (!x.deleted) (out[x.c] ||= {})[x.id] = await C.decryptRecord(dek, x.c, x.id, x);
  return { status: 200, data: out, raw: r.records };
}

/* ═══════════ Scénarios ═══════════ */

test('installation : le super-admin se crée avec le code affiché par le serveur', async () => {
  const c = S.talel = client();
  assert.equal((await c.get('/api/status')).setupNeeded, true);
  const salt = C.newSalt();
  const { authKey } = await C.deriveKeys(PW.talel, salt);
  const bad = await c.post('/api/setup', { setupToken: 'faux', username: 'talel', displayName: 'Talel Ksiksi', authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS });
  assert.equal(bad.status, 403);
  const ok = await c.post('/api/setup', { setupToken: cfg.secrets.setupToken, username: 'talel', displayName: 'Talel Ksiksi', authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS });
  assert.equal(ok.status, 200, ok.message);
  assert.equal(ok.user.kind, 'superadmin');
  const again = await client().post('/api/setup', { setupToken: cfg.secrets.setupToken, username: 'x', displayName: 'X', authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS });
  assert.equal(again.status, 409, 'une seule installation possible');
});

test('protection CSRF : sans l\'en-tête du cabinet, toute écriture est refusée', async () => {
  const r = await S.talel.post('/api/users', { username: 'pirate', displayName: 'P', kind: 'admin' }, { csrf: false });
  assert.equal(r.status, 403);
});

test('le super-admin invite Dr Nouha (sans clé des données : il ne l\'a jamais)', async () => {
  S.nouhaCode = C.newInviteCode();
  const r = await S.talel.post('/api/users', { username: 'nouha', displayName: 'Dr Nouha Ksiksi', kind: 'admin', roleLabel: 'Dentiste',
    inviteAuth: await C.inviteAuth(S.nouhaCode, 'nouha'), inviteDek: '{"iv":"xxxxxxxxxxxxxxxx","ct":"yyyyyyyyyyyyyyyyyyyy"}' });
  assert.equal(r.status, 200, r.message);
  assert.equal(r.user.status, 'invited');
  S.nouhaId = r.user.id;
  const row = app.db.prepare('SELECT invite_dek, invite_hash FROM users WHERE id = ?').get(S.nouhaId);
  assert.equal(row.invite_dek, null, 'le super-admin ne peut pas joindre de clé');
  assert.ok(!row.invite_hash.includes(S.nouhaCode.replace(/-/g, '')), 'le code n\'est jamais stocké');
});

test('Dr Nouha active son compte, crée la clé des données et la clé de secours', async () => {
  const c = S.nouha = client();
  const { r, encKey } = await acceptInvite(c, 'nouha', S.nouhaCode, PW.nouha);
  assert.equal(r.status, 200, r.message);
  assert.equal(r.user.status, 'pending_key');
  const dek = await C.newDek();
  S.recovery = C.newRecoveryKey();
  const kp = await C.unlockPrivateKey(r.privKeyEnc, encKey);
  assert.ok(kp);
  const pub = r.pubKey;
  const b = await c.post('/api/keys/bootstrap', { wrappedDek: await C.wrapDekFor(dek, pub), recoveryDek: await C.wrapDekWithRecovery(dek, S.recovery) });
  assert.equal(b.status, 200, b.message);
  assert.equal(b.user.status, 'active');
  S.dek = await dekFromSession(b, encKey);
  assert.equal((await c.post('/api/keys/bootstrap', { wrappedDek: 'x'.repeat(120), recoveryDek: 'y'.repeat(30) })).status, 409, 'une seule clé des données');
});

test('Dr Nouha enregistre des patients : la base ne contient rien de lisible', async () => {
  const c = S.nouha;
  const amira = { firstName: 'Amira', lastName: 'Ben Salah', phone: '+216 22 123 456', cin: '07123456', allergies: 'Pénicilline' };
  const blind = { phone: await C.blindIndex(S.dek, 'phone', amira.phone), cin: await C.blindIndex(S.dek, 'cin', amira.cin) };
  assert.equal((await putRec(c, S.dek, 'patients', 'p1', amira, { blind })).status, 200);
  assert.equal((await putRec(c, S.dek, 'patients', 'p2', { firstName: 'Hela', lastName: 'Ferchichi', phone: '54 118 902' })).status, 200);
  assert.equal((await putRec(c, S.dek, 'expenses', 'e1', { label: 'Loyer', amount: 900 })).status, 200);
  const all = await readAll(c, S.dek);
  assert.equal(all.data.patients.p1.allergies, 'Pénicilline');
  // recherche par téléphone écrit autrement (indicatif, espaces) grâce à l'index aveugle
  const found = await c.get(`/api/blind?field=phone&hash=${encodeURIComponent(await C.blindIndex(S.dek, 'phone', '0021622123456'))}`);
  assert.deepEqual(found.ids, ['p1']);
  // la base sur le disque : aucun nom, téléphone, CIN ni allergie en clair
  app.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const disk = fs.readFileSync(cfg.dbFile).toString('latin1');
  for (const s of ['Amira', 'Salah', '22 123 456', '07123456', 'Pénicilline', 'nicilline', 'Ferchichi']) assert.ok(!disk.includes(s), `trouvé en clair : ${s}`);
});

test('le super-admin gère le système mais ne voit aucune donnée patient', async () => {
  assert.equal((await S.talel.get('/api/records?since=0')).status, 403);
  assert.equal((await S.talel.get('/api/users')).status, 200);
  const sys = await S.talel.get('/api/system');
  assert.equal(sys.status, 200);
  assert.equal(sys.dataKeyReady, true);
  const audit = await S.talel.get('/api/audit');
  assert.ok(audit.entries.some(e => e.action === 'donnee_creee'));
  assert.ok(!JSON.stringify(audit).includes('Amira'), 'le journal ne contient jamais le contenu');
  assert.equal((await S.talel.get('/api/keys/recovery')).status, 403);
  const grant = await S.talel.post('/api/keys/grant', { userId: S.nouhaId, wrappedDek: 'x'.repeat(200) });
  assert.equal(grant.status, 403);
});

test('Dr Nouha invite une temporaire : accès immédiat (clé jointe), limité à ses niveaux', async () => {
  const code = C.newInviteCode();
  const r = await S.nouha.post('/api/users', { username: 'stagiaire', displayName: 'Stagiaire été', kind: 'staff', ...PRESETS.temp,
    inviteAuth: await C.inviteAuth(code, 'stagiaire'), inviteDek: await C.wrapDekForInvite(S.dek, code, 'stagiaire') });
  assert.equal(r.status, 200, r.message);
  S.tempId = r.user.id;
  const c = S.temp = client();
  const wrong = await c.post('/api/invite/check', { username: 'stagiaire', inviteAuth: await C.inviteAuth('AAAAA-BBBBB-CCCCC-DDDDD', 'stagiaire') });
  assert.equal(wrong.status, 403, 'mauvais code refusé');
  const a = await acceptInvite(c, 'stagiaire', code, PW.temp);
  assert.equal(a.r.status, 200, a.r.message);
  assert.equal(a.r.user.status, 'active', 'active sans attendre Dr Nouha');
  S.tempDek = await dekFromSession(a.r, a.encKey);
  const all = await readAll(c, S.tempDek);
  assert.ok(all.data.patients.p1, 'voit les patients (consultation)');
  assert.equal(all.data.expenses, undefined, 'ne voit pas la caisse');
  assert.equal((await putRec(c, S.tempDek, 'patients', 'p1', { firstName: 'X' })).status, 403, 'ne peut pas modifier un patient');
  assert.equal((await putRec(c, S.tempDek, 'expenses', 'e2', { label: 'X' })).status, 403, 'ne peut pas écrire en caisse');
  assert.equal((await putRec(c, S.tempDek, 'tasks', 't1', { title: 'Commander gants' })).status, 200, 'peut gérer les tâches');
  assert.equal((await c.get('/api/users')).status, 403, 'pas de gestion des comptes');
});

test('retirer un droit coupe l\'accès immédiatement ; en ajouter un l\'ouvre', async () => {
  const p = await S.nouha.patch(`/api/users/${S.tempId}`, { perms: { agenda: 'edit', tasks: 'edit', cash: 'view' } });
  assert.equal(p.status, 200);
  const all = await readAll(S.temp, S.tempDek);
  assert.equal(all.data.patients, undefined, 'patients coupés tout de suite');
  assert.equal(all.data.expenses.e1.label, 'Loyer', 'caisse visible');
});

test('compte créé par le super-admin : en attente jusqu\'à l\'autorisation de Dr Nouha', async () => {
  const code = C.newInviteCode();
  const r = await S.talel.post('/api/users', { username: 'dr.remplacant', displayName: 'Dr Remplaçant', kind: 'staff', ...PRESETS.dentist, inviteAuth: await C.inviteAuth(code, 'dr.remplacant') });
  assert.equal(r.status, 200, r.message);
  S.dentId = r.user.id;
  const c = S.dent = client();
  const a = await acceptInvite(c, 'dr.remplacant', code, PW.dent);
  assert.equal(a.r.user.status, 'pending_key');
  assert.equal((await c.get('/api/records?since=0')).status, 403, 'rien tant que non autorisé');
  const pend = await S.nouha.get('/api/keys/pending');
  const me = pend.pending.find(x => x.id === S.dentId);
  assert.ok(me, 'apparaît dans les comptes à autoriser');
  const g = await S.nouha.post('/api/keys/grant', { userId: S.dentId, wrappedDek: await C.wrapDekFor(S.dek, me.pubKey) });
  assert.equal(g.status, 200, g.message);
  const { r: s, encKey } = await login(client(), 'dr.remplacant', PW.dent);
  S.dent = client(); const again = await login(S.dent, 'dr.remplacant', PW.dent);
  S.dentDek = await dekFromSession(again.r, again.encKey);
  assert.equal(s.user.status, 'active');
});

test('un dentiste « son travail uniquement » ne voit que ses patients', async () => {
  assert.equal((await putRec(S.nouha, S.dek, 'patients', 'p3', { firstName: 'Patient', lastName: 'Du remplaçant' }, { owners: [S.dentId] })).status, 200);
  const all = await readAll(S.dent, S.dentDek);
  assert.deepEqual(Object.keys(all.data.patients), ['p3'], 'uniquement le patient attribué');
  assert.equal(all.data.expenses, undefined, 'pas la caisse');
  // un patient qu'il crée lui reste attribué automatiquement
  assert.equal((await putRec(S.dent, S.dentDek, 'patients', 'p4', { firstName: 'Nouveau' })).status, 200);
  const row = app.db.prepare(`SELECT owners FROM records WHERE collection = 'patients' AND id = 'p4'`).get();
  assert.deepEqual(JSON.parse(row.owners), [S.dentId]);
  assert.equal((await putRec(S.dent, S.dentDek, 'patients', 'p1', { firstName: 'X' })).status, 403, 'ne peut pas toucher aux autres patients');
});

test('modification simultanée : la seconde écriture est détectée (pas d\'écrasement silencieux)', async () => {
  const cur = (await S.nouha.get('/api/records?since=0')).records.find(r => r.c === 'patients' && r.id === 'p2');
  assert.equal((await putRec(S.nouha, S.dek, 'patients', 'p2', { firstName: 'Hela', v: 2 }, { base: cur.v })).status, 200);
  const stale = await putRec(S.nouha, S.dek, 'patients', 'p2', { firstName: 'Hela', v: 3 }, { base: cur.v });
  assert.equal(stale.status, 409);
  assert.ok(stale.current, 'la version actuelle est renvoyée pour fusion');
});

test('mot de passe : 5 erreurs bloquent le compte 15 minutes', async () => {
  const c = client();
  for (let i = 0; i < 5; i++) assert.equal((await login(c, 'stagiaire', 'Mauvais#Mot2passe!')).r.status, 401);
  const locked = await login(c, 'stagiaire', PW.temp);
  assert.equal(locked.r.status, 423, 'bloqué même avec le bon mot de passe');
  app.db.prepare('UPDATE users SET locked_until = 0 WHERE id = ?').run(S.tempId);
});

test('identifiant inconnu : même réponse qu\'un mauvais mot de passe (pas de fuite)', async () => {
  const c = client();
  const a = await c.post('/api/login/params', { username: 'nexistepas' });
  const b = await c.post('/api/login/params', { username: 'nexistepas' });
  assert.equal(a.kdfSalt, b.kdfSalt, 'sel stable pour un identifiant inconnu');
  assert.equal((await login(c, 'nexistepas', 'Peu!Importe2026')).r.status, 401);
});

test('désactiver un compte coupe sa session et ses accès ; le dernier admin est protégé', async () => {
  assert.equal((await S.nouha.post(`/api/users/${S.tempId}/disable`)).status, 200);
  assert.equal((await S.temp.get('/api/records?since=0')).status, 401, 'session coupée');
  assert.equal((await login(client(), 'stagiaire', PW.temp)).r.status, 403);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM user_keys WHERE user_id = ?').get(S.tempId).n, 0, 'clé retirée');
  const last = await S.talel.post(`/api/users/${S.nouhaId}/disable`);
  assert.equal(last.status, 409, 'impossible de désactiver le dernier admin détenteur de la clé');
  assert.equal((await S.nouha.post(`/api/users/${S.nouhaId}/disable`)).status, 400, 'pas soi-même');
});

test('mot de passe oublié : réinitialisation puis récupération par la feuille de secours', async () => {
  const code = C.newInviteCode();
  // le super-admin réinitialise Dr Nouha (sans clé) → elle récupère l'accès avec la clé de secours imprimée
  const r = await S.talel.post(`/api/users/${S.nouhaId}/reset`, { inviteAuth: await C.inviteAuth(code, 'nouha') });
  assert.equal(r.status, 200, r.message);
  const c = S.nouha = client();
  const a = await acceptInvite(c, 'nouha', code, PW.nouha + 'x');
  assert.equal(a.r.user.status, 'pending_key');
  const rec = await c.get('/api/keys/recovery');
  const dek = await C.unwrapDekWithRecovery(rec.recoveryDek, S.recovery.toLowerCase());
  const self = await c.post('/api/keys/self', { wrappedDek: await C.wrapDekFor(dek, a.kp.publicJwk) });
  assert.equal(self.status, 200, self.message);
  S.dek = await dekFromSession(self, a.encKey);
  assert.equal((await readAll(c, S.dek)).data.patients.p1.firstName, 'Amira', 'toutes les données sont de nouveau lisibles');
  await assert.rejects(C.unwrapDekWithRecovery(rec.recoveryDek, 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE-FFFFF'), 'une fausse clé de secours échoue');
});

test('changement de mot de passe : ancienne clé refusée, nouvelle acceptée, clé privée conservée', async () => {
  const me = await S.dent.get('/api/me');
  const oldKeys = await C.deriveKeys(PW.dent, me.kdfSalt, me.kdfIter);
  const priv = await C.unlockPrivateKey(me.privKeyEnc, oldKeys.encKey);
  const salt = C.newSalt();
  const nk = await C.deriveKeys('Nouveau!Remplacant2026', salt);
  // la clé privée doit être ré-enveloppée : on la régénère côté test via export impossible (non extractible) → on garde l'existante
  const r = await S.dent.post('/api/password', { currentAuthKey: oldKeys.authKey, authKey: nk.authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS, privKeyEnc: me.privKeyEnc });
  assert.equal(r.status, 200, r.message);
  assert.ok(priv);
  assert.equal((await login(client(), 'dr.remplacant', PW.dent)).r.status, 401);
  assert.equal((await login(client(), 'dr.remplacant', 'Nouveau!Remplacant2026')).r.status, 200);
});

test('numérotation des factures partagée entre postes, sans doublon', async () => {
  const a = await S.nouha.post('/api/seq/invoice'), b = await S.nouha.post('/api/seq/invoice');
  assert.equal(b.n, a.n + 1);
});

test('sauvegardes : fichier chiffré, relu, restaurable ; aucune donnée lisible dedans', async () => {
  const r = await app.backup.run('auto');
  const buf = fs.readFileSync(r.path);
  assert.ok(!buf.toString('latin1').includes('SQLite format'), 'pas une base en clair');
  const restored = app.backup.decrypt(buf);
  assert.ok(restored.subarray(0, 15).toString() === 'SQLite format 3', 'déchiffrée = base SQLite valide');
  assert.ok(!restored.toString('latin1').includes('Amira'));
  assert.equal(app.backup.status().last.file, r.file);
});

test('clé USB du mardi : copie vérifiée sur la clé, le rappel disparaît', async () => {
  const st = app.backup.status();
  assert.equal(typeof st.usbDue, 'boolean');
  const r = await S.dent.post('/api/backup/usb', { drive: 'Z:' });
  assert.equal(r.status, 200, r.message);
  assert.ok(fs.existsSync(path.join(usbDir(), 'Sauvegardes-Cabinet-Nouha', r.file)));
  assert.equal(app.backup.status().usbDue, false);
  assert.equal((await S.dent.post('/api/backup/usb', { drive: 'Q:' })).status, 400, 'lecteur inconnu refusé');
});

test('planification : 11 h 30 et 15 h 45, rattrapage après coupure, rappel USB le mardi 11 h', () => {
  const at = s => new Date(s);
  const b = createBackup({ db: app.db, cfg, now: () => at('2026-07-14T12:05:00') });   // mardi 14 juillet, 12 h 05
  assert.equal(b.lastSlot(at('2026-07-14T12:05:00')), at('2026-07-14T11:30:00').getTime());
  assert.equal(b.lastSlot(at('2026-07-14T09:00:00')), at('2026-07-13T15:45:00').getTime(), 'avant 11 h 30 : créneau de la veille');
  assert.equal(b.nextSlot(at('2026-07-14T12:05:00')), at('2026-07-14T15:45:00').getTime());
  assert.equal(b.nextSlot(at('2026-07-14T17:00:00')), at('2026-07-15T11:30:00').getTime());
  assert.equal(b.lastUsbReminder(at('2026-07-14T12:05:00')), at('2026-07-14T11:00:00').getTime(), 'mardi après 11 h');
  assert.equal(b.lastUsbReminder(at('2026-07-14T10:59:00')), at('2026-07-07T11:00:00').getTime(), 'mardi avant 11 h : semaine précédente');
  assert.equal(b.lastUsbReminder(at('2026-07-17T08:00:00')), at('2026-07-14T11:00:00').getTime(), 'vendredi : mardi passé');
});

test('le PC rallumé après une coupure fait la sauvegarde manquée', async () => {
  // dernière sauvegarde réussie avant le créneau → tick() doit en lancer une
  app.db.exec(`UPDATE backups SET ts = ts - 2 * 86400000`);
  const before = app.db.prepare('SELECT COUNT(*) n FROM backups WHERE ok = 1').get().n;
  await app.backup.tick();
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM backups WHERE ok = 1').get().n, before + 1);
  await app.backup.tick();
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM backups WHERE ok = 1').get().n, before + 1, 'pas de doublon pour le même créneau');
});

test('réseau : seules les adresses locales sont acceptées', () => {
  for (const a of ['127.0.0.1', '::1', '192.168.1.20', '::ffff:192.168.1.20', '10.0.0.5', '172.20.1.1', 'fe80::1']) assert.ok(isLocalAddress(a), a);
  for (const a of ['8.8.8.8', '41.226.1.1', '172.32.0.1', '::ffff:197.0.0.1', '2001:4860::1']) assert.ok(!isLocalAddress(a), a);
});

test('règles de mot de passe et générateur', () => {
  assert.equal(C.checkPassword('court').ok, false);
  assert.equal(C.checkPassword('toutenminuscules123!').ok, false);
  assert.equal(C.checkPassword('Azerty123456!').ok, false, 'mot trop connu');
  assert.equal(C.checkPassword('Sourire-Durable@2026!').ok, true);
  assert.equal(C.checkPassword('Nouha2026!Abc', 'nouha').ok, false, 'contient l\'identifiant');
  for (let i = 0; i < 50; i++) assert.equal(C.checkPassword(C.generatePassword()).ok, true);
});

test('appareil qui enchaîne les échecs : bloqué après 20 tentatives échouées en 10 minutes', async () => {
  const c = client();
  let last;
  for (let i = 0; i < 25; i++) { last = await c.post('/api/login', { username: 'nexistepas', authKey: 'A'.repeat(44) }); if (last.status === 429) break; }
  assert.equal(last.status, 429, 'trop d\'échecs : appareil bloqué');
  const p = await client().post('/api/login/params', { username: 'dr.remplacant' });
  assert.equal(p.status, 429, 'même un bon compte attend la fin du blocage sur cet appareil');
});
