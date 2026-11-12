/* Restaurer une sauvegarde (.cnbk) — serveur ARRÊTÉ.
   Usage : node tools/restore.mjs <fichier.cnbk> [--cle <clé de sauvegarde>]
   - sans --cle : utilise la clé de sauvegarde de ce PC (data/secrets.json)
   - sur un nouveau PC : --cle avec la clé imprimée (feuille « clé de sauvegarde »)
   La base actuelle est mise de côté (cabinet.db.avant-restauration-AAAAMMJJ-HHMM), rien n'est effacé. */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../server/config.mjs';
import { createBackup } from '../server/backup.mjs';

const file = process.argv[2];
const i = process.argv.indexOf('--cle');
if (!file || !fs.existsSync(file)) { console.error('Usage : node tools/restore.mjs <fichier.cnbk> [--cle <clé>]'); process.exit(1); }
const cfg = loadConfig();
if (i > 0) cfg.secrets.backupKey = process.argv[i + 1];
const backup = createBackup({ db: { prepare: () => ({ get: () => null, run: () => {} }), exec: () => {} }, cfg });
let plain;
try { plain = backup.decrypt(fs.readFileSync(file)); }
catch { console.error('Impossible de déchiffrer : fichier abîmé ou clé de sauvegarde incorrecte.'); process.exit(2); }
if (plain.subarray(0, 15).toString() !== 'SQLite format 3') { console.error('Le fichier déchiffré n\'est pas une base valide.'); process.exit(3); }
const d = new Date(), pad = n => String(n).padStart(2, '0');
const tag = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
for (const ext of ['', '-wal', '-shm']) {
  const f = cfg.dbFile + ext;
  if (fs.existsSync(f)) fs.renameSync(f, `${cfg.dbFile}.avant-restauration-${tag}${ext}`);
}
fs.writeFileSync(cfg.dbFile, plain);
console.log(`Restauré : ${path.basename(file)} → ${cfg.dbFile}`);
console.log('Redémarrez le serveur. Les données restent chiffrées : chacun se reconnecte avec son mot de passe habituel.');
