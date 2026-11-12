/* ═══════════════════════════════════════════
   Fabrique les deux paquets d'installation autonomes (aucune donnée, aucun compte de démonstration) :
     dist/Install-Package-Staff-<version>.zip  → PC du cabinet (serveur, utilisé par toute l'équipe)
     dist/Install-Package-Owner-<version>.zip  → portable du Dr Nouha (copie synchronisée + outil « comptes protégés »)
   Contenu : Node.js (node.exe), l'application prête à tourner (dépendances incluses), les scripts et le guide.
   Rien d'autre à installer sur les PC.
   Usage : node tools/build-package.mjs
   ═══════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const d = new Date(), pad = n => String(n).padStart(2, '0');
const VERSION = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
const DIST = path.join(ROOT, 'dist');
const NODE = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\nodejs\\node.exe') ? 'C:\\Program Files\\nodejs\\node.exe' : process.execPath;
const nodeVersion = execFileSync(NODE, ['-p', 'process.version'], { encoding: 'utf8' }).trim();
const PKG = path.join(ROOT, 'package');

const KINDS = {
  staff: {
    name: 'Install-Package-Staff',
    // [fichier source dans package/, nom dans le paquet]
    files: [['INSTALLER.cmd', 'INSTALLER.cmd'], ['POSTE-CABINET.cmd', 'POSTE-CABINET.cmd'], ['GUIDE-INSTALLATION.html', 'GUIDE-INSTALLATION.html'], ['GUIDE-SECOURS.html', 'GUIDE-SECOURS.html']],
    readme: [
      'Espace cabinet - Dr Nouha Ksiksi - paquet STAFF (PC du cabinet) - version ' + VERSION, '',
      'A installer sur le PC du cabinet qui reste allume (PC de l\'assistante), PAS sur le portable du Dr Nouha.', '',
      '1. Extraire tout le ZIP (clic droit > Extraire tout).',
      '2. Ouvrir GUIDE-INSTALLATION.html et le suivre pas a pas (avec le Dr Nouha a cote pour son code d\'activation).',
      '3. Double-cliquer sur INSTALLER.cmd et accepter la demande de Windows.', '',
      'Aucune donnee ni aucun compte de demonstration : l\'application demarre vide.',
      'Rien a telecharger : Node.js ' + nodeVersion + ' et toutes les dependances sont inclus.',
    ],
  },
  owner: {
    name: 'Install-Package-Owner',
    files: [['INSTALLER-PORTABLE.cmd', 'INSTALLER.cmd'], ['COMPTES-PROTEGES.cmd', 'COMPTES-PROTEGES.cmd'], ['GUIDE-PORTABLE.html', 'GUIDE-PORTABLE.html'], ['GUIDE-SECOURS.html', 'GUIDE-SECOURS.html']],
    readme: [
      'Espace cabinet - Dr Nouha Ksiksi - paquet OWNER (portable du Dr Nouha) - version ' + VERSION, '',
      'A installer UNIQUEMENT sur le portable du Dr Nouha, apres l\'installation du PC du cabinet.', '',
      '1. Extraire tout le ZIP (clic droit > Extraire tout).',
      '2. Ouvrir GUIDE-PORTABLE.html et le suivre pas a pas.',
      '3. Double-cliquer sur INSTALLER.cmd et accepter la demande de Windows.', '',
      'COMPTES-PROTEGES.cmd (installe aussi dans C:\\EspaceCabinet) : seul moyen de reinitialiser le compte',
      'du Dr Nouha ou de l\'administrateur informatique (mot de passe oublie). Droits administrateur du portable requis.',
      'Rien a telecharger : Node.js ' + nodeVersion + ' et toutes les dependances sont inclus.',
    ],
  },
};
const COMMON = ['DEMARRER.cmd', 'ARRETER.cmd', 'ETAT.cmd', 'RESTAURER.cmd', 'DESINSTALLER.cmd'];

function build(kind) {
  const K = KINDS[kind], NAME = `${K.name}-${VERSION}`, OUT = path.join(DIST, NAME);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const copy = (from, to) => fs.cpSync(from, to, { recursive: true });

  // 1. Node.js
  fs.mkdirSync(path.join(OUT, 'node'));
  fs.copyFileSync(NODE, path.join(OUT, 'node', 'node.exe'));
  const lic = path.join(path.dirname(NODE), 'LICENSE');
  if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(OUT, 'node', 'LICENSE.txt'));

  // 2. Application : programme seul (pas de tests, démo, données ni outils de développement)
  const APP = path.join(OUT, 'app');
  for (const dir of ['server', 'public', 'migrations', 'node_modules']) copy(path.join(ROOT, dir), path.join(APP, dir));
  fs.mkdirSync(path.join(APP, 'tools'));
  for (const f of ['restore.mjs', 'comptes.mjs']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(APP, 'tools', f));
  for (const f of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
  fs.writeFileSync(path.join(APP, 'VERSION.txt'), `${VERSION} (${kind})\r\nNode ${nodeVersion}\r\n`);

  // 3. Scripts (PowerShell 5.1 lit l'UTF-8 seulement avec BOM ; cmd.exe veut des fins de ligne Windows) et guides
  fs.mkdirSync(path.join(OUT, 'outils'));
  for (const f of fs.readdirSync(path.join(PKG, 'outils'))) {
    const txt = fs.readFileSync(path.join(PKG, 'outils', f), 'utf8').replace(/^\uFEFF/, '').replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(path.join(OUT, 'outils', f), '\uFEFF' + txt);
  }
  for (const [src, dst] of [...COMMON.map(f => [f, f]), ...K.files]) {
    if (src.endsWith('.cmd')) fs.writeFileSync(path.join(OUT, dst), fs.readFileSync(path.join(PKG, src), 'utf8').replace(/\r?\n/g, '\r\n'));
    else fs.copyFileSync(path.join(PKG, src), path.join(OUT, dst));
  }
  fs.writeFileSync(path.join(OUT, 'LISEZMOI.txt'), K.readme.join('\r\n'));

  // 4. Vérification : aucune donnée embarquée
  for (const bad of ['data', 'data-demo', 'data-demo-portable']) if (fs.existsSync(path.join(OUT, bad)) || fs.existsSync(path.join(APP, bad))) throw new Error(`Dossier de données dans le paquet : ${bad}`);

  // 5. Archive
  const zip = path.join(DIST, `${NAME}.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${OUT}' -DestinationPath '${zip}' -CompressionLevel Optimal`], { stdio: 'inherit' });
  console.log(`Paquet prêt : ${zip} (${(fs.statSync(zip).size / 1048576).toFixed(1)} Mo) — Node ${nodeVersion}`);
  return zip;
}

fs.mkdirSync(DIST, { recursive: true });
for (const f of fs.readdirSync(DIST)) if (/^(EspaceCabinet|Install-Package)-/.test(f)) fs.rmSync(path.join(DIST, f), { recursive: true, force: true });
const only = process.argv[2];
for (const kind of Object.keys(KINDS)) if (!only || only === kind) build(kind);
