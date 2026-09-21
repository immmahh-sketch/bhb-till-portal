"""
Regenerates printer-bridge/assets/bar-logo-escstar.bin - the pre-rendered
ESC/POS bytes for the Black Horse Beamish logo printed at the top of bar
tickets. Re-run this if the source logo (app/logo-dark.png) ever changes.

Requires Pillow: python3 -m pip install pillow

Why ESC * and not GS v 0 or FS q:
  - GS v 0 (the common raster image command) isn't in this printer's
    supported command list at all - sending it just gets echoed back as
    PC437 text.
  - FS q/FS p (Bixolon's NV bit image - store once in flash, print by
    reference) IS supported and seemed like the right fit, but produced
    corrupted/split output on this unit despite following the documented
    byte layout (xL/xH/yL/yH in 8-dot units) - some undocumented internal
    block/byte-order quirk. See manual_extract.txt for the spec as
    documented.
  - ESC * (classic 8-dot-band bit image mode, command #11 in the printer's
    supported list) worked correctly first try: one command per 8-dot-tall
    horizontal band, each band's bytes are one per column (column-major
    within the band). Slightly more bytes on the wire per ticket than NV
    storage would have been, but reliable - and the width has to stay
    modest anyway (180 dots here; 280 printed but was visibly too wide for
    the receipt, so this was sized down).

Run with: python3 generate-logo-assets.py
"""

from PIL import Image, ImageOps

SRC_LOGO = "../app/logo-dark.png"
OUT_BIN = "assets/bar-logo-escstar.bin"
OUT_PREVIEW = "assets/bar-logo-preview.png"
TARGET_WIDTH = 180  # dots - keep conservative, this is close to the max that still looks right on this receipt width


def main():
    src = Image.open(SRC_LOGO).convert("RGBA")

    bg = Image.new("RGBA", src.size, (255, 255, 255, 255))
    flat = Image.alpha_composite(bg, src).convert("L")

    scale = TARGET_WIDTH / flat.width
    raw_h = round(flat.height * scale)
    target_h = ((raw_h + 7) // 8) * 8  # pad to a multiple of 8 so bands divide evenly
    resized = flat.resize((TARGET_WIDTH, raw_h), Image.LANCZOS)
    resized = ImageOps.autocontrast(resized, cutoff=1)
    bw_partial = resized.point(lambda p: 255 if p > 150 else 0, mode="L").convert("1")

    bw = Image.new("1", (TARGET_WIDTH, target_h), 1)  # 1 = white
    bw.paste(bw_partial, (0, 0))
    bw.save(OUT_PREVIEW)

    w, h = bw.size
    pixels = bw.load()
    print(f"logo: {w}x{h} ({h // 8} bands)")

    out = bytearray()
    out += bytes([0x1B, 0x33, 16])  # ESC 3 16 -> line spacing = 8 dots (exact band height)

    nL = w & 0xFF
    nH = (w >> 8) & 0xFF
    for band_y in range(0, h, 8):
        out += bytes([0x1B, 0x2A, 0x00, nL, nH])  # ESC * 0 nL nH (8-dot single density)
        for x in range(w):
            byte = 0
            for bit in range(8):
                black = 1 if pixels[x, band_y + bit] == 0 else 0
                if black:
                    byte |= 1 << (7 - bit)
            out.append(byte)
        out += bytes([0x0A])  # LF - advance exactly one band

    out += bytes([0x1B, 0x32])  # ESC 2 - restore default line spacing

    with open(OUT_BIN, "wb") as f:
        f.write(out)
    print(f"wrote {len(out)} bytes to {OUT_BIN}")


if __name__ == "__main__":
    main()
