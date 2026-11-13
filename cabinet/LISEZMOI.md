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

## Démonstration sur ce PC

Double-cliquer sur `LANCER-DEMO.cmd` (ou `node tools/demo.mjs`) : un cabinet fictif complet est recréé à chaque lancement
(5 comptes, ~45 patients, agenda du jour, factures, labo…) puis s'ouvre sur <http://localhost:3475>.
Identifiants de démonstration : `data-demo/COMPTES-DEMO.txt` (jamais dans Git).
La démo lance aussi le portable du Dr Nouha sur <http://localhost:3476>, déjà associé au cabinet
(seuls `nouha` et `talel` peuvent s'y connecter ; `--sans-portable` pour ne pas le lancer).

## Portable du Dr Nouha (mode « nomade »)

Même programme, installé avec le paquet `Install-Package-Owner` : il tourne seulement sur le portable (<http://localhost:3475>),
n'accepte que le Dr Nouha (tous ses droits) et l'administrateur informatique (ses droits habituels, sans les dossiers).
Association une seule fois : au cabinet, *Sauvegardes & système → Portables associés → Associer* donne un code de 15 min
à saisir sur le portable. Ensuite, dès que les deux sont sur le Wi-Fi du cabinet, tout se synchronise (toutes les 60 s ou
*Synchroniser maintenant*) : le cabinet reste la référence ; si la même donnée a changé des deux côtés, rien n'est écrasé et
le Dr Nouha choisit la version à garder (*Conflits à trancher*). Les actions d'administration (comptes, accès) faites sur le
portable sont transmises au cabinet ; le journal du portable y remonte aussi. Un portable perdu se retire depuis le cabinet.

## Paquets d'installation

```bash
node tools/build-package.mjs     # → dist/Install-Package-Staff-AAAA.MM.JJ.zip et dist/Install-Package-Owner-AAAA.MM.JJ.zip
```

- **Staff** : PC du cabinet (`INSTALLER.cmd`, crée les comptes protégés `nouha` et `talel` et affiche leurs codes d'activation)
  et autres PC du cabinet (`POSTE-CABINET.cmd` : certificat + raccourci). Guides : `GUIDE-INSTALLATION.html`, `GUIDE-SECOURS.html`.
- **Owner** : portable du Dr Nouha (`INSTALLER.cmd`, `COMPTES-PROTEGES.cmd`). Guides : `GUIDE-PORTABLE.html`, `GUIDE-SECOURS.html`.
- Node.js inclus, aucune donnée ni compte de démonstration.

## Mises à jour

```bash
node tools/build-package.mjs maj   # → dist/Mise-a-jour-EspaceCabinet-AAAA.MM.JJ-HHMM.exe (sans argument : les 3 livrables)
```

Un seul `.exe` (lanceur C# `package/lanceur/lanceur.cs`, compilé par `csc.exe` fourni avec Windows ; icône = logo) pour le PC du cabinet **et** le portable : il contient `payload.zip`
(`commun/` = node, app, outils, scripts ; `staff/` et `owner/` = fichiers propres à chaque rôle) et `package/maj/mettre-a-jour.ps1`.
Le script détecte le rôle (`data/config.json`), compare `app/VERSION.txt` (rien à faire si déjà à jour), demande les droits
administrateur, arrête le serveur, copie la base (`data/avant-maj-…`, 3 gardées), déplace l'ancienne version dans
`version-precedente`, installe, redémarre et vérifie ; en cas d'échec, remet l'ancienne version et la base. Journal :
`data/mises-a-jour.log`. Essai sans tâche Windows : `mettre-a-jour.ps1 -Payload … -Dest <dossier> -Test`
(port lu dans `CABINET_PLAIN_PORT`). Les migrations SQL s'appliquent au redémarrage. Version affichée dans Sauvegardes & système.

## Démonstration à envoyer pour relecture

```bash
node tools/build-package.mjs demo   # → dist/Demo-Espace-Cabinet-<version>.exe + dist/Guide-Demo-Espace-Cabinet.html
```

Un seul `.exe`, sans droits administrateur : installe dans `%LOCALAPPDATA%\EspaceCabinet-Demo`, raccourcis « Espace cabinet (démo) »
et « Guide de la démo » sur le bureau, lance `tools/demo.mjs --revue` (données fictives, mot de passe unique `Demo-Sourire-26!`,
tout en 127.0.0.1, pas de mDNS → aucune alerte du pare-feu). Relancé alors qu'une démo tourne : il la ferme et la remplace.
`SUPPRIMER-DEMO.cmd` dans le dossier pour tout enlever.

## Comptes protégés

`nouha` (titulaire, admin) et `talel` (administrateur informatique) sont créés par l'installation du cabinet (`tools/comptes.mjs init`),
chacun avec un code d'activation (72 h). Dans l'application, personne ne peut les modifier, désactiver ni réinitialiser ; chacun change
son propre mot de passe. Seul `tools/comptes.mjs reinitialiser|renommer` sur le portable (droits administrateur Windows) peut les toucher :
la demande part au cabinet à la synchronisation (jeton du portable associé). Une réinitialisation ne rend jamais l'accès aux dossiers
(feuille de secours nécessaire).

## Copie de secours sur le portable (option B)

Sur le portable, si le disque est chiffré (vérifié par l'installation → `"escrow": true` dans `data/config.json`), le navigateur
du Dr Nouha dépose la clé des données dans `data/secours-portable.json` (dossier réservé aux administrateurs Windows), après
vérification sur un vrai dossier ; la clé de sauvegarde du cabinet y est ajoutée à l'association. `comptes.mjs reinitialiser nouha`
joint alors la clé des données au code (chiffrée par lui, comme une invitation) : accès rendu sans feuille de secours.
`comptes.mjs cle-sauvegarde` affiche la clé de sauvegarde du cabinet. Portable retiré au cabinet ou disque déchiffré → copie effacée.
La feuille de secours reste le dernier recours.

## Restauration sur un PC de remplacement

Les sauvegardes (format `CNBK2`) emportent l'identité du serveur (poivre, autorité de certificat) : `RESTAURER.cmd` + clé de sauvegarde
sur un nouveau PC → mêmes mots de passe, même certificat. La base restaurée change d'« époque » : le portable renvoie alors
automatiquement ce qu'il connaît et que la sauvegarde n'avait pas.

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

- Automatiques à **11 h 30 et 15 h 45** (le cabinet ferme à 16 h) dans `data/backups/` (chiffrées) ; si le PC était éteint, dès son redémarrage.
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
