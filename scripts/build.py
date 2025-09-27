# scripts/build.py
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

# Secret: accepte CSV_URL ou (fallback) MEMBRESBOC
CSV_URL = os.environ.get("CSV_URL") or os.environ.get("MEMBRESBOC")
if not CSV_URL:
    raise RuntimeError("Aucun lien CSV. Définis le secret CSV_URL (ou MEMBRESBOC).")

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
    s = norm(value)  # <- 'norm' est déjà défini plus haut dans le script
    oui_vals = {"oui","ok","o","payee","payée","en ordre","a jour","à jour","yes","1","x"}
    non_vals = {"non","no","0","pas en ordre","impaye","impayee","impayé","impayée","due"}
    if s in oui_vals:
        return badge("Oui", "#EAF7EA", "#0F6D0F")
    if s in non_vals:
        return badge("Non", "#FDECEC", "#B42318")
    return badge(value or "—", "#FFF4E5", "#B54708")

# ---- 1) Charger CSV & détecter l'en-tête réel ----
raw = pd.read_csv(CSV_URL, header=None, dtype=str)
raw = raw.fillna("")
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
    tr("Cotisation", row["Cotisation"])
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
    qr = segno.make(url, error="q")        # niveau de correction
    qr_path = QRS_DIR / f"{slug}.png"
    qr.save(qr_path, scale=6, border=2)    # ajuste scale/border si besoin

    # Page HTML -> members/<slug>.html
    html = render_member_html(row)
    (OUT_DIR / f"{slug}.html").write_text(html, encoding="utf-8")

# ---- 5) Index ----
links = "\n".join(
    f"<li><a href='{esc(s)}.html'>{esc(p)} {esc(n)}</a></li>"
    for s, p, n in zip(df["slug"], df["Prénom"], df["Nom"])
)
(OUT_DIR / "index.html").write_text(
    "<!doctype html><meta charset='utf-8'>"
    "<title>Membres · Borin'Old Cars</title>"
    "<h1>Annuaire des membres · Borin'Old Cars</h1>"
    f"<ul>{links}</ul>",
    encoding="utf-8"
)

# ---- 6) Nettoyage : supprimer les fiches orphelines (optionnel mais utile) ----
valid = set(generated_slugs) | {"index"}
for f in OUT_DIR.glob("*.html"):
    if f.stem not in valid:
        f.unlink(missing_ok=True)

print(f"Généré {len(generated_slugs)} fiches et QR.")
