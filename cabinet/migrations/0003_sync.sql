-- Ordinateur portable du Dr Nouha (copie « nomade ») synchronisé avec le PC du cabinet.
-- Sur le portable : remote_v = version du cabinet sur laquelle repose la ligne ; dirty = modifiée ici, pas encore envoyée ;
-- conflict = version du cabinet quand les deux côtés ont modifié la même donnée (à trancher par le Dr Nouha).
ALTER TABLE records ADD COLUMN remote_v INTEGER;
ALTER TABLE records ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE records ADD COLUMN conflict TEXT;
CREATE INDEX records_dirty ON records(dirty);

-- Au cabinet : portables associés (jeton de synchronisation, jamais stocké en clair)
CREATE TABLE nodes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  created_by  TEXT,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER,
  last_ip     TEXT,
  revoked     INTEGER NOT NULL DEFAULT 0
);

-- Journal : origine de l'action (cabinet / portable)
ALTER TABLE audit ADD COLUMN origin TEXT;
