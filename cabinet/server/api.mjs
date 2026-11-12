/* ═══════════════════════════════════════════
   Espace cabinet — API locale
   Le serveur ne voit jamais un mot de passe, une clé de données ni un dossier patient en clair :
   il stocke des empreintes, des clés enveloppées et des données chiffrées par le navigateur.
   Chaque requête est contrôlée : compte actif, session valide, niveau d'accès du domaine concerné.
   ═══════════════════════════════════════════ */
import crypto from 'node:crypto';
import { tx } from './db.mjs';
import { canAccess, sanitizePerms, COLLECTIONS } from '../public/js/secure/perms.mjs';

const KDF_ITER_MIN = 600000;
const PASSWORD_MAX_AGE = 180 * 86400e3;          // renouvellement demandé tous les 6 mois
const MAX_FAILED = 5, LOCK_MS = 15 * 60e3;        // 5 essais puis 15 minutes de blocage
const MAX_BODY = 25 * 1024 * 1024;                // radios / photos chiffrées
const INVITE_TTL = 7 * 86400e3;

class HttpError extends Error { constructor(status, code, message, extra) { super(message); Object.assign(this, { status, code, extra }); } }
const fail = (status, code, message, extra) => { throw new HttpError(status, code, message, extra); };

const sha256 = s => crypto.createHash('sha256').update(s).digest('base64');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const newId = () => crypto.randomBytes(12).toString('hex');
function sameSecret(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const isB64 = (s, min = 1, max = 64 * 1024) => typeof s === 'string' && s.length >= min && s.length <= max && /^[A-Za-z0-9+/=_-]+$/.test(s);
const isText = (s, min, max) => typeof s === 'string' && s.trim().length >= min && s.length <= max;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function createApi({ db, cfg, backup, log = () => {} }) {
  const { pepper, setupToken } = cfg.secrets;
  const authHash = (userId, authKey) => sha256(`${pepper}|auth|${userId}|${authKey}`);
  const inviteHash = (userId, inviteAuth) => sha256(`${pepper}|invite|${userId}|${inviteAuth}`);
  const fakeSalt = username => crypto.createHash('sha256').update(`${pepper}|salt|${String(username).toLowerCase()}`).digest().subarray(0, 16).toString('base64');

  const q = (sql, ...a) => db.prepare(sql).get(...a);
  const qa = (sql, ...a) => db.prepare(sql).all(...a);
  const run = (sql, ...a) => db.prepare(sql).run(...a);

  /* ── Utilisateurs ── */
  const rowToUser = r => r && { ...r, perms: JSON.parse(r.perms || '{}') };
  const getUser = id => rowToUser(q('SELECT * FROM users WHERE id = ?', id));
  const getUserByName = name => rowToUser(q('SELECT * FROM users WHERE username = ?', String(name || '').toLowerCase()));
  const hasKey = id => !!q('SELECT 1 FROM user_keys WHERE user_id = ?', id);
  const keyHolders = () => qa(`SELECT u.id FROM users u JOIN user_keys k ON k.user_id = u.id WHERE u.kind = 'admin' AND u.status = 'active'`).map(r => r.id);
  const nameOf = id => id ? (q('SELECT display_name FROM users WHERE id = ?', id)?.display_name || '—') : '—';
  function profile(u) {
    return { id: u.id, username: u.username, displayName: u.display_name, kind: u.kind, roleLabel: u.role_label,
      perms: u.perms, scope: u.scope, status: u.status, hasDataKey: hasKey(u.id), lastLogin: u.last_login,
      createdAt: u.created_at, createdBy: u.created_by, createdByName: nameOf(u.created_by),
      passwordAge: u.password_changed_at ? Date.now() - u.password_changed_at : null,
      inviteExpires: u.status === 'invited' ? u.invite_expires : null };
  }

  /* ── Journal ── */
  function audit(ctx, action, target = null, detail = null) {
    run('INSERT INTO audit (ts, user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      Date.now(), ctx.user?.id || null, ctx.user?.username || ctx.username || null, action, target, detail ? JSON.stringify(detail) : null, ctx.ip);
  }

  /* ── Sessions ── */
  function createSession(ctx, user) {
    const token = randomToken(), now = Date.now();
    run('INSERT INTO sessions (token_hash, user_id, created_at, last_seen, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sha256(token), user.id, now, now, now + cfg.session.maxMs, ctx.ip, String(ctx.req.headers['user-agent'] || '').slice(0, 200));
    ctx.setCookie(token);
  }
  function loadSession(ctx) {
    const token = (ctx.cookies.cabinet_sid || '');
    if (!token) return;
    const s = q('SELECT * FROM sessions WHERE token_hash = ?', sha256(token));
    const now = Date.now();
    if (!s) return;
    if (s.expires_at < now || now - s.last_seen > cfg.session.idleMs) { run('DELETE FROM sessions WHERE token_hash = ?', s.token_hash); ctx.expired = true; return; }
    const u = getUser(s.user_id);
    if (!u || u.status === 'disabled') { run('DELETE FROM sessions WHERE user_id = ?', s.user_id); return; }
    if (now - s.last_seen > 30e3) run('UPDATE sessions SET last_seen = ? WHERE token_hash = ?', now, s.token_hash);
    ctx.session = s; ctx.user = u;
  }
  const killSessions = userId => run('DELETE FROM sessions WHERE user_id = ?', userId);

  /* ── Limitation des tentatives ÉCHOUÉES par appareil (adresse IP, en mémoire) : 20 échecs / 10 min ── */
  const throttle = new Map();
  const throttleEntry = ip => {
    const now = Date.now(), t = throttle.get(ip) || { start: now, n: 0 };
    if (now - t.start > 10 * 60e3) { t.start = now; t.n = 0; }
    throttle.set(ip, t); return t;
  };
  function checkThrottle(ip) {
    if (throttleEntry(ip).n >= 20) fail(429, 'too_many', 'Trop de tentatives échouées depuis cet appareil. Réessayez dans quelques minutes.');
  }
  const recordFailure = ip => { throttleEntry(ip).n++; };

  /* ── Garde-fous ── */
  const needUser = ctx => { if (!ctx.user) fail(401, ctx.expired ? 'session_expired' : 'not_logged_in', ctx.expired ? 'Session expirée : reconnectez-vous.' : 'Connexion requise.'); return ctx.user; };
  const needActive = ctx => { const u = needUser(ctx); if (u.status !== 'active') fail(403, 'not_active', 'Compte en attente d\'activation.'); return u; };
  const needManager = ctx => { const u = needUser(ctx); if (!['admin', 'superadmin'].includes(u.kind) || u.status !== 'active') fail(403, 'forbidden', 'Réservé aux administrateurs.'); return u; };
  const needKeyHolder = ctx => { const u = needManager(ctx); if (u.kind !== 'admin' || !hasKey(u.id)) fail(403, 'no_key', 'Réservé à un administrateur détenteur de la clé des données.'); return u; };
  function canManage(actor, target) {
    if (target.kind === 'superadmin') return actor.kind === 'superadmin' && actor.id === target.id;
    return true;
  }
  function isLastKeyHolder(userId) { const h = keyHolders(); return h.length === 1 && h[0] === userId; }

  function validateNewAuth(b) {
    if (!isB64(b.authKey, 40, 64)) fail(400, 'bad_request', 'Clé d\'authentification invalide.');
    if (!isB64(b.kdfSalt, 16, 64)) fail(400, 'bad_request', 'Sel invalide.');
    if (!Number.isInteger(b.kdfIter) || b.kdfIter < KDF_ITER_MIN || b.kdfIter > 10_000_000) fail(400, 'bad_request', 'Paramètres de dérivation invalides.');
  }

  /* ════════════ Routes ════════════ */
  const routes = [];
  const route = (method, path, fn) => routes.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

  /* État général (écran de connexion) */
  route('GET', '/api/status', ctx => {
    const n = q('SELECT COUNT(*) n FROM users').n;
    return { setupNeeded: n === 0, dataKeyReady: !!q(`SELECT 1 FROM meta WHERE key = 'recovery_dek'`), serverTime: Date.now(), demo: !!cfg.demo };
  });

  /* Installation : création du super-admin avec le code affiché par le serveur au premier démarrage */
  route('POST', '/api/setup', (ctx, b) => {
    checkThrottle(ctx.ip);
    if (q('SELECT COUNT(*) n FROM users').n > 0) fail(409, 'already_setup', 'Installation déjà faite.');
    if (!sameSecret(b.setupToken, setupToken)) { recordFailure(ctx.ip); fail(403, 'bad_token', 'Code d\'installation incorrect.'); }
    const username = String(b.username || '').toLowerCase();
    if (!USERNAME.test(username)) fail(400, 'bad_username', 'Identifiant : 3 à 32 caractères (lettres, chiffres, . _ -).');
    if (!isText(b.displayName, 2, 80)) fail(400, 'bad_name', 'Nom affiché requis.');
    validateNewAuth(b);
    const id = newId(), now = Date.now();
    run(`INSERT INTO users (id, username, display_name, kind, role_label, perms, scope, status, auth_hash, kdf_salt, kdf_iter, password_changed_at, created_at, updated_at)
         VALUES (?, ?, ?, 'superadmin', 'Administrateur informatique', '{}', 'all', 'active', ?, ?, ?, ?, ?, ?)`,
      id, username, b.displayName.trim(), authHash(id, b.authKey), b.kdfSalt, b.kdfIter, now, now, now);
    ctx.user = getUser(id);
    audit(ctx, 'installation', id);
    createSession(ctx, ctx.user);
    return { user: profile(ctx.user) };
  });

  /* Connexion en deux temps : paramètres de dérivation, puis preuve (clé d'authentification) */
  route('POST', '/api/login/params', (ctx, b) => {
    checkThrottle(ctx.ip);
    const u = getUserByName(b.username);
    if (u && u.kdf_salt) return { kdfSalt: u.kdf_salt, kdfIter: u.kdf_iter };
    return { kdfSalt: fakeSalt(b.username), kdfIter: KDF_ITER_MIN };     // ne révèle pas si l'identifiant existe
  });
  route('POST', '/api/login', (ctx, b) => {
    checkThrottle(ctx.ip);
    const u = getUserByName(b.username);
    ctx.username = String(b.username || '').slice(0, 40);
    const now = Date.now();
    const generic = () => { recordFailure(ctx.ip); fail(401, 'bad_credentials', 'Identifiant ou mot de passe incorrect.'); };
    if (!u || !u.auth_hash || !isB64(b.authKey, 40, 64)) { audit(ctx, 'connexion_refusee', null, { raison: 'inconnu' }); generic(); }
    if (u.status === 'disabled') { audit(ctx, 'connexion_refusee', u.id, { raison: 'desactive' }); fail(403, 'disabled', 'Ce compte est désactivé. Contactez l\'administrateur.'); }
    if (u.locked_until > now) fail(423, 'locked', `Compte bloqué après plusieurs erreurs. Réessayez dans ${Math.ceil((u.locked_until - now) / 60e3)} min.`);
    if (!sameSecret(authHash(u.id, b.authKey), u.auth_hash)) {
      const n = u.failed_logins + 1;
      run('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', n >= MAX_FAILED ? 0 : n, n >= MAX_FAILED ? now + LOCK_MS : 0, u.id);
      audit(ctx, n >= MAX_FAILED ? 'compte_bloque' : 'connexion_refusee', u.id, { raison: 'mot_de_passe' });
      generic();
    }
    run('UPDATE users SET failed_logins = 0, locked_until = 0, last_login = ? WHERE id = ?', now, u.id);
    ctx.user = getUser(u.id);
    createSession(ctx, ctx.user);
    audit(ctx, 'connexion', u.id);
    return session(ctx.user);
  });
  function session(u) {
    const k = q('SELECT wrapped_dek FROM user_keys WHERE user_id = ?', u.id);
    return { user: profile(u), privKeyEnc: u.priv_key_enc, pubKey: u.pub_key, wrappedDek: k?.wrapped_dek || null,
      kdfSalt: u.kdf_salt, kdfIter: u.kdf_iter,
      mustChangePassword: !!u.password_changed_at && Date.now() - u.password_changed_at > PASSWORD_MAX_AGE,
      dataKeyReady: !!q(`SELECT 1 FROM meta WHERE key = 'recovery_dek'`) };
  }
  route('GET', '/api/me', ctx => session(needUser(ctx)));
  route('POST', '/api/logout', ctx => {
    if (ctx.session) { run('DELETE FROM sessions WHERE token_hash = ?', ctx.session.token_hash); audit(ctx, 'deconnexion'); }
    ctx.clearCookie();
    return { ok: true };
  });

  /* Changement de mot de passe : la clé privée est ré-enveloppée par le navigateur avec la nouvelle clé personnelle */
  route('POST', '/api/password', (ctx, b) => {
    const u = needUser(ctx);
    if (!sameSecret(authHash(u.id, b.currentAuthKey), u.auth_hash)) fail(403, 'bad_credentials', 'Mot de passe actuel incorrect.');
    validateNewAuth(b);
    if (u.kind !== 'superadmin' && !isText(b.privKeyEnc, 20, 20000)) fail(400, 'bad_request', 'Clé privée manquante.');
    const now = Date.now();
    run('UPDATE users SET auth_hash = ?, kdf_salt = ?, kdf_iter = ?, priv_key_enc = COALESCE(?, priv_key_enc), password_changed_at = ?, updated_at = ? WHERE id = ?',
      authHash(u.id, b.authKey), b.kdfSalt, b.kdfIter, b.privKeyEnc || null, now, now, u.id);
    run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', u.id, ctx.session.token_hash);
    audit(ctx, 'mot_de_passe_change', u.id);
    return { ok: true };
  });

  /* Invitation : vérification puis activation (le code ne transite jamais : seulement son empreinte) */
  function findInvite(b) {
    checkThrottle(b._ip);
    const u = getUserByName(b.username);
    const bad = () => { recordFailure(b._ip); fail(403, 'bad_invite', 'Identifiant ou code d\'invitation incorrect.'); };
    if (!u || u.status !== 'invited' || !isB64(b.inviteAuth, 40, 64)) bad();
    if (u.invite_expires < Date.now()) fail(410, 'invite_expired', 'Ce code d\'invitation a expiré. Demandez-en un nouveau.');
    if (!sameSecret(inviteHash(u.id, b.inviteAuth), u.invite_hash)) bad();
    return u;
  }
  route('POST', '/api/invite/check', (ctx, b) => {
    const u = findInvite({ ...b, _ip: ctx.ip });
    return { displayName: u.display_name, kind: u.kind, inviteDek: u.invite_dek || null };
  });
  route('POST', '/api/invite/accept', (ctx, b) => {
    const u = findInvite({ ...b, _ip: ctx.ip });
    validateNewAuth(b);
    const now = Date.now();
    let status = 'active', wrapped = null;
    if (u.kind !== 'superadmin') {
      if (!isText(b.pubKey, 100, 5000) || !isText(b.privKeyEnc, 20, 20000)) fail(400, 'bad_request', 'Clés manquantes.');
      if (b.wrappedDek && u.invite_dek) wrapped = String(b.wrappedDek);
      if (wrapped && !isB64(wrapped, 100, 4000)) fail(400, 'bad_request', 'Clé de données invalide.');
      // sans clé transmise par l'invitation : en attente qu'un administrateur détenteur de la clé l'autorise
      status = wrapped ? 'active' : 'pending_key';
    }
    tx(db, () => {
      run(`UPDATE users SET status = ?, auth_hash = ?, kdf_salt = ?, kdf_iter = ?, pub_key = ?, priv_key_enc = ?, password_changed_at = ?,
           invite_hash = NULL, invite_expires = NULL, invite_dek = NULL, failed_logins = 0, locked_until = 0, updated_at = ? WHERE id = ?`,
        status, authHash(u.id, b.authKey), b.kdfSalt, b.kdfIter, b.pubKey || null, b.privKeyEnc || null, now, now, u.id);
      if (wrapped) run('INSERT OR REPLACE INTO user_keys (user_id, wrapped_dek, granted_by, granted_at) VALUES (?, ?, ?, ?)', u.id, wrapped, u.created_by, now);
    });
    ctx.user = getUser(u.id);
    audit(ctx, 'invitation_acceptee', u.id, { acces_donnees: !!wrapped });
    createSession(ctx, ctx.user);
    return session(ctx.user);
  });

  /* Annuaire de l'équipe (noms et rôles, sans aucun secret) : listes de dentistes, auteurs… */
  route('GET', '/api/directory', ctx => {
    needActive(ctx);
    return { people: qa(`SELECT id, display_name, role_label, kind, scope FROM users WHERE status = 'active' AND kind != 'superadmin' ORDER BY display_name`)
      .map(r => ({ id: r.id, displayName: r.display_name, roleLabel: r.role_label, kind: r.kind, scope: r.scope })) };
  });

  /* ── Gestion des comptes (super-admin et admins) ── */
  route('GET', '/api/users', ctx => { needManager(ctx); return { users: qa('SELECT * FROM users ORDER BY created_at').map(r => profile(rowToUser(r))) }; });

  function inviteFields(b) {
    if (!isB64(b.inviteAuth, 40, 64)) fail(400, 'bad_request', 'Empreinte d\'invitation manquante.');
    if (b.inviteDek != null && !isText(b.inviteDek, 20, 4000)) fail(400, 'bad_request', 'Clé d\'invitation invalide.');
  }
  route('POST', '/api/users', (ctx, b) => {
    const actor = needManager(ctx);
    const username = String(b.username || '').toLowerCase();
    if (!USERNAME.test(username)) fail(400, 'bad_username', 'Identifiant : 3 à 32 caractères (lettres minuscules, chiffres, . _ -).');
    if (getUserByName(username)) fail(409, 'username_taken', 'Cet identifiant existe déjà.');
    if (!isText(b.displayName, 2, 80)) fail(400, 'bad_name', 'Nom affiché requis.');
    if (!['admin', 'staff'].includes(b.kind)) fail(400, 'bad_kind', 'Type de compte invalide.');
    inviteFields(b);
    // seul un administrateur détenteur de la clé peut joindre la clé de données à l'invitation
    const inviteDek = b.inviteDek && actor.kind === 'admin' && hasKey(actor.id) ? b.inviteDek : null;
    const id = newId(), now = Date.now();
    run(`INSERT INTO users (id, username, display_name, kind, role_label, perms, scope, status, invite_hash, invite_expires, invite_dek, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'invited', ?, ?, ?, ?, ?, ?)`,
      id, username, b.displayName.trim(), b.kind, String(b.roleLabel || '').slice(0, 40),
      JSON.stringify(b.kind === 'admin' ? {} : sanitizePerms(b.perms)), b.scope === 'own' ? 'own' : 'all',
      inviteHash(id, b.inviteAuth), now + INVITE_TTL, inviteDek, actor.id, now, now);
    audit(ctx, 'compte_cree', id, { identifiant: username, type: b.kind, cle_jointe: !!inviteDek });
    return { user: profile(getUser(id)) };
  });

  route('PATCH', '/api/users/:id', (ctx, b, p) => {
    const actor = needManager(ctx);
    const t = getUser(p.id) || fail(404, 'not_found', 'Compte introuvable.');
    if (!canManage(actor, t)) fail(403, 'forbidden', 'Ce compte ne peut pas être modifié ici.');
    const changes = {};
    if (b.displayName != null) { if (!isText(b.displayName, 2, 80)) fail(400, 'bad_name', 'Nom invalide.'); changes.display_name = b.displayName.trim(); }
    if (b.roleLabel != null) changes.role_label = String(b.roleLabel).slice(0, 40);
    if (t.kind !== 'superadmin') {
      if (b.kind != null) {
        if (!['admin', 'staff'].includes(b.kind)) fail(400, 'bad_kind', 'Type de compte invalide.');
        if (b.kind === 'staff' && isLastKeyHolder(t.id)) fail(409, 'last_admin', 'C\'est le dernier administrateur détenant la clé des données : impossible de le rétrograder.');
        changes.kind = b.kind;
      }
      if (b.perms != null) changes.perms = JSON.stringify(sanitizePerms(b.perms));
      if (b.scope != null) changes.scope = b.scope === 'own' ? 'own' : 'all';
    }
    const keys = Object.keys(changes);
    if (!keys.length) return { user: profile(t) };
    run(`UPDATE users SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map(k => changes[k]), Date.now(), t.id);
    audit(ctx, 'compte_modifie', t.id, { champs: keys });
    return { user: profile(getUser(t.id)) };
  });

  route('POST', '/api/users/:id/disable', (ctx, b, p) => {
    const actor = needManager(ctx);
    const t = getUser(p.id) || fail(404, 'not_found', 'Compte introuvable.');
    if (t.id === actor.id) fail(400, 'self', 'Vous ne pouvez pas désactiver votre propre compte.');
    if (!canManage(actor, t)) fail(403, 'forbidden', 'Ce compte ne peut pas être désactivé ici.');
    if (isLastKeyHolder(t.id)) fail(409, 'last_admin', 'C\'est le dernier administrateur détenant la clé des données : impossible de le désactiver.');
    tx(db, () => { run(`UPDATE users SET status = 'disabled', updated_at = ? WHERE id = ?`, Date.now(), t.id); run('DELETE FROM user_keys WHERE user_id = ?', t.id); killSessions(t.id); });
    audit(ctx, 'compte_desactive', t.id);
    return { user: profile(getUser(t.id)) };
  });
  route('POST', '/api/users/:id/enable', (ctx, b, p) => {
    const actor = needManager(ctx);
    const t = getUser(p.id) || fail(404, 'not_found', 'Compte introuvable.');
    if (!canManage(actor, t) || t.status !== 'disabled') fail(400, 'bad_state', 'Ce compte n\'est pas désactivé.');
    // la clé des données a été retirée : il faudra la ré-autoriser (ou réinitialiser le compte)
    const status = t.auth_hash ? (t.kind === 'superadmin' ? 'active' : 'pending_key') : 'invited';
    run('UPDATE users SET status = ?, updated_at = ? WHERE id = ?', status, Date.now(), t.id);
    audit(ctx, 'compte_reactive', t.id);
    return { user: profile(getUser(t.id)) };
  });
  /* Réinitialisation (mot de passe oublié) : nouveau code d'invitation ; accès aux données à ré-autoriser */
  route('POST', '/api/users/:id/reset', (ctx, b, p) => {
    const actor = needManager(ctx);
    const t = getUser(p.id) || fail(404, 'not_found', 'Compte introuvable.');
    if (t.id === actor.id) fail(400, 'self', 'Pour votre propre compte, utilisez « Changer mon mot de passe ».');
    if (!canManage(actor, t)) fail(403, 'forbidden', 'Ce compte ne peut pas être réinitialisé ici.');
    inviteFields(b);
    const inviteDek = b.inviteDek && actor.kind === 'admin' && hasKey(actor.id) ? b.inviteDek : null;
    const now = Date.now();
    tx(db, () => {
      run(`UPDATE users SET status = 'invited', auth_hash = NULL, kdf_salt = NULL, kdf_iter = NULL, pub_key = NULL, priv_key_enc = NULL,
           invite_hash = ?, invite_expires = ?, invite_dek = ?, failed_logins = 0, locked_until = 0, updated_at = ? WHERE id = ?`,
        inviteHash(t.id, b.inviteAuth), now + INVITE_TTL, inviteDek, now, t.id);
      run('DELETE FROM user_keys WHERE user_id = ?', t.id);
      killSessions(t.id);
    });
    audit(ctx, 'compte_reinitialise', t.id, { cle_jointe: !!inviteDek });
    return { user: profile(getUser(t.id)) };
  });

  /* ── Clé des données ── */
  // Première mise en service : le premier administrateur crée la clé et la clé de secours (imprimée)
  route('POST', '/api/keys/bootstrap', (ctx, b) => {
    const u = needUser(ctx);
    if (u.kind !== 'admin') fail(403, 'forbidden', 'Réservé à l\'administrateur du cabinet.');
    if (q(`SELECT 1 FROM meta WHERE key = 'recovery_dek'`)) fail(409, 'already', 'La clé des données existe déjà.');
    if (!isB64(b.wrappedDek, 100, 4000) || !isText(b.recoveryDek, 20, 4000)) fail(400, 'bad_request', 'Clés manquantes.');
    const now = Date.now();
    tx(db, () => {
      run(`INSERT INTO meta (key, value, updated_at) VALUES ('recovery_dek', ?, ?)`, b.recoveryDek, now);
      run('INSERT OR REPLACE INTO user_keys (user_id, wrapped_dek, granted_by, granted_at) VALUES (?, ?, ?, ?)', u.id, b.wrappedDek, u.id, now);
      run(`UPDATE users SET status = 'active', updated_at = ? WHERE id = ?`, now, u.id);
    });
    ctx.user = getUser(u.id);
    audit(ctx, 'cle_donnees_creee', u.id);
    return session(ctx.user);
  });
  // Clé de secours enveloppée (pour un administrateur qui a tout perdu et dispose de la feuille imprimée)
  route('GET', '/api/keys/recovery', ctx => {
    const u = needUser(ctx);
    if (u.kind !== 'admin') fail(403, 'forbidden', 'Réservé aux administrateurs du cabinet.');
    const m = q(`SELECT value FROM meta WHERE key = 'recovery_dek'`) || fail(404, 'none', 'Aucune clé de secours.');
    return { recoveryDek: m.value };
  });
  route('POST', '/api/keys/recovery', (ctx, b) => {
    needKeyHolder(ctx);
    if (!isText(b.recoveryDek, 20, 4000)) fail(400, 'bad_request', 'Clé manquante.');
    run(`UPDATE meta SET value = ?, updated_at = ? WHERE key = 'recovery_dek'`, b.recoveryDek, Date.now());
    audit(ctx, 'cle_secours_remplacee');
    return { ok: true };
  });
  // Un administrateur sans clé (mot de passe oublié) se la redonne grâce à la feuille de secours
  route('POST', '/api/keys/self', (ctx, b) => {
    const u = needUser(ctx);
    if (u.kind !== 'admin' || u.status !== 'pending_key') fail(403, 'forbidden', 'Non disponible pour ce compte.');
    if (!isB64(b.wrappedDek, 100, 4000)) fail(400, 'bad_request', 'Clé manquante.');
    const now = Date.now();
    tx(db, () => {
      run('INSERT OR REPLACE INTO user_keys (user_id, wrapped_dek, granted_by, granted_at) VALUES (?, ?, ?, ?)', u.id, b.wrappedDek, u.id, now);
      run(`UPDATE users SET status = 'active', updated_at = ? WHERE id = ?`, now, u.id);
    });
    ctx.user = getUser(u.id);
    audit(ctx, 'cle_donnees_recuperee', u.id);
    return session(ctx.user);
  });
  // Comptes en attente d'accès aux données (créés par le super-admin ou réactivés)
  route('GET', '/api/keys/pending', ctx => {
    needKeyHolder(ctx);
    return { pending: qa(`SELECT * FROM users WHERE status = 'pending_key' AND kind != 'superadmin' AND pub_key IS NOT NULL`).map(r => ({ ...profile(rowToUser(r)), pubKey: r.pub_key })) };
  });
  route('POST', '/api/keys/grant', (ctx, b) => {
    const actor = needKeyHolder(ctx);
    const t = getUser(b.userId) || fail(404, 'not_found', 'Compte introuvable.');
    if (t.kind === 'superadmin') fail(403, 'forbidden', 'Le super-admin n\'a jamais accès aux données des patients.');
    if (t.status !== 'pending_key') fail(400, 'bad_state', 'Ce compte n\'attend pas d\'accès.');
    if (!isB64(b.wrappedDek, 100, 4000)) fail(400, 'bad_request', 'Clé manquante.');
    const now = Date.now();
    tx(db, () => {
      run('INSERT OR REPLACE INTO user_keys (user_id, wrapped_dek, granted_by, granted_at) VALUES (?, ?, ?, ?)', t.id, b.wrappedDek, actor.id, now);
      run(`UPDATE users SET status = 'active', updated_at = ? WHERE id = ?`, now, t.id);
    });
    audit(ctx, 'acces_donnees_autorise', t.id);
    return { user: profile(getUser(t.id)) };
  });

  /* ── Données chiffrées ── */
  // « Uniquement son travail » : pour les données liées aux patients, il faut figurer parmi les dentistes attribués
  const PATIENT_LINKED = new Set(['patients', 'appointments', 'requests', 'treatments', 'chart', 'files', 'documents', 'payments', 'gallery', 'labworks', 'activity']);
  const visible = (u, row) => {
    if (u.kind === 'admin' || u.scope !== 'own') return true;
    const owners = row.owners ? JSON.parse(row.owners) : null;
    if (owners) return owners.includes(u.id);
    return !PATIENT_LINKED.has(row.collection);
  };
  route('GET', '/api/records', ctx => {
    const u = needActive(ctx);
    if (u.kind === 'superadmin') fail(403, 'forbidden', 'Le super-admin n\'a pas accès aux données des patients.');
    const since = Math.max(0, +(ctx.url.searchParams.get('since') || 0));
    const rows = qa('SELECT collection, id, iv, data, owners, deleted, updated_at FROM records WHERE updated_at > ? ORDER BY updated_at', since);
    const out = rows.filter(r => canAccess(u, r.collection, r.id, false) && visible(u, r))
      .map(r => ({ c: r.collection, id: r.id, iv: r.iv, data: r.data, owners: r.owners ? JSON.parse(r.owners) : null, deleted: !!r.deleted, v: r.updated_at }));
    const max = rows.length ? rows[rows.length - 1].updated_at : since;
    return { records: out, cursor: max };
  });
  let clock = 0;
  const tick = () => (clock = Math.max(Date.now(), clock + 1));
  route('PUT', '/api/records/:c/:id', (ctx, b, p) => {
    const u = needActive(ctx);
    const { c, id } = p;
    if (!COLLECTIONS[c]) fail(400, 'bad_collection', 'Collection inconnue.');
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) fail(400, 'bad_id', 'Identifiant invalide.');
    if (!canAccess(u, c, id, true)) fail(403, 'forbidden', 'Vous n\'avez pas le droit de modifier ces données.');
    if (!isB64(b.iv, 12, 32) || !isB64(b.data, 4, MAX_BODY)) fail(400, 'bad_request', 'Données chiffrées invalides.');
    const cur = q('SELECT * FROM records WHERE collection = ? AND id = ?', c, id);
    if (cur && !visible(u, cur)) fail(403, 'forbidden', 'Ces données ne vous sont pas attribuées.');
    if (b.base != null && cur && cur.updated_at !== b.base) fail(409, 'conflict', 'Modifié entre-temps par quelqu\'un d\'autre.', { current: { iv: cur.iv, data: cur.data, v: cur.updated_at, deleted: !!cur.deleted } });
    let owners = Array.isArray(b.owners) ? [...new Set(b.owners.map(String))].slice(0, 20) : null;
    // un dentiste « son travail uniquement » qui crée / modifie une donnée patient y reste toujours attribué
    if (u.kind !== 'admin' && u.scope === 'own' && PATIENT_LINKED.has(c)) { owners = owners || []; if (!owners.includes(u.id)) owners.push(u.id); }
    const v = tick();
    tx(db, () => {
      run(`INSERT INTO records (collection, id, iv, data, owners, deleted, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
           ON CONFLICT (collection, id) DO UPDATE SET iv = excluded.iv, data = excluded.data, owners = excluded.owners, deleted = 0, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        c, id, b.iv, b.data, owners ? JSON.stringify(owners) : null, v, u.id);
      run('DELETE FROM blind_index WHERE collection = ? AND record_id = ?', c, id);
      if (c === 'patients' && b.blind && typeof b.blind === 'object')
        for (const f of ['phone']) if (b.blind[f] && isB64(b.blind[f], 20, 64)) run('INSERT INTO blind_index (collection, record_id, field, hash) VALUES (?, ?, ?, ?)', c, id, f, b.blind[f]);
    });
    if (!['activity', 'settings'].includes(c)) audit(ctx, cur ? 'donnee_modifiee' : 'donnee_creee', `${c}/${id}`);
    return { v };
  });
  route('DELETE', '/api/records/:c/:id', (ctx, b, p) => {
    const u = needActive(ctx);
    const { c, id } = p;
    if (!canAccess(u, c, id, true)) fail(403, 'forbidden', 'Vous n\'avez pas le droit de supprimer ces données.');
    const cur = q('SELECT * FROM records WHERE collection = ? AND id = ?', c, id);
    if (!cur) return { ok: true };
    if (!visible(u, cur)) fail(403, 'forbidden', 'Ces données ne vous sont pas attribuées.');
    const v = tick();
    tx(db, () => {
      run('UPDATE records SET iv = NULL, data = NULL, deleted = 1, updated_at = ?, updated_by = ? WHERE collection = ? AND id = ?', v, u.id, c, id);
      run('DELETE FROM blind_index WHERE collection = ? AND record_id = ?', c, id);
    });
    audit(ctx, 'donnee_supprimee', `${c}/${id}`);
    return { v };
  });
  // Recherche exacte par téléphone (empreinte calculée par le navigateur)
  route('GET', '/api/blind', ctx => {
    const u = needActive(ctx);
    if (!canAccess(u, 'patients', null, false)) fail(403, 'forbidden', 'Accès aux patients non autorisé.');
    const field = ctx.url.searchParams.get('field'), hash = ctx.url.searchParams.get('hash');
    if (field !== 'phone' || !isB64(hash, 20, 64)) fail(400, 'bad_request', 'Recherche invalide.');
    const ids = qa(`SELECT b.record_id id, r.owners, r.collection FROM blind_index b JOIN records r ON r.collection = b.collection AND r.id = b.record_id
                    WHERE b.collection = 'patients' AND b.field = ? AND b.hash = ? AND r.deleted = 0`, field, hash)
      .filter(r => visible(u, r)).map(r => r.id);
    return { ids };
  });
  // Numérotation partagée (factures, devis…) sans doublon entre postes
  route('POST', '/api/seq/:name', (ctx, b, p) => {
    const u = needActive(ctx);
    if (!['invoice', 'quote'].includes(p.name)) fail(400, 'bad_request', 'Séquence inconnue.');
    if (!canAccess(u, p.name === 'invoice' ? 'payments' : 'documents', null, true)) fail(403, 'forbidden', 'Non autorisé.');
    return tx(db, () => {
      const key = `seq:${p.name}:${new Date().getFullYear()}`;
      const cur = +(q('SELECT value FROM meta WHERE key = ?', key)?.value || 0) + 1;
      run('INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', key, String(cur), Date.now());
      return { n: cur, year: new Date().getFullYear() };
    });
  });

  /* ── Journal, système, sauvegardes ── */
  route('GET', '/api/audit', ctx => {
    needManager(ctx);
    const before = +(ctx.url.searchParams.get('before') || 0) || Number.MAX_SAFE_INTEGER;
    const limit = Math.min(500, +(ctx.url.searchParams.get('limit') || 200));
    return { entries: qa('SELECT id, ts, user_id userId, username, action, target, detail, ip FROM audit WHERE id < ? ORDER BY id DESC LIMIT ?', before, limit)
      .map(e => ({ ...e, detail: e.detail ? JSON.parse(e.detail) : null, targetName: e.target && !e.target.includes('/') ? nameOf(e.target) : null })) };
  });
  route('GET', '/api/system', ctx => {
    needManager(ctx);
    return {
      users: qa('SELECT kind, status, COUNT(*) n FROM users GROUP BY kind, status'),
      records: qa('SELECT collection, COUNT(*) n FROM records WHERE deleted = 0 GROUP BY collection'),
      sessions: q('SELECT COUNT(*) n FROM sessions WHERE expires_at > ?', Date.now()).n,
      dataKeyReady: !!q(`SELECT 1 FROM meta WHERE key = 'recovery_dek'`),
      keyHolders: keyHolders().length,
      backup: backup ? backup.status() : null,
      server: { started: cfg.startedAt, node: process.version, hostname: cfg.hostname },
    };
  });
  route('GET', '/api/backup/status', ctx => { needActive(ctx); return backup.status(); });
  // Clé de sauvegarde (nécessaire pour restaurer sur un autre PC) : super-admin uniquement, consultation journalisée
  route('GET', '/api/system/backup-key', ctx => {
    const u = needManager(ctx);
    if (u.kind !== 'superadmin') fail(403, 'forbidden', 'Réservé à l\'administrateur informatique.');
    audit(ctx, 'cle_sauvegarde_consultee');
    return { backupKey: cfg.secrets.backupKey, dataDir: cfg.dataDir };
  });
  route('GET', '/api/backup/drives', ctx => { needActive(ctx); return { drives: backup.removableDrives() }; });
  route('POST', '/api/backup/usb', async (ctx, b) => {
    const u = needActive(ctx);
    let r;
    try { r = await backup.toUsb(String(b.drive || ''), u.id); }
    catch (e) { fail(e.status || 500, 'usb', e.status ? e.message : 'La copie sur la clé USB a échoué : vérifiez la clé (espace libre, protection en écriture) et réessayez.'); }
    audit(ctx, 'sauvegarde_usb', r.file, { lecteur: b.drive, taille: r.size });
    return r;
  });
  route('POST', '/api/backup/now', async ctx => {
    const u = needManager(ctx);
    const r = await backup.run('manual', u.id);
    audit(ctx, 'sauvegarde_manuelle', r.file);
    return r;
  });

  /* ════════════ Aiguillage ════════════ */
  return async function handle(req, res, url, helpers) {
    const ctx = { req, res, url, ip: helpers.ip, cookies: helpers.cookies, setCookie: helpers.setCookie, clearCookie: helpers.clearCookie };
    try {
      if (req.method !== 'GET') {
        // protection CSRF : en-tête obligatoire (impossible à envoyer depuis un autre site sans autorisation) + même origine
        if (req.headers['x-cabinet'] !== '1') fail(403, 'csrf', 'Requête refusée.');
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) fail(403, 'csrf', 'Origine refusée.');
      }
      const r = routes.find(r => r.method === req.method && r.re.test(url.pathname));
      if (!r) fail(404, 'not_found', 'Adresse inconnue.');
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await helpers.readJson(MAX_BODY) : {};
      loadSession(ctx);
      const out = await r.fn(ctx, body || {}, url.pathname.match(r.re).groups || {});
      helpers.json(200, out);
    } catch (e) {
      if (e instanceof HttpError) return helpers.json(e.status, { error: e.code, message: e.message, ...(e.extra || {}) });
      if (e?.code === 'body_too_large') return helpers.json(413, { error: 'too_large', message: 'Fichier trop volumineux.' });
      if (e?.code === 'bad_json') return helpers.json(400, { error: 'bad_json', message: 'Requête invalide.' });
      log('Erreur API', e);
      helpers.json(500, { error: 'server', message: 'Erreur du serveur. Elle a été enregistrée.' });
    }
  };
}
