/* ═══════════════════════════════════════════
   Sauvegardes
   - automatiques à 11 h 30 et 15 h 45, avant la fermeture de 16 h (heure du PC) ; si le PC était éteint (coupure de courant),
     la sauvegarde manquée part dès le redémarrage
   - fichiers chiffrés (AES-256-GCM, clé de sauvegarde du cabinet) et compressés
   - conservation : tout sur 14 jours, puis la première de chaque mois pendant 12 mois (guide INPDP)
   - clé USB : rappel chaque mardi à 11 h jusqu'à ce qu'une copie soit faite ; copie relue et vérifiée
   ═══════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const MAGIC = Buffer.from('CNBK1');           // en-tête des fichiers de sauvegarde
const USB_DIR = 'Sauvegardes-Cabinet-Nouha';
const USB_KEEP = 8;                           // 8 semaines sur la clé

export function createBackup({ db, cfg, log = () => {}, now = () => new Date() }) {
  const key = Buffer.from(cfg.secrets.backupKey, 'base64');
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  const pad = n => String(n).padStart(2, '0');
  const stamp = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  function encrypt(plain) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([c.update(zlib.gzipSync(plain)), c.final()]);
    return Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]);
  }
  /** Déchiffre un fichier de sauvegarde (vérifie au passage qu'il est intact). */
  function decrypt(buf, k = key) {
    if (!buf.subarray(0, 5).equals(MAGIC)) throw new Error('Fichier de sauvegarde non reconnu');
    const d = crypto.createDecipheriv('aes-256-gcm', k, buf.subarray(5, 17));
    d.setAuthTag(buf.subarray(17, 33));
    return zlib.gunzipSync(Buffer.concat([d.update(buf.subarray(33)), d.final()]));
  }

  let running = Promise.resolve();
  /** Instantané cohérent de la base (VACUUM INTO), chiffré, écrit dans le dossier des sauvegardes. */
  function run(kind, userId = null) {
    const job = running.then(() => {
      const d = now();
      const file = `cabinet-${stamp(d)}-${kind}.cnbk`;
      const tmp = path.join(cfg.backupDir, `.tmp-${process.pid}-${Date.now()}.db`);
      try {
        db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
        const out = encrypt(fs.readFileSync(tmp));
        const dest = path.join(cfg.backupDir, file);
        fs.writeFileSync(dest + '.part', out);
        decrypt(fs.readFileSync(dest + '.part'));              // relecture : la sauvegarde est exploitable
        fs.renameSync(dest + '.part', dest);
        db.prepare('INSERT INTO backups (ts, kind, file, size, ok, user_id) VALUES (?, ?, ?, ?, 1, ?)').run(d.getTime(), kind, file, out.length, userId);
        prune();
        log(`Sauvegarde ${kind} : ${file} (${Math.round(out.length / 1024)} Ko)`);
        return { file, size: out.length, path: dest, ts: d.getTime() };
      } catch (e) {
        db.prepare('INSERT INTO backups (ts, kind, file, size, ok, detail, user_id) VALUES (?, ?, ?, 0, 0, ?, ?)').run(d.getTime(), kind, '', String(e.message).slice(0, 300), userId);
        log('Échec de sauvegarde', e);
        throw e;
      } finally { fs.rmSync(tmp, { force: true }); }
    });
    running = job.catch(() => {});
    return job;
  }

  /** 14 derniers jours : tout ; au-delà : la première sauvegarde de chaque mois, pendant 12 mois. */
  function prune() {
    const files = fs.readdirSync(cfg.backupDir).filter(f => /^cabinet-\d{8}-\d{6}-\w+\.cnbk$/.test(f)).sort();
    const t = now().getTime(), keepMonths = new Set();
    for (const f of files) {
      const y = +f.slice(8, 12), m = +f.slice(12, 14), dd = +f.slice(14, 16);
      const age = (t - new Date(y, m - 1, dd).getTime()) / 86400e3;
      if (age <= 14) continue;
      const month = `${y}-${m}`;
      if (age <= 366 && !keepMonths.has(month)) { keepMonths.add(month); continue; }
      fs.rmSync(path.join(cfg.backupDir, f), { force: true });
    }
  }

  /* ── Planification ── */
  const lastOk = kind => q(`SELECT MAX(ts) t FROM backups WHERE ok = 1 ${kind ? 'AND kind = ?' : ''}`, ...(kind ? [kind] : []))?.t || 0;
  /** Dernier créneau (11 h 30 / 15 h 45) déjà passé. */
  function lastSlot(d = now()) {
    const slots = cfg.backupSlots.map(([h, m]) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime());
    const past = slots.filter(s => s <= d.getTime());
    if (past.length) return Math.max(...past);
    const [h, m] = cfg.backupSlots[cfg.backupSlots.length - 1];
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, h, m).getTime();   // hier soir
  }
  function nextSlot(d = now()) {
    for (let add = 0; add < 2; add++) for (const [h, m] of cfg.backupSlots) {
      const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, h, m).getTime();
      if (s > d.getTime()) return s;
    }
  }
  /** Appelé chaque minute : lance la sauvegarde si le dernier créneau n'a pas encore la sienne. */
  async function tick() {
    if (lastOk('auto') < lastSlot() && lastOk() < lastSlot()) {
      try { await run('auto'); } catch { /* journalisé ; nouvel essai à la prochaine minute */ }
    }
  }
  let timer = null;
  const start = () => { tick(); timer = setInterval(tick, 60e3); timer.unref?.(); };
  const stop = () => clearInterval(timer);

  /** Le mardi 11 h le plus récent (déjà passé). */
  function lastUsbReminder(d = now()) {
    const { weekday, hour, minute } = cfg.usbReminder;
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
    x.setDate(x.getDate() - ((x.getDay() - weekday + 7) % 7));
    if (x.getTime() > d.getTime()) x.setDate(x.getDate() - 7);
    return x.getTime();
  }

  function status() {
    const last = q(`SELECT ts, kind, file, size FROM backups WHERE ok = 1 ORDER BY ts DESC LIMIT 1`);
    const lastFail = q(`SELECT ts, detail FROM backups WHERE ok = 0 ORDER BY ts DESC LIMIT 1`);
    const usb = q(`SELECT ts, file, detail FROM backups WHERE ok = 1 AND kind = 'usb' ORDER BY ts DESC LIMIT 1`);
    const reminder = lastUsbReminder();
    const installed = q(`SELECT MIN(created_at) t FROM users`)?.t || Date.now();
    return {
      last, lastFail: lastFail && (!last || lastFail.ts > last.ts) ? lastFail : null,
      nextAuto: nextSlot(), slots: cfg.backupSlots.map(([h, m]) => `${pad(h)}:${pad(m)}`),
      usb: usb ? { ts: usb.ts, file: usb.file, drive: usb.detail } : null,
      // rappel dû : mardi 11 h passé, et pas de copie USB depuis (pas de rappel avant la première semaine d'utilisation)
      usbDue: cfg.role !== 'nomade' && reminder > installed && (!usb || usb.ts < reminder),
      usbReminderSince: reminder,
      count: fs.readdirSync(cfg.backupDir).filter(f => f.endsWith('.cnbk')).length,
    };
  }

  /* ── Clé USB ── */
  function removableDrives() {
    if (process.platform !== 'win32') return [];
    try {
      const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2" | Select-Object DeviceID,VolumeName,FreeSpace,Size | ConvertTo-Json -Compress'],
        { encoding: 'utf8', timeout: 15000, windowsHide: true }).trim();
      if (!out) return [];
      return [].concat(JSON.parse(out)).filter(d => d.Size).map(d => ({ drive: d.DeviceID, label: d.VolumeName || '', free: d.FreeSpace, size: d.Size }));
    } catch (e) { log('Lecture des clés USB impossible', e); return []; }
  }
  async function toUsb(drive, userId) {
    const allowed = cfg.usbDrives ? cfg.usbDrives() : removableDrives().map(d => d.drive);
    if (!/^[A-Z]:$/.test(drive) || !allowed.includes(drive)) throw Object.assign(new Error('Clé USB introuvable : branchez-la puis réessayez.'), { status: 400 });
    const b = await run('usb', userId);
    const dir = path.join(cfg.usbRoot ? cfg.usbRoot(drive) : drive + '\\', USB_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, b.file);
    fs.copyFileSync(b.path, dest);
    decrypt(fs.readFileSync(dest));                         // relecture depuis la clé
    db.prepare(`UPDATE backups SET detail = ? WHERE file = ? AND kind = 'usb'`).run(drive, b.file);
    const old = fs.readdirSync(dir).filter(f => f.endsWith('.cnbk')).sort();
    for (const f of old.slice(0, Math.max(0, old.length - USB_KEEP))) fs.rmSync(path.join(dir, f), { force: true });
    return { ok: true, file: b.file, size: b.size, drive, kept: Math.min(old.length, USB_KEEP) };
  }

  return { run, tick, start, stop, status, removableDrives, toUsb, decrypt, lastSlot, nextSlot, lastUsbReminder };
}
