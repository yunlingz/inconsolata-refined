# Font review

Reviewed October 24, 2026. Scope: the four generated Inconsolata Refined 1.100 TTFs and corresponding web fonts, their source glyphs, paired Cascadia stroke measurements, small-size specimens, shaping behavior, hint bytecode, metrics, and family metadata.

## Findings resolved

1. **The original is smaller at the same requested size.** The original regular x height is 0.457 em and its cell is 0.5 em. The Cascadia reference is 0.51758 em and 0.58594 em. Version 1.100 preserves the previous refined lowercase heights (1060 Regular/Italic, 1078 Bold/Bold Italic), 1200-unit cell, and 2380-unit line height. Regular's capital height is now 1424 units versus Cascadia's 1420.
2. **Exported height metadata was stale after outline scaling.** FontForge kept the intermediate x-height and cap-height values even though the outlines had grown. The final build derives both fields from the actual `x` and `H` outlines and recomputes every affected checksum. Regression checks compare metadata with geometry for all four styles.
3. **Terminal symbols need a separate transformation.** Uniformly enlarging the original box and block shapes would leave them sized for a different line grid. Box drawing and blocks are fitted to the new cells and kept upright in italic faces. Full blocks span x=0..1200 and y=-480..1900; upper and lower half blocks meet at y=710. All four faces have explicit regression checks for these bounds.
4. **Family and monospace metadata must agree.** All faces share the family `Inconsolata Refined`, use the conventional Regular/Italic/Bold/Bold Italic subfamilies, and carry matching weight, italic, caret, and style-linking information. The fixed-pitch flag and average character width are set explicitly. Zero-width marks and two-/three-cell optional ligatures retain their original advance relationships. Fontconfig identifies every face as monospaced.
5. **Old hints cannot be reused after these transformations.** Original instructions are stripped and replaced with ttfautohint 1.8.4 hints. The build checks the executable version, embeds its settings, and verifies both global hint tables and actual hint instructions in representative glyphs.
6. **Stroke weight needs four separate targets.** The previous Regular's vertical stems were roughly 170 units versus Cascadia Regular's 200; Bold's vertical stems were already closer, but its horizontal strokes were thinner. The build now instances the original variable design with separate weight/width coordinates for all four styles. Width normalization restores the existing terminal cell, and height fitting preserves the previous lowercase sizes. This adjusts the source drawing throughout the family, including accents and feature glyphs.

## Stroke comparison

Measurements below are in a 2048-unit em. Each entry is **Refined / paired Cascadia**. Vertical samples cut `H` at 25% of cap height and `n` at 35% of actual x height; the horizontal sample cuts the middle of `H`. Filled spans account for overlapping contours. This measures representative stroke geometry, not every stroke or perceived weight under every renderer.

| Style | Vertical H | Vertical n | Horizontal H | Largest relative difference |
| --- | ---: | ---: | ---: | ---: |
| Regular | 209 / 200 | 206 / 212 | 197 / 190 | 4.5% |
| Italic | 211.60 / 208 | 210.18 / 215.30 | 197 / 190 | 3.7% |
| Bold | 266.50 / 264 | 268.50 / 271 | 243 / 244 | 1.0% |
| Bold Italic | 270 / 266 | 271.59 / 274.89 | 245 / 244 | 1.5% |

Upright references use the installed Cascadia Code 2102.025 variable font at weights 400 and 700. That version predates dedicated italics, so italic references use the first official italic release, Cascadia Code Italic 2105.024 at weights 400 and 700. Its upright `H`/`n` stroke samples match 2102.025. Source checksums, release archive provenance, axes, and expected measurements are pinned in [reference/weights.json](../reference/weights.json). When the local reference files are present, verification also checks their hashes and remeasures their actual outlines.

Source coordinates are `wght=635,wdth=119` (Regular), `635,116` (Italic), `840,117` (Bold), and `855,117` (Bold Italic). Final weight metadata and CSS remain 400/700. The four paired specimens at 16 and 24 pixels were visually inspected in [stroke-comparison.png](stroke-comparison.png), along with the full comparison and 10–24-pixel specimens. The changes bring the strokes close to their corresponding references while retaining Inconsolata's different letterforms.

## Verification performed

- All four final fonts pass OpenType Sanitizer.
- Whole-font and individual-table checksums pass.
- All 964 original named glyphs are retained. FontForge also emits the standard `.null` and `nonmarkingreturn` control glyphs.
- All 883 source cmap entries are retained. This count includes control mappings and the original format-4 U+FFFF sentinel; display specimens omit these entries.
- All 17 source OpenType features remain available. HarfBuzz checks code, accents and combining marks, optional ligatures, alternate zero, stylistic sets, fractions, and superscripts. Feature substitutions are compared against the original fonts.
- All ASCII characters have the same 1200-unit advance. Other encoded glyph advances preserve source relationships, including zero-width marks.
- Regression checks require every style's three stroke samples to remain within 5% of its corresponding Cascadia face and preserve its previous lowercase height. Rounding is applied to source cell counts before final advance assignment to prevent 1199-unit single-cell glyphs.
- Windows ascent/descent bounds cover every encoded outline. All four faces have the same typographic and horizontal line metrics.
- Coverage specimens render through FreeType/Cairo at 10, 12, 14, 16, 18, 24, and 32 pixels without tool errors.
- The comparison and small-size PNGs were visually inspected for relative size, weight separation, italic direction, accent placement, ambiguous characters, punctuation, and terminal symbols.
- The documented local bootstrap and repeat-build checks are exercised before committing. Detailed output hashes and validation results accompany the fonts.

## Practical limits

The italic designs are mechanically derived 12-degree obliques. They do not introduce separately drawn cursive forms.

The PNG specimens use FreeType/Cairo, not Windows Terminal's DirectWrite renderer. Exact Windows appearance still needs a visual check after installation on the target display. The hint settings include explicit GDI and DirectWrite ClearType modes, but the images do not constitute a native Windows rendering test.

At fractional pixel line heights, the Cairo specimen can show faint seams between adjacent block rows or box segments. The Cascadia reference shows the same rendering behavior. Glyph metrics and block boundaries are checked in font units; the terminal renderer controls final pixel placement.

The inspected 1.100 specimens showed no additional defect that required manual glyph redrawing. At 10 pixels, the small number of available pixels still limits detail; hinting cannot remove that physical limit.

Original character coverage is preserved. Unsupported scripts and symbols continue to depend on the application's fallback fonts.

## Web font follow-up

All four TTFs and all eight web fonts were regenerated for version 1.100 and remain tracked in Git. The separate `webfonts/` folder contains each face in WOFF and WOFF2, a four-face family stylesheet, an HTML usage example, and the license.

All eight compressed fonts pass OpenType Sanitizer. For every one of the 966 glyphs in each file, decoded geometry, advances, and glyph hint instructions match the source TTF. Other font tables, including features, names, license metadata, and global hint programs, are preserved. WOFF2 may re-encode the outline and location tables and update the head table as part of compression; the decoded geometry and instructions are checked explicitly.

The stylesheet uses weight 400 for Regular/Italic and 700 for Bold/Bold Italic, combined with the CSS styles `normal` and `italic`. All four rules share the family `Inconsolata Refined` and provide WOFF2 followed by WOFF.

The example was tested in Chromium 153.0.8010.12 at 1280×1000 and 375×900. Browser font-loading APIs confirmed all four real faces loaded with their expected descriptors and equal character advances. Blocking WOFF2 requests confirmed successful loading of all four WOFF fallbacks. The size slider works, mobile layout has no horizontal page overflow, and both runs reported no font-decoding or page-script errors. Desktop and mobile screenshots were visually inspected. These checks cover Chromium; Firefox and Safari were not tested.

See [web-validation.json](web-validation.json), [web-browser-validation.json](web-browser-validation.json), and [web-example.png](web-example.png). The browser report records the hashes of the exact font files it tested.
