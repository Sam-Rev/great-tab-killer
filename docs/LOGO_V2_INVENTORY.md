# Logo v2 image-reference inventory

Search performed before replacing any logo files: image-path references in `manifest.json`, all HTML/CSS/JS, all locale JSON, `README.md`, and `NOTICE`.

## Existing logo and extension-icon references

| Reference | Current use | Planned v2 treatment |
|---|---|---|
| `manifest.json` `icons` 16/32/48/128 | Extension listing icons | Replace file contents at the same paths. |
| `manifest.json` `action.default_icon` 16/32 | Toolbar icon | Replace file contents at the same paths. |
| `js/tgs.js` normal `icon-16x16.png`, `icon-32x32.png` | Active toolbar state | Replace file contents at the same paths. |
| `js/tgs.js` `icon-16x16_grey.png`, `icon-32x32_grey.png` | Paused/disabled toolbar state | Regenerate grayscale from the same corresponding v2 masters. |
| `html/suspended.html` `#gsFavicon` → `icon-16x16.png` | Initial fallback only; `js/suspended.js`/`js/helpers/gsFavicon.js` set the suspended tab's original site favicon | Keep favicon update logic unchanged; do not put the product logo into the site-favicon image element. |
| `images/tab-killer-logo.png` | Full-size branding in `html/options.html`, `html/recovery.html` (two states), `html/update.html`, `html/permissions.html`, `html/broken.html`, `html/restoring-window.html`, and `html/monitor-lab.html` | Replace file contents with the v2 master rendering; retain path. |
| `html/monitor-lab.html` `icon-32x32.png` | Page favicon and branded navigation icon | Regenerate at the same path. |
| `README.md` `images/tab-killer-placeholder.png` | Broken/stale image path and placeholder label | Point at `images/tab-killer-logo.png` and remove placeholder wording. |
| `NOTICE` owner asset entry | v1 source asset and generated artwork | Retain v1 source; add v2 PNG/JPEG/master provenance and unconfirmed license. |

## Non-logo images to preserve

- `images/ch-def-favicon*.png` and `images/ch-dev-def-favicon*.png`: generic Chromium/site favicons used by `gsFavicon.js`, `monitor.js`, and `monitor-lab.js`.
- `images/snz_tab.svg` and `images/snz_tab_awake.svg`: suspended/awake illustrations, not product-logo placements.
- `font/fontello.svg`: icon font source referenced by `styles/fontello.css`, not a product logo.

The pre-replacement search found no image-reference strings in locale files. `html/popup.html`, `html/about.html`, `html/changelog.html`, and `html/monitor.html` had no logo placement at search time; add the v2 brand in their visible headers. The suspended page also needs a separate 64–96 px product mark near the suspension message. Its site-favicon element and assignment behavior must stay separate and unchanged.

## Added v2 placements

- `html/popup.html`: `icon-32x32.png` in the status header.
- `html/options.html`, `html/about.html`, `html/changelog.html`, and `html/monitor.html`: `icon-48x48.png` in the page header.
- `html/suspended.html`: `tab-killer-logo.png` at 80 px near the suspended message. The `#gsFavicon` code and `gsTopBarImg` site-icon path remain unchanged.
- `README.md`: corrected its stale missing placeholder image path to `images/tab-killer-logo.png`.

## Replacement and verification status

- All extension icon paths are unchanged and now contain v2 art. The 16/32 px images use the owner-approved simplified SVG variants; 48/128 px and the 512 px page logo use the full master. Toolbar paused states use grayscale versions of the approved small variants.
- Every remaining `brand-placeholder` selector/ID was renamed to `brand-logo`; `images/tab-killer-placeholder.png` did not exist in the tracked tree, and the README's stale reference is fixed. The existing `images/tab-killer-logo.png` path was retained and its contents replaced, so no distinct old product-logo file remains in the shipped `images/` folder.
- `images/snz_tab.svg` and `_awake.svg` remain as suspension/awake state illustrations, not product logos. Chromium favicon fallback images remain because they are site-tab fallbacks. The owner's root input files are preserved and are not referenced by shipped code.
- The source logo's alpha bounding box was `(407, 396, 1678, 1641)` in a 2048 square. The processed master is 1398 square with 5% padding. The 15,104 partial-alpha pixels on the outside transparency boundary were recolored from nearby opaque orange pixels; no unmatting fallback was needed. No opaque white background was found around the outer artwork.
- The script regenerated all seven shipped PNG outputs byte-for-byte. PNG metadata dictionaries are empty. Visual review used light `#FFFFFF` and dark `#202124` backgrounds at 16, 32, 48, and 128 px; the 16/32 paused icon is visibly grayscale against normal at 16 px. Browser rendering in Brave was not checked.
