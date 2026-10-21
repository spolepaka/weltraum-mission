#!/usr/bin/env python3
"""Photo-derived 2nd-gen Tesla Roadster top-view sprites.

Traces the official aerial (ref_roadster_top_view.png) via the outer
high-variance contour — the car is smooth paint/glass on cracked desert —
then recolours body paint per trim while keeping the gold canopy.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
# Prefer the 4K official overhead from X; fall back to the earlier still.
REF_CANDIDATES = [
    Path("/home/ubuntu/.cursor/projects/workspace/uploads/big_HUyHfeEWQAA0UP4_18ec.jpg"),
    Path("/workspace/roadster-ref/top_crop.jpg"),
    Path("/opt/cursor/artifacts/ref_roadster_top_view.png"),
]
REF = next(p for p in REF_CANDIDATES if p.exists())
OUT = ROOT / "public" / "ships"
ART = Path("/opt/cursor/artifacts")
TMP = Path("/tmp")
SPRITE_H = 640

# Tesla-style paints. Lighting comes from the photo luminance.
PAINTS = {
    "white": None,  # keep original body
    "red": {
        "shadow": np.array([72, 10, 14], np.float32),
        "mid": np.array([176, 28, 34], np.float32),
        "hi": np.array([232, 118, 108], np.float32),
    },
    "black": {
        "shadow": np.array([8, 8, 10], np.float32),
        "mid": np.array([28, 28, 32], np.float32),
        "hi": np.array([118, 118, 124], np.float32),
    },
    "silver": {
        "shadow": np.array([36, 40, 48], np.float32),
        "mid": np.array([98, 104, 114], np.float32),
        "hi": np.array([196, 202, 212], np.float32),
    },
    "chrome": {
        "shadow": np.array([78, 70, 52], np.float32),
        "mid": np.array([198, 186, 152], np.float32),
        "hi": np.array([248, 238, 210], np.float32),
    },
}


def local_var(gray: np.ndarray, k: int = 6) -> np.ndarray:
    pad = np.pad(gray, k, mode="edge")
    win = sliding_window_view(pad, (2 * k + 1, 2 * k + 1))
    return win.var(axis=(-1, -2))


def largest_true_component(mask: np.ndarray) -> np.ndarray:
    """4-connected largest True blob. Pure numpy flood fill by scan labels."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    lab = 0
    sizes = {}
    for y in range(h):
        row = mask[y]
        for x in range(w):
            if not row[x] or labels[y, x]:
                continue
            lab += 1
            stack = [(y, x)]
            n = 0
            while stack:
                cy, cx = stack.pop()
                if cy < 0 or cx < 0 or cy >= h or cx >= w:
                    continue
                if not mask[cy, cx] or labels[cy, cx]:
                    continue
                labels[cy, cx] = lab
                n += 1
                stack.append((cy, cx + 1))
                stack.append((cy, cx - 1))
                stack.append((cy + 1, cx))
                stack.append((cy - 1, cx))
            sizes[lab] = n
    if not sizes:
        return mask
    keep = max(sizes, key=sizes.get)
    return labels == keep


def smooth_envelope(vals: np.ndarray, win: int = 11) -> np.ndarray:
    """Moving average; ignores NaNs so nose/tail gaps stay empty."""
    out = vals.copy()
    half = win // 2
    for i in range(len(vals)):
        lo, hi = max(0, i - half), min(len(vals), i + half + 1)
        chunk = vals[lo:hi]
        chunk = chunk[np.isfinite(chunk)]
        if chunk.size:
            out[i] = float(np.median(chunk))
    return out


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    if r <= 0:
        return mask
    pad = np.pad(mask, r, mode="constant")
    win = sliding_window_view(pad, (2 * r + 1, 2 * r + 1))
    return win.any(axis=(-1, -2))


def erode(mask: np.ndarray, r: int) -> np.ndarray:
    if r <= 0:
        return mask
    pad = np.pad(mask, r, mode="constant", constant_values=True)
    win = sliding_window_view(pad, (2 * r + 1, 2 * r + 1))
    return win.all(axis=(-1, -2))


def flood_from_border(blocked: np.ndarray) -> np.ndarray:
    """True where outside / reachable from the image border without crossing blocked."""
    h, w = blocked.shape
    seen = np.zeros((h, w), bool)
    stack = []
    for x in range(w):
        if not blocked[0, x]:
            stack.append((0, x))
        if not blocked[h - 1, x]:
            stack.append((h - 1, x))
    for y in range(h):
        if not blocked[y, 0]:
            stack.append((y, 0))
        if not blocked[y, w - 1]:
            stack.append((y, w - 1))
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or blocked[y, x]:
            continue
        seen[y, x] = True
        stack.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    return seen


def _clusters(ys: np.ndarray, gap: int = 5) -> list[np.ndarray]:
    if ys.size == 0:
        return []
    groups = [[int(ys[0])]]
    for v in ys[1:]:
        if int(v) - groups[-1][-1] <= gap:
            groups[-1].append(int(v))
        else:
            groups.append([int(v)])
    return [np.asarray(g, np.int32) for g in groups]


def extract_car(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return tight RGBA cutout (nose-left) and a binary mask of the same size.

    Official aerial crop is fixed (person clipped). The car/desert boundary is
    the centreline of the high-variance ring — not its fat outer halo.
    """
    # Person sits well below the car. Coords are for the 1450×966 still; scale.
    sx = rgb.shape[1] / 1450.0
    sy = rgb.shape[0] / 966.0
    x0, y0 = int(468 * sx), int(354 * sy)
    x1, y1 = int(978 * sx), int(584 * sy)
    crop = rgb[y0:y1, x0:x1]
    clum = (
        0.299 * crop[:, :, 0].astype(np.float32)
        + 0.587 * crop[:, :, 1].astype(np.float32)
        + 0.114 * crop[:, :, 2].astype(np.float32)
    )
    k = max(7, int(round(7 * sx)))
    var = local_var(clum, k)
    vnorm = var / float(np.percentile(var, 80)) * 255.0
    ring = largest_true_component(vnorm > 160)
    Image.fromarray(crop.astype(np.uint8)).save(TMP / "car_crop_v3.png")
    Image.fromarray((ring.astype(np.uint8) * 255)).save(TMP / "car_ring_v3.png")

    h, w = ring.shape
    top = np.full(w, np.nan, np.float32)
    bot_raw = np.full(w, np.nan, np.float32)
    for x in range(w):
        ys = np.where(ring[:, x])[0]
        if ys.size:
            top[x] = float(ys.min())
            bot_raw[x] = float(ys.max())

    # Centreline from mid-body columns where both ring shoulders are present.
    mid = slice(w // 5, 4 * w // 5)
    spans = bot_raw[mid] - top[mid]
    span_min = 140 * (crop.shape[1] / 510.0)
    good = np.isfinite(top[mid]) & np.isfinite(bot_raw[mid]) & (spans > span_min)
    cy = float(np.median((top[mid][good] + bot_raw[mid][good]) / 2))
    hw = float(np.median(spans[good] / 2))
    print("mirror envelope", "cy", cy, "half-width", hw, "good", int(good.sum()), "crop", crop.shape)

    # Official car is symmetric. The sunlit outer ring is the true silhouette;
    # the shadowed shoulder drops out of the threshold and bites the body if used.
    bot = 2 * cy - top
    win = max(7, int(round(7 * crop.shape[1] / 510.0)))
    top = smooth_envelope(top, win)
    bot = smooth_envelope(bot, win)
    inset = 5.5 * (crop.shape[1] / 510.0)
    top = top + inset
    bot = bot - inset

    mask = np.zeros((h, w), bool)
    for x in range(w):
        if not np.isfinite(top[x]) or not np.isfinite(bot[x]):
            continue
        ya, yb = float(top[x]), float(bot[x])
        if yb < ya:
            ya, yb = yb, ya
        if (yb - ya) < 16:
            continue
        mask[int(np.floor(ya)) : int(np.ceil(yb)) + 1, x] = True

    pad = 2
    mpad = np.pad(mask, pad, mode="constant")
    crop_rgb = np.pad(crop, ((pad, pad), (pad, pad), (0, 0)), mode="edge")
    dist_in = _dist_in(mpad)
    alpha = np.clip(dist_in / 1.25, 0, 1)
    pr = crop_rgb[:, :, 0].astype(np.float32)
    pg = crop_rgb[:, :, 1].astype(np.float32)
    pb = crop_rgb[:, :, 2].astype(np.float32)
    plum = 0.299 * pr + 0.587 * pg + 0.114 * pb
    # Only peel obviously-tan desert on the outer 2px — not shadowed paint.
    desert = (pr - pb > 18) & (plum < 165) & (pg < 150) & (pr < 190) & (pr > 60)
    fringe = desert & (alpha > 0) & (dist_in < 2.2)
    canopy_like = (pr - pb > 28) & (pr > pg) & (dist_in > 5)
    alpha = np.where(fringe & ~canopy_like, 0, alpha)

    rgba = np.zeros((mpad.shape[0], mpad.shape[1], 4), np.uint8)
    rgba[:, :, :3] = crop_rgb
    rgba[:, :, 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    ys2, xs2 = np.where(rgba[:, :, 3] > 12)
    rgba = rgba[ys2.min() : ys2.max() + 1, xs2.min() : xs2.max() + 1]
    rgba = _strip_end_desert(rgba)
    ys2, xs2 = np.where(rgba[:, :, 3] > 12)
    rgba = rgba[ys2.min() : ys2.max() + 1, xs2.min() : xs2.max() + 1]
    return rgba, rgba[:, :, 3] > 12


def _strip_end_desert(rgba: np.ndarray) -> np.ndarray:
    """Nose/tail still pick up a few tan halo pixels — drop those columns/rows."""
    out = rgba.copy()
    r = out[:, :, 0].astype(np.float32)
    g = out[:, :, 1].astype(np.float32)
    b = out[:, :, 2].astype(np.float32)
    a = out[:, :, 3]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    desert = (a > 0) & (r - b > 14) & (lum < 178) & (g < 158) & (r < 200)
    h, w = a.shape
    band = max(6, w // 40)
    desert[:, :band] = desert[:, :band]
    out[:, :band, 3] = np.where(desert[:, :band], 0, out[:, :band, 3])
    out[:, w - band :, 3] = np.where(desert[:, w - band :], 0, out[:, w - band :, 3])
    return out


def _dist_in(mask: np.ndarray) -> np.ndarray:
    """Cheap chamfer distance inside a boolean mask (pixels)."""
    h, w = mask.shape
    inf = h + w + 5
    d = np.where(mask, inf, 0).astype(np.float32)
    # forward
    for y in range(h):
        for x in range(w):
            if not mask[y, x]:
                continue
            best = d[y, x]
            if y:
                best = min(best, d[y - 1, x] + 1)
            if x:
                best = min(best, d[y, x - 1] + 1)
            if y and x:
                best = min(best, d[y - 1, x - 1] + 1.414)
            d[y, x] = best
    # backward
    for y in range(h - 1, -1, -1):
        for x in range(w - 1, -1, -1):
            if not mask[y, x]:
                continue
            best = d[y, x]
            if y + 1 < h:
                best = min(best, d[y + 1, x] + 1)
            if x + 1 < w:
                best = min(best, d[y, x + 1] + 1)
            if y + 1 < h and x + 1 < w:
                best = min(best, d[y + 1, x + 1] + 1.414)
            d[y, x] = best
    d[~mask] = 0
    return d


def body_canopy(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Split paint vs gold glass. Tail-light red stays with body (recolor skips it)."""
    a = rgba[:, :, 3] > 12
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    # Gold glass: warm, medium-dark, not the pale body.
    gold = a & (r - b > 22) & (r > g - 6) & (lum < 188) & (lum > 55) & (chroma > 18)
    # Pale / cool / highlight paint
    body = a & ~gold
    return body, gold


def apply_paint(rgba: np.ndarray, paint: dict | None) -> np.ndarray:
    body, gold = body_canopy(rgba)
    out = darken_glass_mask(rgba, gold)
    if paint is None:
        return out
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    # Keep the thin red tail lamp (saturated red, not gold).
    tail = body & (r > 90) & (r > g + 25) & (r > b + 25) & (g < 90)
    paint_px = body & ~tail
    if not paint_px.any():
        return out
    L = lum[paint_px]
    lo, hi = np.percentile(L, 8), np.percentile(L, 96)
    t = np.clip((L - lo) / max(8, hi - lo), 0, 1)
    # Smoothstep so highlights bloom instead of banding.
    t = t * t * (3 - 2 * t)
    sh, mid, highlight = paint["shadow"], paint["mid"], paint["hi"]
    # two-segment lerp: shadow→mid (0-0.55), mid→hi (0.55-1)
    col = np.zeros((L.size, 3), np.float32)
    m = t < 0.55
    u = np.clip(t / 0.55, 0, 1)
    col[m] = sh + (mid - sh) * u[m, None]
    u2 = np.clip((t - 0.55) / 0.45, 0, 1)
    col[~m] = mid + (highlight - mid) * u2[~m, None]
    out_r = out[:, :, 0].astype(np.float32)
    out_g = out[:, :, 1].astype(np.float32)
    out_b = out[:, :, 2].astype(np.float32)
    out_r[paint_px] = col[:, 0]
    out_g[paint_px] = col[:, 1]
    out_b[paint_px] = col[:, 2]
    out[:, :, 0] = np.clip(out_r, 0, 255).astype(np.uint8)
    out[:, :, 1] = np.clip(out_g, 0, 255).astype(np.uint8)
    out[:, :, 2] = np.clip(out_b, 0, 255).astype(np.uint8)
    return out


def darken_glass_mask(rgba: np.ndarray, gold: np.ndarray) -> np.ndarray:
    """Studio shots show a dark smoked canopy, not a giant gold dome."""
    out = rgba.copy()
    if not gold.any():
        return out
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    L = lum[gold]
    lo, hi = np.percentile(L, 8), np.percentile(L, 96)
    t = np.clip((L - lo) / max(8, hi - lo), 0, 1)
    t = t * t * (3 - 2 * t)
    sh = np.array([16, 16, 18], np.float32)
    mid = np.array([38, 36, 34], np.float32)
    highlight = np.array([118, 108, 92], np.float32)
    col = np.zeros((L.size, 3), np.float32)
    m = t < 0.55
    u = np.clip(t / 0.55, 0, 1)
    col[m] = sh + (mid - sh) * u[m, None]
    u2 = np.clip((t - 0.55) / 0.45, 0, 1)
    col[~m] = mid + (highlight - mid) * u2[~m, None]
    out_r = out[:, :, 0].astype(np.float32)
    out_g = out[:, :, 1].astype(np.float32)
    out_b = out[:, :, 2].astype(np.float32)
    out_r[gold] = col[:, 0]
    out_g[gold] = col[:, 1]
    out_b[gold] = col[:, 2]
    out[:, :, 0] = np.clip(out_r, 0, 255).astype(np.uint8)
    out[:, :, 1] = np.clip(out_g, 0, 255).astype(np.uint8)
    out[:, :, 2] = np.clip(out_b, 0, 255).astype(np.uint8)
    return out


def to_nose_up(rgba: np.ndarray) -> np.ndarray:
    # Official aerial is nose-LEFT. 270° CCW == 90° CW → nose up.
    im = Image.fromarray(rgba, "RGBA").transpose(Image.ROTATE_270)
    # Gentle sharpen so panel lines survive the downscale-to-game later.
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    return np.asarray(im)


def scale_h(rgba: np.ndarray, height: int) -> Image.Image:
    im = Image.fromarray(rgba, "RGBA")
    w = max(1, round(im.size[0] * height / im.size[1]))
    return im.resize((w, height), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    rgb = np.asarray(Image.open(REF).convert("RGB"))
    rgba, mask = extract_car(rgb)
    Image.fromarray(rgba).save(TMP / "car_cut_v2.png")
    Image.fromarray((mask.astype(np.uint8) * 255)).save(TMP / "car_mask_v2.png")
    nose = to_nose_up(rgba)
    Image.fromarray(nose).save(TMP / "car_noseup_v2.png")
    print("cutout", rgba.shape, "nose-up", nose.shape, "opaque", int((nose[:, :, 3] > 12).sum()))

    # Aspect / half-width samples for the canvas fallback (nose → rear).
    m = nose[:, :, 3] > 12
    h, w = m.shape
    samples = []
    for u in (0.0, 0.06, 0.12, 0.2, 0.35, 0.5, 0.65, 0.78, 0.88, 0.95, 1.0):
        y = min(h - 1, max(0, int(round(u * (h - 1)))))
        xs = np.where(m[y])[0]
        if xs.size:
            half = (xs.max() - xs.min() + 1) / 2 / (w / 2)
            samples.append((round(u, 2), round(float(half), 3)))
        else:
            samples.append((round(u, 2), 0.0))
    print("HALF_W", samples)

    for name, spec in PAINTS.items():
        painted = apply_paint(nose, spec)
        sprite = scale_h(painted, SPRITE_H)
        dest = OUT / f"roadster_{name}.png"
        sprite.save(dest, optimize=True)
        print("wrote", dest, sprite.size, dest.stat().st_size)


if __name__ == "__main__":
    main()
