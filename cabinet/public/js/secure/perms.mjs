/* ═══════════════════════════════════════════
   Espace cabinet — niveaux d'accès (partagé : serveur + écran « Utilisateurs »)
   Chaque compte « staff » reçoit, domaine par domaine : aucun / consultation / modification.
   Les admins (Dr Nouha) ont tout ; le super-admin (informaticien) gère les comptes mais n'a aucun accès aux données.
   Le serveur applique ces règles à chaque requête : retirer un droit le coupe immédiatement.
   ═══════════════════════════════════════════ */

export const LEVELS = { none: 0, view: 1, edit: 2 };

export const MODULES = [
  { key: 'agenda',    label: 'Agenda, rendez-vous et demandes en ligne', levels: ['view', 'edit'] },
  { key: 'waiting',   label: 'Salle d\'attente',                          levels: ['view', 'edit'] },
  { key: 'patients',  label: 'Patients : identité et coordonnées',       levels: ['view', 'edit'] },
  { key: 'medical',   label: 'Dossier médical : antécédents, schéma dentaire, soins, radios', levels: ['view', 'edit'] },
  { key: 'documents', label: 'Ordonnances, certificats, devis, bulletins CNAM', levels: ['view', 'edit'] },
  { key: 'billing',   label: 'Factures et paiements des patients',      levels: ['view', 'edit'] },
  { key: 'cash',      label: 'Caisse et dépenses (entrées / sorties)',  levels: ['view', 'edit'] },
  { key: 'reports',   label: 'Rapports financiers',                      levels: ['view'] },
  { key: 'lab',       label: 'Prothèses et laboratoires',                levels: ['view', 'edit'] },
  { key: 'tasks',     label: 'Tâches',                                    levels: ['view', 'edit'] },
  { key: 'gallery',   label: 'Avant / après et publication sur le site', levels: ['view', 'edit'] },
  { key: 'acts',      label: 'Actes & tarifs, codes CNAM',               levels: ['view', 'edit'] },
  { key: 'settings',  label: 'Paramètres du cabinet',                    levels: ['edit'] },
];

// Collection de données → domaine qui la protège
export const COLLECTIONS = {
  patients: 'patients', activity: 'patients',
  appointments: 'agenda', requests: 'agenda',
  treatments: 'medical', chart: 'medical', files: 'medical',
  documents: 'documents',
  payments: 'billing',
  expenses: 'cash', labpayments: 'cash',
  labs: 'lab', labworks: 'lab',
  tasks: 'tasks',
  gallery: 'gallery',
  settings: 'settings',      // cas particulier : lisible par tous, l'enregistrement « acts » relève de « acts »
};

export const PRESETS = {
  dentist:   { label: 'Dentiste (associé ou remplaçant)', roleLabel: 'Dentiste', scope: 'own',
               perms: { agenda: 'edit', waiting: 'edit', patients: 'edit', medical: 'edit', documents: 'edit', billing: 'edit', lab: 'edit', tasks: 'edit', gallery: 'view', acts: 'view' } },
  assistant: { label: 'Assistante confirmée', roleLabel: 'Assistante', scope: 'all',
               perms: { agenda: 'edit', waiting: 'edit', patients: 'edit', medical: 'view', documents: 'edit', billing: 'edit', cash: 'edit', reports: 'view', lab: 'edit', tasks: 'edit', gallery: 'view', acts: 'edit' } },
  reception: { label: 'Accueil / secrétariat', roleLabel: 'Accueil', scope: 'all',
               perms: { agenda: 'edit', waiting: 'edit', patients: 'edit', billing: 'edit', tasks: 'edit' } },
  temp:      { label: 'Temporaire / nouvelle recrue', roleLabel: 'Assistante', scope: 'all',
               perms: { agenda: 'edit', waiting: 'edit', patients: 'view', tasks: 'edit' } },
};

/** Niveau d'un utilisateur sur un domaine : 0 aucun, 1 consultation, 2 modification. */
export function levelOf(user, module) {
  if (!user || user.status !== 'active') return 0;
  if (user.kind === 'admin') return 2;
  if (user.kind === 'superadmin') return 0;
  return LEVELS[(user.perms || {})[module]] || 0;
}

/** Peut lire / écrire un enregistrement de cette collection ? */
export function canAccess(user, collection, recordId, write) {
  const mod = COLLECTIONS[collection];
  if (!mod || !user || user.kind === 'superadmin' || user.status !== 'active') return false;
  if (collection === 'settings') {
    if (!write) return true;
    return recordId === 'acts' ? levelOf(user, 'acts') >= 2 : levelOf(user, 'settings') >= 2;
  }
  if (collection === 'activity' && write) {
    // le fil d'activité est alimenté par toute personne qui modifie quelque chose
    return user.kind === 'admin' || Object.values(user.perms || {}).includes('edit');
  }
  return levelOf(user, mod) >= (write ? 2 : 1);
}

/** Nettoie des droits reçus du navigateur (domaines et niveaux connus uniquement). */
export function sanitizePerms(input) {
  const out = {};
  for (const m of MODULES) {
    const v = input && input[m.key];
    if (v && v !== 'none' && m.levels.includes(v)) out[m.key] = v;
  }
  return out;
}
