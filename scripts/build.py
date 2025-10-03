# scripts/build.py
import hashlib
import os, re, unicodedata
from pathlib import Path
import pandas as pd
import segno

# ---- Config ----
SITE_BASE = "https://borinoldcars.github.io"
OUT_DIR = Path("members")
QRS_DIR = Path("qrs")
OUT_DIR.mkdir(parents=True, exist_ok=True)
QRS_DIR.mkdir(parents=True, exist_ok=True)

CSV_URL = os.environ.get("CSV_URL") or os.environ.get("MEMBRESBOC")
if not CSV_URL:
    raise RuntimeError("Aucun lien CSV. Définis le secret CSV_URL (ou MEMBRESBOC).")
    # Bouton "Ouvrir le Google Sheet"
SHEET_LINK = os.environ.get("SHEET_LINK") or CSV_URL
# (option : tu peux forcer ton lien ici)
# SHEET_LINK = "https://docs.google.com/spreadsheets/d/1j1eBg_7-i4KWuuR1DMA1oYpCN7bq8z1uM3cA2NsLtyY/edit?gid=27480806#gid=27480806"

# Code d'accès (facultatif). Si non défini, la page NE sera PAS verrouillée.
ACCESS_CODE = (os.environ.get("MEMBERS_CODE") or "").strip()
ACCESS_CODE_HASH = hashlib.sha256(ACCESS_CODE.encode("utf-8")).hexdigest() if ACCESS_CODE else ""

# Lien du bouton "Ouvrir le Google Sheet"
SHEET_LINK = os.environ.get("SHEET_LINK") or \
    "https://docs.google.com/spreadsheets/d/1j1eBg_7-i4KWuuR1DMA1oYpCN7bq8z1uM3cA2NsLtyY/edit?gid=27480806#gid=27480806"

# ---- Helpers ----
def norm(s: str) -> str:
    s = str(s).strip().lower()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = s.replace("’", "'")
    s = re.sub(r"\s+", " ", s)
    return s

def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    for a, b in {"é":"e","è":"e","ê":"e","ë":"e","à":"a","â":"a","ä":"a",
                 "î":"i","ï":"i","ô":"o","ö":"o","ù":"u","û":"u","ü":"u","ç":"c"}.items():
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+","-", s).strip("-") or "membre"

def esc(x: str) -> str:
    return (str(x).replace("&","&amp;").replace("<","&lt;")
            .replace(">","&gt;").replace('"',"&quot;"))

def badge(text, bg, fg):
    return (f"<span style='display:inline-block;padding:4px 10px;"
            f"border-radius:999px;background:{bg};color:{fg};font-weight:600'>{esc(text)}</span>")

def colorize_cotisation(value: str) -> str:
    s = norm(value or "")
    oui_vals = {"oui","ok","o","payee","payée","en ordre","a jour","à jour","yes","1","x"}
    non_vals = {"non","no","0","pas en ordre","impaye","impayee","impayé","impayée","due"}
    if s in oui_vals:
        return badge("Oui", "#EAF7EA", "#0F6D0F")
    if s in non_vals:
        return badge("Non", "#FDECEC", "#B42318")
    return badge(value or "—", "#FFF4E5", "#B54708")

# ---- 1) Charger CSV & détecter l'en-tête réel ----
raw = pd.read_csv(CSV_URL, header=None, dtype=str).fillna("")
hdr_candidates = raw.index[
    (raw.iloc[:, 0].map(norm) == "nom") &
    (raw.iloc[:, 1].map(norm).isin(["prénom","prenom"]))
].tolist()
hdr = hdr_candidates[0] if hdr_candidates else 0

df = pd.read_csv(CSV_URL, header=hdr, dtype=str).fillna("")
# supprimer lignes vides (Nom & Prénom manquants)
df = df[~((df.get("Nom","")== "") & (df.get("Prénom","")== "") )].reset_index(drop=True)

# ---- 2) Harmoniser les intitulés (alias) ----
aliases = {
    # nom / prénom
    "nom": "Nom",
    "prenom": "Prénom", "prénom": "Prénom",

    # adresse
    "adresse postale": "Adresse postale",
    "adresse postale (rue, numero, cp, ville)": "Adresse postale",
    "adresse postale ( rue, numero, cp, ville )": "Adresse postale",

    # tel / mail
    "numero de gsm": "Numéro de GSM", "numéro de gsm": "Numéro de GSM",
    "telephone": "Numéro de GSM", "téléphone": "Numéro de GSM",
    "telephone (gsm)": "Numéro de GSM", "téléphone (gsm)": "Numéro de GSM",
    "gsm": "Numéro de GSM",
    "email": "Adresse mail", "e-mail": "Adresse mail", "adresse mail": "Adresse mail",

    # véhicule
    "marque": "Marque du véhicule", "marque du vehicule": "Marque du véhicule",
    "modele": "Modèle du véhicule", "modele du vehicule": "Modèle du véhicule",
    "modèle du véhicule": "Modèle du véhicule",
    "annee": "Année", "année": "Année",

    # immatriculation
    "immatriculation": "Numéro d'immatriculation",
    "numero dimmatriculation": "Numéro d'immatriculation",
    "numéro d'immatriculation": "Numéro d'immatriculation",

    # autres
    "autre club": "Membre d'un autre club",
    "membre d'un autre club": "Membre d'un autre club",
    "assure chez behva": "Assuré chez BEHVA", "assuré chez behva": "Assuré chez BEHVA",
    "autre vehicule": "Autre véhicule", "autre véhicule": "Autre véhicule",

    # cotisation
    "cotisation": "Cotisation",
    "cotisation 2025": "Cotisation",
    "statut cotisation": "Cotisation",
    "cotisation payee": "Cotisation", "cotisation payée": "Cotisation",
    "a jour de cotisation": "Cotisation", "à jour de cotisation": "Cotisation",
}
rename_map = {}
for col in list(df.columns):
    key = norm(col)
    if key in aliases:
        rename_map[col] = aliases[key]
df = df.rename(columns=rename_map)

# colonnes attendues
expected = [
    "Nom","Prénom","Adresse postale","Numéro de GSM","Adresse mail",
    "Marque du véhicule","Modèle du véhicule","Année",
    "Numéro d'immatriculation","Membre d'un autre club",
    "Assuré chez BEHVA","Cotisation","Autre véhicule"
]
for c in expected:
    if c not in df.columns:
        df[c] = ""

# ---- 3) Slugs uniques ----
base = (df["Nom"].fillna("") + "-" + df["Prénom"].fillna("")).map(slugify)
counts, slugs = {}, []
for b in base:
    counts[b] = counts.get(b, 0) + 1
    slugs.append(b if counts[b] == 1 else f"{b}-{counts[b]}")
df["slug"] = slugs

# ---- 4) Génération des fiches + QR ----
def render_member_html(row: pd.Series) -> str:
    email_val = str(row["Adresse mail"]).strip()
    email_html = f"<a href='mailto:{esc(email_val)}'>{esc(email_val)}</a>" if email_val else ""

    vehicule = f'{row["Marque du véhicule"]} {row["Modèle du véhicule"]}'.strip()

    qr_rel = f"../qrs/{row['slug']}.png"
    qr_block = (
        f"<img src='{qr_rel}' alt='QR {esc(row['Prénom'])} {esc(row['Nom'])}' "
        f"style='width:160px;height:auto'>"
        f"<div><a href='{qr_rel}' download>Télécharger le QR</a></div>"
    )

    rows_html = []
    def tr(key, value, is_html=False):
        val = value if is_html else esc(value)
        rows_html.append(f"<tr><th>{esc(key)}</th><td>{val}</td></tr>")

    tr("Nom", row["Nom"])
    tr("Prénom", row["Prénom"])
    tr("Adresse postale", row["Adresse postale"])
    tr("Téléphone (GSM)", row["Numéro de GSM"])
    tr("Email", email_html, is_html=True)
    tr("Véhicule", vehicule)
    tr("Année", row["Année"])
    tr("Immatriculation", row["Numéro d'immatriculation"])
    tr("Autre club", row["Membre d'un autre club"])
    tr("Assuré chez BEHVA", row["Assuré chez BEHVA"])
    tr("Cotisation", colorize_cotisation(row["Cotisation"]), is_html=True)  # ← vert/rouge
    tr("Autre véhicule", row["Autre véhicule"])
    tr("QR code", qr_block, is_html=True)

    title = f"{esc(row['Prénom'])} {esc(row['Nom'])}"
    return f"""<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiche membre · {title} · Borin'Old Cars</title>
<style>
body{{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:24px}}
.card{{background:#fff;max-width:900px;margin:auto;padding:24px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.06)}}
th{{text-align:left;background:#f1f4f8;border-radius:8px;width:220px}} td,th{{padding:8px;border-bottom:1px solid #eee}}
table{{border-collapse:collapse;width:100%}}
.footer{{margin-top:12px;color:#555}}
</style></head><body>
<div class="card">
  <h1>Fiche membre</h1>
  <p><small>Borin'Old Cars</small></p>
  <table>{''.join(rows_html)}</table>
  <p class="footer">Contact club :
    <a href="mailto:vanhollebeke.pierre@icloud.com">vanhollebeke.pierre@icloud.com</a></p>
</div>
</body></html>"""

generated_slugs = []
for _, row in df.iterrows():
    slug = row["slug"]
    generated_slugs.append(slug)

    # URL publique de la fiche
    url = f"{SITE_BASE}/members/{slug}.html"

    # QR -> qrs/<slug>.png
    qr = segno.make(url, error="q")
    qr_path = QRS_DIR / f"{slug}.png"
    qr.save(qr_path, scale=6, border=2)

    # Page HTML -> members/<slug>.html
    html = render_member_html(row)
    (OUT_DIR / f"{slug}.html").write_text(html, encoding="utf-8")

# ---- 5) Index (protégé par code + bouton Google Sheet + recherche/filtre) ----
def cot_status(value: str) -> str:
    s = norm(value or "")
    oui_vals = {"oui","ok","o","payee","payée","en ordre","a jour","à jour","yes","1","x"}
    non_vals = {"non","no","0","pas en ordre","impaye","impayee","impayé","impayée","due"}
    if s in oui_vals: return "oui"
    if s in non_vals: return "non"
    return "na"

rows = []
for s, p, n, marque, modele, cot in zip(
    df["slug"], df["Prénom"], df["Nom"], df["Marque du véhicule"], df["Modèle du véhicule"], df["Cotisation"]
):
    name = f"{p} {n}".strip()
    veh = f"{marque} {modele}".strip()
    status = cot_status(cot)
    rows.append(
        f"<tr data-name='{esc(name)}' data-veh='{esc(veh)}' data-cot='{status}'>"
        f"<td><a href='{esc(s)}.html'>{esc(name)}</a></td>"
        f"<td>{esc(veh)}</td>"
        f"<td>{colorize_cotisation(cot)}</td>"
        f"<td><a href='{esc(s)}.html'>Ouvrir</a></td>"
        f"</tr>"
    )

index_tpl = """<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Annuaire des membres · Borin'Old Cars</title>
<meta name="robots" content="noindex">
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:24px}
.container{max-width:1100px;margin:auto;background:#fff;padding:16px 20px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.06)}
.bar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px}
.btn{background:#0d6efd;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600}
.btn:hover{filter:brightness(.95)}
.top{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
input[type="search"]{flex:1;min-width:240px;padding:10px 12px;border:1px solid #ddd;border-radius:10px}
.filters label{margin-right:10px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{padding:10px;border-bottom:1px solid #eee;text-align:left}
th{background:#f6f8fb}
.count{color:#555;font-size:14px}

/* Écran de verrouillage */
.locked .protected{filter:blur(6px);pointer-events:none;user-select:none}
#gate{position:fixed;inset:0;background:rgba(248,249,251,.96);display:none;align-items:center;justify-content:center;padding:16px}
.locked #gate{display:flex}
.gcard{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:22px;max-width:420px;width:100%;box-shadow:0 8px 20px rgba(0,0,0,.08)}
.gcard h2{margin:0 0 8px 0}
.grow{display:flex;gap:8px;margin-top:12px}
.grow input{flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:10px}
.grow button{background:#0d6efd;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer}
#err{color:#b42318;font-size:14px;margin-top:8px;display:none}
</style></head>
<body>
<div id="gate">
  <div class="gcard">
    <h2>Accès réservé</h2>
    <p>Entrez le code pour accéder à l'annuaire des membres.</p>
    <div class="grow">
      <input id="code" type="password" placeholder="Code d'accès">
      <button id="go">Entrer</button>
    </div>
    <div id="err">Code incorrect.</div>
  </div>
</div>

<div class="container protected">
  <div class="bar">
    <h1>Annuaire des membres</h1>
    <a class="btn" href="{{SHEET_LINK}}" target="_blank" rel="noopener">Ouvrir le Google Sheet</a>
  </div>

  <div class="top">
    <input id="q" type="search" placeholder="Rechercher par nom, véhicule…">
    <div class="filters">
      <label><input type="radio" name="cot" value="all" checked> Tous</label>
      <label><input type="radio" name="cot" value="oui"> Cotisation OK</label>
      <label><input type="radio" name="cot" value="non"> Cotisation NON</label>
    </div>
    <div class="count"><span id="count">0</span>/<span id="total">0</span> membres</div>
  </div>

  <table>
    <thead><tr><th>Nom</th><th>Véhicule</th><th>Cotisation</th><th></th></tr></thead>
    <tbody id="rows">
      {{ROWS}}
    </tbody>
  </table>
</div>

<script>
// Empreinte SHA-256 du code (côté build)
const EXPECTED = "{{CODE_HASH}}";

function setLocked(on){ document.body.classList.toggle('locked', !!on); }
function savedOK(){ const s = localStorage.getItem('members_access'); return s && EXPECTED && s === EXPECTED; }

async function sha256(txt){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function tryUnlock(){
  const input = document.getElementById('code');
  const err = document.getElementById('err');
  const h = await sha256((input.value||'').trim());
  if(h === EXPECTED){
    localStorage.setItem('members_access', h);
    err.style.display = 'none';
    setLocked(false);
  }else{
    err.style.display = 'block';
    input.select();
  }
}

(function initGate(){
  if(!EXPECTED){ setLocked(false); return; }    // pas de code → pas de verrou
  if(savedOK()){ setLocked(false); return; }
  setLocked(true);
  document.getElementById('go').addEventListener('click', tryUnlock);
  document.getElementById('code').addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(); });
})();

// Recherche / filtres
const q = document.getElementById('q');
const rows = Array.from(document.querySelectorAll('#rows tr'));
const radios = Array.from(document.querySelectorAll('input[name="cot"]'));
const countEl = document.getElementById('count');
const totalEl = document.getElementById('total');
totalEl.textContent = rows.length;

function apply(){
  const term = (q.value||'').trim().toLowerCase();
  const cot = (document.querySelector('input[name="cot"]:checked')||{}).value || 'all';
  let shown = 0;
  rows.forEach(tr=>{
    const name = tr.dataset.name.toLowerCase();
    const veh = tr.dataset.veh.toLowerCase();
    const scot = tr.dataset.cot;
    const okTerm = !term || name.includes(term) || veh.includes(term);
    const okCot = cot === 'all' || scot === cot;
    tr.style.display = (okTerm && okCot) ? '' : 'none';
    if(okTerm && okCot) shown++;
  });
  countEl.textContent = shown;
}
q.addEventListener('input', apply);
radios.forEach(r=>r.addEventListener('change', apply));
apply();
</script>
</body></html>"""

index_html = (
    index_tpl
    .replace("{{ROWS}}", "\n".join(rows))
    .replace("{{SHEET_LINK}}", esc(SHEET_LINK))
    .replace("{{CODE_HASH}}", ACCESS_CODE_HASH)
)
(OUT_DIR / "index.html").write_text(index_html, encoding="utf-8")

# ---- 6) Nettoyage : supprimer les fiches orphelines ----
valid = set(generated_slugs) | {"index"}
for f in OUT_DIR.glob("*.html"):
    if f.stem not in valid:
        f.unlink(missing_ok=True)

print(f"Généré {len(generated_slugs)} fiches et QR.")
