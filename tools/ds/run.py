import json, io, os, re, html, requests
from PIL import Image, ImageDraw, ImageOps, ImageFilter, ImageChops
OUT = "tools/ds/out"; os.makedirs(OUT, exist_ok=True)
req = json.load(open("tools/ds/request.json"))
def thumb(fid, sz):
    r = requests.get(f"https://drive.google.com/thumbnail?id={fid}&sz=w{sz}", timeout=60)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert("RGB")
def listing(folder):
    t = requests.get(f"https://drive.google.com/embeddedfolderview?id={folder}", timeout=60).text
    entries = []
    for m in re.finditer(r'<div class="flip-entry" id="entry-([^"]+)".*?<div class="flip-entry-title">(.*?)</div>', t, re.S):
        fid, title = m.group(1), html.unescape(m.group(2))
        block = m.group(0)
        entries.append((fid, title, "/folders/" in block))
    return entries
if req["mode"] == "scan":
    items, todo = [], [(req["folder"], "")]
    while todo:
        f, path = todo.pop(0)
        for fid, title, is_dir in listing(f):
            if is_dir: todo.append((fid, path + title + "/"))
            elif re.search(r"\.(jpe?g|png|heic|webp|tiff?)$", title, re.I) or "." not in title: items.append({"id": fid, "name": path + title})
    json.dump(items, open(f"{OUT}/scan.json", "w"), ensure_ascii=False, indent=0)
    print(len(items), "images")
    if req.get("sheets"):
        W, H, C, R = 300, 225, 4, 3
        for s in range(0, len(items), C * R):
            sheet = Image.new("RGB", (W * C, (H + 22) * R), "white"); d = ImageDraw.Draw(sheet)
            for k, it in enumerate(items[s:s + C * R]):
                x, y = (k % C) * W, (k // C) * (H + 22)
                try:
                    im = ImageOps.contain(thumb(it["id"], 400), (W - 4, H - 4))
                    sheet.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
                except Exception:
                    d.text((x + 10, y + 100), "ERREUR", fill="red")
                d.text((x + 6, y + H + 4), f"#{s + k} {it['name'][-34:]}", fill="black")
            sheet.save(f"{OUT}/sheet-{s // (C * R):03d}.jpg", quality=80)
