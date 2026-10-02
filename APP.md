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
| Boutique | Vêtements, panier, commande | `app/data/boutique.json` |
| Ma carte | Carte de membre avec QR code (fonctionne hors ligne) | Automatique ; année dans `config.json` → `annee_carte` |

Les inscriptions aux sorties se font uniquement sur le formulaire Tally dont le lien est noté dans la
colonne `Inscription` : l'application affiche un bouton « S'inscrire » qui ouvre ce lien. Sans lien, pas de
bouton. Les commandes de vêtements ouvrent l'application email du membre avec un message pré-rempli vers
l'adresse `email` de `config.json`.

Les entrées marquées `"exemple": true` sont des exemples à remplacer ou supprimer.

## Formats

**Événement** (`events.json`) : `id` (unique), `date` (`AAAA-MM-JJ`), `heure`, `fin` (`HH:MM`), `titre`, `lieu`,
`description`, `prix`, `inscription` (lien Tally), `image` (lien).

**Album** (`photos.json`) : `id`, `titre`, `date`, `lien` (album Google Photos complet, optionnel),
`photos` : liste de liens d'images (ex. fichiers déposés dans `app/photos/<album>/`).

**Article** (`boutique.json`) : `id`, `nom`, `description`, `prix` (nombre, 0 = « à confirmer »),
`tailles` et `couleurs` (listes, vides si sans objet), `image`.

## Agenda depuis Google Sheets (optionnel)

1. Ajouter un onglet « Agenda » avec les colonnes : `Date` (JJ/MM/AAAA), `Heure`, `Fin`, `Titre`, `Lieu`,
   `Description`, `Prix`, `Inscription` (lien du formulaire Tally), `Image`.
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
