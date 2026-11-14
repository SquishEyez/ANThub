"""Antelope Hub branding: redraw every logo image in the extracted APK tree
(launcher icons, round icons, adaptive foreground, splash screens, web icon
and favicon) with an "A" coin in the same style, size and position as the
original "W" coin.

usage: python3 brand.py <extracted-apk-dir> [<extra-icon-out.png>]
Splash images are found automatically: large PNGs with the orange coin at
their centre. Launcher icon files are the ones the manifest resolves to.
"""
import io, os, sys
from PIL import Image, ImageDraw, ImageFilter

ORANGE_HI = (255, 179, 71)
ORANGE = (255, 138, 0)
ORANGE_DEEP = (224, 106, 0)
INK = (26, 18, 8)
BG = (16, 18, 26)

# launcher icon files in this APK (from resources.arsc, checked with androguard)
LEGACY = ["9w.png", "yn.png", "FS.png", "RJ.png", "o-.png"]          # 48..192 rounded square
ROUND = ["zR.png", "8c.png", "wb.png", "fO.png", "Gc.png"]           # 48..192 round
FOREGROUND = ["QZ.png", "zr.png", "Em.png", "Lf.png", "as.png"]     # 108..432 adaptive foreground


def coin(d):
    """Orange coin with a bold geometric A, d x d, RGBA, drawn at 4x and downsampled."""
    s = d * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    g = ImageDraw.Draw(im)
    # radial-ish gradient coin
    for i in range(40):
        t = i / 39
        c = tuple(int(ORANGE_DEEP[k] + (ORANGE_HI[k] - ORANGE_DEEP[k]) * t) for k in range(3))
        r = s / 2 * (1 - t * 0.18)
        g.ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r], fill=c + (255,))
    inner = s * 0.40
    g.ellipse([s / 2 - inner, s / 2 - inner, s / 2 + inner, s / 2 + inner], fill=ORANGE + (255,))
    # geometric "A": outer triangle minus inner counter, plus crossbar
    cx, top, base = s / 2, s * 0.24, s * 0.74
    half = s * 0.215
    stroke = s * 0.105
    g.polygon([(cx, top), (cx + half, base), (cx + half - stroke * 1.05, base), (cx, top + stroke * 2.1), (cx - half + stroke * 1.05, base), (cx - half, base)], fill=INK + (255,))
    bar_y = s * 0.565
    g.rectangle([cx - half * 0.52, bar_y, cx + half * 0.52, bar_y + stroke * 0.78], fill=INK + (255,))
    return im.resize((d, d), Image.LANCZOS)


def rounded(size, radius, color):
    s = size * 4
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s - 1, s - 1], radius * 4, fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    im = Image.new("RGBA", (size, size), color + (255,))
    im.putalpha(m)
    return im


def legacy_icon(n):
    im = rounded(n, int(n * 0.22), BG)
    c = coin(int(n * 0.72))
    im.alpha_composite(c, ((n - c.width) // 2, (n - c.height) // 2))
    return im


def round_icon(n):
    s = n * 4
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).ellipse([0, 0, s - 1, s - 1], fill=255)
    im = Image.new("RGBA", (n, n), BG + (255,))
    im.putalpha(m.resize((n, n), Image.LANCZOS))
    c = coin(int(n * 0.66))
    im.alpha_composite(c, ((n - c.width) // 2, (n - c.height) // 2))
    return im


def foreground(n):
    im = Image.new("RGBA", (n, n), BG + (255,))
    c = coin(int(n * 0.56))
    im.alpha_composite(c, ((n - c.width) // 2, (n - c.height) // 2))
    return im.convert("RGB")


def is_splash(im):
    w, h = im.size
    if min(w, h) < 320:
        return False
    rgb = im.convert("RGB")
    corner = rgb.getpixel((2, 2))
    if sum(corner) >= 90:
        return False
    m = int(min(w, h) * 0.1)
    box = rgb.crop((w // 2 - m, h // 2 - m, w // 2 + m, h // 2 + m)).resize((40, 40))
    px = list(box.get_flattened_data()) if hasattr(box, "get_flattened_data") else list(box.getdata())
    orange = sum(1 for r, g, b in px if r > 200 and 90 < g < 200 and b < 90)
    return orange > len(px) * 0.25


def splash(im):
    w, h = im.size
    rgb = im.convert("RGB")
    bg = rgb.getpixel((2, 2))
    # the card behind the coin: sample just inside its top-left corner area (well clear of the coin)
    card = int(min(w, h) * 0.318)
    card_col = rgb.getpixel((w // 2 - int(card * 0.40), h // 2 - int(card * 0.40)))
    if sum(card_col) > 150:  # landed on something bright: use the original dark card colour
        card_col = (20, 22, 30)
    out = Image.new("RGBA", (w, h), bg + (255,))
    card = int(min(w, h) * 0.318)
    out.alpha_composite(rounded(card, int(card * 0.18), card_col), ((w - card) // 2, (h - card) // 2))
    c = coin(int(card * 0.6))
    out.alpha_composite(c, ((w - c.width) // 2, (h - c.height) // 2))
    return out.convert(im.mode if im.mode in ("RGB", "RGBA") else "RGB")


def save(path, im, mode=None):
    if mode == "P":
        im = im.convert("RGBA")
    im.save(path, optimize=True)


def main(tree, extra=None):
    res = os.path.join(tree, "res")
    sizes = [48, 72, 96, 144, 192]
    for f, n in zip(LEGACY, sizes):
        save(os.path.join(res, f), legacy_icon(n))
    for f, n in zip(ROUND, sizes):
        save(os.path.join(res, f), round_icon(n))
    for f, n in zip(FOREGROUND, [108, 162, 216, 324, 432]):
        save(os.path.join(res, f), foreground(n))
    n_splash = 0
    for f in sorted(os.listdir(res)):
        if not f.endswith(".png") or f.endswith(".9.png") or f in LEGACY + ROUND + FOREGROUND:
            continue
        p = os.path.join(res, f)
        try:
            im = Image.open(p)
            im.load()
        except Exception:
            continue
        if is_splash(im):
            splash(im).save(p, optimize=True)
            n_splash += 1
    pub = os.path.join(tree, "assets", "public")
    big = legacy_icon(1024)
    big.save(os.path.join(pub, "icon.png"), optimize=True)
    fav = os.path.join(pub, "favicon.png")
    if os.path.exists(fav):
        w = Image.open(fav).size[0]
        legacy_icon(w).save(fav, optimize=True)
    if extra:
        big.save(extra, optimize=True)
    print(f"brand: 15 launcher icons, {n_splash} splash screens, web icon + favicon redrawn")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
