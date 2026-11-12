/* Configuration du serveur local + secrets générés au premier démarrage (jamais dans le dépôt). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig(overrides = {}) {
  // Installation : C:\EspaceCabinet\app (le programme) et C:\EspaceCabinet\data (les données, conservées aux mises à jour)
  const besideApp = path.join(ROOT, '..', 'data');
  const dataDir = path.resolve(overrides.dataDir || process.env.CABINET_DATA || (fs.existsSync(besideApp) ? besideApp : path.join(ROOT, 'data')));
  for (const d of [dataDir, path.join(dataDir, 'backups'), path.join(dataDir, 'tls')]) fs.mkdirSync(d, { recursive: true });

  // Secrets : poivre des empreintes d'authentification, clé de chiffrement des sauvegardes, code d'installation
  const secretsFile = path.join(dataDir, 'secrets.json');
  let secrets;
  if (fs.existsSync(secretsFile)) secrets = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
  else {
    secrets = {
      pepper: crypto.randomBytes(32).toString('base64'),
      backupKey: crypto.randomBytes(32).toString('base64'),
      setupToken: crypto.randomBytes(9).toString('base64url'),
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  }

  // Rôle de ce PC : « cabinet » (référence) ou « nomade » (portable du Dr Nouha), écrit par l'installation
  const confFile = path.join(dataDir, 'config.json');
  const local = fs.existsSync(confFile) ? JSON.parse(fs.readFileSync(confFile, 'utf8')) : {};

  return {
    role: process.env.CABINET_ROLE || local.role || 'cabinet',
    plainPort: +(process.env.CABINET_PLAIN_PORT || local.plainPort || 0) || null,
    // démonstration / essais : adresse directe du PC du cabinet (sinon il est trouvé sur le Wi-Fi par son nom)
    officeUrl: process.env.CABINET_OFFICE_URL || local.officeUrl || null,
    dataDir,
    dbFile: path.join(dataDir, 'cabinet.db'),
    backupDir: path.join(dataDir, 'backups'),
    tlsDir: path.join(dataDir, 'tls'),
    publicDir: path.join(ROOT, 'public'),
    migrationsDir: path.join(ROOT, 'migrations'),
    hostname: process.env.CABINET_HOSTNAME || 'cabinet-nouha.local',
    httpsPort: +(process.env.CABINET_HTTPS_PORT || 443),
    httpPort: +(process.env.CABINET_HTTP_PORT || 80),
    // Créneaux des sauvegardes automatiques (heure locale du PC) : fin de matinée et juste avant la fermeture (16 h)
    backupSlots: [[11, 30], [15, 45]],
    usbReminder: { weekday: 2, hour: 11, minute: 0 },   // mardi 11 h 00
    session: { idleMs: 30 * 60e3, maxMs: 11 * 3600e3 }, // verrouillage après 30 min d'inactivité (guide INPDP)
    demo: process.env.CABINET_DEMO === '1',
    secrets,
    ...overrides,
  };
}
