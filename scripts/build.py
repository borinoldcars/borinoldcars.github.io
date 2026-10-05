# scripts/build.py
import hashlib
import hmac
import json
import os, re, unicodedata
from pathlib import Path
import pandas as pd
import segno

# ---- Config de sortie ----
SITE_BASE = "https://borinoldcars.github.io"
OUT_DIR = Path("members")
QRS_DIR  = Path("qrs")
APP_DATA_DIR = Path("app/data")
OUT_DIR.mkdir(parents=True, exist_ok=True)
QRS_DIR.mkdir(parents=True, exist_ok=True)

# ---- Sources / Secrets ----
CSV_URL = os.environ.get("CSV_URL") or os.environ.get("MEMBRESBOC")
if not CSV_URL:
    raise RuntimeError("Aucun lien CSV. Définis le secret CSV_URL.")

# Lien « Ouvrir Google Sheet » de l'annuaire : seulement s'il est fourni
# explicitement (le CSV publié contient les coordonnées des membres).
SHEET_LINK = os.environ.get("SHEET_LINK", "").strip()

ACCESS_CODE = (os.environ.get("MEMBERS_CODE") or os.environ.get("MEMBRES_CODE") or "").strip()
ACCESS_CODE_HASH = hashlib.sha256(ACCESS_CODE.encode("utf-8")).hexdigest() if ACCESS_CODE else ""

# Carte de membre : chaque membre a un lien personnel .../#/carte/<clé>.
# La clé = HMAC(CARD_SECRET, slug) ; seule son empreinte SHA-256 est publiée.
CARD_SECRET = os.environ.get("CARD_SECRET", "").strip()

def card_key(slug):
    return hmac.new(CARD_SECRET.encode(), f"carte:{slug}".encode(), hashlib.sha256).hexdigest()[:20]

# Sans CARD_SECRET, on garde les empreintes déjà publiées : les liens envoyés restent valides
# (seuls les nouveaux membres n'ont pas encore de lien).
try:
    _previous = json.loads(Path("app/data/members.json").read_text(encoding="utf-8"))
    PREVIOUS_LOCKS = {m["slug"]: m.get("cle", "") for m in _previous.get("members", [])}
except (OSError, ValueError):
    PREVIOUS_LOCKS = {}
# Empreintes pré-enregistrées pour des membres qui n'apparaissent pas encore dans la liste.
try:
    _pre = json.loads(Path("app/data/cartes-cles.json").read_text(encoding="utf-8"))
    for _slug, _lock in _pre.items():
        if not _slug.startswith("_") and not PREVIOUS_LOCKS.get(_slug):
            PREVIOUS_LOCKS[_slug] = _lock
except (OSError, ValueError):
    pass

def card_lock(slug):
    if CARD_SECRET:
        return hashlib.sha256(card_key(slug).encode()).hexdigest()
    return PREVIOUS_LOCKS.get(slug, "")

# ---- Helpers ----
def norm(s: str) -> str:
    s = str(s).strip().lower()
    s = ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
    )
    s = s.replace("’", "'")
    s = re.sub(r"\s+", " ", s)
    return s

def slugify(s: str) -> str:
    s = norm(s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+","-", s).strip("-") or "membre"

def esc(x: str) -> str:
    return (str(x)
            .replace("&","&amp;").replace("<","&lt;")
            .replace(">","&gt;").replace('"',"&quot;"))

def badge(text, bg, fg):
    return (
        f"<span style='display:inline-block;padding:4px 10px;"
        f"border-radius:999px;background:{bg};color:{fg};font-weight:600'>{esc(text)}</span>"
    )

def colorize_cotisation(value: str) -> str:
    s = norm(value or "")
    oui_vals = {"oui","ok","o","payee","payée","en ordre","a jour","à jour","yes","1","x"}
    non_vals = {"non","no","0","pas en ordre","impaye","impayee","impayé","impayée","due"}
    if s in oui_vals:
        return badge("Oui", "#EAF7EA", "#0F6D0F")
    if s in non_vals:
        return badge("Non", "#FDECEC", "#B42318")
    return badge(value or "—", "#FFF4E5", "#B54708")

# ---- 1) Charger et détecter l’en-tête ----
raw = pd.read_csv(CSV_URL, header=None, dtype=str).fillna("")
hdr_candidates = raw.index[(raw.iloc[:, 1].map(norm) == "nom")].tolist()
hdr = hdr_candidates[0] if hdr_candidates else 0

df = pd.read_csv(CSV_URL, header=hdr, dtype=str).fillna("")

# ---- 2) Normaliser les noms de colonnes ----
aliases = {
    # Nom / Prénom
    "nom": "Nom",
    "prénom": "Prénom", "prenom": "Prénom",

    # Adresse
    "adresse postale": "Adresse postale",
    "adresse postale ( rue, numero, cp, ville)": "Adresse postale",
    "adresse postale (rue, numero, cp, ville)": "Adresse postale",

    # Téléphone
    "n° de gsm (+324........)": "Numéro de GSM",
    "numero de gsm": "Numéro de GSM",
    "numéro de gsm": "Numéro de GSM",
    "gsm": "Numéro de GSM",

    # Email
    "adresse email": "Adresse mail",
    "email": "Adresse mail",
    "adresse mail": "Adresse mail",

    # Véhicule
    "marque du véhicule": "Marque du véhicule",
    "marque": "Marque du véhicule",
    "modèle du véhicule": "Modèle du véhicule",
    "modèle": "Modèle du véhicule",
    "modele": "Modèle du véhicule",

    # Année
    "année de la première mise en circulation": "Année",
    "année": "Année",

    # Immatriculation
    "numéro d'immatriculation": "Numéro d'immatriculation",
    "immatriculation": "Numéro d'immatriculation",

    # Autres
    "etes-vous déja membre d'un autre club oldtimers?": "Membre d'un autre club",
    "etes-vous assuré auprès de la behva?": "Assuré chez BEHVA",
    "possédez-vous d’autres véhicules old ou youngtimers que celui mentionné ci-dessus?": "Autre véhicule",

    # Cotisation
    "cotisation": "Cotisation",

    # Photo du véhicule (lien vers une image, pour la galerie de l'app)
    "photo": "Photo",
    "photo du véhicule": "Photo",
}

rename_map = {}
for col in df.columns:
    n = norm(col)
    if n in aliases:
        rename_map[col] = aliases[n]
df = df.rename(columns=rename_map)

expected = [
    "Nom","Prénom","Adresse postale","Numéro de GSM","Adresse mail",
    "Marque du véhicule","Modèle du véhicule","Année",
    "Numéro d'immatriculation","Membre d'un autre club",
    "Assuré chez BEHVA","Cotisation","Autre véhicule","Photo"
]
for c in expected:
    if c not in df.columns:
        df[c] = ""

# ---- 3) Slugs ----
base = (df["Nom"] + "-" + df["Prénom"]).map(slugify)
counts, slugs = {}, []
for b in base:
    counts[b] = counts.get(b, 0) + 1
    slugs.append(b if counts[b] == 1 else f"{b}-{counts[b]}")
df["slug"] = slugs

# ---- 4) Fiches membres + QR ----
def render_member_html(row: pd.Series) -> str:
    # Fiche publique ouverte par le QR code : uniquement de quoi vérifier l'affiliation.
    # Pas d'adresse, GSM, email, plaque ni autres réponses du formulaire.
    vehicule = re.sub(r"\s+", " ", f"{row['Marque du véhicule']} {row['Modèle du véhicule']}").strip()
    rows_html = []
    def tr(label, value, html=False):
        if str(value).strip() == "":
            return
        v = value if html else esc(re.sub(r"\s+", " ", str(value)).strip())
        rows_html.append(f"<tr><th>{esc(label)}</th><td>{v}</td></tr>")

    tr("Nom", row["Nom"])
    tr("Prénom", row["Prénom"])
    tr("Véhicule", vehicule)
    tr("Cotisation", colorize_cotisation(row["Cotisation"]), html=True)

    title = re.sub(r"\s+", " ", f"{row['Prénom']} {row['Nom']}").strip()
    return f"""<!doctype html><html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Membre · {esc(title)}</title>
<style>
body{{font-family:Georgia,"Times New Roman",serif;background:#e5decf;color:#222;margin:0;padding:24px 16px}}
.card{{background:#f4efe5;max-width:520px;margin:auto;padding:24px;border-radius:12px;border:1px solid #cdc1a8;box-shadow:0 4px 14px rgba(47,33,24,.12)}}
.head{{display:flex;align-items:center;gap:12px;margin-bottom:16px}}
.head img{{height:56px;width:auto}}
h1{{font-size:1.3rem;margin:0}}
small{{color:#5c5244}}
th{{text-align:left;color:#5c5244;font-weight:normal;width:120px}}
td,th{{padding:10px 6px;border-bottom:1px solid #ddd3bf}}
table{{width:100%;border-collapse:collapse}}
a{{color:#8a6538}}
</style></head><body>
<div class="card">
<div class="head"><img src="../app/icons/logo.png" alt=""><div><h1>Membre du club</h1><small>Borin'Old Cars</small></div></div>
<table>{''.join(rows_html)}</table>
<p><small>Contact club : <a href="mailto:borinoldcars@gmail.com">borinoldcars@gmail.com</a></small></p>
</div>
</body></html>"""

generated_slugs = []
for _, row in df.iterrows():
    slug = row["slug"]
    generated_slugs.append(slug)

    url = f"{SITE_BASE}/members/{slug}.html"
    qr = segno.make(url, error="q")
    qr.save(QRS_DIR / f"{slug}.png", scale=6, border=2)

    html = render_member_html(row)
    (OUT_DIR / f"{slug}.html").write_text(html, encoding="utf-8")

# Supprime les fiches et QR de personnes qui ne sont plus dans la liste.
keep = set(generated_slugs)
for f in OUT_DIR.glob("*.html"):
    if f.stem != "index" and f.stem not in keep:
        f.unlink()
for f in QRS_DIR.glob("*.png"):
    if f.stem not in keep:
        f.unlink()

# ---- 5) Index (template + remplacements) ----
def cot_status(val):
    s = norm(val)
    if s in {"oui","ok","o","payee","payée","en ordre","a jour","à jour","yes","1","x"}:
        return "oui"
    if s in {"non","no","0","pas en ordre","impaye","impayee","impayé","impayée","due"}:
        return "non"
    return "na"

index_rows = []
for s, p, n, m, mo, c in zip(
    df["slug"], df["Prénom"], df["Nom"],
    df["Marque du véhicule"], df["Modèle du véhicule"], df["Cotisation"]
):
    name = f"{p} {n}"
    veh = f"{m} {mo}".strip()
    cat = cot_status(c)
    index_rows.append(
        f"<tr data-name='{esc(name)}' data-veh='{esc(veh)}' data-cot='{cat}'>"
        f"<td><a href='{esc(s)}.html'>{esc(name)}</a></td>"
        f"<td>{esc(veh)}</td>"
        f"<td>{colorize_cotisation(c)}</td>"
        f"<td><a href='{esc(s)}.html'>Ouvrir</a></td></tr>"
    )

index_tpl = """<!doctype html><html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Annuaire membres · Borin'Old Cars</title>
<meta name="robots" content="noindex">
<style>
body{font-family:system-ui;background:#f8f9fb;margin:24px}
.container{max-width:1100px;margin:auto;background:#fff;padding:16px;border-radius:16px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{padding:10px;border-bottom:1px solid #eee}
th{background:#f6f8fb}
.locked .protected{filter:blur(6px);pointer-events:none}
#gate{position:fixed;inset:0;z-index:9999;background:rgba(248,249,251,.96);
display:none;align-items:center;justify-content:center}
.locked #gate{display:flex}
</style></head><body>

<div id="gate"><div>
<h2>Accès réservé</h2>
<input id="code" type="password" placeholder="Code d'accès">
<button id="go">Entrer</button>
<div id="err" style="color:red;display:none">Code incorrect</div>
</div></div>

<div class="container protected">
<h1>Annuaire des membres</h1>
{{SHEET_LINK}}
<a href="#" id="logout">Se déconnecter</a>
<br><br>

<input id="q" type="search" placeholder="Rechercher...">
<label><input type="radio" name="cot" value="all" checked> Tous</label>
<label><input type="radio" name="cot" value="oui"> OK</label>
<label><input type="radio" name="cot" value="non"> NON</label>

<table>
<thead><tr><th>Nom</th><th>Véhicule</th><th>Cotisation</th><th></th></tr></thead>
<tbody id="rows">
{{ROWS}}
</tbody></table>
</div>

<script>
const EXPECTED = "{{CODE_HASH}}";

if (new URLSearchParams(location.search).get('logout') === '1') {
  localStorage.removeItem('members_access');
}

function setLocked(x){ document.body.classList.toggle("locked", !!x); }
function savedOK(){ return localStorage.getItem("members_access") === EXPECTED; }

async function sha256(t){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function unlock(){
  const c = document.getElementById("code").value.trim();
  const h = await sha256(c);
  if(h === EXPECTED){
    localStorage.setItem("members_access", h);
    document.getElementById("err").style.display = "none";
    setLocked(false);
  }else{
    document.getElementById("err").style.display = "block";
  }
}

(function(){
  if(!EXPECTED || savedOK()) setLocked(false); else setLocked(true);
  document.getElementById("go").onclick = unlock;
  const code = document.getElementById("code");
  if(code){ code.addEventListener("keydown", e=>{ if(e.key==="Enter") unlock(); }); }

  const logout = document.getElementById("logout");
  if(logout){
    logout.onclick = e=>{
      e.preventDefault();
      localStorage.removeItem("members_access");
      location.reload();
    };
  }

  const q = document.getElementById("q");
  const rows = Array.from(document.querySelectorAll("#rows tr"));
  const radios = Array.from(document.querySelectorAll("input[name='cot']"));
  function apply(){
    const term = (q.value||"").toLowerCase();
    const fil = (document.querySelector("input[name='cot']:checked")||{}).value || "all";
    rows.forEach(tr=>{
      const okTerm = !term ||
        tr.dataset.name.toLowerCase().includes(term) ||
        tr.dataset.veh.toLowerCase().includes(term);
      const okCot = fil==="all" || tr.dataset.cot===fil;
      tr.style.display = (okTerm && okCot) ? "" : "none";
    });
  }
  q.addEventListener("input", apply);
  radios.forEach(r=>r.addEventListener("change", apply));
  apply();
})();
</script>

</body></html>
"""

index_html = (
    index_tpl
    .replace("{{ROWS}}", "\n".join(index_rows))
    .replace("{{SHEET_LINK}}", f'<a href="{esc(SHEET_LINK)}" target="_blank">Ouvrir Google Sheet</a> ·' if SHEET_LINK else "")
    .replace("{{CODE_HASH}}", ACCESS_CODE_HASH)
)

(OUT_DIR / "index.html").write_text(index_html, encoding="utf-8")

# ---- 6) Données pour l'application (carte de membre + garage) ----
# Uniquement des infos non sensibles : pas d'adresse, téléphone, email ni plaque.
def clean(x):
    return re.sub(r"\s+", " ", str(x)).strip()

APP_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Date d'entrée au club : colonne de la liste si elle existe, sinon app/data/membres-depuis.json.
try:
    MEMBRES_DEPUIS = json.loads((APP_DATA_DIR / "membres-depuis.json").read_text(encoding="utf-8"))
except (OSError, ValueError):
    MEMBRES_DEPUIS = {}

def member_since(row):
    for col in df.columns:
        if norm(col) in ("membre depuis", "date d'inscription", "inscrit le", "submitted at"):
            v = clean(row[col])
            m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", v) or re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", v)
            if m:
                g = m.groups()
                return "-".join(g) if len(g[0]) == 4 else f"{g[2]}-{int(g[1]):02d}-{int(g[0]):02d}"
            if re.fullmatch(r"\d{4}", v):
                return v
    return MEMBRES_DEPUIS.get(row["slug"], "")

app_members = [
    {
        "slug": row["slug"],
        "prenom": clean(row["Prénom"]),
        "nom": clean(row["Nom"]),
        "marque": clean(row["Marque du véhicule"]),
        "modele": clean(row["Modèle du véhicule"]),
        "annee": clean(row["Année"]),
        "cotisation": cot_status(row["Cotisation"]),
        "photo": clean(row["Photo"]),
        "cle": card_lock(row["slug"]),
        "depuis": member_since(row),
    }
    for _, row in df.iterrows()
]
# Garage. Source : la « Fiche Véhicule » (réponses au formulaire, une ligne par
# véhicule) publiée en CSV dans le secret GARAGE_CSV_URL. Chaque ligne est
# rattachée à un membre par son nom et son prénom. Le véhicule de la liste des
# membres reste affiché, sauf s'il est déjà décrit par une de ses fiches.
BRANDS = {
    "vw": "Volkswagen", "volkswagen": "Volkswagen",
    "alfa romeo": "Alfa Romeo",
    "citroen": "Citroën", "mercedes": "Mercedes-Benz", "mercedes benz": "Mercedes-Benz",
    "rolls royce": "Rolls-Royce",
}

def brand(x):
    x = clean(x)
    if norm(x) in BRANDS:
        return BRANDS[norm(x)]
    return x.title() if (x.isupper() or x.islower()) and len(x) > 3 else x

def year(x):
    x = clean(x)
    m = re.search(r"\b(\d{4})\b", x)
    if m:
        return m.group(1)
    if re.fullmatch(r"\d{2}", x):
        return ("19" if int(x) > 30 else "20") + x
    return x

def car_key(marque, modele):
    return slugify(f"{brand(marque)} {modele}")

def vehicle_id(owner, nom, prenom, marque, modele):
    who = owner["slug"] if owner else slugify(f"{nom}-{prenom}")
    return slugify(f"{who}-{brand(marque)}-{modele}")

main_cars = {
    m["slug"]: {
        "id": vehicle_id(m, "", "", m["marque"], m["modele"]),
        "slug": m["slug"], "prenom": m["prenom"], "nom": m["nom"],
        "marque": brand(m["marque"]), "modele": m["modele"],
        "annee": year(m["annee"]), "photo": m["photo"],
    }
    for m in app_members if m["marque"] or m["modele"]
}

sheet_cars = {}  # clé (propriétaire, véhicule) -> fiche ; la réponse la plus récente l'emporte
GARAGE_CSV_URL = os.environ.get("GARAGE_CSV_URL", "").strip()
if GARAGE_CSV_URL:
    gr = pd.read_csv(GARAGE_CSV_URL, dtype=str).fillna("")
    gr.columns = [norm(c) for c in gr.columns]
    by_name = {}
    for m in app_members:
        by_name[slugify(f"{m['nom']}-{m['prenom']}")] = m
        by_name.setdefault(slugify(f"{m['prenom']}-{m['nom']}"), m)
    unmatched = []
    for _, r in gr.iterrows():
        def get(*names):
            for n in names:
                if n in r and clean(r[n]) not in ("", "."):
                    return clean(r[n])
            return ""
        nom, prenom = get("nom"), get("prenom")
        marque = get("marque du vehicule", "marque")
        modele = get("modele du vehicule", "modele")
        if not (marque or modele):
            continue
        owner = by_name.get(slugify(f"{nom}-{prenom}"))
        if not owner:
            # Plus dans la liste des membres : sa fiche ne s'affiche pas au garage.
            unmatched.append(f"{prenom} {nom}")
            continue
        photo = get("photo", "photo du vehicule", "untitled file upload field")
        photo = photo.split(",")[0].strip() if photo.startswith("http") else ""
        lien = get("facebook / instagram / ... du vehicule", "lien")
        car = {
            "id": vehicle_id(owner, nom, prenom, marque, modele),
            "slug": owner["slug"] if owner else "",
            "prenom": owner["prenom"] if owner else prenom.title(),
            "nom": owner["nom"] if owner else nom.title(),
            "marque": brand(marque),
            "modele": modele,
            "version": get("version"),
            "couleur": get("couleur"),
            "annee": year(get("date de la premiere mise en circulation", "annee")),
            "moteur": get("motorisation"),
            "cylindres": get("nombre de cylindres"),
            "puissance": get("puissance"),
            "carburant": get("carburant"),
            "boite": get("type de boite de vitesse"),
            "rapports": get("nombre de rapports"),
            "pays": get("pays d'origine du vehicule"),
            "etat": get("etat"),
            "histoire": str(r.get("histoire / anecdote", "")).strip(),
            "photo": photo,
            "lien": lien if lien.startswith("http") else "",
        }
        sheet_cars[(car["slug"] or car["id"], car_key(marque, modele))] = car
    if unmatched:
        print("Garage : fiches ignorées (propriétaire absent de la liste des membres) :", ", ".join(sorted(set(unmatched))))

def same_car(main, fiche):
    """Le véhicule de la liste des membres est-il déjà décrit par une fiche ?"""
    a = slugify(f"{main['marque']} {main['modele']}").split("-")
    b = slugify(f"{fiche['marque']} {fiche['modele']} {fiche['version']}").split("-")
    return set(a) <= set(b) or "".join(a) in "".join(b) or slugify(f"{fiche['marque']} {fiche['modele']}").replace("-", "") in "".join(a)

if GARAGE_CSV_URL:
    vehicules = [
        c for slug, c in main_cars.items()
        if not any(f["slug"] == slug and same_car(c, f) for f in sheet_cars.values())
    ]
    vehicules += list(sheet_cars.values())
else:
    # Sans GARAGE_CSV_URL, on garde le garage déjà publié (fiches comprises) et on
    # ajoute seulement le véhicule des nouveaux membres.
    try:
        previous = json.loads((APP_DATA_DIR / "members.json").read_text(encoding="utf-8")).get("vehicules", [])
    except (OSError, ValueError):
        previous = []
    members_slugs = {m["slug"] for m in app_members}
    vehicules = [v for v in previous if not v.get("slug") or v["slug"] in members_slugs]
    known = {v.get("slug") for v in vehicules}
    vehicules += [c for slug, c in main_cars.items() if slug not in known]
print(f"Garage : {len(vehicules)} véhicules ({len(sheet_cars)} depuis la Fiche Véhicule).")

(APP_DATA_DIR / "members.json").write_text(
    json.dumps({"members": app_members, "vehicules": vehicules}, ensure_ascii=False, indent=1),
    encoding="utf-8",
)

# ---- 6 bis) Albums photos : liste des photos de chaque dossier Google Drive ----
# Pour chaque album de app/data/photos.json qui a un « dossier » (dossier Drive partagé
# « Tous les utilisateurs disposant du lien »), on lit la vue publique du dossier et on
# enregistre les identifiants des photos (« drive »), triés par nom de fichier.
# En cas d'échec, la liste déjà enregistrée est conservée.
import urllib.request

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".gif")

def drive_folder_images(folder_id):
    url = f"https://drive.google.com/embeddedfolderview?id={folder_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (borinoldcars build)"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    files = []
    for m in re.finditer(r'id="entry-([\w-]+)".*?class="flip-entry-title">([^<]*)<', html, re.S):
        fid, title = m.group(1), m.group(2).strip()
        # « ._xxx.jpg » : fichiers cachés créés par les Mac sur les disques externes, pas des photos.
        if title.startswith("._"):
            continue
        if title.lower().endswith(IMAGE_EXT):
            files.append((title.lower(), fid))
    natural = lambda t: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", t[0])]
    return [fid for _, fid in sorted(files, key=natural)]

photos_path = APP_DATA_DIR / "photos.json"
try:
    photos_data = json.loads(photos_path.read_text(encoding="utf-8"))
except (OSError, ValueError):
    photos_data = {}
changed = False
for album in photos_data.get("albums", []):
    if not album.get("dossier"):
        continue
    try:
        ids = drive_folder_images(album["dossier"])
    except Exception as e:  # réseau, page modifiée… : on garde l'existant
        print(f"Photos : dossier de « {album.get('titre')} » illisible ({e}).")
        continue
    if ids and ids != album.get("drive"):
        album["drive"] = ids
        changed = True
    print(f"Photos : « {album.get('titre')} » : {len(ids)} photo(s) dans le dossier.")
if changed:
    photos_path.write_text(json.dumps(photos_data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

# ---- 7) Agenda (optionnel) : onglet Google Sheet publié en CSV ----
# Colonnes reconnues : Date (JJ/MM/AAAA), Heure, Fin, Titre, Lieu, Description,
# Prix, Inscription (lien vers un formulaire Tally / Google Forms), Affiche (lien d'image ou Google Drive)
EVENTS_CSV_URL = os.environ.get("EVENTS_CSV_URL", "").strip()
ev = None
if EVENTS_CSV_URL:
    try:
        ev = pd.read_csv(EVENTS_CSV_URL, dtype=str).fillna("")
        ev.columns = [norm(c) for c in ev.columns]
    except Exception as e:  # Sheet injoignable : on garde l'agenda déjà publié
        print("Agenda : lecture impossible, agenda inchangé :", e)
if ev is not None:
    # Sans colonne « Ruban » dans le Sheet, on garde les rubans déjà publiés (par date).
    try:
        old_rubans = {e["date"]: e["ruban"] for e in json.loads((APP_DATA_DIR / "events.json").read_text(encoding="utf-8"))["events"] if e.get("ruban")}
    except (OSError, ValueError, KeyError):
        old_rubans = {}

    def col(r, *names):
        for n in names:
            if n in r and clean(r[n]):
                return clean(r[n])
        return ""

    def iso_date(d):
        m = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$", d)
        if m:
            y = m.group(3) if len(m.group(3)) == 4 else "20" + m.group(3)
            return f"{y}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
        return d

    def hhmm(t):
        # « 16H30 », « 16h », « 9:30 » -> « 16:30 », « 16:00 », « 09:30 »
        m = re.match(r"^(\d{1,2})\s*[hH:.]\s*(\d{2})?$", t)
        return f"{int(m.group(1)):02d}:{m.group(2) or '00'}" if m else t

    def image_url(u):
        # Un lien de partage Google Drive (…/file/d/ID/view ou ?id=ID) devient une image affichable.
        m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)", u)
        if m:
            return f"https://drive.google.com/thumbnail?id={m.group(1)}&sz=w1600"
        return u if u.startswith("http") else ""

    events = []
    for i, r in ev.iterrows():
        titre = col(r, "titre", "evenement", "nom")
        date = iso_date(col(r, "date"))
        if not titre or not date:
            continue
        events.append({
            "id": slugify(f"{date}-{titre}"),
            "date": date,
            "heure": hhmm(col(r, "heure", "debut")),
            "fin": hhmm(col(r, "fin")),
            "titre": titre,
            "lieu": col(r, "lieu", "adresse"),
            "description": col(r, "description").rstrip(" ,;"),
            "prix": col(r, "prix", "tarif"),
            "inscription": next((u for u in [col(r, "inscription", "formulaire", "lien")] if u.startswith("http")), ""),
            "image": image_url(col(r, "affiche", "image", "photo")),
        })
        ruban = col(r, "ruban").lower() if "ruban" in ev.columns else old_rubans.get(date, "")
        if ruban:
            events[-1]["ruban"] = ruban
    events.sort(key=lambda e: e["date"])
    (APP_DATA_DIR / "events.json").write_text(
        json.dumps({"events": events}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"Agenda : {len(events)} événement(s).")

print(f"Généré {len(generated_slugs)} fiches et QR.")
