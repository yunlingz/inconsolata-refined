# Font review

Reviewed October 24, 2026. Scope: Inconsolata Refined **1.200**, all four TTFs, eight web fonts, every original glyph, paired installed Iosevka references, metadata, hinting, shaping, and browser use.

## Design decisions

- The active target is Windows-installed Iosevka 33.3.5, replacing the previous Cascadia comparison. Inputs are the original pinned Inconsolata 3.100 variable source, never the previous refined binaries.
- Preserve Inconsolata’s recognizable forms. Weight/width axes and common transforms provide the best visual balance; 1% is a soft goal. There are no individual weight redraws.
- Match x height 520, capitals 735, letter descenders −215, cell/space 500, and natural line height 1250 in a 1000-unit em. Accent regions are fitted with a shared monotonic map. All original named glyphs fit the typographic line box.
- Use 9° obliques for the italic styles. Terminal artwork stays upright and fills its own grid.

## Paired stroke calibration

The three calibration samples are filled spans through H at 25% capital height, n at 35% x height, and the H crossbar. Values below are **refined / Iosevka**, in a 1000-unit em.

| Style | Vertical H | Vertical n | Horizontal H | Largest difference |
| --- | ---: | ---: | ---: | ---: |
| Regular | 80.50 / 78.00 | 75.50 / 78.00 | 68.00 / 70.00 | 3.21% |
| Italic | 80.68 / 79.00 | 77.15 / 79.31 | 70.00 / 70.00 | 2.72% |
| Bold | 112.00 / 111.00 | 110.00 / 111.00 | 97.00 / 96.00 | 1.04% |
| Bold Italic | 113.30 / 113.00 | 113.26 / 112.78 | 96.00 / 96.00 | 0.42% |

These are representative stem measurements, not a bound on every visible stroke. Every glyph has a separate recorded scanline profile. Diagonals, curves, serifs, and different letterforms change those profiles; for example, a horizontal cut across a diagonal A leg is not its perpendicular stroke width.

## Defects and metadata corrected

1. Transforming and rounding outlines introduced small contour contacts in a few glyphs, including percent. The build compares each glyph’s FontForge validation flags with its exact original source instance and repairs only new intersection/direction warnings. Cleanup is checked against every one of the 966 output glyphs using bounds and 14 filled scanline comparisons per inked glyph. Nearby shared-width candidates resolve the Bold Italic rounding case without redrawing percent.
2. Upstream digits lack combining-mark anchors. A separate fallback lookup now positions all 25 supplied marks on default digits and the alternate zero. It precedes the upstream lookups, so original mark-to-mark stacking remains active. Every outline and advance is compared exactly before/after this metadata step. There are 275 attachment checks per style, plus a stacking regression.
3. Windows clipping metrics no longer add the previous 32-unit padding. They agree with the complete 965/−285 line box, avoiding larger spacing in applications that use those fields.
4. The italic caret slope is calculated from our 9° slant (rise 1000/run 158), independently of the installed reference’s 1000/25 values. Underline (−50/50) and strikeout (265/51) position/thickness agree with the measured reference and fit our metrics.
5. Family/style names, 400/700 weights, fixed-pitch flags, average width, actual x/capital metadata, checksums, and fresh hint bytecode are verified. Zero-width marks and multi-cell feature glyphs retain their advances.

## Complete validation

- All 964 original glyphs per style retain their named outlines; all 883 cmap entries and 17 feature tags remain. Outputs have 966 glyphs including two standard controls.
- The audit measures all glyphs, including the 81 unencoded feature/component glyphs. All 880 printable source characters have paired Iosevka profiles. Unencoded glyphs have no reliable cross-family name mapping and are reviewed as Inconsolata source derivatives.
- All 18,729 tested spacing pairs per style have positive ordinary-text clearance. The remaining overlaps all involve terminal artwork intended to meet/fill cell edges.
- Full-font FontForge checks find no new non-extrema warnings relative to the original variable instances. Existing upstream warnings remain recorded; missing extrema are advisory for these quadratic TTFs. All 12 files pass OpenType Sanitizer.
- Unicode coverage, every named-glyph advance, original feature substitutions, source licenses, hint programs, metadata, and SFNT/table checksums pass. Every glyph’s geometry, advances, and instructions survive WOFF/WOFF2 compression.
- Encoded coverage renders at 10, 12, 14, 16, 18, 24, and 32 px. Full coverage sheets, paired comparisons, small sizes, and the combining-mark matrix are provided for visual review.
- Chromium checks confirm all four real WOFF2 faces and all four forced WOFF fallbacks, natural 10 px cells/25 px lines at 20 px, emphasis, the slider, desktop/mobile layout, and the complete glyph viewer. The report records hashes of the current eight web fonts and the complete glyph audit.
- Repeat builds produced identical hashes for all four TTFs and eight web fonts.

## Limits

Standalone glyphs fit the natural line box. Some unusual bold digit/mark combinations involving U+0312, U+0328 extend above/below it; exact cases and bounds are recorded in [validation.json](validation.json). Their glyph shapes and attachment clearance are preserved. Tall or stacked combining sequences can need more application line spacing.

The new release has not been automatically tested in native Windows Terminal/DirectWrite. Earlier user approval applied to the previous Cascadia-based release. Reinstall all four current TTFs and check this release on the intended display. Chromium/FreeType results are not a substitute for that check; Firefox and Safari were not tested.

Fractional pixel placement and hint quantization can change apparent weight or create fine terminal-block seams. The glyph-unit boundaries and metrics are checked, but two different font designs/renderers cannot be made pixel-identical.

See [glyph-audit.html](glyph-audit.html), [glyph-audit.json](glyph-audit.json), [validation.json](validation.json), [web-validation.json](web-validation.json), [web-browser-validation.json](web-browser-validation.json), and [combining-marks.png](combining-marks.png).
