from pathlib import Path
from PIL import Image, ImageDraw

downloads = Path.home() / "Downloads"
matches = sorted(downloads.glob("vehcra_app_logo_1024.*"))
if not matches:
    raise SystemExit("Logo not found in Downloads. Check the file name.")

out = Path(r"C:\vehora\frontend\public\logo")
out.mkdir(parents=True, exist_ok=True)

im = Image.open(matches[0]).convert("RGB")
k = im.size[0] / 1254
im.save(out / "vehora-logo-full.png")

v = im.crop((int(230 * k), int(170 * k), int(1110 * k), int(770 * k)))
w, h = v.size
bg = im.getpixel((int(240 * k), int(180 * k)))


def round_icon(size, name, inner=0.74):
    S = size * 4
    base = Image.new("RGB", (S, S), bg)
    tw = int(S * inner)
    th = int(h * tw / w)
    base.paste(v.resize((tw, th), Image.LANCZOS), ((S - tw) // 2, (S - th) // 2))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, S - 1, S - 1), fill=255)
    res = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    res.paste(base, (0, 0), mask)
    t = max(4, S // 60)
    ImageDraw.Draw(res).ellipse(
        (t // 2, t // 2, S - t // 2 - 1, S - t // 2 - 1),
        outline=(224, 184, 106, 255),
        width=t,
    )
    res.resize((size, size), Image.LANCZOS).save(out / name)


round_icon(512, "icon-round-512.png")
round_icon(192, "icon-round-192.png")
round_icon(64, "favicon-round.png")

S = 512
m = Image.new("RGB", (S, S), bg)
tw = int(S * 0.58)
th = int(h * tw / w)
m.paste(v.resize((tw, th), Image.LANCZOS), ((S - tw) // 2, (S - th) // 2))
m.save(out / "icon-maskable-512.png")

print("Done:", [p.name for p in out.iterdir()])
