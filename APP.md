# Application Borin'Old Cars

Web app installable (PWA) servie par GitHub Pages à l'adresse https://borinoldcars.github.io/.
Sur téléphone : ouvrir le lien puis « Installer » (Android) ou Partager → « Sur l'écran d'accueil » (iPhone).

## Fonctions

| Onglet | Contenu | Où modifier |
|---|---|---|
| Accueil | Prochaine sortie, raccourcis | `app/data/config.json` (nom, slogan, email, liens) |
| Agenda | Sorties à venir / passées, ajout au calendrier, itinéraire, inscription | `app/data/events.json` **ou** onglet Google Sheet (voir plus bas) |
| Garage | Véhicules des membres, recherche par marque | Automatique depuis le Google Sheet des membres (colonne optionnelle `Photo` = lien d'image) |
| Photos | Albums d'événements + visionneuse | `app/data/photos.json` |
| Boutique | Vêtements, panier, commande | `app/data/boutique.json` |
| Ma carte | Carte de membre avec QR code (fonctionne hors ligne) | Automatique ; année dans `config.json` → `annee_carte` |

Les inscriptions et commandes ouvrent l'application email du membre avec un message
pré-rempli vers l'adresse `email` de `config.json` (aucun serveur nécessaire).
Si un événement a un champ `inscription` (lien Google Forms / Tally), le bouton ouvre ce formulaire à la place.

Les entrées marquées `"exemple": true` sont des exemples à remplacer ou supprimer.

## Formats

**Événement** (`events.json`) : `id` (unique), `date` (`AAAA-MM-JJ`), `heure`, `fin` (`HH:MM`), `titre`, `lieu`,
`description`, `prix`, `places`, `inscription` (lien), `image` (lien).

**Album** (`photos.json`) : `id`, `titre`, `date`, `lien` (album Google Photos complet, optionnel),
`photos` : liste de liens d'images (ex. fichiers déposés dans `app/photos/<album>/`).

**Article** (`boutique.json`) : `id`, `nom`, `description`, `prix` (nombre, 0 = « à confirmer »),
`tailles` et `couleurs` (listes, vides si sans objet), `image`.

## Agenda depuis Google Sheets (optionnel)

1. Ajouter un onglet « Agenda » avec les colonnes : `Date` (JJ/MM/AAAA), `Heure`, `Fin`, `Titre`, `Lieu`,
   `Description`, `Prix`, `Places`, `Inscription`, `Image`.
2. Fichier → Partager → Publier sur le web → cet onglet au format CSV, copier le lien.
3. Dans GitHub : Settings → Secrets and variables → Actions → nouveau secret `EVENTS_CSV_URL`.

Le workflow (toutes les 30 min) régénère alors `app/data/events.json`, ainsi que `app/data/members.json`
(nom, véhicule, statut de cotisation — sans adresse, téléphone, email ni plaque).
