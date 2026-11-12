# Cabinet Dentaire Dr Nouha Ksiksi — plan

Premier vrai cabinet dentaire en ligne de CICTNA RDC. Un seul projet, deux faces :
**le site public** (attirer et rassurer les patients) et **l'espace cabinet** (gérer les patients),
hébergés sur **Cloudflare**, avec les données des patients **chiffrées** de bout en bout.

---

## 1. La praticienne et le cabinet

| | |
|---|---|
| Nom | Dr Nouha Ksiksi — عيادة د. نهى كسيكسي |
| Activité | Chirurgie et implantologie, esthétique du sourire, soins (dents et gencives), prothèse fixe et mobile |
| Arabe | جراحة الفم و زراعة الأسنان، تجميل الأسنان، علاج اللثة و الأسنان، تركيبات ثابتة و متحركة |
| Adresse | Médenine, en face de l'hôpital universitaire Habib Bourguiba |
| Autre lieu | Interventions dans une grande clinique à Djerba ; travaille aussi depuis chez elle |
| Facebook | https://www.facebook.com/drksiksinouha/ |
| Slogans existants | « Votre sourire, notre engagement » · « Votre sourire, notre priorité » · « Des soins de qualité pour un sourire durable » · « ابتسامتك .. أولويتنا » |
| Cabinet | 1 Bis Rue Pasteur, Médenine Sud 4100 · fiche Google : https://maps.app.goo.gl/cMfdkKGYkvkVVkUMA (33.33230, 10.48935) |
| Téléphone | Cabinet 23 232 407 · WhatsApp 98 192 130 |
| À obtenir | Horaires, e-mail, nom de domaine, logo en fichier vectoriel (SVG/PDF), diplômes et formations, nom de la clinique de Djerba (et accord pour la citer) |

## 2. Identité visuelle (la sienne, pas la nôtre)

Elle a déjà une marque : logo dent + implant (trait bleu et or), deux déclinaisons :
- **Bleu nuit et or** (bannière du cabinet) → identité principale du site. Bleu nuit ≈ `#16325c`, or ≈ `#c9a24b`, blanc cassé ≈ `#faf8f4`.
- **Bleu-vert (teal)** (fiches éducatives) → couleur d'accent pour les contenus « conseils ». Teal ≈ `#2a9db0`.
- Couleurs à confirmer en extrayant du logo vectoriel quand on l'aura.

Typographies : **différentes de dr-riadh-rjili.tn** (consigne). Proposition :
titres en serif élégante proche de sa bannière (ex. *Fraunces* ou *Cormorant*), texte en sans-serif lisible
(ex. *Plus Jakarta Sans*), arabe en *IBM Plex Sans Arabic* ou *Tajawal*. Une touche manuscrite discrète
pour les slogans (comme sur ses visuels).

## 3. Ressources reçues (`assets/`)

| Fichier | Contenu | Usage prévu |
|---|---|---|
| `photos/equipe/dr-nouha-ksiksi-portrait.jpg` | Portrait souriant, veste bleu marine (lors d'une formation en chirurgie) | Section « Votre dentiste », page À propos |
| `photos/cabinet/chirurgie-implant-salle.jpg` | Chirurgie implantaire, écran radio, salle équipée | Section « Le cabinet » / technologie |
| `photos/cabinet/chirurgie-en-cours.jpg` | Intervention en tenue stérile | Section implantologie |
| `photos/avant-apres/cas-01 … cas-06` | 6 cas avant/après (réhabilitations, facettes/couronnes, bridge, diastème) | Galerie avec curseur avant/après |
| `marque/banniere-cabinet-bleu-or.jpg` | Bannière officielle : logo, 4 spécialités, adresse | Référence couleurs/typo, réseaux |
| `marque/fiche-prothese-implants-fr.jpg` / `-ar.jpg` | Fiche « Prothèse totale stabilisée par 2 implants » (FR + AR) | Page traitement + article « Conseils » |

Traitement des avant/après : les images sont des montages (haut = avant, bas = après ; le cas 06 est côte à côte,
le cas 05 porte un libellé « Before »). → Découper automatiquement chaque montage en deux images alignées pour
un vrai curseur glissant, recadrer, compresser (WebP), retirer les métadonnées.
**Consentement écrit de chaque patient obligatoire** avant publication ; mettre un champ « consentement signé »
dans l'espace cabinet et ne publier que les cas consentis. Plus de photos et vidéos à venir.

## 4. Site public (côté patients)

Inspiré de la **mécanique de conversion** de dr-riadh-rjili.tn, sans en reprendre polices, bannières ni textes,
et en corrigeant ses faiblesses (chiffres incohérents, images de remplissage, pas de tarifs, arabe incomplet).

- **FR + AR complet** (vraie mise en page de droite à gauche), sélecteur de langue visible.
- **Appel à l'action partout** : « Prendre rendez-vous » (en-tête, héros, bouton flottant mobile) + bouton WhatsApp flottant + appel direct.
- **Héros** : portrait ou photo du cabinet, slogan, 4 spécialités, repère « en face du CHU Habib Bourguiba ».
- **Spécialités** : une page par traitement (implant, prothèse fixe/mobile, esthétique/facettes, chirurgie, soins et gencives) — déroulé, durée, réponses aux peurs, avant/après liés.
- **Galerie avant/après** à curseur, filtrable par traitement, avec durée du traitement.
- **Votre dentiste** : parcours, formations (ex. cycle de formation en chirurgie pré-implantaire), valeurs.
- **Conseils** : articles et fiches (ses fiches FR/AR deviennent des pages lisibles et partageables), vidéos plus tard.
- **Avis patients** (Google), **FAQ**, **plan d'accès** et itinéraire, horaires, urgences.
- **Ancrage local** : Médenine, Djerba, Zarzis, Ben Guerdane, Tataouine (référencement local).
- **Demande de rendez-vous en ligne** : choix du motif, créneau souhaité, nom + téléphone → chiffrés dans le navigateur (voir §6) → apparaissent dans l'espace cabinet. Confirmation par WhatsApp/SMS par le cabinet.
- Tarifs indicatifs « à partir de » si elle le souhaite.
- Rapide (< 2 s), accessible, référencement (balises, schema.org `Dentist`), mentions légales et confidentialité.

## 5. Espace cabinet (côté praticienne)

Reprend tout ce que la démo **dental-clinic** fait (et que Talel a validé), en vrai, plus :

- **Patients** : fiche, antécédents, alertes allergies/anticoagulants, **schéma dentaire FDI** dans la fiche (états, notes, historique par dent), documents/radios/photos.
- **Rendez-vous** : agenda jour/semaine, **lieu** (cabinet Médenine / clinique Djerba / autre), demandes en ligne à valider, rappels WhatsApp (lien pré-rempli).
- **Soins et plans de traitement** : devis par étapes (ex. implant → pilier → couronne), suivi de l'avancement, consentements éclairés imprimables et signés.
- **Ordonnances** et certificats (modèles), impression A5.
- **Paiements** en dinars (DT, 3 décimales), acomptes et paiements échelonnés, CNAM.
- **Avant/après** : capture liée au dossier + case « consentement publication » → alimente la galerie publique (photos anonymisées).
- **Comptes** : Dr Nouha + assistante (droits différents), journal des accès.
- **Fonctionne sur téléphone** (elle travaille aussi de chez elle et à Djerba).

## 6. Sécurité des données (exigence de Talel)

Demande initiale : « noms, numéros de carte d'identité et téléphones stockés hachés ».
Un hachage est **à sens unique** : la praticienne ne pourrait plus lire le nom de son patient. On applique donc :

1. **Chiffrement de bout en bout dans le navigateur** (AES-GCM 256, WebCrypto) de toutes les données nominatives
   et médicales : nom, prénom, CIN, téléphones, adresse, antécédents, notes, fichiers. Le serveur et la base Cloudflare
   ne voient que du texte chiffré.
2. **Index aveugles** (« blind index ») : HMAC-SHA-256 avec une clé secrète, sur le téléphone et la CIN normalisés
   → recherche exacte et détection de doublons **sans stocker le numéro en clair**. C'est la partie « hachée » demandée.
3. **Clés** : une clé de données aléatoire, enveloppée par la clé de chaque utilisateur (dérivée de son mot de passe,
   PBKDF2 ≥ 600 000 itérations). **Clé de secours imprimée** sur papier, gardée au cabinet. Sans elle et sans mot de passe,
   les données sont irrécupérables — c'est le prix de la sécurité.
4. **Demandes de RDV du site public** : chiffrées dans le navigateur du visiteur avec la **clé publique** du cabinet ;
   seule la praticienne peut les lire.
5. **Accès** : Cloudflare Access (code envoyé par e-mail, limité aux adresses autorisées) devant l'espace cabinet
   **+** mot de passe de déverrouillage de l'application. Sessions courtes, verrouillage automatique.
6. Recherche par nom : la liste des patients est déchiffrée **dans le navigateur** après connexion (quelques milliers
   de patients : instantané). Rien en clair côté serveur.
7. Sauvegardes chiffrées quotidiennes (R2), export complet possible par la praticienne.

Cadre légal : loi organique 2004-63, données de santé = données sensibles ; la praticienne est responsable du traitement.
Héberger chez Cloudflare (hors Tunisie) → **déclaration / autorisation INPDP** à faire par la praticienne ; le chiffrement
de bout en bout réduit fortement le risque mais ne dispense pas de la démarche. À lui signaler dès le départ.

## 6 bis. Décision d'hébergement de l'espace cabinet (12 novembre 2026) — remplace le §7 pour l'espace cabinet

Après lecture du guide INPDP / Ordre des médecins (`INPDP_guide_medecins.pdf`, délibération n°4 du 5 sept. 2018) :
un hébergement à distance des dossiers patients exige un **hébergeur de données de santé accrédité** (art. 16) ; Cloudflare
ne l'est pas et les données sortiraient de Tunisie. **Décision : l'espace cabinet est hébergé au cabinet, accessible
uniquement sur le Wi-Fi du cabinet.** Le site public reste sur Cloudflare (aucune donnée patient).

- **Machine** : le PC de l'assistante (allumé toute la journée), sous Windows Famille. Pas le PC de la radio (poste médical,
  logiciel du fabricant : on n'y touche pas). Mise en veille désactivée, redémarrages Windows hors heures d'ouverture.
- **Onduleur** recommandé (coupures de courant). **Chiffrement du disque** : plus tard (BitLocker = Windows Pro).
- **Service Windows** (démarre seul) : Node + base SQLite locale. On garde : chiffrement dans le navigateur, niveaux d'accès,
  super-admin sans accès aux données (exactement ce que le guide demande pour le technicien de maintenance).
- **Nom sur le réseau** : `cabinet-nouha.local` (annoncé par le service, mDNS) → fonctionne même si l'adresse IP change ou si
  la box redémarre ; en plus, adresse IP fixe réservée dans la box. HTTPS local (certificat installé une fois par appareil,
  indispensable au chiffrement dans le navigateur).
- **Wi-Fi invités** séparé pour les patients.
- **Sauvegardes** : chiffrées, automatiques **deux fois par jour, 11 h 30 et 15 h 45** (juste avant la fermeture de 16 h) (coupures de courant l'été) sur le disque
  du PC ; si le PC était éteint à l'heure prévue, la sauvegarde part dès son redémarrage. **Rappel chaque mardi à 11 h** dans l'application
  pour brancher la clé USB, copie chiffrée automatique, puis la clé part hors du cabinet (exigence du guide).
- **Accès à distance** (domicile, Djerba) : pas pour l'instant. Plus tard éventuellement par VPN, après avis de l'INPDP.
- **Obligations de la praticienne** (guide) : déclaration + **autorisation préalable** INPDP, désignation d'un **DPO**,
  **registre** des traitements, **notice** en salle d'attente, conservation 20 ans, contrat de maintenance / confidentialité
  avec Talel, notification ANSI en cas d'incident. Brouillons à préparer par nous.
- Site public : retirer le **motif** du message WhatsApp de prise de RDV (donnée de santé via une messagerie hébergée hors de Tunisie).

**Avancement (12 novembre 2026, soir)** — serveur local fait et testé (`cabinet/server/`, voir `cabinet/LISEZMOI.md`) :
comptes (super-admin / admin / staff à niveaux), invitations (code jamais transmis au serveur ; clé des données jointe
quand l'invitant la détient), clé de secours, droits appliqués à chaque requête, « son travail uniquement » pour les
dentistes non admin, données chiffrées + index aveugles, journal sans contenu, sauvegardes 11 h 30 / 15 h 45 + rattrapage,
clé USB du mardi 11 h, HTTPS local avec autorité du cabinet, nom `cabinet-nouha.local` (mDNS), réseau local uniquement.
24 tests de bout en bout + essai du vrai serveur (HTTPS, page certificat, nom réseau). **Reste** : brancher l'interface
(connexion, déverrouillage, synchronisation, écrans Utilisateurs / super-admin / sauvegardes et alerte du mardi,
verrouillage automatique), polices et bibliothèques hors ligne, installation comme tâche Windows, guide du routeur.

**Décision (13 novembre 2026)** : pas de numéro de CIN dans les fiches patients (non nécessaire) ; seul le téléphone a un index aveugle.

**Avancement (12 novembre 2026, nuit)** — application branchée sur le serveur : connexion, activation par code, déverrouillage,
clé des données + feuille de secours, attente d'autorisation, verrouillage auto 30 min ; stockage chiffré synchronisé (10 s) ;
menus selon les accès ; pages Utilisateurs / Journal / Sauvegardes & système / Mon compte ; bandeau USB du mardi ; polices et
icônes locales (champ CIN ajouté puis retiré : non nécessaire). Démo : `cabinet/LANCER-DEMO.cmd`. Paquet autonome : `node tools/build-package.mjs`
(ZIP 34 Mo, Node inclus, INSTALLER.cmd + guide) testé hors installation (14 vérifications). Formulaire du site : motif retiré.
**À faire** : installation réelle au cabinet ; reprise des données existantes (voir réponse à Talel).

**Avancement (13 novembre 2026)** — portable du Dr Nouha (mode « nomade ») : le cabinet coupe le courant à la fermeture,
donc le portable garde sa propre copie chiffrée et se resynchronise quand les deux sont sur le Wi-Fi du cabinet.
Réservé à Dr Nouha (tous droits) et Talel (droits informatiques, pas de dossiers). Association par code à usage unique (15 min),
certificat du cabinet épinglé ; le cabinet reste la référence ; conflits conservés et tranchés par Dr Nouha (écran
« Conflits à trancher ») ; actions d'administration du portable relayées au cabinet ; journal du portable remonté (origine
« portable ») ; factures du portable en série « P ». paquet Owner ; raccourci bureau avec icône sur les deux
installations. 35 tests (dont 11 de synchronisation) ; essai réel dans la démo (cabinet :3475 + portable :3476) : modification
croisée, conflit, résolution côté portable → version reçue au cabinet. **Reste** : décider comment les comptes Talel / Nouha
sont créés et protégés ; installation réelle (cabinet + portable).

**Avancement (13 novembre 2026, suite)** — comptes protégés et paquets finaux :
- `nouha` et `talel` créés par l'installation du cabinet avec un code d'activation chacun (72 h, affiché une fois) ; chacun choisit son
  mot de passe. Verrouillés dans l'application (403 « protected » sur modifier / désactiver / réinitialiser, même entre eux).
- Décision Talel : l'outil de gestion de ces deux comptes est sur le **portable du Dr Nouha** (`COMPTES-PROTEGES.cmd`, admin Windows),
  pas sur le PC du cabinet (les assistantes y ont accès). Demandes relayées au cabinet par la synchronisation, tracées au journal.
- Sauvegardes avec identité du serveur ; restauration sur PC de remplacement sans changer les mots de passe ni les certificats ;
  le portable complète la restauration. « Nouvelle feuille de secours » dans Mon compte.
- Deux paquets : `Install-Package-Staff` (cabinet + `POSTE-CABINET.cmd` pour les autres PC) et `Install-Package-Owner` (portable).
  Guides : installation, portable, secours. Pas de téléphones (PC et portable uniquement). Tendances « +12 % / +8 % » factices retirées.
- 40 tests ; essai de bout en bout sur les paquets extraits (activation des deux comptes, clé des données, association, outil du portable).

## 7. Technique (site public sur Cloudflare)

- **Cloudflare Pages** : site public (statique, rapide) + application cabinet.
- **Pages Functions / Workers** : API (authentification, enregistrement des données chiffrées, demandes de RDV).
- **D1** (SQLite) : tables avec colonnes chiffrées + index aveugles.
- **R2** : photos, radios, documents (chiffrés) ; images publiques de la galerie (non nominatives).
- **Cloudflare Access** : protection de l'espace cabinet.
- Domaine : à choisir (ex. `dr-nouha-ksiksi.tn` ou `.com`) ; DNS sur le compte Cloudflare de Talel (celui de cictnardc.net).
- Dépôt : privé sur `talelksiksi` (nom à confirmer). Déploiement automatique depuis GitHub.
- Une **démo publique** avec données fictives pourra être ajoutée au portfolio (comme les deux autres projets).

## 8. Où on en est (12 novembre 2026)

Fait :
- Dossier, git local (identité personnelle), photos rangées dans `assets/`.
- `tools/prepare-images.ps1` : découpe les montages avant/après en paires (`site/img/cas/*-avant.jpg` / `*-apres.jpg`),
  redimensionne les photos sans métadonnées, extrait le logo de la bannière (`site/img/logo-banniere.jpg`).
  Le cas 06 (montage « polaroïd » côte à côte) n'est pas encore découpé.
- **Premier aperçu du site public** (`site/index.html`, `styles.css`, `main.js`), en français, statique :
  héros (portrait, slogan, badge CHU), 6 cartes spécialités, curseur avant/après (5 cas, balayage automatique
  à l'apparition), « Votre dentiste », fiche « prothèse stabilisée par 2 implants », formulaire de RDV (validation
  seulement, **n'envoie rien**), carte Google + itinéraire, boutons flottants WhatsApp / RDV, apparitions au défilement.
  Polices : Fraunces (titres), Plus Jakarta Sans (texte), Caveat (slogans). Couleurs : bleu nuit `#16325c`, or `#c9a24b`.
- **Version arabe complète** (`site/ar/index.html`, `dir="rtl"`) : mêmes sections, textes en arabe repris de ses
  propres formulations (« ابتسامتك .. أولويتنا », intitulés des spécialités), fiche implants en arabe, curseur avant/après
  inversé (« قبل » à droite). Polices arabes : Amiri (titres), IBM Plex Sans Arabic (texte), Aref Ruqaa (slogans).
  `styles.css` passe aux propriétés logiques (`inset-inline-*`, `margin-inline-*`) : un seul fichier pour les deux sens.
  `main.js` lit `<html lang>` pour les textes (cas, messages, WhatsApp). Liens `hreflang` FR ↔ AR.
- **Logo détouré** (`tools/extract-logo.py`) : `site/img/logo.png` (bleu et or) et `logo-blanc.png` (pied de page),
  fond transparent, sans halo — en attendant le fichier vectoriel officiel.
- **Coordonnées réelles** : téléphone et WhatsApp branchés (`CABINET` dans `main.js`), carte et itinéraire sur sa propre
  fiche Google Maps (note 4,8), bouton « Voir la fiche Google Maps ». Ligne « patients de Médenine, Djerba… » retirée (demande de Talel).
- **Captures pour Dr Nouha** dans `apercus/` (hors git) : ordinateur et téléphone, FR et AR. Carte « Médenine » du héros
  déplacée en bas de la photo (elle cachait son visage).
- **Espace cabinet local** (`app/`) : copie de la démo `dental-clinic` à son nom (clés de stockage `cn_`, ses coordonnées,
  elle + une assistante), aperçu `node tools/serve.js 3475 app` (config « nouha-cabinet »). **La démo Vercel reste générique**
  (clients internationaux) : rien de spécifique à la Tunisie ou au cabinet n'y est ajouté.
  Fonctions vues dans la vidéo « Smart Clinic » qu'elle a reçue, ajoutées ici (`app/js/cabinet-plus.js`, `app/css/cabinet-plus.css`),
  à reprendre dans la vraie version chiffrée : salle d'attente en temps réel
  (arrivé → fauteuil → terminé, durées d'attente et de soin, alertes allergies/anticoagulants), agenda semaine,
  demandes de RDV en ligne (planifier, créer la fiche, répondre par WhatsApp), prothèses et laboratoires (suivi des travaux,
  retards, soldes dus), tâches avec priorités, caisse et dépenses (rapport journalier imprimable, chèques émis),
  ordonnances A5 avec médicaments favoris, certificats, devis, **bulletin de soins CNAM** pré-rempli (assuré, malade,
  soins, prothèses, schéma dentaire adulte et temporaire), galerie avant/après avec consentement de publication.
  Non repris : orthodontie, appli mobile patient, passerelle SMS payante (WhatsApp suffit).
  **Bulletin CNAM** : calé sur le formulaire officiel (recto « soins dentaires » de https://www.cnam.nat.tn/doc/upload/BS1.pdf,
  image `app/img/cnam-bulletin-dentaire.jpg`), données placées aux positions mesurées sur le PDF, A4 paysage sans marge.
  Option « Données seules » pour imprimer sur un bulletin pré-imprimé.
  **Actes & tarifs** : catalogue unique (tarif, code acte CNAM, cotation, prothèse oui/non) + code praticien, modifiable par
  la dentiste ET l'assistante, enregistré automatiquement ; les codes sont vides au départ, c'est le cabinet qui les remplit.
  Le bulletin et les soins reprennent automatiquement ces valeurs. À vérifier avec elle : un essai réel sur un bulletin
  papier (alignement selon son imprimante), son code praticien CNAM, et les codes / cotations qu'elle utilise.
- Aperçu local : `node tools/serve.js` (sert `dossier/` → `dossier/index.html` comme Cloudflare Pages), port 3471.

Écarté volontairement : l'image de salle de soins de la bannière (semble être une illustration, pas son cabinet).

- **En ligne** : https://dr-nouha-ksiksi.ksiksi-talel.workers.dev (Cloudflare Workers, fichiers statiques), dépôt privé
  https://github.com/talelksiksi/cabinet-nouha, redéploiement automatique à chaque push sur `main`. `wrangler.jsonc` ne publie
  que `site/` (vérifié : `/app/`, `/assets/`, `PLAN.md` → 404). Formulaire de RDV : ouvre WhatsApp pré-rempli (rien n'est stocké).

Reste à faire en priorité :
1. Envoyer le lien à Dr Nouha ; choisir le nom de domaine et le brancher (onglet Domains du Worker).
2. Faire relire les textes arabes par Dr Nouha (formulations médicales, ton).
3. Compléter les horaires (section Accès des deux pages).
4. Faire valider les textes (descriptions des cas, points « Votre dentiste ») et les consentements des patients.
5. Puis le socle sécurité et l'espace cabinet (étapes 3 à 6 ci-dessous).

## 9. Étapes

1. Maquette du site public (FR/AR) avec ses photos → validation par Talel et Dr Nouha.
2. Galerie avant/après (découpage des montages) + pages spécialités + conseils.
3. Socle sécurité : comptes, Access, chiffrement, index aveugles, clé de secours.
4. Espace cabinet : patients, schéma dentaire, rendez-vous (+ demandes en ligne), soins, plans de traitement.
5. Ordonnances, paiements, documents, consentements.
6. Mise en ligne : domaine, DNS, Access, sauvegardes ; formation de la praticienne et de l'assistante.

## 10. Questions ouvertes (à poser au démarrage)

- Nom de domaine souhaité ? Téléphone/WhatsApp, horaires, e-mail du cabinet ?
- Combien d'utilisateurs (elle + une assistante ?) et quelles adresses e-mail pour Access ?
- Les patients de Djerba sont-ils les siens (même dossier) ou ceux de la clinique (à ne pas mélanger) ?
- Afficher des tarifs indicatifs ?
- Accès au compte Cloudflare : Talel fournit un jeton d'API limité, ou fait les étapes lui-même guidé.
