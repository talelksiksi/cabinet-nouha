// Aperçu local du site, comme Cloudflare Pages : fichiers statiques, « dossier/ » sert « dossier/index.html ».
// Usage : node tools/serve.js [port] [dossier]   (par défaut 3470 et « site » ; « app » pour l'espace cabinet)
// Écoute sur le réseau local : ouvrir l'adresse « téléphone » affichée au démarrage (même Wi-Fi).
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
}).listen(port, '0.0.0.0', () => {
  // Accessible aussi depuis le téléphone, sur le même Wi-Fi
  const lan = Object.values(require('os').networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${port}/`);
  console.log(`Aperçu : http://localhost:${port}/${lan.length ? '  ·  téléphone : ' + lan.join('  ') : ''}`);
});
