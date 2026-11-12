# Espace cabinet — serveur local

Tourne sur le PC de l'assistante, au cabinet. Accessible **uniquement sur le Wi-Fi du cabinet** :
<https://cabinet-nouha.local>. Rien n'est hébergé à l'extérieur (guide INPDP, délibération n°4 du 5 sept. 2018).

## Démarrer

```bash
npm install        # une fois (2 dépendances JavaScript pures, rien à compiler)
npm start          # https://cabinet-nouha.local  (ports 443 et 80)
npm test           # 24 scénarios de bout en bout
```

Node.js 22.13 ou plus (SQLite intégré). Variables utiles : `CABINET_DATA` (dossier des données, par défaut `data/`),
`CABINET_HTTPS_PORT`, `CABINET_HTTP_PORT`.

## Première installation

1. Au premier démarrage, le journal affiche un **code d'installation** (aussi dans `data/secrets.json`).
2. Sur chaque appareil : ouvrir `http://cabinet-nouha.local/certificat` et installer le certificat du cabinet (une fois).
3. Créer le compte super-admin avec le code, inviter Dr Nouha (admin), qui crée la clé des données
   et **imprime la clé de secours** (à garder au cabinet, sous clé).

## Sécurité, en bref

- Mots de passe, clés et dossiers patients sont chiffrés **dans le navigateur** : le serveur ne stocke que des
  empreintes, des clés enveloppées et des données illisibles. Le super-admin (informaticien) gère les comptes et le
  système, sans aucun accès aux données des patients.
- Droits par domaine (aucun / consultation / modification) appliqués par le serveur à chaque requête.
- Verrouillage après 30 min d'inactivité ; 5 erreurs de mot de passe = compte bloqué 15 min ; 20 échecs depuis un
  appareil = appareil bloqué 10 min ; renouvellement du mot de passe demandé tous les 6 mois.
- Le serveur refuse toute connexion qui ne vient pas du réseau local.

## Sauvegardes

- Automatiques à **11 h 30 et 16 h 30** dans `data/backups/` (chiffrées) ; si le PC était éteint, dès son redémarrage.
- Conservation : 14 jours complets, puis une par mois pendant 12 mois.
- **Chaque mardi à 11 h**, l'application demande de brancher la clé USB : copie chiffrée et vérifiée dans
  `Sauvegardes-Cabinet-Nouha\` sur la clé, qui repart ensuite hors du cabinet.
- Restaurer demande la **clé de sauvegarde** (`data/secrets.json`, à imprimer avec la feuille de secours) et la clé
  de secours des données.

## Dossiers

- `server/` : serveur (API, sauvegardes, HTTPS local, nom réseau)
- `public/` : application (navigateur) ; `public/js/secure/` : chiffrement et niveaux d'accès, partagés avec le serveur
- `migrations/` : schéma de la base
- `data/` : base, sauvegardes, certificats, secrets — **jamais dans Git**
