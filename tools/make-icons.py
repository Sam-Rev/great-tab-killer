#!/usr/bin/env python3
"""Create v2 extension art from owner-supplied source files.

Developer-only. Requires Pillow; the optional SVG rasterization path also uses
an installed ImageMagick `magick` executable. Neither is a runtime dependency.
"""

from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/Tab_Killer_logo_v2.png"
MASTER = ROOT / "assets/source/Tab_Killer_logo_v2_master.png"
IMAGES = ROOT / "images"
ICON_SIZES = (16, 32, 48, 128)
ACTION_SIZES = (16, 32)
BRAND_SIZE = 512
PADDING_FRACTION = 0.05
ORANGE = (255, 90, 0)


def _outer_partial_edges(rgba: Image.Image) -> list[tuple[int, int]]:
    alpha = rgba.getchannel("A")
    partial = alpha.point(lambda value: 255 if 0 < value < 255 else 0)
    transparent = alpha.point(lambda value: 255 if value == 0 else 0)
    touches_transparent = transparent.filter(ImageFilter.MaxFilter(3))
    edge = ImageChops.multiply(partial, touches_transparent)
    bounds = edge.getbbox()
    if bounds is None:
        return []
    pixels = edge.load()
    left, top, right, bottom = bounds
    return [(x, y) for y in range(top, bottom) for x in range(left, right) if pixels[x, y]]


def _orange_pixel(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha == 255 and red > 190 and green < 150 and blue < 90


def defringe_outer_edges(source: Image.Image) -> tuple[Image.Image, int, int, int]:
    rgba = source.convert("RGBA")
    pixels = rgba.load()
    edges = _outer_partial_edges(rgba)
    offsets = sorted(
        ((dx, dy) for dy in range(-16, 17) for dx in range(-16, 17)),
        key=lambda offset: (offset[0] ** 2 + offset[1] ** 2, offset[1], offset[0]),
    )
    changed = 0
    fallbacks = 0
    farthest = 0
    width, height = rgba.size
    for x, y in edges:
        replacement = None
        distance = 0
        for dx, dy in offsets:
            xx, yy = x + dx, y + dy
            if 0 <= xx < width and 0 <= yy < height and _orange_pixel(pixels[xx, yy]):
                replacement = pixels[xx, yy][:3]
                distance = math.isqrt(dx * dx + dy * dy)
                break
        red, green, blue, alpha = pixels[x, y]
        if replacement is None:
            # Remove a white matte while preserving alpha if no opaque orange
            # source pixel can be found nearby.
            factor = alpha / 255
            replacement = tuple(
                max(0, min(255, round((channel - 255 * (1 - factor)) / factor)))
                for channel in (red, green, blue)
            )
            fallbacks += 1
        pixels[x, y] = (*replacement, alpha)
        changed += 1
        farthest = max(farthest, distance)
    return rgba, changed, fallbacks, farthest


def prepare_master(source: Image.Image) -> tuple[Image.Image, dict[str, object]]:
    rgba, edge_count, fallback_count, farthest = defringe_outer_edges(source)
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Source logo is fully transparent")
    left, top, right, bottom = bbox
    mark = rgba.crop(bbox)
    side = round(max(mark.size) * (1 + 2 * PADDING_FRACTION))
    cx = (left + right) / 2
    cy = (top + bottom) / 2
    crop_left = round(cx - side / 2)
    crop_top = round(cy - side / 2)
    master = rgba.crop((crop_left, crop_top, crop_left + side, crop_top + side))
    return master, {
        "source_size": rgba.size,
        "alpha_bbox": bbox,
        "crop": (crop_left, crop_top, crop_left + side, crop_top + side),
        "master_size": master.size,
        "defringed_edge_pixels": edge_count,
        "white_unmatte_fallbacks": fallback_count,
        "farthest_opaque_orange_distance": farthest,
    }


def _resize_rgba(master: Image.Image, size: int) -> Image.Image:
    # Resizing premultiplied pixels prevents transparent RGB from forming halos.
    return master.convert("RGBa").resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")


def save_clean_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def _simple_svg(size: int) -> str:
    # A compact folder-face icon. At 16 px the inner ring is omitted; the 32 px
    # version keeps a clean inset outline. Blade, droplets, and tiny window mark
    # are intentionally absent at both sizes.
    ring = (
        '<path d="M8 10.2h16a2.2 2.2 0 0 1 2.2 2.2v11.2a2.2 2.2 0 0 1-2.2 2.2H8a2.2 2.2 0 0 1-2.2-2.2V12.4A2.2 2.2 0 0 1 8 10.2Z" '
        'fill="none" stroke="#fff" stroke-width="1.25"/>'
        if size == 32 else ""
    )
    eye_width = 2.7 if size == 16 else 2.3
    mouth_width = 2.8 if size == 16 else 2.4
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 32 32">
  <path d="M2.5 8.2c0-1.5 1.2-2.7 2.7-2.7h7.4l2.6 2.7h11.9c1.6 0 2.9 1.3 2.9 2.9v14.1c0 2-1.6 3.6-3.6 3.6H6.1c-2 0-3.6-1.6-3.6-3.6Z" fill="{ORANGE_HEX}"/>
  {ring}
  <g fill="none" stroke="#fff" stroke-width="{eye_width}" stroke-linecap="round">
    <path d="m9.1 14.4 4.4 4.4m0-4.4-4.4 4.4M18.5 14.4l4.4 4.4m0-4.4-4.4 4.4"/>
  </g>
  <path d="M8.5 24.2 Q16 18.8 23.5 24.2" fill="none" stroke="#fff" stroke-width="{mouth_width}" stroke-linecap="round"/>
</svg>'''


ORANGE_HEX = "#FF5A00"


def generate_simplified(output_dir: Path = IMAGES) -> None:
    for size in (16, 32):
        svg_path = ROOT / f"assets/source/Tab_Killer_logo_v2_simple_{size}.svg"
        svg_path.write_text(_simple_svg(size), encoding="utf-8")
        raster_path = ROOT / f"assets/source/.simple-{size}-raster.png"
        subprocess.run(
            ["magick", "-background", "none", "-density", "384", str(svg_path), str(raster_path)],
            check=True,
        )
        with Image.open(raster_path) as rendered:
            # Rasterize above target size, then downsample once with Lanczos.
            clean = rendered.convert("RGBa").resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
            save_clean_png(clean, output_dir / f"icon-{size}x{size}.png")
            grey = ImageOps.grayscale(clean).convert("RGBA")
            grey.putalpha(clean.getchannel("A"))
            save_clean_png(grey, output_dir / f"icon-{size}x{size}_grey.png")
        raster_path.unlink()


def generate_full() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Missing owner source logo: {SOURCE}")
    master, report = prepare_master(Image.open(SOURCE))
    save_clean_png(master, MASTER)
    print("Master preparation:", report)
    for size in ICON_SIZES:
        save_clean_png(_resize_rgba(master, size), IMAGES / f"icon-{size}x{size}.png")
    grey = ImageOps.grayscale(master).convert("RGBA")
    grey.putalpha(master.getchannel("A"))
    for size in ACTION_SIZES:
        save_clean_png(_resize_rgba(grey, size), IMAGES / f"icon-{size}x{size}_grey.png")
    save_clean_png(_resize_rgba(master, BRAND_SIZE), IMAGES / "tab-killer-logo.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simplified", action="store_true", help="Generate and rasterize simplified 16/32 px vectors.")
    parser.add_argument("--preview-dir", type=Path, help="Write simplified PNG previews here without replacing shipped icons.")
    args = parser.parse_args()
    if args.preview_dir:
        generate_simplified(args.preview_dir)
    elif args.simplified:
        generate_simplified()
    else:
        generate_full()


if __name__ == "__main__":
    main()
