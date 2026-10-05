/**
 * Borin'Old Cars — suivi de l'application : qui l'a ouverte, installée, avec les notifications.
 *
 * À coller dans le même projet Apps Script que liens-cartes.gs (Google Sheet des membres :
 * Extensions → Apps Script → « + » → Script, nommé suivi-app). Il réutilise CARD_SECRET,
 * ONGLET_MEMBRES_GID, norm_, slugify_ et cle_ de liens-cartes.gs.
 *
 * Mise en service :
 * 1. Déployer → Nouveau déploiement → type « Application Web »
 *    Exécuter en tant que : Moi · Qui a accès : Tout le monde → Déployer.
 * 2. Copier l'URL de l'application Web (…/exec) et la mettre dans app/data/config.json → "suivi_url".
 * 3. (Facultatif) Exécuter preparerSuivi() : l'onglet « Utilisation » liste tous les membres,
 *    y compris ceux qui n'ont pas encore ouvert l'application.
 *
 * L'application envoie la clé de carte du membre (jamais son nom) ; le script retrouve le membre
 * en recalculant les clés avec CARD_SECRET. Un envoi sans clé valide est ignoré.
 */

var ONGLET_SUIVI = "Utilisation";
var ENTETES_SUIVI = ["Nom", "Prénom", "Application installée", "Notifications", "Appareil",
  "Première ouverture", "Dernière ouverture", "Jours d'utilisation", "Version"];

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return ok_(); }
  var cle = String(d.cle || "").toLowerCase();
  if (!/^[0-9a-f]{20}$/.test(cle)) return ok_();
  var m = membresParCle_()[cle];
  if (!m) return ok_();

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = ongletSuivi_();
    var maintenant = new Date();
    var ligne = ligneDe_(sh, m);
    var avant = ligne ? sh.getRange(ligne, 1, 1, ENTETES_SUIVI.length).getValues()[0] : null;
    var jours = avant ? Number(avant[7]) || 0 : 0;
    var dernier = avant && avant[6] instanceof Date ? avant[6] : null;
    if (!dernier || !memeJour_(dernier, maintenant)) jours += 1;
    var valeurs = [m.nom, m.prenom,
      d.installe ? "Oui" : "Non (navigateur)",
      d.notif ? "Oui" : "Non",
      String(d.appareil || "").slice(0, 30),
      avant && avant[5] instanceof Date ? avant[5] : maintenant,
      maintenant, jours,
      String(d.version || "").slice(0, 30)];
    if (ligne) sh.getRange(ligne, 1, 1, valeurs.length).setValues([valeurs]);
    else sh.appendRow(valeurs);
  } finally {
    lock.releaseLock();
  }
  return ok_();
}

// Ajoute à l'onglet « Utilisation » les membres qui n'y figurent pas encore.
function preparerSuivi() {
  var sh = ongletSuivi_();
  var membres = membresParCle_();
  Object.keys(membres).forEach(function (cle) {
    var m = membres[cle];
    if (!ligneDe_(sh, m)) sh.appendRow([m.nom, m.prenom, "Jamais ouverte", "", "", "", "", 0, ""]);
  });
  sh.autoResizeColumns(1, ENTETES_SUIVI.length);
}

function ok_() {
  return ContentService.createTextOutput("ok");
}

function ongletSuivi_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ONGLET_SUIVI);
  if (!sh) {
    sh = ss.insertSheet(ONGLET_SUIVI);
    sh.getRange(1, 1, 1, ENTETES_SUIVI.length).setValues([ENTETES_SUIVI]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("F:G").setNumberFormat("dd/mm/yyyy hh:mm");
  }
  return sh;
}

function ligneDe_(sh, m) {
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (norm_(vals[i][0]) === norm_(m.nom) && norm_(vals[i][1]) === norm_(m.prenom)) return i + 1;
  }
  return 0;
}

function memeJour_(a, b) {
  var f = "yyyy-MM-dd", tz = Session.getScriptTimeZone();
  return Utilities.formatDate(a, tz, f) === Utilities.formatDate(b, tz, f);
}

// { clé de carte : { nom, prenom } } — mêmes règles que genererLiensCartes().
function membresParCle_() {
  var cache = CacheService.getScriptCache();
  var enCache = cache.get("membres_par_cle");
  if (enCache) return JSON.parse(enCache);

  var secret = PropertiesService.getScriptProperties().getProperty("CARD_SECRET");
  if (!secret) throw new Error("Ajoutez la propriété de script CARD_SECRET.");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheets().filter(function (s) { return s.getSheetId() === ONGLET_MEMBRES_GID; })[0];
  if (!src) throw new Error("Onglet des membres introuvable (gid " + ONGLET_MEMBRES_GID + ").");
  var rows = src.getDataRange().getDisplayValues();
  var h = rows.findIndex(function (r) { return r.some(function (c) { return norm_(c) === "nom"; }); });
  var iNom = rows[h].findIndex(function (c) { return norm_(c) === "nom"; });
  var iPrenom = rows[h].findIndex(function (c) { return norm_(c) === "prenom"; });

  var vus = {}, out = {};
  rows.slice(h + 1).forEach(function (r) {
    var base = slugify_(r[iNom] + "-" + r[iPrenom]);
    vus[base] = (vus[base] || 0) + 1;
    var slug = vus[base] === 1 ? base : base + "-" + vus[base];
    out[cle_(secret, slug)] = { nom: r[iNom].trim(), prenom: r[iPrenom].trim() };
  });
  cache.put("membres_par_cle", JSON.stringify(out), 600);
  return out;
}
