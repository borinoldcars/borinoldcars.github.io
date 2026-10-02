/**
 * Borin'Old Cars — liens personnels des cartes de membre.
 *
 * À coller dans le Google Sheet des membres : Extensions → Apps Script.
 * 1. Projet → Paramètres du projet → Propriétés du script : ajouter
 *    CARD_SECRET = la même valeur que le secret GitHub CARD_SECRET.
 * 2. Exécuter genererLiensCartes() : l'onglet « Liens cartes » est (re)créé
 *    avec le lien personnel de chaque membre.
 *
 * Ne publiez jamais l'onglet « Liens cartes » sur le web : chaque lien ouvre
 * la carte d'un membre.
 */

// Onglet publié en CSV pour le site (gid présent dans le lien CSV_URL).
var ONGLET_MEMBRES_GID = 27480806;
var SITE = "https://borinoldcars.github.io/#/carte/";

function genererLiensCartes() {
  var secret = PropertiesService.getScriptProperties().getProperty("CARD_SECRET");
  if (!secret) throw new Error("Ajoutez la propriété de script CARD_SECRET.");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheets().filter(function (s) { return s.getSheetId() === ONGLET_MEMBRES_GID; })[0];
  if (!src) throw new Error("Onglet des membres introuvable (gid " + ONGLET_MEMBRES_GID + ").");

  var rows = src.getDataRange().getDisplayValues();
  var h = rows.findIndex(function (r) { return r.some(function (c) { return norm_(c) === "nom"; }); });
  if (h < 0) throw new Error("Colonne « Nom » introuvable.");
  var iNom = rows[h].findIndex(function (c) { return norm_(c) === "nom"; });
  var iPrenom = rows[h].findIndex(function (c) { return norm_(c) === "prenom"; });

  var vus = {};
  var out = [["Nom", "Prénom", "Lien personnel de la carte"]];
  rows.slice(h + 1).forEach(function (r) {
    var base = slugify_(r[iNom] + "-" + r[iPrenom]);
    vus[base] = (vus[base] || 0) + 1;
    var slug = vus[base] === 1 ? base : base + "-" + vus[base];
    out.push([r[iNom].trim(), r[iPrenom].trim(), SITE + cle_(secret, slug)]);
  });

  var dst = ss.getSheetByName("Liens cartes") || ss.insertSheet("Liens cartes");
  dst.clearContents();
  dst.getRange(1, 1, out.length, 3).setValues(out);
  dst.autoResizeColumns(1, 3);
}

// Mêmes règles que scripts/build.py (norm + slugify) et card_key().
function norm_(s) {
  return String(s).trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/’/g, "'").replace(/\s+/g, " ");
}

function slugify_(s) {
  return norm_(s).replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "membre";
}

function cle_(secret, slug) {
  var sig = Utilities.computeHmacSha256Signature("carte:" + slug, secret);
  return sig.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join("").slice(0, 20);
}
