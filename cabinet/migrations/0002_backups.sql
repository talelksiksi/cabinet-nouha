-- Historique des sauvegardes (automatiques 11 h 30 / 16 h 30, clé USB du mardi, manuelles)
CREATE TABLE backups (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('auto', 'usb', 'manual')),
  file     TEXT NOT NULL,
  size     INTEGER NOT NULL,
  ok       INTEGER NOT NULL,
  detail   TEXT,
  user_id  TEXT
);
CREATE INDEX backups_ts ON backups(ts);
