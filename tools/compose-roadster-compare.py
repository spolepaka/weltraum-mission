#!/usr/bin/env python3
"""Official top-view (nose-up) vs each trim sprite at the same scale."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ART = Path("/opt/cursor/artifacts")
SHIPS = Path("/workspace/public/ships")
H = 420
PAD = 18
BG = (18, 18, 22, 255)

# Official aerial crop (person clipped), rotated nose-up. Keep the lakebed so
# reviewers can see this is the real still, not a redraw.
official = Image.open("/tmp/car_crop_v3.png").convert("RGBA")
official = official.transpose(Image.ROTATE_270)
bbox = official.getbbox()
official = official.crop(bbox)
oh = H
ow = int(official.size[0] * oh / official.size[1])
official = official.resize((ow, oh), Image.Resampling.LANCZOS)

trims = [
    ("beepbuggy", "red", "Roadster / Multi-Coat Red"),
    ("cloudcoupe", "white", "Performance / Ano White"),
    ("shadowspeeder", "black", "Thrust / Deep Black"),
    ("chromewasp", "silver", "Rocket / Midnight Silver"),
    ("apexflash", "chrome", "Founders / Chrome"),
]

panels = [("Official aerial (rotated nose-up)", official)]
for sid, paint, label in trims:
    im = Image.open(SHIPS / f"roadster_{paint}.png").convert("RGBA")
    sc = oh / im.size[1]
    im = im.resize((max(1, int(im.size[0] * sc)), oh), Image.Resampling.LANCZOS)
    panels.append((label, im))
    im.save(ART / f"tesla_roadsters_sprite_{sid}.png")

cap_h = 36
w = PAD + sum(p[1].size[0] + PAD for p in panels)
h = PAD + oh + cap_h + PAD
out = Image.new("RGBA", (w, h), BG)
d = ImageDraw.Draw(out)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
except Exception:
    font = ImageFont.load_default()
x = PAD
for label, im in panels:
    out.alpha_composite(im, (x, PAD))
    d.text((x, PAD + oh + 8), label, fill=(220, 220, 224), font=font)
    x += im.size[0] + PAD
out.convert("RGB").save(ART / "tesla_roadsters_ref_vs_all.png", quality=92)

red = panels[1][1]
white = panels[2][1]
pair_w = PAD * 4 + official.size[0] + red.size[0] + white.size[0]
pair = Image.new("RGBA", (pair_w, h), BG)
pd = ImageDraw.Draw(pair)
x = PAD
pair.alpha_composite(official, (x, PAD))
pd.text((x, PAD + oh + 8), "Official aerial (nose-up)", fill=(220, 220, 224), font=font)
x += official.size[0] + PAD
pair.alpha_composite(white, (x, PAD))
pd.text((x, PAD + oh + 8), "Performance / Ano White", fill=(220, 220, 224), font=font)
x += white.size[0] + PAD
pair.alpha_composite(red, (x, PAD))
pd.text((x, PAD + oh + 8), "Roadster / Multi-Coat Red", fill=(220, 220, 224), font=font)
pair.convert("RGB").save(ART / "tesla_roadsters_ref_vs_base.png", quality=92)
def write_strip(paths, out_name, labels):
    frames = [p for p in paths if p.exists()]
    if not frames:
        return
    thumbs = [Image.open(p).convert("RGB") for p in frames]
    th = 280
    tw = int(th * thumbs[0].size[0] / thumbs[0].size[1])
    thumbs = [im.resize((tw, th), Image.Resampling.LANCZOS) for im in thumbs]
    strip = Image.new("RGB", (PAD + len(thumbs) * (tw + 8), th + PAD * 2 + 22), (18, 18, 22))
    d2 = ImageDraw.Draw(strip)
    x = PAD
    for i, im in enumerate(thumbs):
        strip.paste(im, (x, PAD))
        d2.text((x + 6, PAD + th + 4), labels[i] if i < len(labels) else f"f{i}", fill=(200, 210, 220), font=font)
        x += tw + 8
    strip.save(ART / out_name, quality=92)
    print("wrote", out_name, strip.size)

write_strip(
    [ART / f"tesla_roadsters_slow_flip_{i}.png" for i in range(8)],
    "tesla_roadsters_slow_flip_strip.png",
    ["0°", "eased", "edge", "under", "under", "edge", "eased", "360°"],
)
write_strip(
    [ART / f"tesla_roadsters_asteroid_flip_{i}.png" for i in range(8)],
    "tesla_roadsters_asteroid_flip_strip.png",
    ["boost", "roll", "safe", "under", "pass", "pass", "settle", "done"],
)

print("wrote compare", out.size, pair.size)
