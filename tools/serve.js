// Aperçu local du site, comme Cloudflare Pages : fichiers statiques, « dossier/ » sert « dossier/index.html ».
// Usage : node tools/serve.js [port] [dossier]   (par défaut 3470 et « site » ; « app » pour l'espace cabinet)
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', process.argv[3] || 'site'), port = +process.env.PORT || +process.argv[2] || 3470;
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  let f = path.join(root, p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith('/')) { r.writeHead(301, { Location: p + '/' }); return r.end(); }
    f = path.join(f, 'index.html');
  }
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404, { 'Content-Type': 'text/html' }); return r.end('<h1>404</h1>'); }
    r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    r.end(b);
  });
}).listen(port, '127.0.0.1', () => console.log(`Aperçu : http://localhost:${port}/`));
