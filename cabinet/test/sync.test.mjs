/* Deux PC réels côte à côte : le cabinet (référence) et le portable du Dr Nouha.
   Lancer : npm test */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { loadConfig } from '../server/config.mjs';
import { createApp } from '../server/index.mjs';
import * as C from '../public/js/secure/crypto.mjs';
import { PRESETS } from '../public/js/secure/perms.mjs';

let dir, office, laptop, officeSrv, laptopSrv, OFFICE, LAPTOP;
const S = {};

async function serve(app) { const s = http.createServer(app.handler); await new Promise(r => s.listen(0, '127.0.0.1', r)); return s; }
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cabinet-sync-'));
  const ocfg = loadConfig({ dataDir: path.join(dir, 'office') });
  office = createApp(ocfg, { log: () => {} });
  officeSrv = await serve(office);
  OFFICE = `http://127.0.0.1:${officeSrv.address().port}`;
  const lcfg = loadConfig({ dataDir: path.join(dir, 'laptop'), role: 'nomade', officeUrl: OFFICE, syncEvery: 3600e3 });
  laptop = createApp(lcfg, { log: () => {} });
  laptopSrv = await serve(laptop);
  LAPTOP = `http://127.0.0.1:${laptopSrv.address().port}`;
  S.ocfg = ocfg;
});
after(() => { officeSrv.close(); laptopSrv.close(); office.close(); laptop.close(); fs.rmSync(dir, { recursive: true, force: true }); });

function client(base) {
  let cookie = '';
  const call = async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Cabinet': '1', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  return { get: u => call('GET', u), post: (u, b) => call('POST', u, b), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: u => call('DELETE', u) };
}
const PW = { talel: 'Infra!Portable2026#Tk', nouha: 'Sourire-Durable@2026!', amel: 'Assist#Medenine2026!' };
async function login(c, username, password) {
  const p = await c.post('/api/login/params', { username });
  const k = await C.deriveKeys(password, p.kdfSalt, p.kdfIter);
  const r = await c.post('/api/login', { username, authKey: k.authKey });
  if (r.status === 200 && r.privKeyEnc && r.wrappedDek) r.dek = await C.unwrapDek(r.wrappedDek, await C.unlockPrivateKey(r.privKeyEnc, k.encKey));
  return r;
}
async function activate(c, username, code, password) {
  const inviteAuth = await C.inviteAuth(code, username);
  const chk = await c.post('/api/invite/check', { username, inviteAuth });
  const salt = C.newSalt(), k = await C.deriveKeys(password, salt), kp = await C.newUserKeyPair();
  const wrappedDek = chk.inviteDek ? await C.wrapDekFor(await C.unwrapDekFromInvite(chk.inviteDek, code, username), kp.publicJwk) : null;
  return c.post('/api/invite/accept', { username, inviteAuth, authKey: k.authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS, pubKey: kp.publicJwk, privKeyEnc: await C.lockPrivateKey(kp.privateKey, k.encKey), wrappedDek });
}
const put = async (c, dek, coll, id, obj, extra = {}) => c.put(`/api/records/${coll}/${id}`, { ...(await C.encryptRecord(dek, coll, id, obj)), ...extra });
async function read(c, dek) {
  const r = await c.get('/api/records?since=0'); if (r.status !== 200) return r;
  const out = {}; for (const x of r.records) if (!x.deleted) (out[x.c] ||= {})[x.id] = { ...(await C.decryptRecord(dek, x.c, x.id, x)), _v: x.v };
  return out;
}
const sync = () => laptop.sync.syncOnce();

test('cabinet installé : administrateur, Dr Nouha, assistante, premiers dossiers', async () => {
  const t = S.talelO = client(OFFICE);
  const salt = C.newSalt(), k = await C.deriveKeys(PW.talel, salt);
  assert.equal((await t.post('/api/setup', { setupToken: S.ocfg.secrets.setupToken, username: 'talel', displayName: 'Talel Ksiksi', authKey: k.authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS })).status, 200);
  const code = C.newInviteCode();
  await t.post('/api/users', { username: 'nouha', displayName: 'Dr Nouha Ksiksi', kind: 'admin', roleLabel: 'Dentiste', inviteAuth: await C.inviteAuth(code, 'nouha') });
  const n = S.nouhaO = client(OFFICE);
  const a = await activate(n, 'nouha', code, PW.nouha);
  const dek = S.dek = await C.newDek();
  const b = await n.post('/api/keys/bootstrap', { wrappedDek: await C.wrapDekFor(dek, a.pubKey), recoveryDek: await C.wrapDekWithRecovery(dek, C.newRecoveryKey()) });
  assert.equal(b.status, 200);
  const c2 = C.newInviteCode();
  await n.post('/api/users', { username: 'amel', displayName: 'Amel', kind: 'staff', ...PRESETS.assistant, inviteAuth: await C.inviteAuth(c2, 'amel'), inviteDek: await C.wrapDekForInvite(dek, c2, 'amel') });
  S.amelO = client(OFFICE); assert.equal((await activate(S.amelO, 'amel', c2, PW.amel)).status, 200);
  for (const [id, name] of [['p1', 'Amira'], ['p2', 'Sofiene'], ['p3', 'Yosra'], ['p4', 'Rania']])
    assert.equal((await put(n, dek, 'patients', id, { firstName: name, lastName: 'Test', phone: `+216 22 00${id.slice(1)} 000` }, { blind: { phone: await C.blindIndex(dek, 'phone', `22 00${id.slice(1)} 000`) } })).status, 200);
});

test('association : mauvais code refusé, bon code accepté une seule fois', async () => {
  const l = client(LAPTOP);
  assert.equal((await l.get('/api/status')).paired, false);
  const bad = await l.post('/api/portable/pair', { code: 'AAAAA-BBBBB' });
  assert.equal(bad.status, 403);
  const { code } = await S.nouhaO.post('/api/sync/pairing-code');
  const ok = await l.post('/api/portable/pair', { code, name: 'Portable de test' });
  assert.equal(ok.status, 200, ok.message);
  assert.equal(ok.sync.ok, true, ok.sync.error);
  assert.equal((await l.post('/api/portable/pair', { code })).status, 409, 'déjà associé');
  const nodes = await S.talelO.get('/api/sync/nodes');
  assert.equal(nodes.nodes.length, 1);
  assert.equal(nodes.nodes[0].name, 'Portable de test');
});

test('sur le portable : Dr Nouha se connecte avec son mot de passe habituel ; l\'assistante est refusée', async () => {
  const n = S.nouhaL = client(LAPTOP);
  const r = await login(n, 'nouha', PW.nouha);
  assert.equal(r.status, 200, r.message);
  S.dekL = r.dek;
  const data = await read(n, S.dekL);
  assert.equal(Object.keys(data.patients).length, 4, 'tous les dossiers copiés');
  assert.equal(data.patients.p1.firstName, 'Amira');
  const a = await login(client(LAPTOP), 'amel', PW.amel);
  assert.equal(a.status, 401, 'l\'assistante n\'a pas d\'identifiants sur le portable');
  // la recherche par téléphone fonctionne aussi sur le portable (index aveugle copié)
  const f = await n.get(`/api/blind?field=phone&hash=${encodeURIComponent(await C.blindIndex(S.dekL, 'phone', '22 001 000'))}`);
  assert.deepEqual(f.ids, ['p1']);
});

test('travail à la maison (cabinet éteint) puis retour : tout arrive au cabinet', async () => {
  officeSrv.close(); await new Promise(r => setTimeout(r, 100));
  const n = S.nouhaL;
  assert.equal((await put(n, S.dekL, 'patients', 'p5', { firstName: 'Nouveau', lastName: 'Patient du soir' })).status, 200);
  const cur = (await read(n, S.dekL)).patients.p1;
  assert.equal((await put(n, S.dekL, 'patients', 'p1', { firstName: 'Amira', lastName: 'Test', allergies: 'Pénicilline (vu à la maison)' }, { base: cur._v })).status, 200);
  const off = await sync();
  assert.equal(off.ok, false, 'cabinet injoignable');
  assert.equal((await n.get('/api/status')).pending, 2, '2 modifications en attente');
  // le lendemain matin : le PC du cabinet est rallumé
  officeSrv = http.createServer(office.handler); await new Promise(r => officeSrv.listen(+new URL(OFFICE).port, '127.0.0.1', r));
  const on = await sync();
  assert.equal(on.ok, true, on.error);
  assert.equal(on.sent, 2);
  const o = await read(S.amelO, (await login(S.amelO = client(OFFICE), 'amel', PW.amel)).dek);
  assert.equal(o.patients.p5.lastName, 'Patient du soir', 'nouveau patient visible au cabinet');
  assert.equal(o.patients.p1.allergies, 'Pénicilline (vu à la maison)');
  assert.equal((await client(LAPTOP).get('/api/status')).pending, 0);
});

test('modifications faites au cabinet : arrivent sur le portable', async () => {
  const amelDek = (await login(S.amelO, 'amel', PW.amel)).dek;
  await put(S.amelO, amelDek, 'appointments', 'a1', { patientId: 'p2', date: '2026-11-14', time: '09:00', service: 'Consultation' });
  const r = await sync();
  assert.equal(r.ok, true);
  const l = await read(S.nouhaL, S.dekL);
  assert.equal(l.appointments.a1.time, '09:00');
});

test('même dossier modifié des deux côtés : rien n\'est perdu, le Dr Nouha choisit', async () => {
  const amelDek = (await login(S.amelO, 'amel', PW.amel)).dek;
  const oc = (await read(S.amelO, amelDek)).patients.p3;
  await put(S.amelO, amelDek, 'patients', 'p3', { firstName: 'Yosra', lastName: 'Test', phone: '+216 98 111 222' }, { base: oc._v });
  const lc = (await read(S.nouhaL, S.dekL)).patients.p3;
  await put(S.nouhaL, S.dekL, 'patients', 'p3', { firstName: 'Yosra', lastName: 'Test', notes: 'Note du soir' }, { base: lc._v });
  const r = await sync();
  assert.equal(r.conflicts, 1, 'conflit détecté');
  const c = await S.nouhaL.get('/api/sync/conflicts');
  assert.equal(c.conflicts.length, 1);
  const local = await C.decryptRecord(S.dekL, 'patients', 'p3', c.conflicts[0].local);
  const remote = await C.decryptRecord(S.dekL, 'patients', 'p3', c.conflicts[0].office);
  assert.equal(local.notes, 'Note du soir'); assert.equal(remote.phone, '+216 98 111 222');
  // elle garde sa version du portable : elle part au cabinet
  assert.equal((await S.nouhaL.post('/api/sync/resolve', { c: 'patients', id: 'p3', keep: 'local' })).status, 200);
  await sync();
  const o = await read(S.amelO, amelDek);
  assert.equal(o.patients.p3.notes, 'Note du soir');
  assert.equal((await S.nouhaL.get('/api/sync/conflicts')).conflicts.length, 0);
});

test('suppression d\'un côté : supprimé de l\'autre', async () => {
  assert.equal((await S.nouhaL.del('/api/records/patients/p4')).status, 200);
  await sync();
  const amelDek = (await login(S.amelO, 'amel', PW.amel)).dek;
  assert.equal((await read(S.amelO, amelDek)).patients.p4, undefined);
});

test('administrateur informatique sur le portable : comptes oui, dossiers jamais', async () => {
  const t = client(LAPTOP);
  assert.equal((await login(t, 'talel', PW.talel)).status, 200);
  assert.equal((await t.get('/api/records?since=0')).status, 403);
  assert.equal((await t.get('/api/users')).status, 200);
  // création d'un compte depuis le portable : transmise au cabinet
  const code = C.newInviteCode();
  const r = await t.post('/api/users', { username: 'stagiaire', displayName: 'Stagiaire', kind: 'staff', ...PRESETS.temp, inviteAuth: await C.inviteAuth(code, 'stagiaire') });
  assert.equal(r.status, 200, r.message);
  const atOffice = (await S.talelO.get('/api/users')).users.find(u => u.username === 'stagiaire');
  assert.ok(atOffice, 'compte créé au cabinet');
  assert.ok((await t.get('/api/users')).users.find(u => u.username === 'stagiaire'), 'et recopié sur le portable');
  // actions réservées au PC du cabinet
  assert.equal((await t.post('/api/setup', {})).status, 403);
});

test('factures : numérotation distincte cabinet / portable (aucun doublon)', async () => {
  const lo = await S.nouhaL.post('/api/seq/invoice');
  const of = await (await (async () => { const n = client(OFFICE); await login(n, 'nouha', PW.nouha); return n; })()).post('/api/seq/invoice');
  assert.match(lo.label, /^FAC-\d{4}-P\d{3}$/);
  assert.match(of.label, /^FAC-\d{4}-\d{4}$/);
});

test('journal du cabinet : les actions du portable y figurent, marquées « portable »', async () => {
  await sync();
  const j = await S.talelO.get('/api/audit?limit=500');
  const fromLaptop = j.entries.filter(e => e.origin === 'portable');
  assert.ok(fromLaptop.some(e => e.action === 'connexion' && e.username === 'nouha'), 'connexion sur le portable');
  assert.ok(fromLaptop.some(e => e.action === 'conflit_tranche'), 'conflit tranché');
});

test('portable retiré au cabinet : il ne peut plus se synchroniser', async () => {
  const id = (await S.talelO.get('/api/sync/nodes')).nodes[0].id;
  assert.equal((await S.talelO.post(`/api/sync/nodes/${id}/revoke`)).status, 200);
  const r = await sync();
  assert.equal(r.ok, false);
  assert.match(r.error, /retiré/);
});
