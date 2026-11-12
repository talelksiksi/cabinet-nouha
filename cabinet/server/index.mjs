/* ═══════════════════════════════════════════
   Espace cabinet — serveur local
   https://cabinet-nouha.local  (réseau du cabinet uniquement)
   Démarrage : node server/index.mjs   (installé comme tâche Windows au démarrage du PC)
   ═══════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { openDb } from './db.mjs';
import { createApi } from './api.mjs';
import { createBackup } from './backup.mjs';
import { ensureTls } from './tls.mjs';
import { startMdns } from './mdns.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.pdf': 'application/pdf' };

const CSP = [
  "default-src 'self'",
  // l'interface actuelle utilise des gestionnaires onclick : 'unsafe-inline' tant qu'ils ne sont pas tous migrés
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob:", "connect-src 'self'", "frame-src 'self' blob: data:",
  "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');
const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** Adresses du réseau local uniquement : le serveur ne répond pas à Internet, même par erreur de configuration. */
export function isLocalAddress(addr = '') {
  const a = addr.replace(/^::ffff:/, '');
  if (a === '::1' || a === '127.0.0.1' || /^127\./.test(a)) return true;
  if (/^10\./.test(a) || /^192\.168\./.test(a) || /^169\.254\./.test(a)) return true;
  const m = a.match(/^172\.(\d+)\./); if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  if (/^(fe80|fc|fd)/i.test(a)) return true;
  return false;
}

function parseCookies(h = '') { const o = {}; for (const p of h.split(';')) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } return o; }

function readJson(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) { reject(Object.assign(new Error('too large'), { code: 'body_too_large' })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!size) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('bad json'), { code: 'bad_json' })); } });
    req.on('error', reject);
  });
}

export function createApp(cfg, { log = console.log } = {}) {
  cfg.startedAt = Date.now();
  const db = openDb(cfg);
  const backup = createBackup({ db, cfg, log });
  const api = createApi({ db, cfg, backup, log });

  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(cfg.publicDir, rel));
    if (!file.startsWith(cfg.publicDir + path.sep)) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS }); return res.end('<h1>Page introuvable</h1>'); }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size,
        'Cache-Control': ext === '.html' || ext === '.mjs' || ext === '.js' ? 'no-cache' : 'public, max-age=86400', ...SECURITY_HEADERS });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  function handler(req, res) {
    const ip = req.socket.remoteAddress || '';
    if (!isLocalAddress(ip)) { res.writeHead(403); return res.end('Accès réservé au réseau du cabinet.'); }
    const url = new URL(req.url, `https://${req.headers.host || cfg.hostname}`);
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      // en http://localhost, un nom de cookie par port : le cabinet et le portable de démonstration ne se mélangent pas
      const sid = req.socket.encrypted ? 'cabinet_sid' : `cabinet_sid_${req.socket.localPort}`;
      return api(req, res, url, {
        ip, cookies: parseCookies(req.headers.cookie), cookieName: sid,
        readJson: max => readJson(req, max),
        setCookie: token => res.setHeader('Set-Cookie', `${sid}=${token}; HttpOnly; SameSite=Strict; Path=/${req.socket.encrypted ? '; Secure' : ''}`),
        clearCookie: () => res.setHeader('Set-Cookie', `${sid}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${req.socket.encrypted ? '; Secure' : ''}`),
        json: (status, obj) => { if (res.headersSent) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS }); res.end(JSON.stringify(obj)); },
      });
    }
    if (url.pathname === '/cabinet-nouha-ca.crt' && cfg.tls) { res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="cabinet-nouha-ca.crt"' }); return res.end(cfg.tls.caDer); }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  }

  return { db, backup, handler, sync: api.sync, close: () => { backup.stop(); api.sync.stop(); db.close(); } };
}

/* Port 80 : uniquement la page d'installation du certificat ; tout le reste part en HTTPS. */
function plainHandler(cfg) {
  return (req, res) => {
    if (!isLocalAddress(req.socket.remoteAddress || '')) { res.writeHead(403); return res.end(); }
    const url = new URL(req.url, `http://${req.headers.host || cfg.hostname}`);
    if (url.pathname === '/cabinet-nouha-ca.crt') { res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="cabinet-nouha-ca.crt"' }); return res.end(cfg.tls.caDer); }
    if (url.pathname === '/certificat') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS });
      return res.end(fs.readFileSync(path.join(cfg.publicDir, 'certificat.html')));
    }
    const host = (req.headers.host || cfg.hostname).replace(/:\d+$/, '');
    res.writeHead(302, { Location: `https://${host}${cfg.httpsPort === 443 ? '' : ':' + cfg.httpsPort}${url.pathname}${url.search}` });
    res.end();
  };
}

/* ── Lancement direct ── */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cfg = loadConfig();
  const logFile = path.join(cfg.dataDir, 'serveur.log');
  const log = (msg, err) => {
    const line = `[${new Date().toLocaleString('fr-FR')}] ${msg}${err ? ' — ' + (err.stack || err) : ''}`;
    console.log(line); fs.appendFile(logFile, line + '\n', () => {});
  };
  let mdns = { stop() {} };
  if (cfg.role === 'nomade') {
    // ── Portable du Dr Nouha : uniquement sur ce portable (http://localhost), synchronisé avec le cabinet ──
    const app = createApp(cfg, { log });
    const port = cfg.plainPort || 3475;
    http.createServer(app.handler).listen(port, '127.0.0.1', () => log(`Espace cabinet (portable) : http://localhost:${port}/`));
    app.backup.start();
    app.sync.start();
    var close = () => app.close();
  } else {
    // ── PC du cabinet : https://cabinet-nouha.local pour tout le réseau du cabinet ──
    cfg.tls = ensureTls(cfg, log);
    const app = createApp(cfg, { log });
    https.createServer({ key: cfg.tls.key, cert: cfg.tls.cert, minVersion: 'TLSv1.2' }, app.handler)
      .listen(cfg.httpsPort, '0.0.0.0', () => log(`Espace cabinet : https://${cfg.hostname}${cfg.httpsPort === 443 ? '' : ':' + cfg.httpsPort}/`));
    http.createServer(plainHandler(cfg)).listen(cfg.httpPort, '0.0.0.0', () => log(`Installation du certificat : http://${cfg.hostname}${cfg.httpPort === 80 ? '' : ':' + cfg.httpPort}/certificat`))
      .on('error', e => log('Port HTTP indisponible (page certificat)', e));
    // Accès direct sur ce PC uniquement (http://localhost) : démonstration et poste serveur lui-même
    if (cfg.plainPort) http.createServer(app.handler).listen(cfg.plainPort, '127.0.0.1', () => log(`Sur ce PC : http://localhost:${cfg.plainPort}/`));
    mdns = startMdns(cfg.hostname, log);
    app.backup.start();
    if (app.db.prepare('SELECT COUNT(*) n FROM users').get().n === 0)
      log(`PREMIÈRE INSTALLATION — code d'installation : ${cfg.secrets.setupToken}  (à saisir sur https://${cfg.hostname}/)`);
    var close = () => app.close();
  }
  const shutdown = () => { log('Arrêt du serveur'); mdns.stop(); close(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
