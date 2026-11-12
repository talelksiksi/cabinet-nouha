/* ═══════════════════════════════════════════
   Fabrique le paquet d'installation autonome : dist/EspaceCabinet-<version>.zip
   Contenu : Node.js (node.exe), l'application prête à tourner (dépendances incluses), les scripts
   INSTALLER / DEMARRER / ARRETER / ETAT / RESTAURER / DESINSTALLER et le guide.
   Rien d'autre à installer sur le PC du cabinet.
   Usage : node tools/build-package.mjs
   ═══════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const d = new Date(), pad = n => String(n).padStart(2, '0');
const VERSION = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
const NAME = `EspaceCabinet-${VERSION}`;
const DIST = path.join(ROOT, 'dist'), OUT = path.join(DIST, NAME);
const NODE = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\nodejs\\node.exe') ? 'C:\\Program Files\\nodejs\\node.exe' : process.execPath;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const copy = (from, to, filter = () => true) => fs.cpSync(from, to, { recursive: true, filter: src => filter(path.relative(ROOT, src).replace(/\\/g, '/')) });

// 1. Node.js
fs.mkdirSync(path.join(OUT, 'node'));
fs.copyFileSync(NODE, path.join(OUT, 'node', 'node.exe'));
const lic = path.join(path.dirname(NODE), 'LICENSE');
if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(OUT, 'node', 'LICENSE.txt'));
const nodeVersion = execFileSync(NODE, ['-p', 'process.version'], { encoding: 'utf8' }).trim();

// 2. Application (sans tests, démo ni outils de développement)
const APP = path.join(OUT, 'app');
for (const dir of ['server', 'public', 'migrations', 'node_modules']) copy(path.join(ROOT, dir), path.join(APP, dir));
fs.mkdirSync(path.join(APP, 'tools'));
fs.copyFileSync(path.join(ROOT, 'tools', 'restore.mjs'), path.join(APP, 'tools', 'restore.mjs'));
for (const f of ['package.json', 'package-lock.json', 'LISEZMOI.md']) fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
fs.writeFileSync(path.join(APP, 'VERSION.txt'), `${VERSION}\r\nNode ${nodeVersion}\r\n`);

// 3. Scripts et guide (PowerShell 5.1 lit l'UTF-8 seulement avec BOM : accents corrects)
const PKG = path.join(ROOT, 'package');
fs.mkdirSync(path.join(OUT, 'outils'));
for (const f of fs.readdirSync(path.join(PKG, 'outils'))) {
  const txt = fs.readFileSync(path.join(PKG, 'outils', f), 'utf8').replace(/^\uFEFF/, '').replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(path.join(OUT, 'outils', f), '\uFEFF' + txt);
}
for (const f of fs.readdirSync(PKG).filter(f => /\.(cmd|html)$/.test(f))) {
  // fins de ligne Windows pour cmd.exe
  if (f.endsWith('.cmd')) fs.writeFileSync(path.join(OUT, f), fs.readFileSync(path.join(PKG, f), 'utf8').replace(/\r?\n/g, '\r\n'));
  else fs.copyFileSync(path.join(PKG, f), path.join(OUT, f));
}
fs.writeFileSync(path.join(OUT, 'LISEZMOI.txt'), [
  `Espace cabinet - Dr Nouha Ksiksi - version ${VERSION}`, '',
  '1. Extraire tout le ZIP (clic droit > Extraire tout).',
  '2. Sur le PC de l\'assistante : double-cliquer sur INSTALLER.cmd et accepter la demande de Windows.',
  '3. Suivre GUIDE-INSTALLATION.html (premiere mise en service, autres appareils, sauvegardes).',
  '4. Sur le portable du Dr Nouha : INSTALLER-PORTABLE.cmd, puis associer au cabinet (guide, section 5 bis).', '',
  'Rien a telecharger : Node.js ' + nodeVersion + ' et toutes les dependances sont inclus.',
].join('\r\n'));

// 4. Archive
const zip = path.join(DIST, `${NAME}.zip`);
fs.rmSync(zip, { force: true });
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${OUT}' -DestinationPath '${zip}' -CompressionLevel Optimal`], { stdio: 'inherit' });
const size = f => (fs.statSync(f).size / 1048576).toFixed(1) + ' Mo';
const du = dir => fs.readdirSync(dir, { recursive: true }).reduce((s, f) => { const p = path.join(dir, f); return s + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0); }, 0);
console.log(`Paquet prêt : ${zip} (${size(zip)} ; ${(du(OUT) / 1048576).toFixed(0)} Mo une fois extrait) — Node ${nodeVersion}`);
