"""
Generates the Staff Portal's home-screen icon set (portal/icons/*.png) from
scratch - same brand palette as the portal itself (--sage/--bone/--gold),
same "BH" + subtitle mark as app/icon.svg (the till app's icon), so a
phone with more than one Black Horse app installed can tell them apart by
the subtitle while still reading as the same family.

Requires Pillow: python -m pip install pillow
Run with: python generate_icons.py (from this folder)
"""

from PIL import Image, ImageDraw, ImageFont

SAGE = (78, 95, 79, 255)     # --sage
BONE = (247, 247, 247, 255)  # --bone
GOLD = (201, 165, 107, 255)  # --gold

FONT_BOLD = "C:/Windows/Fonts/georgiab.ttf"


def rounded_icon(size, corner_pct=0.1875):
    """Standard icon: rounded square, safe for apple-touch-icon and Android's own display."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=round(size * corner_pct), fill=SAGE)
    draw_mark(d, size, size)
    return img


def maskable_icon(size):
    """Full-bleed square, no baked-in corners - Android applies its own mask
    shape, so only what's inside the centre ~80% safe zone can be trusted
    to survive un-cropped."""
    img = Image.new("RGBA", (size, size), SAGE)
    d = ImageDraw.Draw(img)
    draw_mark(d, size, size, scale=0.62)
    return img


def draw_mark(d, w, h, scale=0.78):
    bh_size = round(h * 0.34 * scale / 0.78)
    sub_size = round(h * 0.11 * scale / 0.78)
    bh_font = ImageFont.truetype(FONT_BOLD, bh_size)
    sub_font = ImageFont.truetype(FONT_BOLD, sub_size)

    cx = w / 2
    cy = h * 0.5

    bbox = d.textbbox((0, 0), "BH", font=bh_font)
    bh_h = bbox[3] - bbox[1]
    bh_y = cy - bh_h * 0.85
    d.text((cx, bh_y), "BH", font=bh_font, fill=BONE, anchor="ma")

    # Letter-spaced "STAFF" - PIL has no native tracking, so space the
    # glyphs by hand.
    label = "STAFF"
    gap = round(sub_size * 0.38)
    widths = [d.textlength(ch, font=sub_font) for ch in label]
    total = sum(widths) + gap * (len(label) - 1)
    x = cx - total / 2
    sub_y = bh_y + bh_h * 1.28
    for ch, cw in zip(label, widths):
        d.text((x, sub_y), ch, font=sub_font, fill=GOLD, anchor="la")
        x += cw + gap


def favicon(size):
    """Too small for the subtitle to read - just the mark."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=round(size * 0.22), fill=SAGE)
    font = ImageFont.truetype(FONT_BOLD, round(size * 0.58))
    d.text((size / 2, size / 2 + size * 0.03), "BH", font=font, fill=BONE, anchor="mm")
    return img


if __name__ == "__main__":
    rounded_icon(180).save("icon-180.png")
    rounded_icon(192).save("icon-192.png")
    rounded_icon(512).save("icon-512.png")
    maskable_icon(512).save("icon-maskable-512.png")
    favicon(32).save("favicon-32.png")
    print("Wrote icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png, favicon-32.png")
