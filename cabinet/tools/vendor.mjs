// Télécharge une fois les polices, icônes et graphiques dans public/vendor/ : l'application ne dépend plus d'Internet.
// Usage : node tools/vendor.mjs   (déjà fait ; à relancer seulement pour changer de version)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'vendor');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const get = async (url, bin) => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return bin ? Buffer.from(await r.arrayBuffer()) : r.text(); };
const save = (rel, data) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); console.log('  ' + rel, Math.round(data.length / 1024) + ' Ko'); };

// Font Awesome 6.5.0
const FA = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0';
save('fontawesome/css/all.min.css', await get(`${FA}/css/all.min.css`));
for (const f of ['fa-solid-900', 'fa-regular-400', 'fa-brands-400', 'fa-v4compatibility'])
  for (const ext of ['woff2', 'ttf']) save(`fontawesome/webfonts/${f}.${ext}`, await get(`${FA}/webfonts/${f}.${ext}`, true));

// Chart.js 4.4.0
save('chart.umd.min.js', await get('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'));

// Polices Archivo + JetBrains Mono (Google Fonts) : CSS réécrite vers des fichiers locaux
let css = await get('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
let i = 0;
for (const url of [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g))]) {
  const name = `f${String(++i).padStart(2, '0')}-${path.basename(new URL(url).pathname)}`;
  save(`fonts/${name}`, await get(url, true));
  css = css.split(url).join(name);
}
save('fonts/fonts.css', css);
console.log('Terminé.');
