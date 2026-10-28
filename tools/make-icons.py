#!/usr/bin/env python3
"""Generate metadata-free extension and page-brand PNGs from the owner logo.

Development tool only. Requires Pillow in the developer's Python environment;
Pillow is not used by the extension at runtime and is not shipped as a package.
"""

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source" / "Tab_Killer_logo.png"
IMAGES = ROOT / "images"
ICON_SIZES = (16, 32, 48, 128)
ACTION_SIZES = (16, 32)
BRAND_SIZE = 512
PADDING_FRACTION = 0.08


def prepare_logo(source: Image.Image) -> Image.Image:
    rgba = source.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Source logo is fully transparent")

    mark = rgba.crop(bbox)
    side = max(mark.size)
    pad = round(side * PADDING_FRACTION)
    canvas_side = side + 2 * pad
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    x = (canvas_side - mark.width) // 2
    y = (canvas_side - mark.height) // 2
    canvas.alpha_composite(mark, (x, y))
    return canvas


def save_png(image: Image.Image, path: Path, size: int) -> None:
    rendered = image.resize((size, size), Image.Resampling.LANCZOS)
    # Passing no pnginfo and saving a fresh image strips source metadata chunks.
    rendered.save(path, format="PNG", optimize=True)


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Missing owner source logo: {SOURCE}")
    IMAGES.mkdir(parents=True, exist_ok=True)
    logo = prepare_logo(Image.open(SOURCE))

    for size in ICON_SIZES:
        save_png(logo, IMAGES / f"icon-{size}x{size}.png", size)
    grey_logo = ImageOps.grayscale(logo).convert("RGBA")
    grey_logo.putalpha(logo.getchannel("A"))
    for size in ACTION_SIZES:
        save_png(grey_logo, IMAGES / f"icon-{size}x{size}_grey.png", size)
    save_png(logo, IMAGES / "tab-killer-logo.png", BRAND_SIZE)


if __name__ == "__main__":
    main()
