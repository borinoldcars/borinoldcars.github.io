import json, io, os, requests
from PIL import Image, ImageDraw, ImageOps
OUT = "tools/ds/out"; os.makedirs(OUT, exist_ok=True)
req = json.load(open("tools/ds/request.json"))
def thumb(fid, sz):
    r = requests.get(f"https://drive.google.com/thumbnail?id={fid}&sz=w{sz}", timeout=60)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert("RGB")
if req["mode"] == "sheets":
    albums = json.load(open("app/data/photos.json"))["albums"]
    items = []
    for a in albums:
        for i, fid in enumerate(a.get("drive", [])):
            items.append((f"{a['id'][:14]}#{i}", fid))
    json.dump(dict(items), open(f"{OUT}/index.json", "w"), indent=0)
    W, H, C, R = 300, 225, 4, 3
    for s in range(0, len(items), C * R):
        sheet = Image.new("RGB", (W * C, (H + 22) * R), "white"); d = ImageDraw.Draw(sheet)
        for k, (label, fid) in enumerate(items[s:s + C * R]):
            x, y = (k % C) * W, (k // C) * (H + 22)
            try:
                im = ImageOps.contain(thumb(fid, 400), (W - 4, H - 4))
                sheet.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
            except Exception as e:
                d.text((x + 10, y + 100), "ERREUR", fill="red")
            d.text((x + 6, y + H + 4), label, fill="black")
        sheet.save(f"{OUT}/sheet-{s // (C * R):03d}.jpg", quality=80)
elif req["mode"] == "big":
    for fid in req["ids"]:
        thumb(fid, 1600).save(f"{OUT}/big-{fid}.jpg", quality=88)
elif req["mode"] == "cutout":
    from rembg import remove, new_session
    sess = new_session(req.get("model", "isnet-general-use"))
    for fid in req["ids"]:
        im = thumb(fid, 2000)
        im.save(f"{OUT}/big-{fid}.jpg", quality=88)
        cut = remove(im, session=sess, post_process_mask=True)
        cut = cut.crop(cut.getbbox())
        cut.save(f"{OUT}/cut-{fid}.png")

if req["mode"] == "sam":
    from rembg import remove, new_session
    sess = new_session("sam")
    for job in req["jobs"]:
        im = thumb(job["id"], 2000)
        cut = remove(im, session=sess, sam_prompt=job["prompt"], post_process_mask=True)
        cut = cut.crop(cut.getbbox())
        cut.save(f"{OUT}/sam-{job['id']}.png")

if req["mode"] == "refine":
    from rembg import remove, new_session
    from PIL import ImageFilter, ImageChops
    sam = new_session("sam"); fine = new_session(req.get("model", "birefnet-general"))
    for job in req["jobs"]:
        im = thumb(job["id"], 2000)
        m_sam = remove(im, session=sam, sam_prompt=job["prompt"], only_mask=True).convert("L")
        m_sam = m_sam.point(lambda v: 255 if v > 127 else 0).filter(ImageFilter.MaxFilter(41)).filter(ImageFilter.GaussianBlur(6))
        m_fine = remove(im, session=fine, only_mask=True).convert("L")
        m_sam.save(f"{OUT}/msam-{job['id']}.png"); m_fine.save(f"{OUT}/mfine-{job['id']}.png")
        alpha = ImageChops.multiply(m_fine, m_sam)
        out = im.convert("RGBA"); out.putalpha(alpha)
        out = out.crop(alpha.point(lambda v: 255 if v > 20 else 0).getbbox())
        out.save(f"{OUT}/fin-{job['id']}.png")

if req["mode"] == "crop":
    from rembg import remove, new_session
    from PIL import ImageFilter, ImageChops
    sam = new_session("sam"); fine = new_session(req.get("model", "isnet-general-use"))
    for job in req["jobs"]:
        im = thumb(job["id"], 2000)
        m_sam = remove(im, session=sam, sam_prompt=job["prompt"], only_mask=True).convert("L")
        m_sam = m_sam.point(lambda v: 255 if v > 127 else 0).filter(ImageFilter.MaxFilter(job.get("grow", 15))).filter(ImageFilter.GaussianBlur(2))
        box = job["crop"]; c = im.crop(box)
        m_c = remove(c, session=fine, only_mask=True).convert("L")
        m_fine = Image.new("L", im.size, 0); m_fine.paste(m_c, box[:2])
        alpha = ImageChops.multiply(m_fine, m_sam)
        alpha = alpha.point(lambda v: 0 if v < 40 else (255 if v > 215 else v))
        out = im.convert("RGBA"); out.putalpha(alpha)
        out = out.crop(alpha.point(lambda v: 255 if v > 20 else 0).getbbox())
        out.save(f"{OUT}/crop-{job['id']}.png")
        m_fine.save(f"{OUT}/mcrop-{job['id']}.png")
