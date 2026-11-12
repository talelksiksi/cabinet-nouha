/* Comptes protégés (Dr Nouha, administrateur informatique), outil du portable, restauration sur un PC de remplacement.
   Lancer : npm test */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { loadConfig, ROOT } from '../server/config.mjs';
import { createApp } from '../server/index.mjs';
import { provisionProtected } from '../server/accounts.mjs';
import * as C from '../public/js/secure/crypto.mjs';
import { PRESETS } from '../public/js/secure/perms.mjs';

let dir, office, laptop, officeSrv, laptopSrv, OFFICE, LAPTOP, ocfg, lcfg;
const S = {};
const serveOn = async (app, port = 0) => { const s = http.createServer(app.handler); await new Promise(r => s.listen(port, '127.0.0.1', r)); return s; };

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cabinet-prot-'));
  ocfg = loadConfig({ dataDir: path.join(dir, 'office') });
  office = createApp(ocfg, { log: () => {} });
  officeSrv = await serveOn(office);
  OFFICE = `http://127.0.0.1:${officeSrv.address().port}`;
  lcfg = loadConfig({ dataDir: path.join(dir, 'laptop'), role: 'nomade', officeUrl: OFFICE, syncEvery: 3600e3 });
  laptop = createApp(lcfg, { log: () => {} });
  laptopSrv = await serveOn(laptop);
  LAPTOP = `http://127.0.0.1:${laptopSrv.address().port}`;
});
after(() => { officeSrv.close(); laptopSrv.close(); office.close(); laptop.close(); fs.rmSync(dir, { recursive: true, force: true }); });

function client(base) {
  let cookie = '';
  const call = async (method, url, body, headers = {}) => {
    const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Cabinet': '1', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  return { get: u => call('GET', u), post: (u, b, h) => call('POST', u, b, h), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b) };
}
const PW = { talel: 'Infra!Protege2026#Tk', nouha: 'Sourire-Durable@2026!', nouha2: 'Nouveau-Depart#2027!', amel: 'Assist#Medenine2026!' };
async function login(c, username, password) {
  const p = await c.post('/api/login/params', { username });
  const k = await C.deriveKeys(password, p.kdfSalt, p.kdfIter);
  const r = await c.post('/api/login', { username, authKey: k.authKey });
  if (r.status === 200 && r.privKeyEnc && r.wrappedDek) r.dek = await C.unwrapDek(r.wrappedDek, await C.unlockPrivateKey(r.privKeyEnc, k.encKey));
  r.encKey = k.encKey;
  return r;
}
async function activate(c, username, code, password) {
  const inviteAuth = await C.inviteAuth(code, username);
  const chk = await c.post('/api/invite/check', { username, inviteAuth });
  if (chk.status !== 200) return chk;
  const salt = C.newSalt(), k = await C.deriveKeys(password, salt), kp = await C.newUserKeyPair();
  const wrappedDek = chk.inviteDek ? await C.wrapDekFor(await C.unwrapDekFromInvite(chk.inviteDek, code, username), kp.publicJwk) : null;
  const r = await c.post('/api/invite/accept', { username, inviteAuth, authKey: k.authKey, kdfSalt: salt, kdfIter: C.KDF_ITERATIONS, pubKey: kp.publicJwk, privKeyEnc: await C.lockPrivateKey(kp.privateKey, k.encKey), wrappedDek });
  r.kp = kp; return r;
}
const put = async (c, dek, coll, id, obj, extra = {}) => c.put(`/api/records/${coll}/${id}`, { ...(await C.encryptRecord(dek, coll, id, obj)), ...extra });
async function read(c, dek) {
  const r = await c.get('/api/records?since=0'); if (r.status !== 200) return r;
  const out = {}; for (const x of r.records) if (!x.deleted) (out[x.c] ||= {})[x.id] = { ...(await C.decryptRecord(dek, x.c, x.id, x)), _v: x.v };
  return out;
}
const tool = (data, role, ...args) => {
  try { return { code: 0, out: execFileSync(process.execPath, ['--no-warnings', path.join(ROOT, 'tools', 'comptes.mjs'), ...args], { env: { ...process.env, CABINET_DATA: data, CABINET_ROLE: role }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; }
};

test('installation : les deux comptes protégés existent déjà, chacun active le sien avec son code', async () => {
  const res = provisionProtected(office.db, ocfg);
  assert.deepEqual(res.map(r => [r.username, r.state]), [['nouha', 'created'], ['talel', 'created']]);
  S.codes = Object.fromEntries(res.map(r => [r.username, r.code]));
  assert.equal((await client(OFFICE).get('/api/status')).setupNeeded, false, 'pas d\'écran d\'installation');
  // un code ne marche que pour son compte
  assert.equal((await activate(client(OFFICE), 'talel', S.codes.nouha, PW.talel)).status, 403);
  S.talel = client(OFFICE);
  const t = await activate(S.talel, 'talel', S.codes.talel, PW.talel);
  assert.equal(t.status, 200, t.message);
  assert.equal(t.user.kind, 'superadmin');
  assert.equal(t.user.protected, true);
  S.nouha = client(OFFICE);
  const a = await activate(S.nouha, 'nouha', S.codes.nouha, PW.nouha);
  assert.equal(a.status, 200, a.message);
  assert.equal(a.user.kind, 'admin');
  // première mise en service : clé des données + feuille de secours
  const dek = S.dek = await C.newDek();
  S.recovery = C.newRecoveryKey();
  assert.equal((await S.nouha.post('/api/keys/bootstrap', { wrappedDek: await C.wrapDekFor(dek, a.kp.publicJwk), recoveryDek: await C.wrapDekWithRecovery(dek, S.recovery) })).status, 200);
  // codes à usage unique
  assert.equal((await activate(client(OFFICE), 'nouha', S.codes.nouha, 'Autre#Essai2026!x')).status, 403);
  // relancer l'installation ne touche pas aux comptes activés
  assert.deepEqual(provisionProtected(office.db, ocfg).map(r => [r.username, r.state, r.code]), [['nouha', 'active', null], ['talel', 'active', null]]);
  assert.equal(tool(ocfg.dataDir, 'cabinet', 'init').code, 0);
});

test('dans l\'application : personne ne modifie, désactive ni réinitialise un compte protégé', async () => {
  const users = (await S.talel.get('/api/users')).users;
  const nouha = users.find(u => u.username === 'nouha'), talel = users.find(u => u.username === 'talel');
  assert.ok(nouha.protected && talel.protected);
  for (const [c, target] of [[S.talel, nouha], [S.nouha, talel], [S.talel, talel]]) {
    const p = await c.patch(`/api/users/${target.id}`, { displayName: 'Pirate', kind: 'staff' });
    assert.equal(p.status, 403); assert.equal(p.error, 'protected');
    assert.equal((await c.post(`/api/users/${target.id}/reset`, { inviteAuth: await C.inviteAuth(C.newInviteCode(), target.username) })).status, 403);
    assert.equal((await c.post(`/api/users/${target.id}/disable`)).status, 403);
  }
  // les autres comptes restent gérés normalement par les deux
  const code = C.newInviteCode();
  const cr = await S.nouha.post('/api/users', { username: 'amel', displayName: 'Amel', kind: 'staff', ...PRESETS.assistant, inviteAuth: await C.inviteAuth(code, 'amel'), inviteDek: await C.wrapDekForInvite(S.dek, code, 'amel') });
  assert.equal(cr.status, 200);
  assert.equal((await S.talel.patch(`/api/users/${cr.user.id}`, { roleLabel: 'Assistante principale' })).status, 200);
  assert.equal((await activate(client(OFFICE), 'amel', code, PW.amel)).status, 200);
  // chacun change son propre mot de passe
  const me = await login(client(OFFICE), 'talel', PW.talel);
  assert.equal(me.status, 200);
  assert.equal((await put(S.nouha, S.dek, 'patients', 'p1', { firstName: 'Amira', lastName: 'Avant' })).status, 200);
});

test('portable associé ; l\'outil « comptes protégés » refuse de tourner au cabinet', async () => {
  const { code } = await S.nouha.post('/api/sync/pairing-code');
  const ok = await client(LAPTOP).post('/api/portable/pair', { code, name: 'Portable test' });
  assert.equal(ok.status, 200, ok.message);
  const r = tool(ocfg.dataDir, 'cabinet', 'reinitialiser', 'nouha');
  assert.equal(r.code, 1);
  assert.match(r.out, /uniquement depuis le portable/);
  // sans jeton de portable : refusé
  assert.equal((await client(OFFICE).post('/api/sync/protected', { ops: [{ op: 'rename', username: 'nouha', payload: { displayName: 'Pirate' } }] })).status, 401);
});

test('mot de passe oublié : l\'outil du portable donne un code, le Dr Nouha retrouve ses dossiers avec la feuille de secours', async () => {
  const r = tool(lcfg.dataDir, 'nomade', 'reinitialiser', 'nouha');
  assert.equal(r.code, 0, r.out);
  const code = r.out.match(/[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}/)[0];
  assert.match(tool(lcfg.dataDir, 'nomade', 'etat').out, /EN ATTENTE/);
  const s = await laptop.sync.syncOnce();
  assert.equal(s.ok, true, s.error);
  assert.match(tool(lcfg.dataDir, 'nomade', 'etat').out, /appliquée au cabinet/);
  // l'ancien mot de passe ne marche plus, ni au cabinet ni sur le portable
  assert.equal((await login(client(OFFICE), 'nouha', PW.nouha)).status, 401);
  assert.equal((await login(client(LAPTOP), 'nouha', PW.nouha)).status, 401);
  // activation au cabinet avec le nouveau code : compte actif mais SANS accès aux dossiers
  const n = client(OFFICE);
  const a = await activate(n, 'nouha', code, PW.nouha2);
  assert.equal(a.status, 200, a.message);
  assert.equal(a.user.status, 'pending_key');
  assert.equal((await n.get('/api/records?since=0')).status, 403);
  // la feuille de secours redonne l'accès
  const { recoveryDek } = await n.get('/api/keys/recovery');
  const dek = await C.unwrapDekWithRecovery(recoveryDek, S.recovery);
  const self = await n.post('/api/keys/self', { wrappedDek: await C.wrapDekFor(dek, a.kp.publicJwk) });
  assert.equal(self.status, 200);
  const l = await login(S.nouha = client(OFFICE), 'nouha', PW.nouha2);
  assert.equal(l.status, 200);
  assert.equal((await read(S.nouha, l.dek)).patients.p1.lastName, 'Avant');
  // renommer via l'outil
  assert.equal(tool(lcfg.dataDir, 'nomade', 'renommer', 'talel', 'Talel', 'K.').code, 0);
  await laptop.sync.syncOnce();
  assert.equal((await S.talel.get('/api/users')).users.find(u => u.username === 'talel').displayName, 'Talel K.');
  // sur le portable, le nouveau mot de passe fonctionne après synchronisation
  await laptop.sync.syncOnce();
  assert.equal((await login(client(LAPTOP), 'nouha', PW.nouha2)).status, 200);
  const journal = (await S.talel.get('/api/audit?limit=200')).entries || (await S.talel.get('/api/audit')).entries || [];
  assert.ok(journal.some(e => e.action === 'compte_protege_reinitialise'), 'tracé dans le journal du cabinet');
});

test('PC du cabinet remplacé : restauration de la sauvegarde USB, mêmes mots de passe, le portable renvoie ce qui manquait', async () => {
  const b = await office.backup.run('manual');
  const full = office.backup.decryptFull(fs.readFileSync(b.path));
  assert.equal(full.identity.pepper, ocfg.secrets.pepper, 'la sauvegarde emporte l\'identité du serveur');
  // après la sauvegarde : travail au cabinet, synchronisé sur le portable
  const dek = (await login(S.nouha, 'nouha', PW.nouha2)).dek;
  const cur = (await read(S.nouha, dek)).patients.p1;
  assert.equal((await put(S.nouha, dek, 'patients', 'p1', { firstName: 'Amira', lastName: 'Après sauvegarde' }, { base: cur._v })).status, 200);
  assert.equal((await put(S.nouha, dek, 'patients', 'p2', { firstName: 'Karim', lastName: 'Nouveau' })).status, 200);
  assert.equal((await laptop.sync.syncOnce()).ok, true);
  // le PC du cabinet tombe en panne ; nouveau PC : installation neuve (nouveaux secrets) puis restauration
  officeSrv.closeAllConnections(); officeSrv.close(); office.close();
  await new Promise(r => setTimeout(r, 300));     // les connexions gardées ouvertes par fetch voient la fermeture
  const port = +new URL(OFFICE).port;
  const newDir = path.join(dir, 'office-neuf');
  const fresh = loadConfig({ dataDir: newDir });
  assert.notEqual(fresh.secrets.pepper, ocfg.secrets.pepper);
  const out = execFileSync(process.execPath, ['--no-warnings', path.join(ROOT, 'tools', 'restore.mjs'), b.path, '--cle', ocfg.secrets.backupKey], { env: { ...process.env, CABINET_DATA: newDir }, encoding: 'utf8' });
  assert.match(out, /Identité du cabinet reprise/);
  const ncfg = loadConfig({ dataDir: newDir });
  assert.equal(ncfg.secrets.pepper, ocfg.secrets.pepper);
  assert.equal(ncfg.secrets.backupKey, ocfg.secrets.backupKey);
  office = createApp(ncfg, { log: () => {} });
  officeSrv = await serveOn(office, port);
  // mot de passe habituel accepté sur le nouveau PC
  const n = client(OFFICE);
  const l = await login(n, 'nouha', PW.nouha2);
  assert.equal(l.status, 200, l.message);
  let o = await read(n, l.dek);
  assert.equal(o.patients.p1.lastName, 'Avant', 'la sauvegarde datait d\'avant');
  assert.equal(o.patients.p2, undefined);
  // le portable se synchronise : il renvoie ce que la sauvegarde n'avait pas
  const s = await laptop.sync.syncOnce();
  assert.equal(s.ok, true, s.error);
  assert.ok(s.healed >= 2, JSON.stringify(s));
  o = await read(n, l.dek);
  assert.equal(o.patients.p1.lastName, 'Après sauvegarde');
  assert.equal(o.patients.p2.lastName, 'Nouveau');
  assert.equal((await laptop.sync.syncOnce()).conflicts, 0);
});
