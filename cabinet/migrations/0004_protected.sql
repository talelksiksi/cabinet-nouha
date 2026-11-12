-- Comptes protégés : le Dr Nouha (titulaire) et l'administrateur informatique.
-- Créés par l'installation du PC du cabinet ; impossibles à modifier, désactiver ou réinitialiser depuis l'application.
-- Seul l'outil « comptes protégés » du portable du Dr Nouha peut les réinitialiser (nouveau code d'activation).
ALTER TABLE users ADD COLUMN protected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN activated_at INTEGER;
UPDATE users SET activated_at = COALESCE(password_changed_at, created_at) WHERE auth_hash IS NOT NULL;

-- Sur le portable : demandes de l'outil « comptes protégés », envoyées au cabinet à la prochaine synchronisation
CREATE TABLE protected_ops (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  op          TEXT NOT NULL,          -- 'reset' | 'rename'
  username    TEXT NOT NULL,
  payload     TEXT NOT NULL,          -- JSON : { inviteAuth } ou { displayName }
  sent_at     INTEGER,
  result      TEXT
);
