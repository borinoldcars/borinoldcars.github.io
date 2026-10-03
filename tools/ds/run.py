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
