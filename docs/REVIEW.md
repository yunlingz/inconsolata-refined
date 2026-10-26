# Font review

Reviewed October 25, 2026. Inconsolata Refined **1.600** contains four TTFs and eight WOFF/WOFF2 files, rebuilt from original Inconsolata 3.100. This release enlarges the narrow proportions and changes all four stroke-weight targets to Cascadia Code.

## Nerd editions, October 26

Four additional version **1.601** TTFs use the exact family **Inconsolata Refined Nerd** and the complete pinned **Nerd Fonts 3.5.1** patcher. [Validation](nerd-validation.json) covers all **10,995 registered names**, every supplied character's **540-unit** advance, retained original glyph data/hints/metrics, metadata and sanitization. Each face contains **12,008 glyphs**, with **10,879 added characters and 161 replacements**. Every Nerd character renders at 12/24 px through FreeType/HarfBuzz. The [preview](nerd-preview.png) was visually inspected, and an [isolated rebuild](nerd-reproducibility.json) verifies all four binaries.

**Every Nerd-provided glyph wins over an overlapping base character.** This replaces U+2665 heart and all 160 U+2500–U+259F terminal glyphs. A neutral ASCII seed plus forced box-drawing patching prevents existing sets from suppressing Nerd artwork. Coverage and geometry hashes from actual patcher output verify all **11,040 supplied characters**, including every replacement. All 968 original glyph records and their global hint/layout tables remain intact for stable references, while overlapping Unicode mappings select the appended Nerd symbols. Other original characters keep their refined outlines/hints. Nerd symbols use unhinted outlines; Powerline separators retain intentional seam overlaps. Braille U+2800 and Codicons U+EC03 are intentionally blank. Base line/size metrics stay unchanged; native Windows Terminal installation remains a manual check. [Installation and licensing](../nerd-fonts/README.md) are included with the fonts.

## Size, proportions, and weight

Dimensions grow by **8%** from 1.500, with whole-unit rounding: cell/word space **540**, lowercase x height **562**, capitals **794**, letter descender **−232**, natural line **1350**, and UPM **1000**. hhea is **1042/−232/76**; typographic metrics are **1042/−308/0**; Win clipping metrics are **1042/308**. The cell-to-line ratio remains 0.4. Bearings, all six whitespace advances, mark attachment, decorations, and terminal artwork follow the new dimensions. Italics remain 9° obliques.

Iosevka 33.3.5 supplies the narrow spacing template. Cascadia Code supplies separate Regular/Italic/Bold/Bold Italic stem targets: the recorded upright 2102.025 matches the installed Windows font; the italic companion is 2105.024. References and axes are checksum-pinned in [weights.json](../reference/weights.json). No reference outlines or layout tables are copied.

| Style | Original source wght/wdth | Vertical H: output / Cascadia | Vertical n | Horizontal H | Maximum sample difference |
| --- | --- | --- | --- | --- | --- |
| Regular | 580/95 | 101.00 / 97.66 | 99.50 / 103.52 | 95.00 / 92.77 | 3.88% |
| Italic | 590/92 | 104.07 / 101.56 | 102.16 / 105.13 | 95.00 / 92.77 | 2.82% |
| Bold | 820/89 | 130.50 / 128.91 | 130.50 / 132.32 | 119.00 / 119.14 | 1.38% |
| Bold Italic | 820/89 | 131.88 / 129.88 | 131.60 / 134.23 | 119.00 / 119.14 | 1.95% |

These filled-span samples are normalized to a 1000-unit em. They are calibration evidence, not a universal error bound for every stroke in different typefaces. The 1% preference remains soft. Every original glyph receives separate outline, spacing, and filled-span checks; paired Cascadia profiles are normalized from its 2048-unit em before comparison. Counters have independent targets adjusted for the heavier stems, rather than retaining the old lighter counters unchanged.

## Actual rendered size

Native Windows measurements show that 1.500 already had similar aggregate height, and taller plain capitals, than the installed Cascadia. Its smaller optical presence chiefly came from its narrower footprint and lower ink area. This release deliberately makes that appearance larger; it does not claim identical cross-family glyph heights.

[Size measurements](size-review.json) compare all **738 upright / 739 italic shared printable characters**, seven sizes (10, 12, 14, 16, 18, 20, 24 px), four fractional positions, and three fonts: 1.500, 1.600, and the corresponding Cascadia weight. That is **248,136 rasterizations** across the family. At 16 px:

| Style | Ink area vs Cascadia, 1.500 → 1.600 | Mean rendered height vs Cascadia, 1.600 |
| --- | --- | --- |
| Regular | 82.9% → 105.6% | 103.7% |
| Italic | 84.7% → 109.2% | 105.5% |
| Bold | 85.7% → 101.9% | 102.4% |
| Bold Italic | 86.1% → 102.0% | 103.8% |

Ink is an alpha-mask sum; height/width use 10% alpha and core height uses 50%. These describe optical presence, not readability or universal stroke equality. Individual letters and pixel sizes differ. All original glyph and sort-symbol advances grow proportionally; FontForge's two generated empty controls retain their em-based advances, including the 333-unit nonmarking-return control.

## Source-based stroke balance

The shared nonlinear height fit can thin strokes around capitals and accent regions. [outline-balance.mjs](../scripts/outline-balance.mjs) compares corresponding original/resized cubic contours and targets perpendicular width under the common affine stem scale:

    intended width = original width × |det(A)| / |A × original unit tangent|

A includes the calibrated horizontal/lowercase scales and italic shear. Bounded normal displacements preserve counter contours, straight stems, smooth joins, advances, and line bounds. The same acceptance rule applies to every glyph; names select report examples only.

| Style | Original glyphs reviewed | Corrections retained | f minimum sampled width, resize → balanced |
| --- | ---: | ---: | --- |
| Regular | 964 | 670 | 67.94 → 85.40 |
| Italic | 964 | 611 | 70.15 → 79.01 |
| Bold | 964 | 607 | 98.82 → 106.87 |
| Bold Italic | 964 | 533 | 99.23 → 102.09 |

These are sampled source-relative widths in cubic geometry, not cross-family stem errors. [Every glyph's evidence](outline-review.json) and the [unhinted comparison](outline-comparison.svg) separate geometry from raster hinting. Quadratic export and overlap cleanup are checked separately.

Native acceptance rejected **28** geometric proposals (6/3/8/11 by style), retaining the uncompensated resized source. [Generated constraints](../reference/outline-native-limits.json) contain measured results, not a manually selected letter list.

## Fresh hinting and independent geometry reference

The base is pinned **ttfautohint 1.8.4**, range 8–50, limit 200, x-height increase 14, qsq, and Windows compatibility. Selection algorithm **7** evaluates every glyph and fitted size. It prefers natural/quantized fitting; eight glyph-size choices require strong fitting for detail preservation.

Changing the weight and dimensions intentionally changes tiny raster features. The feature-preservation reference is therefore a fresh, **uncompensated original-source resize at the same new axes and dimensions**, rendered without text hinting. [native-baseline.mjs](../scripts/native-baseline.mjs) rebuilds it from checksum-verified original inputs; its hash, IDs, and advances are independently checked. Historical 1.400 remains the separate visual/ink comparison, and 1.500 is the size-comparison baseline. Neither previous binary is a shipping build input.

The [fitting review](hinting-review.json) contains **6,662,936 candidate rasterizations**. Its local ink-distribution scores improve on average in each style, with some individual glyph-size scores worse. These are shape-fidelity proxies, not readability ratings. Resolvable counters use approximately 2 px inscribed diameter; components need 0.5 px² and a 1 px gap, with 35%/50%/65% coverage sweeps. Smaller details remain score terms; identical subpixel binary masks are not a universal design invariant.

The [bounds/detail safeguard](hint-bounds.json) allows 2 px + PPEM/16 of hint displacement. A displaced program, or a glyph whose three fitting modes lose source details, can be omitted only after direct rendering passes **every** tested size/phase for bounds, visibility, and source-detail retention. Final bypass counts are **3/5/2/5**; the report records names, IDs, causes, and source-program hashes. No name selects the rule. Remaining programs retain the guarded ttfautohint CVT[3] ABI and balanced mode restoration.

## Coverage, spacing, and delivery checks

All **964 original named glyphs**, **883 original cmap entries**, and **17 feature tags** remain. Each face contains **968 glyphs and 885 cmap entries**, including two generated controls and two one-cell sort triangles. Audits include unencoded alternates/ligatures, all 25 combining marks on digits and alternate zero, **18,755 spacing pairs/style**, contour validity, bounds, shaping, sanitization, and hint preservation in both web formats.

The desktop/web, complete-glyph audit, preview, and browser tests passed. Browser checks loaded real WOFF2 and forced WOFF, validated all four faces, emphasis, mobile layout, glyph viewer, and **0.54 em cells / 1.35 em natural lines**. An [isolated original-source rebuild](reproducibility.json) reproduced all **12 font binaries byte for byte**. The exhaustive compiled native raster test passed with **zero flags across 1,331,968 glyph cases and 5,504 header cases**.

[Native validation](native-raster-validation.json) tests all 968 output glyphs/style at every integer 8–50 px and eight phases, including exact compiled/fixed-mode pixel agreement, source details, visibility, bounds, curve balance, and both sort directions on dark and bright headers. Verified coverage is **1,331,968 glyph cases and 5,504 header cases**.

Terminal artwork stays upright and fills the enlarged cell; text-hint programs remain removed from U+2500–U+259F. The one-cell sort triangles grow to x=65–475, y=157–632, with borders tied to the new weight targets and direct rendering. Their counters and neighboring header pixels receive separate tests.

## Limits

Browser raster tests do not reproduce every Windows Terminal rendering setting. Install all four replacement TTFs and restart Terminal/editor for actual visual approval. Finite checks cannot prove universal bug-free rendering. Very tall or stacked combining sequences can overhang the natural line box; their shapes and actual bounds remain recorded.
