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
| À obtenir | Téléphone / WhatsApp, horaires, e-mail, nom de domaine, logo en fichier vectoriel (SVG/PDF), diplômes et formations, nom de la clinique de Djerba (et accord pour la citer) |

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

## 7. Technique (tout sur Cloudflare)

- **Cloudflare Pages** : site public (statique, rapide) + application cabinet.
- **Pages Functions / Workers** : API (authentification, enregistrement des données chiffrées, demandes de RDV).
- **D1** (SQLite) : tables avec colonnes chiffrées + index aveugles.
- **R2** : photos, radios, documents (chiffrés) ; images publiques de la galerie (non nominatives).
- **Cloudflare Access** : protection de l'espace cabinet.
- Domaine : à choisir (ex. `dr-nouha-ksiksi.tn` ou `.com`) ; DNS sur le compte Cloudflare de Talel (celui de cictnardc.net).
- Dépôt : privé sur `talelksiksi` (nom à confirmer). Déploiement automatique depuis GitHub.
- Une **démo publique** avec données fictives pourra être ajoutée au portfolio (comme les deux autres projets).

## 8. Étapes

1. Maquette du site public (FR/AR) avec ses photos → validation par Talel et Dr Nouha.
2. Galerie avant/après (découpage des montages) + pages spécialités + conseils.
3. Socle sécurité : comptes, Access, chiffrement, index aveugles, clé de secours.
4. Espace cabinet : patients, schéma dentaire, rendez-vous (+ demandes en ligne), soins, plans de traitement.
5. Ordonnances, paiements, documents, consentements.
6. Mise en ligne : domaine, DNS, Access, sauvegardes ; formation de la praticienne et de l'assistante.

## 9. Questions ouvertes (à poser au démarrage)

- Nom de domaine souhaité ? Téléphone/WhatsApp, horaires, e-mail du cabinet ?
- Combien d'utilisateurs (elle + une assistante ?) et quelles adresses e-mail pour Access ?
- Les patients de Djerba sont-ils les siens (même dossier) ou ceux de la clinique (à ne pas mélanger) ?
- Afficher des tarifs indicatifs ?
- Accès au compte Cloudflare : Talel fournit un jeton d'API limité, ou fait les étapes lui-même guidé.
