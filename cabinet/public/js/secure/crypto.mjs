/* ═══════════════════════════════════════════
   Espace cabinet — chiffrement côté navigateur (WebCrypto)
   Fonctionne aussi sous Node (tests) : uniquement globalThis.crypto, btoa / atob, TextEncoder.

   Hiérarchie des clés
   ───────────────────
   mot de passe ──PBKDF2-SHA256 (600 000 itérations)──► 512 bits
        ├─ 256 premiers bits : clé d'authentification (envoyée au serveur, qui n'en garde qu'une empreinte)
        └─ 256 derniers bits : clé personnelle (ne quitte jamais le navigateur)
   clé personnelle ──AES-GCM──► protège la clé privée RSA-OAEP 3072 de l'utilisateur
   clé publique RSA ──► enveloppe la clé de données du cabinet (DEK, AES-GCM 256) pour cet utilisateur
   DEK ──AES-GCM──► chaque enregistrement (AAD = collection/id : impossible d'échanger deux lignes)
   DEK ──HKDF──► clé HMAC de l'index aveugle (téléphone)
   clé de secours imprimée ──AES-GCM──► copie de la DEK, pour tout récupérer si plus personne n'a son mot de passe
   ═══════════════════════════════════════════ */

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();

export const KDF_ITERATIONS = 600000;

/* ── Encodages ── */
export const b64 = bytes => { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
export const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
export const randomBytes = n => globalThis.crypto.getRandomValues(new Uint8Array(n));
export const newSalt = () => b64(randomBytes(16));
export const newId = () => [...randomBytes(12)].map(x => x.toString(16).padStart(2, '0')).join('');

/* ── Mot de passe → clé d'authentification + clé personnelle ── */
export async function deriveKeys(password, saltB64, iterations = KDF_ITERATIONS) {
  const base = await subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations }, base, 512));
  const encKey = await subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { authKey: b64(bits.slice(0, 32)), encKey };
}

/* ── AES-GCM générique ── */
async function aesEncrypt(key, bytes, aad) {
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, ...(aad ? { additionalData: enc.encode(aad) } : {}) }, key, bytes);
  return { iv: b64(iv), ct: b64(ct) };
}
async function aesDecrypt(key, { iv, ct }, aad) {
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), ...(aad ? { additionalData: enc.encode(aad) } : {}) }, key, unb64(ct)));
}

/* ── Paire de clés de l'utilisateur ── */
const RSA = { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
export async function newUserKeyPair() {
  const kp = await subtle.generateKey(RSA, true, ['encrypt', 'decrypt']);
  return { publicJwk: JSON.stringify(await subtle.exportKey('jwk', kp.publicKey)), privateKey: kp.privateKey };
}
export async function lockPrivateKey(privateKey, encKey) {
  return JSON.stringify(await aesEncrypt(encKey, await subtle.exportKey('pkcs8', privateKey), 'private-key'));
}
export async function unlockPrivateKey(lockedJson, encKey) {
  const raw = await aesDecrypt(encKey, JSON.parse(lockedJson), 'private-key');
  return subtle.importKey('pkcs8', raw, RSA, true, ['decrypt']);   // ré-enveloppable lors d'un changement de mot de passe
}

/* ── Clé de données du cabinet (DEK) ── */
export const newDek = () => subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
const importDek = raw => subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
/* Copie de secours sur le portable du Dr Nouha (dossier réservé aux administrateurs Windows, disque chiffré) */
export const exportDek = async dek => b64(await subtle.exportKey('raw', dek));
export const importDekB64 = s => importDek(unb64(s));
export async function wrapDekFor(dek, publicJwk) {
  const pub = await subtle.importKey('jwk', JSON.parse(publicJwk), RSA, false, ['encrypt']);
  return b64(await subtle.encrypt({ name: 'RSA-OAEP' }, pub, await subtle.exportKey('raw', dek)));
}
export async function unwrapDek(wrappedB64, privateKey) {
  return importDek(await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, unb64(wrappedB64)));
}

/* ── Clé de secours (imprimée et gardée au cabinet) ── */
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 0, 1 : pas de confusion à la relecture
export function newRecoveryKey() {
  const r = randomBytes(30);
  const chars = [...r].map(x => B32[x % 32]).join('');           // 30 caractères ≈ 150 bits
  return chars.match(/.{5}/g).join('-');
}
const normRecovery = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
async function recoveryAesKey(recovery) {
  return subtle.importKey('raw', await subtle.digest('SHA-256', enc.encode('cabinet-recovery:' + normRecovery(recovery))), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function wrapDekWithRecovery(dek, recovery) {
  return JSON.stringify(await aesEncrypt(await recoveryAesKey(recovery), await subtle.exportKey('raw', dek), 'recovery'));
}
export async function unwrapDekWithRecovery(blob, recovery) {
  return importDek(await aesDecrypt(await recoveryAesKey(recovery), JSON.parse(blob), 'recovery'));
}

/* ── Code d'invitation : porte la DEK quand l'invitant la possède (le remplaçant travaille tout de suite) ── */
export function newInviteCode() { return newRecoveryKey().slice(0, 23); } // 4 groupes de 5 ≈ 100 bits
async function inviteAesKey(code, usernameLower) {
  const base = await subtle.importKey('raw', enc.encode(normRecovery(code)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('cabinet-invite:' + usernameLower), iterations: 100000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function wrapDekForInvite(dek, code, username) {
  return JSON.stringify(await aesEncrypt(await inviteAesKey(code, username.toLowerCase()), await subtle.exportKey('raw', dek), 'invite'));
}
export async function unwrapDekFromInvite(blob, code, username) {
  return importDek(await aesDecrypt(await inviteAesKey(code, username.toLowerCase()), JSON.parse(blob), 'invite'));
}
/** Ce que le serveur reçoit pour vérifier un code d'invitation : une empreinte, jamais le code lui-même
 *  (le code déverrouille la clé de données : le serveur ne doit pas pouvoir s'en servir). */
export async function inviteAuth(code, username) {
  return b64(await subtle.digest('SHA-256', enc.encode(`cabinet-invite-auth:${username.toLowerCase()}:${normRecovery(code)}`)));
}

/* ── Enregistrements ── */
export async function encryptRecord(dek, collection, id, obj) {
  const { iv, ct } = await aesEncrypt(dek, enc.encode(JSON.stringify(obj)), `${collection}/${id}`);
  return { iv, data: ct };
}
export async function decryptRecord(dek, collection, id, { iv, data }) {
  return JSON.parse(dec.decode(await aesDecrypt(dek, { iv, ct: data }, `${collection}/${id}`)));
}

/* ── Index aveugles : recherche exacte sans stocker la valeur ── */
const normalizers = {
  phone: v => String(v || '').replace(/\D/g, '').slice(-8),   // 8 derniers chiffres : +216 / 00216 / espaces sans effet
};
const hmacCache = new WeakMap();
async function hmacKey(dek) {
  if (hmacCache.has(dek)) return hmacCache.get(dek);
  const base = await subtle.importKey('raw', await subtle.exportKey('raw', dek), 'HKDF', false, ['deriveKey']);
  const k = await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('cabinet'), info: enc.encode('blind-index') }, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  hmacCache.set(dek, k); return k;
}
export async function blindIndex(dek, field, value) {
  const n = (normalizers[field] || (v => String(v || '').trim().toLowerCase()))(value);
  if (!n) return null;
  const mac = await subtle.sign('HMAC', await hmacKey(dek), enc.encode(`${field}:${n}`));
  return b64(mac).replace(/=+$/, '');
}

/* ── Règles de mot de passe (le serveur ne voit jamais le mot de passe : la règle s'applique ici) ── */
const COMMON = ['password', 'motdepasse', 'azerty', 'qwerty', '123456', 'admin', 'cabinet', 'dentiste', 'nouha', 'ksiksi', 'medenine', 'tunisie', 'bonjour', 'soleil'];
export function checkPassword(pw, username = '') {
  const issues = [];
  if (pw.length < 12) issues.push('au moins 12 caractères');
  if (!/[A-Z]/.test(pw)) issues.push('une majuscule');
  if (!/[a-z]/.test(pw)) issues.push('une minuscule');
  if (!/[0-9]/.test(pw)) issues.push('un chiffre');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('un symbole (!?@#$%&*…)');
  const low = pw.toLowerCase();
  if (username && username.length >= 3 && low.includes(username.toLowerCase())) issues.push('ne pas contenir l\'identifiant');
  if (COMMON.some(w => low.includes(w))) issues.push('éviter les mots trop connus (azerty, cabinet, nom du cabinet…)');
  if (/(.)\1\1/.test(pw)) issues.push('pas trois fois le même caractère d\'affilée');
  return { ok: issues.length === 0, issues };
}
export function generatePassword(length = 18) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!?@#$%&*+-=_'];
  const all = sets.join('');
  for (;;) {
    const r = randomBytes(length);
    const pw = [...r].map((x, i) => (i < sets.length ? sets[i] : all)[x % (i < sets.length ? sets[i] : all).length]);
    // mélange (Fisher-Yates) pour que les catégories obligatoires ne soient pas toujours au début
    const s = randomBytes(length);
    for (let i = pw.length - 1; i > 0; i--) { const j = s[i] % (i + 1); [pw[i], pw[j]] = [pw[j], pw[i]]; }
    const out = pw.join('');
    if (checkPassword(out).ok) return out;
  }
}
