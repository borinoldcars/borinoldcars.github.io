# Application Borin'Old Cars

Web app installable (PWA) servie par GitHub Pages à l'adresse https://borinoldcars.github.io/.
Sur téléphone : ouvrir le lien puis « Installer » (Android) ou Partager → « Sur l'écran d'accueil » (iPhone).

## Fonctions

| Onglet | Contenu | Où modifier |
|---|---|---|
| Accueil | Prochaine sortie, raccourcis | `app/data/config.json` (nom, slogan, email, liens) |
| Agenda | Sorties à venir / passées, ajout au calendrier, itinéraire, bouton d'inscription Tally | `app/data/events.json` **ou** onglet Google Sheet (voir plus bas) |
| Garage | Véhicules des membres (comité en tête), recherche par marque | Automatique depuis le Google Sheet (voir « Plusieurs véhicules par membre ») ; comité dans `config.json` → `comite` |
| Photos | Albums d'événements + visionneuse | `app/data/photos.json` |
| Boutique | Articles du club (photos, prix, tailles) et bouton « Commander » vers le bon de commande Tally | `app/data/boutique.json` (+ photos dans `app/boutique/`) |
| Ma carte | Carte de membre avec QR code (fonctionne hors ligne), visible seulement via le lien personnel du membre | Voir « Cartes de membre » ; année dans `config.json` → `annee_carte` |

Les inscriptions aux sorties se font uniquement sur le formulaire Tally dont le lien est noté dans la
colonne `Inscription` : l'application affiche un bouton « S'inscrire » qui ouvre ce lien. Sans lien, pas de
bouton. Les commandes de la boutique se font de même sur le bon de commande Tally (`commande` dans
`boutique.json`).

Les entrées marquées `"exemple": true` sont des exemples à remplacer ou supprimer.

## Formats

**Événement** (`events.json`) : `id` (unique), `date` (`AAAA-MM-JJ`), `heure`, `fin` (`HH:MM`), `titre`, `lieu`,
`description`, `prix`, `inscription` (lien Tally), `image` (lien).

**Album** (`photos.json`) : `id`, `titre`, `date`, `lien` (album Google Photos complet, optionnel),
`photos` : liste de liens d'images (ex. fichiers déposés dans `app/photos/<album>/`).

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
