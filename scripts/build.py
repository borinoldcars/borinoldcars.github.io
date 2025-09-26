# scripts/build.py
import os, re, pandas as pd
from pathlib import Path

CSV_URL = os.environ["CSV_URL"]
OUT_DIR = Path("members")
OUT_DIR.mkdir(parents=True, exist_ok=True)

raw = pd.read_csv(CSV_URL, header=None)
hdr_candidates = raw.index[
    (raw.iloc[:,0].astype(str).str.strip().str.lower()=="nom") &
    (raw.iloc[:,1].astype(str).str.strip().str.lower().isin(["prénom","prenom"]))
].tolist()
hdr = hdr_candidates[0] if hdr_candidates else 0
df = pd.read_csv(CSV_URL, header=hdr).dropna(how="all").reset_index(drop=True)

expected = ["Nom","Prénom","Adresse postale","Numéro de GSM","Adresse mail",
            "Marque du véhicule","Modèle du véhicule","Année",
            "Numéro d'immatriculation","Membre d'un autre club",
            "Assuré chez BEHVA","Autre véhicule"]
for c in expected:
    if c not in df.columns: df[c] = ""

def slugify(s:str)->str:
    s=(s or "").strip().lower()
    for a,b in {"é":"e","è":"e","ê":"e","ë":"e","à":"a","â":"a","ä":"a","î":"i","ï":"i","ô":"o","ö":"o","ù":"u","û":"u","ü":"u","ç":"c"}.items():
        s=s.replace(a,b)
    s=re.sub(r"[^a-z0-9]+","-",s)
    return re.sub(r"-+","-",s).strip("-") or "membre"

base=(df["Nom"].fillna("")+"-"+df["Prénom"].fillna("")).map(slugify)
counts, slugs = {}, []
for b in base:
    counts[b]=counts.get(b,0)+1
    slugs.append(b if counts[b]==1 else f"{b}-{counts[b]}")
df["slug"]=slugs

def esc(x): return (str(x).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;"))

def member_html(r)->str:
    rows="".join(f"<tr><th>{esc(k)}</th><td>{esc(v)}</td></tr>" for k,v in [
        ("Nom",r["Nom"]),("Prénom",r["Prénom"]),("Adresse postale",r["Adresse postale"]),
        ("Téléphone (GSM)",r["Numéro de GSM"]),("Email",r["Adresse mail"]),
        ("Véhicule",f'{r["Marque du véhicule"]} {r["Modèle du véhicule"]}'.strip()),
        ("Année",r["Année"]),("Immatriculation",r["Numéro d'immatriculation"]),
        ("Autre club",r["Membre d'un autre club"]),("Assuré chez BEHVA",r["Assuré chez BEHVA"]),
        ("Autre véhicule",r["Autre véhicule"]),
    ])
    title=f'{esc(r["Prénom"])} {esc(r["Nom"])}'
    return f"""<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiche membre · {title} · Borin'Old Cars</title>
<style>body{{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8f9fb;margin:24px}}
.card{{background:#fff;max-width:900px;margin:auto;padding:24px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.06)}}
th{{text-align:left;background:#f1f4f8;border-radius:8px;width:220px}} td,th{{padding:8px;border-bottom:1px solid #eee}}
table{{border-collapse:collapse;width:100%}}</style></head><body>
<div class="card"><h1>Fiche membre</h1><p><small>Borin'Old Cars</small></p>
<table>{rows}</table>
<p style="margin-top:12px">Contact club :
<a href="mailto:vanhollebeke.pierre@icloud.com">vanhollebeke.pierre@icloud.com</a></p>
</div></body></html>"""

for _, r in df.iterrows():
    (OUT_DIR / f"{r['slug']}.html").write_text(member_html(r), encoding="utf-8")

links="\n".join(f"<li><a href='{esc(s)}.html'>{esc(p)} {esc(n)}</a></li>" for s,p,n in zip(df["slug"],df["Prénom"],df["Nom"]))
(OUT_DIR / "index.html").write_text(
    "<!doctype html><meta charset='utf-8'><title>Membres · Borin'Old Cars</title>"
    "<h1>Annuaire des membres · Borin'Old Cars</h1><ul>"+links+"</ul>", encoding="utf-8")
print(f"Généré {len(df)} fiches.")
