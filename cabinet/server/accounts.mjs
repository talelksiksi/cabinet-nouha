/* ═══════════════════════════════════════════
   Comptes protégés : le Dr Nouha (titulaire, administratrice) et l'administrateur informatique.
   - Créés par l'installation du PC du cabinet, chacun avec un code d'activation (72 h) : chacun choisit
     lui-même son mot de passe ; personne d'autre ne le connaît.
   - Dans l'application, personne ne peut les renommer, les rétrograder, les désactiver ni les réinitialiser
     (chacun peut seulement changer son propre mot de passe).
   - Seul l'outil « comptes protégés » du PORTABLE du Dr Nouha (droits administrateur Windows) peut les
     réinitialiser ou les renommer ; la demande est transmise au cabinet à la synchronisation suivante.
   - Une réinitialisation ne donne jamais accès aux dossiers : le Dr Nouha les retrouve avec sa feuille de secours.
   ═══════════════════════════════════════════ */
import crypto from 'node:crypto';

export const PROTECTED_ACCOUNTS = [
  { username: 'nouha', displayName: 'Dr Nouha Ksiksi', kind: 'admin', roleLabel: 'Dentiste titulaire' },
  { username: 'talel', displayName: 'Talel Ksiksi', kind: 'superadmin', roleLabel: 'Administrateur informatique' },
];
export const PROTECTED_NAMES = PROTECTED_ACCOUNTS.map(a => a.username);
export const ACTIVATION_TTL = 72 * 3600e3;

const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const sha256 = s => crypto.createHash('sha256').update(s).digest('base64');
const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Code d'activation : 4 groupes de 5 caractères (≈ 100 bits), même format que les invitations. */
export function newActivationCode() {
  return [...crypto.randomBytes(20)].map(b => B32[b % 32]).join('').match(/.{5}/g).join('-');
}
/** Empreinte du code, calculée exactement comme le navigateur (crypto.mjs → inviteAuth). */
export const inviteAuthOf = (code, username) => sha256(`cabinet-invite-auth:${username.toLowerCase()}:${norm(code)}`);
export const inviteHashOf = (pepper, userId, inviteAuth) => sha256(`${pepper}|invite|${userId}|${inviteAuth}`);

/**
 * PC du cabinet, à l'installation : crée les comptes protégés manquants ; pour un compte protégé jamais activé,
 * remplace son code (l'ancien ne marche plus). Un compte déjà activé n'est jamais touché ici.
 * Retourne [{ username, displayName, code | null, state }].
 */
export function provisionProtected(db, cfg, now = Date.now()) {
  const out = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const a of PROTECTED_ACCOUNTS) {
      const u = db.prepare('SELECT * FROM users WHERE username = ?').get(a.username);
      if (u && u.activated_at) { out.push({ ...a, code: null, state: 'active' }); continue; }
      if (u && !u.protected) { out.push({ ...a, code: null, state: 'conflict' }); continue; }
      const code = newActivationCode();
      const id = u?.id || crypto.randomBytes(12).toString('hex');
      const hash = inviteHashOf(cfg.secrets.pepper, id, inviteAuthOf(code, a.username));
      if (u) db.prepare('UPDATE users SET invite_hash = ?, invite_expires = ?, status = ?, updated_at = ? WHERE id = ?').run(hash, now + ACTIVATION_TTL, 'invited', now, id);
      else db.prepare(`INSERT INTO users (id, username, display_name, kind, role_label, perms, scope, status, invite_hash, invite_expires, protected, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, '{}', 'all', 'invited', ?, ?, 1, ?, ?)`).run(id, a.username, a.displayName, a.kind, a.roleLabel, hash, now + ACTIVATION_TTL, now, now);
      db.prepare('INSERT INTO audit (ts, user_id, username, action, target, detail, ip, origin) VALUES (?, NULL, ?, ?, ?, NULL, NULL, NULL)')
        .run(now, 'installation', u ? 'code_activation_renouvele' : 'compte_protege_cree', id);
      out.push({ ...a, code, state: u ? 'renewed' : 'created' });
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return out;
}

/**
 * PC du cabinet : applique une demande de l'outil du portable (reçue d'un portable associé).
 * reset  → le compte redevient « à activer » avec le code choisi sur le portable (72 h) ; mot de passe, clés et sessions effacés.
 * rename → nouveau nom affiché.
 */
export function applyProtectedOp(db, cfg, op, now = Date.now()) {
  const u = db.prepare('SELECT * FROM users WHERE username = ? AND protected = 1').get(String(op.username || ''));
  if (!u) return { ok: false, error: 'Compte protégé introuvable.' };
  let p = {};
  try { p = typeof op.payload === 'string' ? JSON.parse(op.payload) : (op.payload || {}); } catch {}
  if (op.op === 'reset') {
    if (typeof p.inviteAuth !== 'string' || !/^[A-Za-z0-9+/=]{40,64}$/.test(p.inviteAuth)) return { ok: false, error: 'Demande invalide.' };
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`UPDATE users SET status = 'invited', auth_hash = NULL, kdf_salt = NULL, kdf_iter = NULL, pub_key = NULL, priv_key_enc = NULL,
                  invite_hash = ?, invite_expires = ?, invite_dek = NULL, failed_logins = 0, locked_until = 0, updated_at = ? WHERE id = ?`)
        .run(inviteHashOf(cfg.secrets.pepper, u.id, p.inviteAuth), now + ACTIVATION_TTL, now, u.id);
      db.prepare('DELETE FROM user_keys WHERE user_id = ?').run(u.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return { ok: true, expires: now + ACTIVATION_TTL };
  }
  if (op.op === 'rename') {
    const name = String(p.displayName || '').trim();
    if (name.length < 2 || name.length > 80) return { ok: false, error: 'Nom invalide.' };
    db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(name, now, u.id);
    return { ok: true };
  }
  return { ok: false, error: 'Demande inconnue.' };
}
