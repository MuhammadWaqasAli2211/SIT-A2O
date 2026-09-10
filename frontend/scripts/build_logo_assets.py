"""Turn public/logo.png into the asset set the app actually serves.

Run from the frontend directory, with any Python that has Pillow:

    ../backend/.venv/Scripts/python.exe scripts/build_logo_assets.py

Re-run this whenever public/logo.png changes. Nothing else regenerates
public/brand/, and the committed output will silently keep serving the old
artwork if you forget.

## Why this exists

The supplied logo is 500x500 RGBA whose artwork only occupies
(24, 41)-(465, 444) — about 12% of the canvas is empty padding, and it sits
off-centre. Handing that file to a browser and asking for a 16px favicon does
two bad things at once: a third of the pixel budget goes on nothing, and a
detailed gradient gets downscaled 30x in a single step, which is what turned
the ribbon into a smear.

So the artwork is trimmed to its own bounds, recentred on a square, and
resampled once per size that the app actually requests, with sharpening at the
small end to put back the edge contrast every downscale removes.

## Three variants

  mark-*.png    transparent, flat — the plain artwork
  mark3d-*.png  transparent, extruded — the one the app renders
  icon-*.png    the artwork on a white rounded tile

`mark3d-*` is the default in the app: the same artwork given real depth by
stacking darkened copies of its own silhouette down and right behind it, then
dropping a soft shadow under the whole thing. The side wall is built from a
darkened copy of the artwork rather than one flat colour, so the extrusion
carries the logo's own blue-to-green shift instead of looking like a grey
slab glued to the back.

The depth also does a second job. With no tile behind it, the logo's deep
blue (#013186, measured oklch(0.348 0.150 261)) sits at almost exactly the
lightness of `--nav-shell` (oklch(0.22 0.07 262)) and `--auth-pane`
(oklch(0.33 0.15 262)). The drop shadow and the lighter extruded edge give
the mark an outline against those surfaces that a flat cut-out does not have.
It reduces the problem; it does not erase it — see the note in brand.tsx.
"""

import pathlib

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

PUBLIC = pathlib.Path(__file__).resolve().parents[1] / "public"
OUT = PUBLIC / "brand"

# Sizes the app and the browser actually ask for. 180 is apple-touch-icon,
# 192/512 are the PWA manifest sizes, and the rest cover the favicon plus the
# 32-36px lockup at 1x, 2x and 3x.
MARK_SIZES = [512, 256, 192, 144, 128, 96, 72, 64, 48]
MARK3D_SIZES = [512, 256, 192, 180, 144, 128, 96, 72, 64, 48, 32, 16]
ICON_SIZES = [512, 256, 192, 180, 128, 96, 64, 48, 32, 16]

# --- extrusion -------------------------------------------------------------
# Depth as a fraction of the artwork's edge, and the light direction. Down and
# right, because every other shadow in the app falls that way and a mark lit
# from the opposite side to its own container reads as pasted on.
DEPTH = 0.055
LIGHT = (0.62, 1.0)  # (x, y) weighting of the extrusion direction
# How dark the side wall goes. Not black: a black wall against the deep blue
# end of the gradient just reads as a hole.
WALL_DARKEN = 0.42
# Contact shadow, as fractions of the edge.
SHADOW_OFFSET = 0.035
SHADOW_BLUR = 0.045
SHADOW_ALPHA = 110

# Breathing room inside the square, as a fraction of the final edge. Small:
# the point of trimming was to spend pixels on artwork, not to re-add margin.
MARK_PAD = 0.03
# The tile needs a little more so the artwork does not collide with the
# rounded corners — but only a little, for the same reason.
ICON_PAD = 0.07

# As a fraction of the tile's edge. Reads as a modern app icon at every size.
TILE_RADIUS = 0.22


def trimmed(src: Image.Image) -> Image.Image:
    """The artwork, cropped to its own bounds. Aspect ratio preserved.

    Deliberately not squared. The artwork is 441x403 — wider than it is tall —
    so padding it to a square adds 9% dead vertical space, and in a square
    container that dead space is what limits the width: the mark ends up
    rendering 9% narrower than the box allows, for nothing. The app sizes
    these by height and lets the width follow.
    """
    box = src.getchannel("A").getbbox()
    if box is None:
        raise SystemExit("logo.png has no opaque pixels — is it the right file?")
    return src.crop(box)


def squared(art: Image.Image) -> Image.Image:
    """Centred on a square. Only the tiled app icons need this — a launcher
    icon has to be square, whereas an inline logo does not."""
    edge = max(art.size)
    square = Image.new("RGBA", (edge, edge), (0, 0, 0, 0))
    square.paste(art, ((edge - art.width) // 2, (edge - art.height) // 2))
    return square


def resample(art: Image.Image, height: int, pad: float) -> Image.Image:
    """One output, scaled to `height` with the aspect ratio kept.

    Height rather than width because that is what the layout constrains: the
    bars these sit in have fixed heights, and the mark is free to be as wide
    as it naturally is.
    """
    inner_h = max(1, round(height * (1 - 2 * pad)))
    inner_w = max(1, round(inner_h * art.width / art.height))
    small = art.resize((inner_w, inner_h), Image.LANCZOS)
    if height <= 96:
        # Eased off as the size grows: the amount that rescues 16px leaves
        # visible haloing at 96.
        percent = 150 if height <= 32 else 130 if height <= 48 else 110
        small = small.filter(ImageFilter.UnsharpMask(radius=1.0, percent=percent, threshold=2))
    if pad == 0:
        return small
    canvas = Image.new(
        "RGBA", (round(inner_w / (1 - 2 * pad)), height), (0, 0, 0, 0)
    )
    canvas.paste(small, ((canvas.width - inner_w) // 2, (height - inner_h) // 2), small)
    return canvas


def extruded(art: Image.Image) -> Image.Image:
    """The artwork with real depth behind it, on transparency.

    Built at the artwork's own resolution and downsampled afterwards by the
    normal path, so the depth scales with the mark instead of being a fixed
    pixel offset that looks heavy at 512 and invisible at 48.

    The wall is a darkened copy of the artwork itself, stepped one pixel at a
    time so the side reads as a continuous surface rather than as a few
    discrete ghosts.
    """
    edge = art.width
    depth = max(2, round(edge * DEPTH))
    # Room for the extrusion and the shadow to fall into without clipping.
    pad = depth + max(2, round(edge * (SHADOW_OFFSET + SHADOW_BLUR * 2)))
    canvas = Image.new("RGBA", (edge + pad * 2, edge + pad * 2), (0, 0, 0, 0))
    origin = (pad, pad)

    # 1. Contact shadow: the silhouette, blurred, offset, under everything.
    silhouette = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    solid = Image.new("RGBA", art.size, (0, 0, 0, SHADOW_ALPHA))
    silhouette.paste(
        solid,
        (
            origin[0] + round(edge * SHADOW_OFFSET * LIGHT[0]) + depth,
            origin[1] + round(edge * SHADOW_OFFSET * LIGHT[1]) + depth,
        ),
        art,
    )
    canvas.alpha_composite(
        silhouette.filter(ImageFilter.GaussianBlur(max(1, edge * SHADOW_BLUR)))
    )

    # 2. The side wall: darkened copies stepped along the light direction,
    #    far to near, so the nearest step sits closest to the face.
    wall = ImageEnhance.Brightness(art).enhance(WALL_DARKEN)
    # Keep the original alpha — Brightness multiplies it too, which would
    # otherwise leave the wall semi-transparent and washed out.
    wall.putalpha(art.getchannel("A"))
    for step in range(depth, 0, -1):
        canvas.alpha_composite(
            wall,
            (
                origin[0] + round(step * LIGHT[0]),
                origin[1] + round(step * LIGHT[1]),
            ),
        )

    # 3. The face, unmodified, on top.
    canvas.alpha_composite(art, origin)

    # Trim back to the artwork's own bounds plus whatever the depth and
    # shadow actually claimed. Not squared — see `trimmed`.
    return canvas.crop(canvas.getchannel("A").getbbox())


def specular(art: Image.Image) -> Image.Image:
    """A faint top-left highlight, so the face reads as lit rather than flat.

    Masked to the artwork so it never spills onto the background, and kept
    weak — this logo already carries its own gradients, and a strong sheen on
    top of them just looks like a smudge.
    """
    edge = art.width
    glow = Image.new("L", art.size, 0)
    ImageDraw.Draw(glow).ellipse(
        (-edge * 0.25, -edge * 0.35, edge * 0.72, edge * 0.55), fill=58
    )
    glow = glow.filter(ImageFilter.GaussianBlur(edge * 0.08))
    glow = ImageChops.multiply(glow, art.getchannel("A"))
    sheen = Image.new("RGBA", art.size, (255, 255, 255, 0))
    sheen.putalpha(glow)
    lit = art.copy()
    lit.alpha_composite(sheen)
    return lit


def tiled(art: Image.Image, size: int) -> Image.Image:
    """The artwork on a white rounded tile.

    The tile is drawn at 4x and downsampled so its corner radius is genuinely
    smooth rather than a staircase — at 16px an aliased corner is a large
    fraction of the whole icon.
    """
    scale = 4
    big = size * scale
    tile = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=round(big * TILE_RADIUS), fill=(255, 255, 255, 255)
    )
    tile = tile.resize((size, size), Image.LANCZOS)
    inner = resample(squared(art), size, ICON_PAD)
    tile.alpha_composite(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
    return tile


def main() -> None:
    OUT.mkdir(exist_ok=True)
    src = Image.open(PUBLIC / "logo.png").convert("RGBA")
    art = trimmed(src)
    print(
        f"source {src.size} -> artwork {art.size} "
        f"(padding trimmed, aspect {art.width / art.height:.3f}:1 kept)\n"
    )

    for size in MARK_SIZES:
        resample(art, size, MARK_PAD).save(OUT / f"mark-{size}.png", optimize=True)
    print(f"mark-*.png    {MARK_SIZES}")

    art3d = extruded(specular(art))
    for size in MARK3D_SIZES:
        # No extra padding: the extrusion already built its own margin, and
        # adding more here would shrink the mark for no reason.
        resample(art3d, size, 0).save(OUT / f"mark3d-{size}.png", optimize=True)
    print(f"mark3d-*.png  {MARK3D_SIZES}")

    for size in ICON_SIZES:
        tiled(art, size).save(OUT / f"icon-{size}.png", optimize=True)
    print(f"icon-*.png  {ICON_SIZES}")

    # A real multi-resolution .ico, so browsers and OS surfaces pick a
    # pre-rendered size instead of rescaling one themselves. Built from the
    # extruded mark on transparency, matching what the app itself shows.
    resample(art3d, 256, 0).save(
        PUBLIC / "favicon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("favicon.ico   (16-256, multi-resolution)")

    total = sum(p.stat().st_size for p in OUT.glob("*.png"))
    print(f"\n{len(list(OUT.glob('*.png')))} files, {total / 1024:.0f} KB total")


if __name__ == "__main__":
    main()
