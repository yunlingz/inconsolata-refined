# Font review

Reviewed October 24, 2026. Scope: Inconsolata Refined **1.400**, all four TTFs, eight web fonts, every original glyph and the two added sort symbols, paired installed Iosevka references, metadata, hinting, shaping, and browser use.

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

## Curve balance corrected in 1.400

The user's 1.300 screenshots exposed a local imbalance that whole-passage brightness had missed: the curved ends of `s` grew heavier while its diagonal middle grew thinner. At 14 pt the issue disappeared; at the reported 12 pt it was visible. Native Windows tests reproduce it at 24 px inside Regular's 22–26 PPEM strengthening range, while 28 px lies outside that range. The large bitmap specimen on the original author's website has a different size and rasterization, so it is useful as a design reference rather than a direct pixel comparison.

Comparing natural, quantized, strong, and original-source renderings isolates our added strong rounding as the cause. The unchanged Regular outline's middle-to-ends vertical-cut ratio is 1.193; the 1.300 raster measured 0.741. This is a hinting distortion, not a missing stroke in the outline. A diagonal's vertical cut is naturally wider than its perpendicular stroke, so the desired ratio is not necessarily 1.

Version 1.400 retains fresh ttfautohint 1.8.4 `qsq` base programs. During the adaptive ranges, full-size `s`/`S` and all 20 supplied accented forms use **natural** stem widths. Eight (including the numerator alternate), alternate zero, and the two ordinal letters use **quantized** fitting. A regional coverage scan across the glyph set informed these choices; its ratios were diagnostic, not universal readability scores. Other suitable text retains stronger rounding at Regular/Italic 22–26 PPEM and Bold/Bold Italic 16–19 or 26–28 PPEM. Blue zones, other sizes, and existing GDI strong mode stay unchanged. Existing compact-glyph, symbol, mark, `æ`/`ǽ`, and Bold Italic `ů` protections remain.

The native regression sums normalized pixel coverage through three central columns, split into upper/middle/lower bands, then averages four quarter-pixel placements. The table shows the middle band divided by the mean of the end bands for lowercase `s`. These are vertical coverage ratios, not perpendicular stroke widths.

| Style | Size | 1.300 | 1.400 |
| --- | ---: | ---: | ---: |
| Regular | 24 px | 0.741 | 1.194 |
| Italic | 24 px | 0.837 | 1.145 |
| Bold | 18 px | 0.853 | 1.106 |
| Bold Italic | 18 px | 0.953 | 1.158 |

All **966 existing outlines, advances, and glyph IDs remain exact** relative to 1.200/1.300; GPOS/GSUB/GDEF remain byte-identical. There are no individual letter redraws. Only 27 existing glyphs per style change pixels, within the adaptive ranges. Terminal artwork retains the 1.300 repair: U+2500–U+259F renders directly from its cell-fitted outlines without the autohinter programs that collapsed or inverted its spans.

## htop sort symbols

The crowded `CPU%▽MEM%` header has a separate cause. The installed htop 3.0.5 [header code](https://github.com/htop-dev/htop/blob/3.0.5/ProcessList.c#L96) replaces a single trailing space with the [U+25B3/U+25BD sort indicator](https://github.com/htop-dev/htop/blob/3.0.5/CRT.c#L58). Original Inconsolata lacks both characters, causing Windows font fallback. The measured Iosevka reference maps them to `WWID` glyphs with **1000-unit advances and roughly 780-unit ink widths**, against its ordinary 500-unit cell. Either source can produce the overlapping appearance in the screenshots. Cascadia supplies its own one-cell triangles.

[symbols.mjs](../scripts/symbols.mjs) appends two newly constructed geometric triangles. Each has a **500-unit advance**, x bounds **60–440**, and y bounds **145–585**. They remain upright in italic styles, use 60/80-unit regular/bold borders, and render without text-hint distortion. The vertical extent was chosen after native tests caught disappearing counters in smaller bold prototypes. Their hollow centers pass the 18–32 px counter checks, and all 10–32 px cases remain visible and inside their cells. No Iosevka or Cascadia outline is copied.

All existing cmap mappings and hint programs survive this append exactly. The `hmtx` table is expanded to carry the new glyphs; every existing advance and side bearing remains unchanged. The outputs now have **968 glyphs and 885 cmap entries**. Original coverage and features remain intact.

## Native pixel validation

[Windows comparisons](native-comparison.png), [all-glyph evidence](native-raster-validation.json), and `npm run test:raster` document the release against the pinned **1.300** Git baseline. The check addresses all 968 output glyphs, including unencoded alternates/ligatures and controls, through temporary private-use cmap mappings. Empty glyph zero uses an identical nonzero empty glyph to prevent browser fallback.

All **356,224 glyph cases** pass at every integer 10–32 px size and four phases, including **355,488 before/after comparisons** for the existing glyphs. Checks cover actual RGBA identity outside the permitted scope, geometry/layout preservation, disappearance, clipping, counters, and raster bounds. New regressions test `s`/`S` band balance and **1,472** up/down header cases on dark and bright backgrounds. Header tests check one-cell advances and actual adjacent ink masks; rounded bounding boxes alone can overlap harmlessly at half-pixel cell widths. Accidentally created raster islands are not treated as required outline counters.

Whole-passage luminance remains essentially unchanged. These measurements sum sRGB-linearized text luminance, averaged over four phases, with Iosevka = 100. They combine brightness and shape area and do not measure readability.

| Style | Size | 1.300 | 1.400 |
| --- | ---: | ---: | ---: |
| Regular | 24 px | 98.23 | 98.19 |
| Italic | 24 px | 98.28 | 98.24 |
| Bold | 18 px | 96.13 | 96.12 |
| Bold Italic | 18 px | 96.61 | 96.59 |

Native Windows Chromium reports **155.0.0.0** in its reduced user agent. The report pins all four TTF and eight web-font hashes. Linux Chromium website checks use **153.0.8010.12**. Repeat builds reproduce identical hashes for all 12 font files.

## Defects and metadata corrected

1. Transforming and rounding outlines introduced small contour contacts in a few glyphs, including percent. The build compares each glyph’s FontForge validation flags with its exact original source instance and repairs only new intersection/direction warnings. Cleanup checks all 966 source-derived output glyphs, before appending the triangles, using bounds and 14 filled scanline comparisons per inked glyph. Nearby shared-width candidates resolve the Bold Italic rounding case without redrawing percent.
2. Upstream digits lack combining-mark anchors. A separate fallback lookup now positions all 25 supplied marks on default digits and the alternate zero. It precedes the upstream lookups, so original mark-to-mark stacking remains active. Every outline and advance is compared exactly before/after this metadata step. There are 275 attachment checks per style, plus a stacking regression.
3. Windows clipping metrics no longer add the previous 32-unit padding. They agree with the complete 965/−285 line box, avoiding larger spacing in applications that use those fields.
4. The italic caret slope is calculated from our 9° slant (rise 1000/run 158), independently of the installed reference’s 1000/25 values. Underline (−50/50) and strikeout (265/51) position/thickness agree with the measured reference and fit our metrics.
5. Family/style names, 400/700 weights, fixed-pitch flags, average width, actual x/capital metadata, checksums, and fresh hint bytecode are verified. Zero-width marks and multi-cell feature glyphs retain their advances.

## Complete validation

- All 964 original glyphs per style retain their named outlines; all 883 original cmap entries and 17 feature tags remain. Outputs have 968 glyphs including two standard controls and the two new sort triangles.
- The audit measures all glyphs, including the 81 unencoded feature/component glyphs. All 880 printable source characters have paired Iosevka profiles. Unencoded glyphs have no reliable cross-family name mapping and are reviewed as Inconsolata source derivatives.
- All 18,755 tested spacing pairs per style have positive ordinary-text clearance. The remaining overlaps all involve terminal artwork intended to meet/fill cell edges. The two new symbols also receive separate outline and scanline audits.
- Full-font FontForge checks find no new non-extrema warnings relative to the original variable instances. Existing upstream warnings remain recorded; missing extrema are advisory for these quadratic TTFs. All 12 files pass OpenType Sanitizer.
- Unicode coverage, every named-glyph advance, original feature substitutions, source licenses, hint programs, metadata, and SFNT/table checksums pass. Every glyph’s geometry, advances, and instructions survive WOFF/WOFF2 compression.
- Encoded coverage renders at 10, 12, 14, 16, 18, 24, and 32 px. Full coverage sheets, paired comparisons, small sizes, and the combining-mark matrix are provided for visual review.
- Chromium checks confirm all four real WOFF2 faces and all four forced WOFF fallbacks, natural 10 px cells/25 px lines at 20 px, emphasis, the slider, desktop/mobile layout, and the complete glyph viewer. The report records hashes of the current eight web fonts and the complete glyph audit.
- Repeat builds produced identical hashes for all four TTFs and eight web fonts.

## Limits

Standalone glyphs fit the natural line box. Some unusual bold digit/mark combinations involving U+0312, U+0328 extend above/below it; exact cases and bounds are recorded in [validation.json](validation.json). Their glyph shapes and attachment clearance are preserved. Tall or stacked combining sequences can need more application line spacing.

Native Windows Chromium and Linux/WSL Chromium are checked. The release still needs a manual check in Windows Terminal after installing all four current TTFs; native browser pixels do not reproduce Terminal’s renderer, contrast, or gamma settings. Earlier user approval applied to previous versions. Firefox and Safari were not tested.

Fractional pixel placement and hint quantization can change apparent weight or create fine terminal-block seams. The glyph-unit boundaries and metrics are checked, but two different font designs/renderers cannot be made pixel-identical.

See [glyph-audit.html](glyph-audit.html), [glyph-audit.json](glyph-audit.json), [validation.json](validation.json), [web-validation.json](web-validation.json), [web-browser-validation.json](web-browser-validation.json), and [combining-marks.png](combining-marks.png).
