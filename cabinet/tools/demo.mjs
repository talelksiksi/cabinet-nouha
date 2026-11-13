/* ═══════════════════════════════════════════
   Démonstration sur ce PC : http://localhost:3475
   - repart de zéro à chaque lancement (dossier data-demo/, jamais dans Git)
   - crée les comptes et un cabinet animé (données fictives) en passant par la vraie API et le vrai chiffrement
   - les identifiants de démonstration sont écrits dans data-demo/COMPTES-DEMO.txt
   Usage : node tools/demo.mjs [--keep] [--no-open] [--port 3475]
   ═══════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as C from '../public/js/secure/crypto.mjs';
import { PRESETS } from '../public/js/secure/perms.mjs';
import { buildDataset } from './demo-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PORT = +arg('--port', 3475), KEEP = process.argv.includes('--keep'), OPEN = !process.argv.includes('--no-open'), PORTABLE = !process.argv.includes('--sans-portable');
const DATA = path.join(ROOT, 'data-demo'), DATA_P = path.join(ROOT, 'data-demo-portable'), PORT_P = PORT + 1;
const BASE = `http://localhost:${PORT}`;

if (!KEEP) { fs.rmSync(DATA, { recursive: true, force: true }); fs.rmSync(DATA_P, { recursive: true, force: true }); }
const fresh = !fs.existsSync(path.join(DATA, 'cabinet.db'));
const srv = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'index.mjs')], {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, CABINET_DATA: DATA, CABINET_DEMO: '1', CABINET_PLAIN_PORT: String(PORT), CABINET_HTTPS_PORT: '8443', CABINET_HTTP_PORT: '8080' },
});
let log = '';
srv.stdout.on('data', d => { log += d; process.stdout.write(String(d).replace(/code d'installation : \S+/, 'code d\'installation : (démo)')); });
srv.stderr.on('data', d => process.stderr.write(d));
let srvP = null;
const stop = () => { srv.kill(); srvP?.kill(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
srv.on('exit', c => { console.log('Serveur arrêté', c ?? ''); process.exit(c || 0); });

/* ── petit client HTTP avec cookie, comme un navigateur ── */
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', 'X-Cabinet': '1', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${data.message || ''}`);
    return data;
  };
}
async function activate(call, username, code, password) {
  const inviteAuth = await C.inviteAuth(code, username);
  const chk = await call('POST', '/api/invite/check', { username, inviteAuth });
  const salt = C.newSalt();
  const { authKey, encKey } = await C.deriveKeys(password, salt);
  const kp = await C.newUserKeyPair();
  const wrappedDek = chk.inviteDek ? await C.wrapDekFor(await C.unwrapDekFromInvite(chk.inviteDek, code, username), kp.publicJwk) : null;
  const r = await call('POST', '/api/invite/accept', { username, inviteAuth, authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS, pubKey: kp.publicJwk, privKeyEnc: await C.lockPrivateKey(kp.privateKey, encKey), wrappedDek });
  return { r, kp, encKey };
}

async function seed() {
  const secrets = JSON.parse(fs.readFileSync(path.join(DATA, 'secrets.json'), 'utf8'));
  const pw = { talel: C.generatePassword(16), nouha: C.generatePassword(16), amel: C.generatePassword(16), stagiaire: C.generatePassword(16), remplacant: C.generatePassword(16) };
  const t = client(), n = client();
  // super-admin
  let salt = C.newSalt();
  let k = await C.deriveKeys(pw.talel, salt);
  await t('POST', '/api/setup', { setupToken: secrets.setupToken, username: 'talel', displayName: 'Talel Ksiksi', authKey: k.authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS });
  // Dr Nouha (admin) : invitée par le super-admin, crée la clé des données
  const code = C.newInviteCode();
  await t('POST', '/api/users', { username: 'nouha', displayName: 'Dr Nouha Ksiksi', kind: 'admin', roleLabel: 'Dentiste', inviteAuth: await C.inviteAuth(code, 'nouha') });
  const a = await activate(n, 'nouha', code, pw.nouha);
  const dek = await C.newDek(), recovery = C.newRecoveryKey();
  const boot = await n('POST', '/api/keys/bootstrap', { wrappedDek: await C.wrapDekFor(dek, a.r.pubKey), recoveryDek: await C.wrapDekWithRecovery(dek, recovery) });
  const nouhaId = boot.user.id;
  // équipe créée par le Dr Nouha (clé jointe à l'invitation)
  const team = [
    ['amel', 'Amel Ben Ali', PRESETS.assistant], ['stagiaire', 'Yasmine (stagiaire été)', PRESETS.temp], ['remplacant', 'Dr Walid Remplaçant', PRESETS.dentist],
  ];
  const ids = {};
  for (const [username, displayName, preset] of team) {
    const c = C.newInviteCode();
    const r = await n('POST', '/api/users', { username, displayName, kind: 'staff', roleLabel: preset.roleLabel, perms: preset.perms, scope: preset.scope,
      inviteAuth: await C.inviteAuth(c, username), inviteDek: await C.wrapDekForInvite(dek, c, username) });
    ids[username] = r.user.id;
    await activate(client(), username, c, pw[username]);
  }
  // données du cabinet, chiffrées comme le ferait le navigateur
  const ds = buildDataset({ nouha: nouhaId, remp: ids.remplacant, now: new Date() });
  const ownersOf = pid => [...new Set([...ds.appointments, ...ds.treatments].filter(x => x.patientId === pid && x.dentistId).map(x => x.dentistId))].sort();
  const put = async (c, id, obj, owners, blind) => n('PUT', `/api/records/${c}/${encodeURIComponent(id)}`, { ...(await C.encryptRecord(dek, c, String(id), obj)), owners, blind });
  let count = 0;
  for (const p of ds.patients) { await put('patients', p.id, p, ownersOf(p.id), { phone: await C.blindIndex(dek, 'phone', p.phone) }); count++; }
  for (const c of ['appointments', 'treatments', 'payments', 'documents', 'labworks', 'gallery', 'requests', 'activity'])
    for (const o of ds[c]) { await put(c, o.id, o, o.patientId != null ? [...new Set([...ownersOf(o.patientId), ...(o.dentistId ? [o.dentistId] : [])])].sort() : (c === 'requests' || c === 'activity' ? [] : null)); count++; }
  for (const c of ['labs', 'labpayments', 'tasks', 'expenses']) for (const o of ds[c]) { await put(c, o.id, o, null); count++; }
  for (const [pid, teeth] of Object.entries(ds.chart)) { await put('chart', pid, teeth, ownersOf(+pid)); count++; }
  await put('settings', 'clinic', ds.settings.clinic, null); await put('settings', 'acts', ds.settings.acts, null);
  for (let i = 0; i < ds.payments.length; i++) await n('POST', '/api/seq/invoice');     // la numérotation reprend après les factures de démo
  fs.writeFileSync(path.join(DATA, 'COMPTES-DEMO.txt'), [
    'Espace cabinet — comptes de DÉMONSTRATION (données fictives, régénérées à chaque lancement)', `Adresse : ${BASE}`, '',
    `talel       ${pw.talel}     super-admin : comptes, journal, sauvegardes — aucun dossier patient`,
    `nouha       ${pw.nouha}     Dr Nouha : tout le cabinet + utilisateurs`,
    `amel        ${pw.amel}     assistante confirmée (caisse incluse)`,
    `stagiaire   ${pw.stagiaire}     temporaire : agenda, salle d'attente, patients en lecture, tâches`,
    `remplacant  ${pw.remplacant}     dentiste remplaçant : uniquement ses patients`, '',
    `Clé de secours des données (démo) : ${recovery}`,
  ].join('\r\n'));
  return count;
}

/* Portable de démonstration : même programme en mode « nomade », associé au cabinet de démonstration */
async function startPortable() {
  const fresh = !fs.existsSync(path.join(DATA_P, 'portable.json'));
  srvP = spawn(process.execPath, ['--no-warnings', path.join(ROOT, 'server', 'index.mjs')], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CABINET_DATA: DATA_P, CABINET_ROLE: 'nomade', CABINET_PLAIN_PORT: String(PORT_P), CABINET_OFFICE_URL: BASE, CABINET_DEMO: '1', CABINET_ESCROW: '1' },
  });
  let plog = ''; srvP.stdout.on('data', d => { plog += d; }); srvP.stderr.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 80 && !plog.includes('portable'); i++) await new Promise(r => setTimeout(r, 250));
  if (!fresh) return;
  const line = fs.readFileSync(path.join(DATA, 'COMPTES-DEMO.txt'), 'utf8').split(/\r?\n/).find(l => l.startsWith('nouha '));
  const pwNouha = line.trim().split(/\s+/)[1];
  const n = client(), p = await n('POST', '/api/login/params', { username: 'nouha' });
  const k = await C.deriveKeys(pwNouha, p.kdfSalt, p.kdfIter);
  await n('POST', '/api/login', { username: 'nouha', authKey: k.authKey });
  const { code } = await n('POST', '/api/sync/pairing-code');
  const r = await fetch(`http://localhost:${PORT_P}/api/portable/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cabinet': '1' }, body: JSON.stringify({ code, name: 'Portable du Dr Nouha (démo)' }) }).then(r => r.json());
  console.log(r.ok ? `Portable de démonstration associé et synchronisé (${r.sync?.received ?? 0} dossiers copiés).` : `Association du portable de démo : ${r.message || 'échec'}`);
}

(async () => {
  for (let i = 0; i < 80 && !log.includes('Sur ce PC'); i++) await new Promise(r => setTimeout(r, 250));
  if (!log.includes('Sur ce PC')) { console.error('Le serveur de démonstration n\'a pas démarré.'); return stop(); }
  if (fresh) {
    process.stdout.write('Création du cabinet de démonstration (comptes, patients, agenda)… ');
    const t0 = Date.now(), n = await seed();
    console.log(`${n} enregistrements chiffrés en ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
    // comme une vraie installation : les comptes du Dr Nouha et de l'administrateur sont protégés
    const { DatabaseSync } = await import('node:sqlite');
    const ddb = new DatabaseSync(path.join(DATA, 'cabinet.db'));
    ddb.exec('PRAGMA busy_timeout = 5000');
    ddb.prepare(`UPDATE users SET protected = 1 WHERE username IN ('talel', 'nouha')`).run();
    ddb.close();
  }
  if (PORTABLE) await startPortable();
  console.log(`\n  ➜ Cabinet : ${BASE}${PORTABLE ? `\n  ➜ Portable du Dr Nouha : http://localhost:${PORT_P}  (Dr Nouha et administrateur uniquement)` : ''}\n  ➜ Identifiants : ${path.join(DATA, 'COMPTES-DEMO.txt')}\n  (Ctrl+C pour arrêter)\n`);
  if (OPEN) exec(process.platform === 'win32' ? `start "" "${BASE}"` : `xdg-open ${BASE}`);
})().catch(e => { console.error(e); stop(); });
