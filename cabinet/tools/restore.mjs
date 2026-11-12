/* Restaurer une sauvegarde (.cnbk) — serveur ARRÊTÉ.
   Usage : node tools/restore.mjs <fichier.cnbk> [--cle <clé de sauvegarde>]
   - sans --cle : utilise la clé de sauvegarde de ce PC (data/secrets.json)
   - sur un PC de remplacement : --cle avec la clé imprimée (feuille « clé de sauvegarde »)
   La sauvegarde contient aussi l'identité du serveur : sur un PC de remplacement, elle est reprise (mots de passe
   inchangés pour tous ; au cabinet, même certificat : les autres postes et le portable le reconnaissent).
   La base actuelle est mise de côté (cabinet.db.avant-restauration-AAAAMMJJ-HHMM), rien n'est effacé. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { loadConfig } from '../server/config.mjs';
import { createBackup } from '../server/backup.mjs';

const file = process.argv[2];
const i = process.argv.indexOf('--cle');
if (!file || !fs.existsSync(file)) { console.error('Usage : node tools/restore.mjs <fichier.cnbk> [--cle <clé>]'); process.exit(1); }
const cfg = loadConfig();
const givenKey = i > 0 ? String(process.argv[i + 1] || '').trim() : null;
if (givenKey) cfg.secrets.backupKey = givenKey;
const backup = createBackup({ db: { prepare: () => ({ get: () => null, run: () => {} }), exec: () => {} }, cfg });
let plain, identity;
try { ({ db: plain, identity } = backup.decryptFull(fs.readFileSync(file))); }
catch { console.error('Impossible de déchiffrer : fichier abîmé ou clé de sauvegarde incorrecte.'); process.exit(2); }
if (plain.subarray(0, 15).toString() !== 'SQLite format 3') { console.error('Le fichier déchiffré n\'est pas une base valide.'); process.exit(3); }
const d = new Date(), pad = n => String(n).padStart(2, '0');
const tag = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
for (const ext of ['', '-wal', '-shm']) {
  const f = cfg.dbFile + ext;
  if (fs.existsSync(f)) fs.renameSync(f, `${cfg.dbFile}.avant-restauration-${tag}${ext}`);
}
fs.writeFileSync(cfg.dbFile, plain);
// nouvelle « époque » : à sa prochaine synchronisation, le portable du Dr Nouha renvoie ce que la sauvegarde n'avait pas
{
  const rdb = new DatabaseSync(cfg.dbFile);
  rdb.prepare(`INSERT INTO meta (key, value, updated_at) VALUES ('epoch', ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .run(`restauration-${tag}-${crypto.randomBytes(4).toString('hex')}`, Date.now());
  rdb.close();
}
console.log(`Restauré : ${path.basename(file)} → ${cfg.dbFile}`);

// Identité du serveur (PC de remplacement) : même poivre, même clé de sauvegarde, même autorité de certificat
const secretsFile = path.join(cfg.dataDir, 'secrets.json');
const secrets = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
let changed = false;
if (identity?.pepper && identity.pepper !== secrets.pepper) { secrets.pepper = identity.pepper; changed = true; }
if (givenKey && givenKey !== secrets.backupKey) { secrets.backupKey = givenKey; changed = true; }  // les anciennes sauvegardes et la feuille restent valables
if (changed) {
  fs.copyFileSync(secretsFile, `${secretsFile}.avant-restauration-${tag}`);
  fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  console.log('Identité du cabinet reprise : chacun garde son mot de passe ; la clé de sauvegarde imprimée reste la bonne.');
}
if (identity?.tls && cfg.role !== 'nomade') {
  const cur = fs.existsSync(path.join(cfg.tlsDir, 'ca.crt')) ? fs.readFileSync(path.join(cfg.tlsDir, 'ca.crt'), 'utf8') : '';
  if (cur !== identity.tls['ca.crt']) {
    for (const f of fs.readdirSync(cfg.tlsDir)) fs.renameSync(path.join(cfg.tlsDir, f), path.join(cfg.tlsDir, `${f}.avant-restauration-${tag}`));
    fs.writeFileSync(path.join(cfg.tlsDir, 'ca.key'), identity.tls['ca.key'], { mode: 0o600 });
    fs.writeFileSync(path.join(cfg.tlsDir, 'ca.crt'), identity.tls['ca.crt']);
    console.log('Certificat du cabinet repris : les autres postes et le portable reconnaîtront ce PC sans réinstallation.');
  }
}
console.log('Redémarrez le serveur. Les données restent chiffrées : chacun se reconnecte avec son mot de passe habituel.');
