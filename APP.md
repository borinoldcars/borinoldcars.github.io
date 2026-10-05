# Application Borin'Old Cars

Web app installable (PWA) servie par GitHub Pages à l'adresse https://borinoldcars.github.io/.
Sur téléphone : ouvrir le lien puis « Installer » (Android) ou Partager → « Sur l'écran d'accueil » (iPhone).

## Fonctions

| Onglet | Contenu | Où modifier |
|---|---|---|
| Accueil | Prochaine sortie, raccourcis, boutons Facebook / Instagram / TikTok | `app/data/config.json` (nom, slogan, email, liens, `reseaux`) |
| Agenda | Sorties à venir / passées, ajout au calendrier, itinéraire, bouton d'inscription Tally | `app/data/events.json` **ou** onglet Google Sheet (voir plus bas) |
| Garage | Véhicules des membres (comité en tête), recherche par marque | Automatique depuis le Google Sheet (voir « Plusieurs véhicules par membre ») ; comité dans `config.json` → `comite` ; photos ajoutées à la main (ex. voiture détourée dans `app/garage/`) dans `config.json` → `photos_vehicules` (`"id-du-véhicule": "chemin ou lien"`) |
| Photos | Albums d'événements + visionneuse | `app/data/photos.json` |
| Boutique | Articles du club (photos, prix, tailles) ; un article touché s'affiche en grand avec un bouton « Commander » vers le bon de commande Tally | `app/data/boutique.json` (+ photos dans `app/boutique/`) |
| Ma carte | Carte de membre avec QR code (fonctionne hors ligne), visible seulement via le lien personnel du membre | Voir « Cartes de membre » ; année dans `config.json` → `annee_carte` |

Les inscriptions aux sorties se font uniquement sur le formulaire Tally dont le lien est noté dans la
colonne `Inscription` : l'application affiche un bouton « S'inscrire » qui ouvre ce lien. Sans lien, pas de
bouton. Les commandes de la boutique se font de même sur le bon de commande Tally (`commande` dans
`boutique.json`).

Les entrées marquées `"exemple": true` sont des exemples à remplacer ou supprimer.

## Formats

**Événement** (`events.json`) : `id` (unique), `date` (`AAAA-MM-JJ`), `heure`, `fin` (`HH:MM`), `titre`, `lieu`,
`description`, `prix`, `inscription` (lien Tally), `image` (lien).

**Album** (`photos.json`) : `id`, `titre`, `date` et **`dossier`** (identifiant du dossier Google Drive partagé
« Tous les utilisateurs disposant du lien » : la page de l'album affiche tout le dossier, nouvelles photos
comprises). À défaut : `photos` (liens d'images) ou `drive` (identifiants de photos). Couverture : `couverture`,
sinon l'affiche de la sortie liée.
La mise à jour automatique (toutes les 30 min) lit chaque `dossier` et remplit `drive` avec la liste des
photos : l'album s'affiche alors en vignettes. Tant que la liste est vide, l'album montre le dossier Drive. Une sortie de l'agenda à la même `date` affiche le bouton
« Voir les photos de l'événement » (ou indiquer `evenement` = id de la sortie).

**Boutique** (`boutique.json`) : `commande` (lien du bon de commande Tally), `note`, et `articles` :
`id`, `nom`, `prix` (nombre), `tailles` (liste, vide si sans objet), `image`. Garder les articles et prix
identiques à ceux du bon de commande Tally.

## Agenda depuis Google Sheets (optionnel)

1. Ajouter un onglet « Agenda » avec les colonnes : `Date` (JJ/MM/AAAA), `Heure`, `Fin`, `Titre`, `Lieu`,
   `Description`, `Prix`, `Inscription` (lien du formulaire Tally), `Affiche` (lien de l'image : un lien de
   partage Google Drive fonctionne, à condition que le fichier soit partagé « Tous les utilisateurs disposant du lien »).
   Quand `Inscription` contient un lien, un bouton « S'inscrire » l'ouvre (dans l'agenda, sur l'accueil et
   sur la page de la sortie) ; sans lien, pas de bouton.
2. Fichier → Partager → Publier sur le web → cet onglet au format CSV, copier le lien.
3. Dans GitHub : Settings → Secrets and variables → Actions → nouveau secret `EVENTS_CSV_URL`.

Le workflow (toutes les 30 min) régénère alors `app/data/events.json`, ainsi que `app/data/members.json`
(nom, véhicule, statut de cotisation — sans adresse, téléphone, email ni plaque).

## Garage : la « Fiche Véhicule »

Le garage se remplit à partir du Google Sheet **« Fiche Véhicule »** (les réponses au formulaire, une
ligne par véhicule : marque, modèle, version, couleur, motorisation, état, anecdote…). Chaque ligne est
rattachée à un membre par son **nom et prénom** ; un membre peut donc avoir plusieurs véhicules.
Le véhicule indiqué dans la liste des membres reste affiché, sauf s'il est déjà décrit par une fiche.

Mise en place (une seule fois) :

1. Ouvrir « Fiche Véhicule » → Fichier → Partager → Publier sur le web → choisir la feuille,
   format **CSV** → Publier, puis copier le lien.
2. GitHub : Settings → Secrets and variables → Actions → nouveau secret `GARAGE_CSV_URL` = ce lien.

Ensuite, chaque nouvelle réponse au formulaire apparaît dans l'application à la mise à jour suivante
(toutes les 30 min). Si un nom ne correspond à aucun membre, le véhicule est quand même affiché et le
journal du workflow « Build members » le signale. Une colonne d'envoi de fichier (photo) contenant un
lien d'image est utilisée comme photo du véhicule.

## Cartes de membre : liens personnels

Chaque membre ouvre **sa** carte avec un lien personnel (`https://borinoldcars.github.io/#/carte/<clé>`).
Il l'ouvre une fois sur son téléphone ; la carte y reste enregistrée. Sans ce lien, l'application n'affiche
aucune carte et ne propose pas la liste des membres.

- La clé est calculée à partir d'un secret (**`CARD_SECRET`**) ; le site ne publie qu'une empreinte de la
  clé, pas la clé. Sans le secret GitHub `CARD_SECRET`, la mise à jour garde les empreintes déjà publiées
  (les liens envoyés restent valides) ; avec, elle calcule aussi celles des nouveaux membres.
  Changer `CARD_SECRET` invalide tous les liens (à renvoyer ensuite).
- Pour obtenir les liens (y compris ceux des nouveaux membres) : script `scripts/liens-cartes.gs`, à coller
  dans le Google Sheet des membres (Extensions → Apps Script, propriété de script `CARD_SECRET` = même
  valeur que le secret GitHub). Il remplit un onglet « Liens cartes », **à ne jamais publier**.
- Le QR code de la carte ouvre une fiche de vérification publique limitée au nom, prénom, véhicule et
  état de la cotisation (plus d'adresse, GSM, email ni plaque).

## Date d'entrée au club (« Membre depuis »)

La carte de membre affiche « Membre depuis <mois année> ». La date vient d'une colonne de la liste des
membres (« Membre depuis », « Date d'inscription » ou « Submitted at ») si elle existe, sinon du fichier
`app/data/membres-depuis.json` (`"nom-prenom": "AAAA-MM-JJ"` ou `"AAAA"`).
Les membres listés dans `config.json` → `fondateurs` affichent « Membre fondateur » à la place.

## Notifications (OneSignal)

L'accueil affiche un encart « Notifications du club » avec le bouton « Recevoir les notifications ».
Les messages s'envoient depuis https://dashboard.onesignal.com (compte du club, offre gratuite) :
Messages → New Message → Push, puis titre, texte, éventuellement une image et un lien
(par exemple `https://borinoldcars.github.io/#/agenda`).

- Android / tablette : fonctionne depuis Chrome ou l'app installée.
- iPhone : uniquement si l'app est installée sur l'écran d'accueil (iOS 16.4 ou plus récent).
- L'identifiant de l'app OneSignal est `ONESIGNAL_APP_ID` dans `app/app.js` ; `sw.js` charge le
  service worker de OneSignal. Dans OneSignal, Settings → Push & In-App → Web doit indiquer
  l'adresse `https://borinoldcars.github.io` (intégration « Custom Code »).

## Fiches véhicule (PDF)

Sur la page « Ma carte de membre », un bouton « Fiche véhicule » par voiture du membre ouvre la fiche
PDF (aperçu dans l'application) avec un bouton « Télécharger le PDF ». Les fiches sont dans le dossier
Google Drive du club (partagé « Tous les utilisateurs disposant du lien »). Correspondance véhicule → fichier :
`config.json` → `fiches_vehicules` (`"id-du-véhicule": "id-du-fichier-Drive"`). Pour une nouvelle fiche,
ajouter le PDF dans le dossier et l'associer au véhicule. Remplacer le contenu d'un PDF existant
(Drive : « Gérer les versions ») garde le même lien.

## Site vitrine

Site public de présentation du club : https://borinoldcars.github.io/site/ (dossier `site/`).
Il lit les mêmes fichiers que l'application (`app/data/` : slogan, email, réseaux, comité, agenda,
garage, albums, boutique) : rien à mettre à jour en double. Le site a ses propres pages (agenda complet, fiche de
chaque sortie, garage avec recherche, fiche de chaque voiture, albums photos) : il ne renvoie pas vers
l'application, réservée aux membres (seul un lien « Espace membres » en pied de page y mène). Sur la vitrine, les propriétaires sont affichés
avec leur prénom et l'initiale du nom. Le bouton « Demander à adhérer » ouvre le formulaire d'adhésion Tally
(https://tally.so/r/OD46PM). Les textes de présentation (« Le club », « Nous rejoindre ») se
modifient directement dans `site/index.html`.
