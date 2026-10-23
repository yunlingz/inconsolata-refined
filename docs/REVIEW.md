# Font review

Reviewed October 24, 2026. Scope: the four generated Inconsolata Refined 1.000 TTFs, their source glyphs, small-size specimens, shaping behavior, hint bytecode, metrics, and family metadata.

## Findings resolved

1. **The original is smaller at the same requested size.** The original regular x height is 0.457 em and its cell is 0.5 em. The Cascadia reference is 0.51758 em and 0.58594 em. The refined outlines are enlarged uniformly, and additional side bearings produce the reference cell width. X height, cell width, and line height now match the reference; capital height stays approximately 1.8% higher to preserve the original letter proportions.
2. **Exported height metadata was stale after outline scaling.** FontForge kept the intermediate x-height and cap-height values even though the outlines had grown. The final build derives both fields from the actual `x` and `H` outlines and recomputes every affected checksum. Regression checks compare metadata with geometry for all four styles.
3. **Terminal symbols need a separate transformation.** Uniformly enlarging the original box and block shapes would leave them sized for a different line grid. Box drawing and blocks are fitted to the new cells and kept upright in italic faces. Full blocks span x=0..1200 and y=-480..1900; upper and lower half blocks meet at y=710. All four faces have explicit regression checks for these bounds.
4. **Family and monospace metadata must agree.** All faces share the family `Inconsolata Refined`, use the conventional Regular/Italic/Bold/Bold Italic subfamilies, and carry matching weight, italic, caret, and style-linking information. The fixed-pitch flag and average character width are set explicitly. Zero-width marks and two-/three-cell optional ligatures retain their original advance relationships. Fontconfig identifies every face as monospaced.
5. **Old hints cannot be reused after these transformations.** Original instructions are stripped and replaced with ttfautohint 1.8.4 hints. The build checks the executable version, embeds its settings, and verifies both global hint tables and actual hint instructions in representative glyphs.

## Verification performed

- All four final fonts pass OpenType Sanitizer.
- Whole-font and individual-table checksums pass.
- All 964 original named glyphs are retained. FontForge also emits the standard `.null` and `nonmarkingreturn` control glyphs.
- All 883 source cmap entries are retained. This count includes control mappings and the original format-4 U+FFFF sentinel; display specimens omit these entries.
- All 17 source OpenType features remain available. HarfBuzz checks code, accents and combining marks, optional ligatures, alternate zero, stylistic sets, fractions, and superscripts. Feature substitutions are compared against the original fonts.
- All ASCII characters have the same 1200-unit advance. Other encoded glyph advances preserve source relationships, including zero-width marks.
- Windows ascent/descent bounds cover every encoded outline. All four faces have the same typographic and horizontal line metrics.
- Coverage specimens render through FreeType/Cairo at 10, 12, 14, 16, 18, 24, and 32 pixels without tool errors.
- The comparison and small-size PNGs were visually inspected for relative size, weight separation, italic direction, accent placement, ambiguous characters, punctuation, and terminal symbols.
- The documented local bootstrap and repeat-build checks are exercised before committing. Detailed output hashes and validation results accompany the fonts.

## Practical limits

The italic designs are mechanically derived 12-degree obliques. They do not introduce separately drawn cursive forms.

The PNG specimens use FreeType/Cairo, not Windows Terminal's DirectWrite renderer. Exact Windows appearance still needs a visual check after installation on the target display. The hint settings include explicit GDI and DirectWrite ClearType modes, but the images do not constitute a native Windows rendering test.

At fractional pixel line heights, the Cairo specimen can show faint seams between adjacent block rows or box segments. The Cascadia reference shows the same rendering behavior. Glyph metrics and block boundaries are checked in font units; the terminal renderer controls final pixel placement.

The visual review found no additional defect that justified redrawing the original letters. At 10 pixels, the small number of available pixels still limits detail; hinting cannot remove that physical limit.

Original character coverage is preserved. Unsupported scripts and symbols continue to depend on the application's fallback fonts.

## Web font follow-up

The four original TTFs remain tracked in Git and byte-for-byte unchanged. The separate `webfonts/` folder contains each face in WOFF and WOFF2, a four-face family stylesheet, an HTML usage example, and the license.

All eight compressed fonts pass OpenType Sanitizer. For every one of the 966 glyphs in each file, decoded geometry, advances, and glyph hint instructions match the source TTF. Other font tables, including features, names, license metadata, and global hint programs, are preserved. WOFF2 may re-encode the outline and location tables and update the head table as part of compression; the decoded geometry and instructions are checked explicitly.

The stylesheet uses weight 400 for Regular/Italic and 700 for Bold/Bold Italic, combined with the CSS styles `normal` and `italic`. All four rules share the family `Inconsolata Refined` and provide WOFF2 followed by WOFF.

The example was tested in Chromium 153.0.8010.12 at 1280×1000 and 375×900. Browser font-loading APIs confirmed all four real faces loaded with their expected descriptors and equal character advances. Blocking WOFF2 requests confirmed successful loading of all four WOFF fallbacks. The size slider works, mobile layout has no horizontal page overflow, and both runs reported no font-decoding or page-script errors. Desktop and mobile screenshots were visually inspected. These checks cover Chromium; Firefox and Safari were not tested.

See [web-validation.json](web-validation.json), [web-browser-validation.json](web-browser-validation.json), and [web-example.png](web-example.png). The browser report records the hashes of the exact font files it tested.
