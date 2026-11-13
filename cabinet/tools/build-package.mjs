/* ═══════════════════════════════════════════
   Fabrique les livrables (aucune donnée, aucun compte de démonstration) :
     dist/Install-Package-Staff-<version>.zip      → installation du PC du cabinet (+ autres PC du cabinet)
     dist/Install-Package-Owner-<version>.zip      → installation du portable du Dr Nouha
     dist/Mise-a-jour-EspaceCabinet-<version>.exe  → MISE À JOUR : un seul fichier, pour le PC du cabinet ET le portable
   Node.js, l'application (dépendances incluses), les scripts et les guides sont dedans : rien à installer d'autre.
   L'exécutable est fabriqué avec IExpress (fourni avec Windows) : rien à télécharger non plus pour le construire.
   Usage : node tools/build-package.mjs [staff|owner|maj]
   ═══════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const d = new Date(), pad = n => String(n).padStart(2, '0');
// version = date et heure de fabrication (comparable d'une mise à jour à l'autre)
const VERSION = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const DIST = path.join(ROOT, 'dist');
const NODE = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\nodejs\\node.exe') ? 'C:\\Program Files\\nodejs\\node.exe' : process.execPath;
const nodeVersion = execFileSync(NODE, ['-p', 'process.version'], { encoding: 'utf8' }).trim();
const PKG = path.join(ROOT, 'package');
const crlf = s => s.replace(/^\uFEFF/, '').replace(/\r?\n/g, '\r\n');
const ps1 = (src, dst) => fs.writeFileSync(dst, '\uFEFF' + crlf(fs.readFileSync(src, 'utf8')));   // PowerShell 5.1 : UTF-8 avec BOM

const KINDS = {
  staff: {
    name: 'Install-Package-Staff',
    // [fichier source dans package/, nom dans le paquet]
    files: [['INSTALLER.cmd', 'INSTALLER.cmd'], ['POSTE-CABINET.cmd', 'POSTE-CABINET.cmd'], ['GUIDE-INSTALLATION.html', 'GUIDE-INSTALLATION.html']],
    readme: [
      'Espace cabinet - Dr Nouha Ksiksi - paquet STAFF (PC du cabinet) - version ' + VERSION, '',
      'A installer sur le PC du cabinet qui reste allume (PC de l\'assistante), PAS sur le portable du Dr Nouha.', '',
      '1. Extraire tout le ZIP (clic droit > Extraire tout).',
      '2. Ouvrir GUIDE-INSTALLATION.html et le suivre pas a pas (avec le Dr Nouha a cote pour son code d\'activation).',
      '3. Double-cliquer sur INSTALLER.cmd et accepter la demande de Windows.', '',
      'Mises a jour ensuite : un seul fichier Mise-a-jour-EspaceCabinet-<version>.exe (voir GUIDE-SECOURS.html, section M).',
      'Aucune donnee ni aucun compte de demonstration : l\'application demarre vide.',
      'Rien a telecharger : Node.js ' + nodeVersion + ' et toutes les dependances sont inclus.',
    ],
  },
  owner: {
    name: 'Install-Package-Owner',
    files: [['INSTALLER-PORTABLE.cmd', 'INSTALLER.cmd'], ['COMPTES-PROTEGES.cmd', 'COMPTES-PROTEGES.cmd'], ['GUIDE-PORTABLE.html', 'GUIDE-PORTABLE.html']],
    readme: [
      'Espace cabinet - Dr Nouha Ksiksi - paquet OWNER (portable du Dr Nouha) - version ' + VERSION, '',
      'A installer UNIQUEMENT sur le portable du Dr Nouha, apres l\'installation du PC du cabinet.', '',
      '1. Extraire tout le ZIP (clic droit > Extraire tout).',
      '2. Ouvrir GUIDE-PORTABLE.html et le suivre pas a pas.',
      '3. Double-cliquer sur INSTALLER.cmd et accepter la demande de Windows.', '',
      'COMPTES-PROTEGES.cmd (installe aussi dans C:\\EspaceCabinet) : seul moyen de reinitialiser le compte',
      'du Dr Nouha ou de l\'administrateur informatique (mot de passe oublie). Droits administrateur du portable requis.',
      'Mises a jour ensuite : un seul fichier Mise-a-jour-EspaceCabinet-<version>.exe (voir GUIDE-SECOURS.html, section M).',
      'Rien a telecharger : Node.js ' + nodeVersion + ' et toutes les dependances sont inclus.',
    ],
  },
};
const COMMON = ['DEMARRER.cmd', 'ARRETER.cmd', 'ETAT.cmd', 'RESTAURER.cmd', 'DESINSTALLER.cmd'];

/** Programme commun aux deux PC : node, app, outils, scripts de gestion, guide de secours. */
function assembleProgram(OUT, tag) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  // 1. Node.js
  fs.mkdirSync(path.join(OUT, 'node'));
  fs.copyFileSync(NODE, path.join(OUT, 'node', 'node.exe'));
  const lic = path.join(path.dirname(NODE), 'LICENSE');
  if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(OUT, 'node', 'LICENSE.txt'));
  // 2. Application : programme seul (pas de tests, démo, données ni outils de développement)
  const APP = path.join(OUT, 'app');
  for (const dir of ['server', 'public', 'migrations', 'node_modules']) fs.cpSync(path.join(ROOT, dir), path.join(APP, dir), { recursive: true });
  fs.mkdirSync(path.join(APP, 'tools'));
  for (const f of ['restore.mjs', 'comptes.mjs']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(APP, 'tools', f));
  for (const f of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
  fs.writeFileSync(path.join(APP, 'VERSION.txt'), `${VERSION} (${tag})\r\nNode ${nodeVersion}\r\n`);
  // 3. Scripts de gestion
  fs.mkdirSync(path.join(OUT, 'outils'));
  for (const f of fs.readdirSync(path.join(PKG, 'outils'))) ps1(path.join(PKG, 'outils', f), path.join(OUT, 'outils', f));
  for (const f of COMMON) fs.writeFileSync(path.join(OUT, f), crlf(fs.readFileSync(path.join(PKG, f), 'utf8')));
  fs.copyFileSync(path.join(PKG, 'GUIDE-SECOURS.html'), path.join(OUT, 'GUIDE-SECOURS.html'));
  // 4. Aucune donnée embarquée
  for (const bad of ['data', 'data-demo', 'data-demo-portable']) if (fs.existsSync(path.join(OUT, bad)) || fs.existsSync(path.join(APP, bad))) throw new Error(`Dossier de données dans le paquet : ${bad}`);
}
function copyRoleFiles(K, OUT) {
  for (const [src, dst] of K.files) {
    if (src.endsWith('.cmd')) fs.writeFileSync(path.join(OUT, dst), crlf(fs.readFileSync(path.join(PKG, src), 'utf8')));
    else fs.copyFileSync(path.join(PKG, src), path.join(OUT, dst));
  }
}
const zipDir = (srcGlob, zip) => {
  fs.rmSync(zip, { force: true });
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${srcGlob}' -DestinationPath '${zip}' -CompressionLevel Optimal`], { stdio: 'inherit' });
};
const mo = f => (fs.statSync(f).size / 1048576).toFixed(1) + ' Mo';

/* Paquets d'installation (ZIP) */
function build(kind) {
  const K = KINDS[kind], NAME = `${K.name}-${VERSION}`, OUT = path.join(DIST, NAME);
  assembleProgram(OUT, kind);
  copyRoleFiles(K, OUT);
  fs.writeFileSync(path.join(OUT, 'LISEZMOI.txt'), K.readme.join('\r\n'));
  const zip = path.join(DIST, `${NAME}.zip`);
  zipDir(OUT, zip);
  console.log(`Paquet prêt : ${zip} (${mo(zip)}) — Node ${nodeVersion}`);
}

/* Mise à jour : un seul .exe pour les deux PC (le script détecte le rôle du PC) */
function buildUpdate() {
  const NAME = `Mise-a-jour-EspaceCabinet-${VERSION}`, WORK = path.join(DIST, `.${NAME}`), P = path.join(WORK, 'payload');
  fs.rmSync(WORK, { recursive: true, force: true });
  assembleProgram(path.join(P, 'commun'), 'maj');
  for (const kind of ['staff', 'owner']) { fs.mkdirSync(path.join(P, kind)); copyRoleFiles(KINDS[kind], path.join(P, kind)); }
  const SRC = path.join(WORK, 'cab');
  fs.mkdirSync(SRC);
  zipDir(path.join(P, '*'), path.join(SRC, 'payload.zip'));
  ps1(path.join(PKG, 'maj', 'mettre-a-jour.ps1'), path.join(SRC, 'mettre-a-jour.ps1'));
  fs.writeFileSync(path.join(SRC, 'maj.cmd'), crlf(fs.readFileSync(path.join(PKG, 'maj', 'maj.cmd'), 'utf8')));
  const exe = path.join(DIST, `${NAME}.exe`);
  fs.rmSync(exe, { force: true });
  const files = ['payload.zip', 'mettre-a-jour.ps1', 'maj.cmd'];
  const sed = [
    '[Version]', 'Class=IEXPRESS', 'SEDVersion=3',
    '[Options]', 'PackagePurpose=InstallApp', 'ShowInstallProgramWindow=0', 'HideExtractAnimation=1', 'UseLongFileName=1',
    'InsideCompressed=0', 'CAB_FixedSize=0', 'CAB_ResvCodeSigning=0', 'RebootMode=N',
    'InstallPrompt=%InstallPrompt%', 'DisplayLicense=%DisplayLicense%', 'FinishMessage=%FinishMessage%', 'TargetName=%TargetName%',
    'FriendlyName=%FriendlyName%', 'AppLaunched=%AppLaunched%', 'PostInstallCmd=%PostInstallCmd%',
    'AdminQuietInstCmd=%AdminQuietInstCmd%', 'UserQuietInstCmd=%UserQuietInstCmd%', 'SourceFiles=SourceFiles',
    '[Strings]', 'InstallPrompt=', 'DisplayLicense=', 'FinishMessage=', `TargetName=${exe}`,
    'FriendlyName=Espace cabinet - mise a jour', 'AppLaunched=cmd /c maj.cmd', 'PostInstallCmd=<None>', 'AdminQuietInstCmd=', 'UserQuietInstCmd=',
    ...files.map((f, i) => `FILE${i}="${f}"`),
    '[SourceFiles]', `SourceFiles0=${SRC}\\`,
    '[SourceFiles0]', ...files.map((_, i) => `%FILE${i}%=`), '',
  ].join('\r\n');
  const sedFile = path.join(WORK, 'maj.sed');
  fs.writeFileSync(sedFile, sed);
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'iexpress.exe'), ['/N', '/Q', sedFile], { stdio: 'inherit' });
  for (let i = 0; i < 120 && !fs.existsSync(exe); i++) execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},500)']);
  if (!fs.existsSync(exe)) throw new Error('IExpress n\'a pas produit la mise à jour');
  fs.rmSync(WORK, { recursive: true, force: true });
  console.log(`Mise à jour prête : ${exe} (${mo(exe)}) — un seul fichier pour le PC du cabinet et le portable`);
}

fs.mkdirSync(DIST, { recursive: true });
const only = process.argv[2];
for (const f of fs.readdirSync(DIST)) {
  const kindOf = /^Install-Package-Staff/.test(f) ? 'staff' : /^Install-Package-Owner/.test(f) ? 'owner' : /^\.?Mise-a-jour-/.test(f) ? 'maj' : /^EspaceCabinet-/.test(f) ? 'old' : null;
  if (kindOf && (!only || only === kindOf || kindOf === 'old')) fs.rmSync(path.join(DIST, f), { recursive: true, force: true });
}
for (const kind of Object.keys(KINDS)) if (!only || only === kind) build(kind);
if (!only || only === 'maj') buildUpdate();
