/* ═══════════════════════════════════════════
   Synchronisation cabinet ⇄ ordinateur portable du Dr Nouha
   ───────────────────────────────────────────
   - Le PC du cabinet est la référence (comptes, sauvegardes, clé USB). Le portable est une copie complète
     qui fonctionne seule (à la maison, sans Internet) et se synchronise dès qu'il retrouve le Wi-Fi du cabinet.
   - Les serveurs n'échangent que des enregistrements CHIFFRÉS : aucun des deux ne lit les dossiers.
   - Association par un code à usage unique (15 min) : tout ce qui transite pendant l'association est chiffré
     et signé avec une clé tirée de ce code ; ensuite le portable n'accepte que le certificat du cabinet.
   - Même donnée modifiée des deux côtés : rien n'est écrasé, les deux versions sont gardées et le Dr Nouha choisit.
   - Comptes : gérés au cabinet ; le portable en reçoit une copie (seuls le Dr Nouha et l'administrateur
     informatique peuvent s'y connecter). Les actions d'administration faites sur le portable sont transmises au cabinet.
   ═══════════════════════════════════════════ */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import mdnsFactory from 'multicast-dns';

const CODE_TTL = 15 * 60e3;
const SYNC_EVERY = 60e3;
const PULL_PAGE = 300;
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const sha = s => crypto.createHash('sha256').update(s).digest('base64');
const hmac = (key, s) => crypto.createHmac('sha256', key).update(s).digest('base64');
const pairKey = code => Buffer.from(crypto.hkdfSync('sha256', normCode(code), 'cabinet-pair', 'pair-key', 32));
const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// Comptes autorisés sur le portable : le Dr Nouha (admin) et l'administrateur informatique
const NOMAD_KINDS = ['admin', 'superadmin'];
// Actions d'administration que le portable transmet au cabinet (comptes gérés au cabinet)
const FORWARD = [/^\/api\/users$/, /^\/api\/users\/[^/]+$/, /^\/api\/users\/[^/]+\/(disable|enable|reset)$/, /^\/api\/keys\/grant$/, /^\/api\/password$/, /^\/api\/keys\/recovery$/, /^\/api\/sync\/pairing-code$/, /^\/api\/sync\/nodes\/[^/]+\/revoke$/];
// Actions impossibles sur le portable (elles se font au cabinet)
const OFFICE_ONLY = [/^\/api\/setup$/, /^\/api\/invite\//, /^\/api\/keys\/bootstrap$/, /^\/api\/keys\/self$/, /^\/api\/backup\/usb$/, /^\/api\/backup\/drives$/];

export function createSync(h) {
  const { cfg, db, route, fail, q, qa, run, tx, needManager, needActive, needUser, audit, getUser, tick, log, invoke, recordFailure } = h;
  const isNomad = cfg.role === 'nomade';
  const pepper = () => cfg.secrets.pepper;

  /* ═══════════ CÔTÉ CABINET ═══════════ */
  const codes = new Map();                       // code → { expires, by }
  function needNode(ctx) {
    const id = String(ctx.req?.headers['x-node'] || ''), auth = String(ctx.req?.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const n = id && q('SELECT * FROM nodes WHERE id = ?', id);
    if (!n || n.revoked || !same(sha(`${pepper()}|node|${id}|${token}`), n.token_hash)) fail(401, 'node', 'Portable non reconnu ou retiré : associez-le de nouveau.');
    run('UPDATE nodes SET last_seen = ?, last_ip = ? WHERE id = ?', Date.now(), ctx.ip, id);
    ctx.node = n; ctx.origin = 'portable';
    return n;
  }

  if (!isNomad) {
    route('POST', '/api/sync/pairing-code', ctx => {
      const u = needManager(ctx);
      const code = [...crypto.randomBytes(10)].map(b => B32[b % 32]).join('').replace(/(.{5})/, '$1-');
      codes.set(normCode(code), { expires: Date.now() + CODE_TTL, by: u.id });
      audit(ctx, 'portable_code_cree');
      return { code, expires: Date.now() + CODE_TTL };
    });
    route('GET', '/api/sync/nodes', ctx => {
      needManager(ctx);
      return { nodes: qa('SELECT id, name, created_at createdAt, last_seen lastSeen, last_ip lastIp, revoked FROM nodes ORDER BY created_at') };
    });
    route('POST', '/api/sync/nodes/:id/revoke', (ctx, b, p) => {
      needManager(ctx);
      if (!q('SELECT 1 FROM nodes WHERE id = ?', p.id)) fail(404, 'not_found', 'Portable inconnu.');
      run('UPDATE nodes SET revoked = 1 WHERE id = ?', p.id);
      audit(ctx, 'portable_retire', p.id);
      return { ok: true };
    });
    // Association : le portable prouve qu'il connaît le code ; la réponse est chiffrée et signée avec ce code
    route('POST', '/api/sync/pair', (ctx, b) => {
      const now = Date.now();
      for (const [k, v] of codes) if (v.expires < now) codes.delete(k);
      if (typeof b.nonce !== 'string' || b.nonce.length < 16) fail(400, 'bad_request', 'Requête invalide.');
      const hit = [...codes.entries()].find(([code]) => same(hmac(pairKey(code), `pair|${b.nonce}`), b.proof));
      if (!hit) { recordFailure(ctx.ip); fail(403, 'bad_code', 'Code d\'association incorrect ou expiré.'); }
      const [code, entry] = hit;
      codes.delete(code);
      const id = crypto.randomBytes(9).toString('hex'), token = crypto.randomBytes(32).toString('base64url');
      run('INSERT INTO nodes (id, name, token_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?)', id, String(b.name || 'Ordinateur portable').slice(0, 60), sha(`${pepper()}|node|${id}|${token}`), entry.by, now);
      const K = pairKey(code), iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', K, iv);
      const ct = Buffer.concat([c.update(JSON.stringify({ nodeId: id, token, pepper: pepper() })), c.final(), c.getAuthTag()]).toString('base64');
      const caPem = cfg.tls?.caPem ? String(cfg.tls.caPem) : '';
      ctx.origin = 'portable';
      audit({ ...ctx, user: getUser(entry.by) }, 'portable_associe', id, { nom: String(b.name || '') });
      return { iv: iv.toString('base64'), ct, caPem, hostname: cfg.hostname, proof: hmac(K, `${b.nonce}|${caPem}|${ct}`) };
    });
    // Envoi des modifications du cabinet au portable (chiffrées, avec l'index aveugle du téléphone)
    route('GET', '/api/sync/pull', ctx => {
      needNode(ctx);
      const since = Math.max(0, +(ctx.url.searchParams.get('since') || 0));
      const rows = qa(`SELECT r.collection c, r.id, r.iv, r.data, r.owners, r.deleted, r.updated_at v, r.updated_by by, b.hash phone
                       FROM records r LEFT JOIN blind_index b ON b.collection = r.collection AND b.record_id = r.id AND b.field = 'phone'
                       WHERE r.updated_at > ? ORDER BY r.updated_at LIMIT ?`, since, PULL_PAGE + 1);
      const more = rows.length > PULL_PAGE;
      const page = rows.slice(0, PULL_PAGE);
      return { rows: page, cursor: page.length ? page[page.length - 1].v : since, more };
    });
    // Réception des modifications faites sur le portable
    route('POST', '/api/sync/push', (ctx, b) => {
      needNode(ctx);
      const out = [];
      for (const r of (Array.isArray(b.rows) ? b.rows : []).slice(0, 500)) {
        if (!h.COLLECTIONS[r.c] || !/^[A-Za-z0-9._-]{1,64}$/.test(r.id)) { out.push({ c: r.c, id: r.id, error: 'invalide' }); continue; }
        const cur = q('SELECT * FROM records WHERE collection = ? AND id = ?', r.c, r.id);
        const curV = cur ? cur.updated_at : null;
        if ((r.base ?? null) !== curV) {
          // déjà appliqué (réponse perdue) : même contenu → simple confirmation
          if (cur && cur.iv === (r.iv ?? null) && cur.data === (r.data ?? null) && !!cur.deleted === !!r.deleted) { out.push({ c: r.c, id: r.id, v: curV }); continue; }
          out.push({ c: r.c, id: r.id, conflict: cur ? { iv: cur.iv, data: cur.data, owners: cur.owners, deleted: !!cur.deleted, v: curV, by: cur.updated_by } : { deleted: true, v: null } });
          continue;
        }
        const v = tick(), by = getUser(r.by) ? r.by : null;
        tx(db, () => {
          if (r.deleted) run(`INSERT INTO records (collection, id, iv, data, owners, deleted, updated_at, updated_by) VALUES (?, ?, NULL, NULL, ?, 1, ?, ?)
                              ON CONFLICT (collection, id) DO UPDATE SET iv = NULL, data = NULL, deleted = 1, updated_at = excluded.updated_at, updated_by = excluded.updated_by`, r.c, r.id, r.owners ?? null, v, by);
          else run(`INSERT INTO records (collection, id, iv, data, owners, deleted, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                    ON CONFLICT (collection, id) DO UPDATE SET iv = excluded.iv, data = excluded.data, owners = excluded.owners, deleted = 0, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
            r.c, r.id, r.iv, r.data, r.owners ?? null, v, by);
          run('DELETE FROM blind_index WHERE collection = ? AND record_id = ?', r.c, r.id);
          if (r.c === 'patients' && !r.deleted && r.phone) run(`INSERT INTO blind_index (collection, record_id, field, hash) VALUES (?, ?, 'phone', ?)`, r.c, r.id, r.phone);
        });
        out.push({ c: r.c, id: r.id, v });
      }
      return { results: out };
    });
    // Comptes recopiés sur le portable : identifiants complets seulement pour le Dr Nouha et l'administrateur informatique
    route('GET', '/api/sync/accounts', ctx => {
      needNode(ctx);
      const users = qa('SELECT * FROM users').map(u => NOMAD_KINDS.includes(u.kind) ? u
        : { ...u, auth_hash: null, kdf_salt: null, kdf_iter: null, priv_key_enc: null, invite_hash: null, invite_dek: null, failed_logins: 0, locked_until: 0 });
      const ids = users.filter(u => u.kind === 'admin').map(u => u.id);
      const keys = qa('SELECT * FROM user_keys').filter(k => ids.includes(k.user_id));
      const meta = qa(`SELECT * FROM meta WHERE key = 'recovery_dek'`);
      return { users, keys, meta };
    });
    // Journal du portable versé dans celui du cabinet
    route('POST', '/api/sync/audit', (ctx, b) => {
      needNode(ctx);
      let n = 0;
      for (const e of (Array.isArray(b.entries) ? b.entries : []).slice(0, 1000)) {
        run('INSERT INTO audit (ts, user_id, username, action, target, detail, ip, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          +e.ts || Date.now(), e.user_id || null, e.username || null, String(e.action || '').slice(0, 60), e.target || null, e.detail || null, e.ip || null, 'portable');
        n++;
      }
      return { n };
    });
    // Action d'administration faite sur le portable, exécutée ici au nom de la personne connectée là-bas
    route('POST', '/api/sync/act', async (ctx, b) => {
      needNode(ctx);
      const u = getUser(b.actAs);
      if (!u || u.status !== 'active' || !NOMAD_KINDS.includes(u.kind)) fail(403, 'forbidden', 'Compte non autorisé.');
      const p = String(b.path || '');
      if (!FORWARD.some(re => re.test(p)) || !['POST', 'PATCH'].includes(b.method)) fail(400, 'bad_request', 'Action non transmissible.');
      const sub = { ...ctx, user: u, session: { token_hash: '' }, origin: 'portable', url: new URL(p, 'http://x') };
      return invoke(b.method, p, sub, b.body || {});
    });
    return { isNomad, status: () => ({ role: 'cabinet' }), start() {}, stop() {}, forwardable: () => false, officeOnly: () => false };
  }

  /* ═══════════ CÔTÉ PORTABLE ═══════════ */
  const stateFile = path.join(cfg.dataDir, 'portable.json');
  const S = Object.assign({ paired: false, nodeId: null, token: null, caPem: null, officeIp: null, cursor: 0, auditPushed: 0, lastSync: null, lastError: null, reachable: false },
    fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {});
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(S, null, 2), { mode: 0o600 });

  function mdnsLookup(name, ms = 3000) {
    return new Promise(resolve => {
      let m; try { m = mdnsFactory({ reuseAddr: true }); } catch { return resolve(null); }
      const t = setTimeout(() => { m.destroy(); resolve(null); }, ms);
      m.on('response', r => { const a = r.answers.find(x => x.type === 'A' && x.name.toLowerCase() === name.toLowerCase()); if (a && a.data !== '127.0.0.1') { clearTimeout(t); m.destroy(); resolve(a.data); } });
      m.on('error', () => {});
      m.query({ questions: [{ name, type: 'A' }] });
    });
  }
  /** Trouve le PC du cabinet sur le Wi-Fi : résolution .local de Windows, sinon requête mDNS directe. */
  async function discover() {
    if (cfg.officeUrl) return true;
    const viaOs = await new Promise(res => { const t = setTimeout(() => res(null), 2500); dns.lookup(cfg.hostname, { family: 4 }, (e, a) => { clearTimeout(t); res(e ? null : a); }); });
    const ip = viaOs && !viaOs.startsWith('127.') ? viaOs : await mdnsLookup(cfg.hostname);
    if (ip) S.officeIp = ip;
    return !!ip;
  }
  function call(method, p, body, { pairing = false } = {}) {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = { 'Content-Type': 'application/json', 'X-Cabinet': '1', Host: cfg.hostname, ...(payload ? { 'Content-Length': payload.length } : {}),
      ...(pairing ? {} : { 'X-Node': S.nodeId, Authorization: `Bearer ${S.token}` }) };
    let mod, opts;
    if (cfg.officeUrl) { const u = new URL(p, cfg.officeUrl); mod = u.protocol === 'https:' ? https : http; opts = { host: u.hostname, port: u.port, path: u.pathname + u.search, rejectUnauthorized: false }; }
    else {
      mod = https;
      // association : certificat pas encore connu (la réponse est authentifiée par le code) ; ensuite : uniquement celui du cabinet
      opts = { host: S.officeIp, port: cfg.officePort || 443, path: p, servername: cfg.hostname, ...(pairing ? { rejectUnauthorized: false } : { ca: S.caPem }) };
    }
    return new Promise((resolve, reject) => {
      const req = mod.request({ ...opts, method, headers, timeout: 20000 }, res => {
        const chunks = []; res.on('data', d => chunks.push(d));
        res.on('end', () => {
          let data = {}; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
          if (res.statusCode >= 400) return reject(Object.assign(new Error(data.message || `Erreur ${res.statusCode}`), { status: res.statusCode, data }));
          resolve(data);
        });
      });
      req.on('timeout', () => req.destroy(new Error('Délai dépassé')));
      req.on('error', e => reject(Object.assign(new Error('Le PC du cabinet ne répond pas.'), { status: 503, cause: e })));
      if (payload) req.write(payload);
      req.end();
    });
  }

  /* Association avec le PC du cabinet */
  async function pair(code, name) {
    if (S.paired) fail(409, 'already', 'Ce portable est déjà associé.');
    if (!(await discover())) fail(503, 'offline', 'PC du cabinet introuvable : branchez le portable sur le Wi-Fi du cabinet, PC du cabinet allumé.');
    const nonce = crypto.randomBytes(24).toString('base64'), K = pairKey(code);
    let r;
    try { r = await call('POST', '/api/sync/pair', { nonce, proof: hmac(K, `pair|${nonce}`), name }, { pairing: true }); }
    catch (e) { fail(e.status === 503 ? 503 : 403, 'pair', e.status === 503 ? e.message : 'Code d\'association incorrect ou expiré.'); }
    if (!same(hmac(K, `${nonce}|${r.caPem}|${r.ct}`), r.proof)) fail(502, 'pair', 'Réponse non authentique : association interrompue.');
    const buf = Buffer.from(r.ct, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', K, Buffer.from(r.iv, 'base64'));
    d.setAuthTag(buf.subarray(buf.length - 16));
    const secret = JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8'));
    Object.assign(S, { paired: true, nodeId: secret.nodeId, token: secret.token, caPem: r.caPem || null, cursor: 0, auditPushed: q('SELECT COALESCE(MAX(id), 0) m FROM audit').m });
    // même « poivre » que le cabinet : les mots de passe du Dr Nouha et de l'administrateur fonctionnent ici à l'identique
    cfg.secrets.pepper = secret.pepper;
    fs.writeFileSync(path.join(cfg.dataDir, 'secrets.json'), JSON.stringify(cfg.secrets, null, 2), { mode: 0o600 });
    save();
    log('Portable associé au PC du cabinet');
    return syncOnce();
  }

  /* Copie des comptes (le cabinet fait foi) */
  function applyAccounts(a) {
    tx(db, () => {
      run('DELETE FROM user_keys');
      const ids = a.users.map(u => u.id);
      for (const id of qa('SELECT id FROM users').map(r => r.id)) if (!ids.includes(id)) run('DELETE FROM users WHERE id = ?', id);
      for (const u of a.users) {
        const cols = Object.keys(u);
        run(`INSERT INTO users (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
             ON CONFLICT (id) DO UPDATE SET ${cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ')}`, ...cols.map(c => u[c]));
      }
      for (const k of a.keys) run('INSERT INTO user_keys (user_id, wrapped_dek, granted_by, granted_at) VALUES (?, ?, ?, ?)', k.user_id, k.wrapped_dek, k.granted_by, k.granted_at);
      for (const m of a.meta) run('INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', m.key, m.value, m.updated_at);
      // sessions des comptes qui ne peuvent plus se connecter ici
      run(`DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users WHERE status = 'active' AND kind IN ('admin', 'superadmin'))`);
    });
  }
  /* Envoi des modifications faites sur le portable */
  async function push() {
    let sent = 0, conflicts = 0;
    for (;;) {
      const rows = qa(`SELECT r.*, b.hash phone FROM records r LEFT JOIN blind_index b ON b.collection = r.collection AND b.record_id = r.id AND b.field = 'phone'
                       WHERE r.dirty = 1 AND r.conflict IS NULL ORDER BY r.updated_at LIMIT 200`);
      if (!rows.length) break;
      const res = await call('POST', '/api/sync/push', { rows: rows.map(r => ({ c: r.collection, id: r.id, iv: r.iv, data: r.data, owners: r.owners, deleted: !!r.deleted, base: r.remote_v ?? null, by: r.updated_by, phone: r.phone })) });
      tx(db, () => {
        for (const x of res.results) {
          const local = rows.find(r => r.collection === x.c && r.id === x.id); if (!local) continue;
          if (x.v != null) { run('UPDATE records SET remote_v = ?, dirty = CASE WHEN updated_at = ? THEN 0 ELSE dirty END WHERE collection = ? AND id = ?', x.v, local.updated_at, x.c, x.id); sent++; }
          else if (x.conflict) { run('UPDATE records SET conflict = ? WHERE collection = ? AND id = ?', JSON.stringify(x.conflict), x.c, x.id); conflicts++; }
        }
      });
      if (res.results.every(x => x.error)) break;
    }
    return { sent, conflicts };
  }
  /* Réception des modifications du cabinet */
  async function pull() {
    let got = 0, conflicts = 0;
    for (;;) {
      const res = await call('GET', `/api/sync/pull?since=${S.cursor}`);
      tx(db, () => {
        for (const r of res.rows) {
          const local = q('SELECT * FROM records WHERE collection = ? AND id = ?', r.c, r.id);
          const sameContent = local && local.iv === r.iv && local.data === r.data && !!local.deleted === !!r.deleted;
          if (local && local.remote_v === r.v) continue;
          if (local && local.dirty) {
            if (sameContent) run('UPDATE records SET remote_v = ?, dirty = 0, conflict = NULL WHERE collection = ? AND id = ?', r.v, r.c, r.id);
            else { run('UPDATE records SET conflict = ? WHERE collection = ? AND id = ?', JSON.stringify({ iv: r.iv, data: r.data, owners: r.owners, deleted: !!r.deleted, v: r.v, by: r.by }), r.c, r.id); conflicts++; }
            continue;
          }
          const v = tick();
          run(`INSERT INTO records (collection, id, iv, data, owners, deleted, updated_at, updated_by, remote_v, dirty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
               ON CONFLICT (collection, id) DO UPDATE SET iv = excluded.iv, data = excluded.data, owners = excluded.owners, deleted = excluded.deleted,
               updated_at = excluded.updated_at, updated_by = excluded.updated_by, remote_v = excluded.remote_v, dirty = 0, conflict = NULL`,
            r.c, r.id, r.iv, r.data, r.owners, r.deleted ? 1 : 0, v, r.by, r.v);
          run('DELETE FROM blind_index WHERE collection = ? AND record_id = ?', r.c, r.id);
          if (r.phone) run(`INSERT INTO blind_index (collection, record_id, field, hash) VALUES (?, ?, 'phone', ?)`, r.c, r.id, r.phone);
          got++;
        }
      });
      S.cursor = res.cursor; save();
      if (!res.more) break;
    }
    return { got, conflicts };
  }
  async function pushAudit() {
    for (;;) {
      const entries = qa('SELECT * FROM audit WHERE id > ? ORDER BY id LIMIT 500', S.auditPushed);
      if (!entries.length) return;
      await call('POST', '/api/sync/audit', { entries });
      S.auditPushed = entries[entries.length - 1].id; save();
    }
  }
  let running = null;
  async function syncAccounts() { applyAccounts(await call('GET', '/api/sync/accounts')); }
  function syncOnce() {
    if (!S.paired) return Promise.resolve({ ok: false, error: 'Portable non associé' });
    if (running) return running;
    running = (async () => {
      try {
        if (!(await discover())) throw Object.assign(new Error('Hors du cabinet : le PC du cabinet est introuvable sur ce réseau.'), { status: 503 });
        await syncAccounts();
        const p = await push(), l = await pull();
        await pushAudit();
        Object.assign(S, { lastSync: Date.now(), reachable: true, lastError: null }); save();
        return { ok: true, sent: p.sent, received: l.got, conflicts: conflictCount() };
      } catch (e) {
        Object.assign(S, { reachable: false, lastError: e.status === 401 ? 'Ce portable a été retiré au cabinet : associez-le de nouveau.' : e.message }); save();
        if (e.status === 401) { S.paired = false; save(); }
        return { ok: false, error: S.lastError };
      } finally { running = null; }
    })();
    return running;
  }
  const conflictCount = () => q('SELECT COUNT(*) n FROM records WHERE conflict IS NOT NULL').n;
  let timer = null;
  const start = () => { syncOnce(); timer = setInterval(syncOnce, cfg.syncEvery || SYNC_EVERY); timer.unref?.(); };
  const stop = () => clearInterval(timer);

  /* Routes du portable */
  route('POST', '/api/portable/pair', async (ctx, b) => {
    if (S.paired) fail(409, 'already', 'Ce portable est déjà associé.');
    const r = await pair(String(b.code || ''), String(b.name || 'Portable du Dr Nouha'));
    return { ok: true, sync: r };
  });
  route('POST', '/api/sync/now', async ctx => { needUser(ctx); return syncOnce(); });
  route('GET', '/api/sync/conflicts', ctx => {
    const u = needActive(ctx);
    if (u.kind === 'superadmin') fail(403, 'forbidden', 'Réservé au Dr Nouha.');
    return { conflicts: qa('SELECT collection c, id, iv, data, owners, deleted, updated_at v, conflict FROM records WHERE conflict IS NOT NULL')
      .map(r => ({ c: r.c, id: r.id, local: { iv: r.iv, data: r.data, deleted: !!r.deleted, v: r.v }, office: JSON.parse(r.conflict) })) };
  });
  route('POST', '/api/sync/resolve', async (ctx, b) => {
    const u = needActive(ctx);
    if (u.kind === 'superadmin') fail(403, 'forbidden', 'Réservé au Dr Nouha.');
    const r = q('SELECT * FROM records WHERE collection = ? AND id = ? AND conflict IS NOT NULL', b.c, b.id) || fail(404, 'not_found', 'Conflit introuvable.');
    const office = JSON.parse(r.conflict);
    if (b.keep === 'local') run('UPDATE records SET remote_v = ?, conflict = NULL, dirty = 1 WHERE collection = ? AND id = ?', office.v, b.c, b.id);
    else if (b.keep === 'office') run(`UPDATE records SET iv = ?, data = ?, owners = ?, deleted = ?, updated_at = ?, remote_v = ?, dirty = 0, conflict = NULL WHERE collection = ? AND id = ?`,
      office.iv ?? null, office.data ?? null, office.owners ?? null, office.deleted ? 1 : 0, tick(), office.v, b.c, b.id);
    else fail(400, 'bad_request', 'Choix invalide.');
    audit(ctx, 'conflit_tranche', `${b.c}/${b.id}`, { garde: b.keep === 'local' ? 'portable' : 'cabinet' });
    syncOnce();
    return { ok: true };
  });

  /** Action d'administration : transmise au cabinet au nom de la personne connectée. */
  async function forward(ctx, method, p, body) {
    const u = needActive(ctx);
    if (!S.paired) fail(503, 'offline', 'Portable non associé au cabinet.');
    if (!(await discover())) fail(503, 'offline', 'Les comptes se gèrent au cabinet : branchez le portable sur le Wi-Fi du cabinet (PC du cabinet allumé).');
    let r;
    try { r = await call('POST', '/api/sync/act', { method, path: p, body, actAs: u.id }); }
    catch (e) { fail(e.status || 503, e.data?.error || 'office', e.message, e.data); }
    try { await syncAccounts(); } catch {}
    return r;
  }

  return {
    isNomad, start, stop, syncOnce, forward,
    forwardable: p => FORWARD.some(re => re.test(p)),
    officeOnly: p => OFFICE_ONLY.some(re => re.test(p)),
    status: () => ({ role: 'nomade', paired: S.paired, office: { reachable: S.reachable, lastSync: S.lastSync, lastError: S.lastError },
      pending: q('SELECT COUNT(*) n FROM records WHERE dirty = 1').n, conflicts: conflictCount() }),
  };
}
