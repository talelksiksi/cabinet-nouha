-- Espace cabinet : schéma initial.
-- Rien de lisible sur les patients ici : les colonnes « data » sont chiffrées par le navigateur (AES-GCM 256).

-- Comptes : super-admin (informaticien, sans accès aux données), admin (dentiste + gestion), staff (niveaux d'accès)
CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name    TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('superadmin', 'admin', 'staff')),
  role_label      TEXT NOT NULL DEFAULT '',
  perms           TEXT NOT NULL DEFAULT '{}',            -- {"agenda":"edit","cash":"view",...}
  scope           TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'own')),
  status          TEXT NOT NULL CHECK (status IN ('invited', 'pending_key', 'active', 'disabled')),
  auth_hash       TEXT,                                   -- empreinte de la clé d'authentification (jamais le mot de passe)
  kdf_salt        TEXT,
  kdf_iter        INTEGER,
  pub_key         TEXT,                                   -- clé publique RSA-OAEP (JWK)
  priv_key_enc    TEXT,                                   -- clé privée chiffrée avec le mot de passe de l'utilisateur
  invite_hash     TEXT,
  invite_expires  INTEGER,
  invite_dek      TEXT,                                   -- clé de données chiffrée avec le code d'invitation (si l'invitant la possède)
  password_changed_at INTEGER,                           -- renouvellement régulier demandé par le guide INPDP
  failed_logins   INTEGER NOT NULL DEFAULT 0,
  locked_until    INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  last_login      INTEGER
);

-- Clé de données du cabinet, enveloppée pour chaque utilisateur autorisé (jamais pour le super-admin)
CREATE TABLE user_keys (
  user_id      TEXT PRIMARY KEY REFERENCES users(id),
  wrapped_dek  TEXT NOT NULL,
  granted_by   TEXT,
  granted_at   INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Données du cabinet : une ligne par enregistrement, contenu chiffré
CREATE TABLE records (
  collection  TEXT NOT NULL,
  id          TEXT NOT NULL,
  iv          TEXT,
  data        TEXT,
  owners      TEXT,               -- identifiants des dentistes concernés (pour « uniquement son travail »)
  deleted     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT,
  PRIMARY KEY (collection, id)
);
CREATE INDEX records_updated ON records(updated_at);

-- Index aveugles (HMAC) : recherche exacte / doublons sur téléphone et CIN sans les stocker en clair
CREATE TABLE blind_index (
  collection  TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  field       TEXT NOT NULL,
  hash        TEXT NOT NULL,
  PRIMARY KEY (collection, record_id, field)
);
CREATE INDEX blind_lookup ON blind_index(field, hash);

-- Divers : clé de données enveloppée par la clé de secours imprimée, etc.
CREATE TABLE meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Journal d'activité : qui, quoi, quand — jamais le contenu des dossiers
CREATE TABLE audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  user_id   TEXT,
  username  TEXT,
  action    TEXT NOT NULL,
  target    TEXT,
  detail    TEXT,
  ip        TEXT
);
CREATE INDEX audit_ts ON audit(ts);

