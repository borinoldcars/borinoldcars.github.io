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

if req["mode"] == "grid":
    for name, fid in req["items"].items():
        im = thumb(fid, 2000); W, H = im.size
        s = 1000 / max(W, H); sm = im.resize((int(W * s), int(H * s))); d = ImageDraw.Draw(sm)
        for x in range(0, W, 200):
            d.line([(x * s, 0), (x * s, sm.height)], fill="yellow"); d.text((x * s + 2, 2), str(x), fill="yellow")
        for y in range(0, H, 200):
            d.line([(0, y * s), (sm.width, y * s)], fill="yellow"); d.text((2, y * s + 2), str(y), fill="yellow")
        sm.save(f"{OUT}/grid-{name}.jpg", quality=85)

if req["mode"] == "crop":
    from rembg import remove, new_session
    sam = new_session("sam"); fine = new_session("isnet-general-use")
    for name, job in req["jobs"].items():
        im = thumb(job["id"], 2000)
        x1, y1, x2, y2 = job["box"]
        prompt = [{"type": "rectangle", "data": job["box"], "label": 1}]
        prompt += [{"type": "point", "data": p, "label": 1} for p in job.get("pos", [])]
        prompt += [{"type": "point", "data": p, "label": 0} for p in job.get("neg", [])]
        m_sam = remove(im, session=sam, sam_prompt=prompt, only_mask=True).convert("L")
        m_sam = m_sam.point(lambda v: 255 if v > 127 else 0).filter(ImageFilter.MaxFilter(job.get("grow", 15))).filter(ImageFilter.GaussianBlur(2))
        m = 60; box = (max(0, x1 - m), max(0, y1 - m), min(im.width, x2 + m), min(im.height, y2 + m))
        m_c = remove(im.crop(box), session=fine, only_mask=True).convert("L")
        m_fine = Image.new("L", im.size, 0); m_fine.paste(m_c, box[:2])
        alpha = ImageChops.multiply(m_fine, m_sam).point(lambda v: 0 if v < 40 else (255 if v > 215 else v))
        out = im.convert("RGBA"); out.putalpha(alpha)
        out = out.crop(alpha.point(lambda v: 255 if v > 20 else 0).getbbox())
        out.save(f"{OUT}/cut-{name}.png")
if req["mode"] == "big":
    for name, fid in req["items"].items():
        im = thumb(fid, 1600); im.save(f"{OUT}/big-{name}.jpg", quality=85)
