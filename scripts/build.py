# scripts/build.py
import os, re, unicodedata
from pathlib import Path
import pandas as pd

CSV_URL = os.environ["CSV_URL"]          # injecté par le secret
OUT_DIR = Path("members")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# --- 1) Charger le CSV et détecter la ligne d'en-têtes ---
raw = pd.read_csv(CSV_URL, header=None)
hdr_candidates = raw.index[
    (raw.iloc[:, 0].astype(str).str.strip().str.lower() == "nom") &
    (raw.iloc[:, 1].astype(str).str.strip().str.lower().isin(["prénom", "prenom"]))
].tolist()
hdr = hdr_candidates[0] if hdr_candidates else 0
df = pd.read_csv(CSV_URL, header=hdr).dropna(how="all").reset_index(drop=True)

# --- 2) Harmoniser les noms de colonnes (alias/variantes) ---
def norm(s: str) -> str:
    s = str(s).strip().lower()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = s.replace("’", "'")
    s = re.sub(r"\s+", " ", s)
    return s

aliases = {
    # Nom / prénom
    "nom": "Nom",
    "prenom": "Prénom", "prénom": "Prénom",

    # Adresse
    "adresse postale": "Adresse postale",
    "adresse postale (rue, numero, cp, ville)": "Adresse postale",
    "adresse postale ( rue, numero, cp, ville )": "Adresse postale",

    # Téléphone / mail
    "numero de gsm": "Numéro de GSM", "numéro de gsm": "Numéro de GSM",
    "telephone": "Numéro de GSM", "téléphone": "Numéro de GSM",
    "telephone (gsm)": "Numéro de GSM", "téléphone (gsm)": "Numéro de GSM",
    "gsm": "Numéro de GSM",
    "email": "Adresse mail", "e-mail": "Adresse mail", "adresse mail": "Adresse mail",

    # Véhicule
    "marque": "Marque du véhicule", "marque du vehicule": "Marque du véhicule",
    "modele": "Modèle du véhicule", "modele du vehicule": "Modèle du véhicule", "modèle du véhicule": "Modèle du véhicule",
    "annee": "Année", "année": "Année",

    # Immatriculation
    "immatriculation": "Numéro d'immatriculation",
    "numero dimmatriculation": "Numéro d'immatriculation",
    "numéro d'immatriculation": "Numéro d'immatriculation",

    # Autres infos
    "autre club": "Membre d'un autre club",
    "membre d'un autre club": "Membre d'un autre club",
    "assure chez behva": "Assuré chez BEHVA", "assuré chez behva": "Assuré chez BEHVA",
    "autre vehicule": "Autre véhicule", "autre véhicule": "Autre véhicule",

    # Cotisation (nouv.)
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

# Colonnes attendues (créées vides si manquantes)
expected = [
    "Nom", "Prénom", "Adresse postale", "Numéro de GSM", "Adresse mail",
    "Marque du véhicule", "Modèle du véhicule", "Année",
    "Numéro d'immatriculation", "Membre d'un autre club",
    "Assuré chez BEHVA", "Cotisation", "Autre véhicule"
]
for c in expected:
    if c not in df.columns:
        df[c] = ""

# --- 3) Slugs uniques ---
def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    for a, b in {"é":"e","è":"e","ê":"e","ë":"e","à":"a","â":"a","ä":"a","î":"i","ï":"i","ô":"o","ö":"o","ù":"u","û":"u","ü":"u","ç":"c"}.items():
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-") or "membre"

base = (df["Nom"].fillna("") + "-" + df["Prénom"].fillna("")).map(slugify)
counts, slugs = {}, []
for b in base:
    counts[b] = counts.get(b, 0) + 1
    slugs.append(b if counts[b] == 1 else f"{b}-{counts[b]}")
df["slug"] = slugs

# --- 4) Génération HTML ---
def esc(x):  # petite échappement HTML
    return (str(x).replace("&","&amp;").replace("<","&lt;")
            .replace(">","&gt;").replace('"',"&quot;"))

def member_html(row) -> str:
    pairs = [
        ("Nom", row["Nom"]),
        ("Prénom", row["Prénom"]),
        ("Adresse postale", row["Adresse postale"]),
        ("Téléphone (GSM)", row["Numéro de GSM"]),
        ("Email", row["Adresse mail"]),
        ("Véhicule", f'{row["Marque du véhicule"]} {row["Modèle du véhicule"]}'.strip()),
        ("Année", row["Année"]),
        ("Immatriculation", row["Numéro d'immatriculation"]),
        ("Autre club", row["Membre d'un autre club"]),
        ("Assuré chez BEHVA", row["Assuré chez BEHVA"]),
        ("Cotisation", row["Cotisation"]),           # ← ajouté
        ("Autre véhicule", row["Autre véhicule"]),
    ]
    rows = "".join(f"<tr><th>{esc(k)}</th><td>{esc(v)}</td></tr>" for k, v in pairs)
    title = f'{esc(row["Prénom"])} {esc(row["Nom"])}'
    return f"""<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiche membre · {title} · Borin'Old Cars</title>
<style>
body{{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:24px}}
.card{{background:#fff;max-width:900px;margin:auto;padding:24px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.06)}}
th{{text-align:left;background:#f1f4f8;border-radius:8px;width:220px}} td,th{{padding:8px;border-bottom:1px solid #eee}}
table{{border-collapse:collapse;width:100%}}
</style></head><body>
<div class="card"><h1>Fiche membre</h1><p><small>Borin'Old Cars</small></p>
<table>{rows}</table>
<p style="margin-top:12px">Contact club :
<a href="mailto:vanhollebeke.pierre@icloud.com">vanhollebeke.pierre@icloud.com</a></p>
</div></body></html>"""

# Fiches individuelles
for _, row in df.iterrows():
    (OUT_DIR / f"{row['slug']}.html").write_text(member_html(row), encoding="utf-8")

# Index
links = "\n".join(
    f"<li><a href='{esc(s)}.html'>{esc(p)} {esc(n)}</a></li>"
    for s, p, n in zip(df["slug"], df["Prénom"], df["Nom"])
)
(OUT_DIR / "index.html").write_text(
    "<!doctype html><meta charset='utf-8'>"
    "<title>Membres · Borin'Old Cars</title>"
    "<h1>Annuaire des membres · Borin'Old Cars</h1>"
    f"<ul>{links}</ul>",
    encoding="utf-8")
print(f"Généré {len(df)} fiches.")
