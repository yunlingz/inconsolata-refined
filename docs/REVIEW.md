# Font review

Reviewed October 24, 2026. Scope: Inconsolata Refined **1.500**, four TTFs and eight web fonts, all original glyphs, and the two one-cell sort symbols. The review separates source geometry, resizing, hint fitting, and actual rendered pixels.

## Size and overall weight

The reference remains the installed **Iosevka 33.3.5**, with upright face 0 and italic face 4 of the corresponding Regular/Bold collections. Each output starts from the original Inconsolata 3.100 variable source. No Iosevka outlines or layout tables are copied.

The x height is **520**, capitals **735**, cell/word space **500**, and natural line height **1250**, in a 1000-unit em. Original names, coverage, advances, marks, and 17 feature tags remain. There are 968 output glyphs and 885 cmap entries.

The H/n calibration is unchanged. Values below are **refined / Iosevka**:

| Style | Vertical H | Vertical n | Horizontal H | Largest difference |
| --- | ---: | ---: | ---: | ---: |
| Regular | 80.50 / 78.00 | 75.50 / 78.00 | 68.00 / 70.00 | 3.21% |
| Italic | 80.68 / 79.00 | 77.15 / 79.31 | 70.00 / 70.00 | 2.72% |
| Bold | 112.00 / 111.00 | 110.00 / 111.00 | 97.00 / 96.00 | 1.04% |
| Bold Italic | 113.30 / 113.00 | 113.26 / 112.78 | 96.00 / 96.00 | 0.42% |

These are representative filled-span measurements, not a bound on every stroke in different typefaces. All original glyphs also receive their own size, bearing, spacing, and scanline audit; 880 printable source characters have paired Iosevka profiles.

## Shared geometric correction

The earlier height fit uses different slopes around the baseline, x height, capitals, and accents. Above capital height its compression can thin a curved stroke even before hinting. The upper hook of Regular f had a minimum sampled perpendicular width of **41.18 units** in the resized cubic outline; the source-aware correction raises that minimum to **60.35 units** while keeping the common stem calibration.

[outline-balance.mjs](../scripts/outline-balance.mjs) compares corresponding original and resized cubic curves. It measures a filled stroke along the local normal, accepting a nearby opposing boundary with a compatible direction. The intended width preserves the original stroke under the common affine stem scale:

    intended perpendicular width = original width × |det(A)| / |A × original unit tangent|

A contains the existing horizontal scale, lowercase vertical scale, and the italic shear when applicable. The correction removes the extra weight distortion introduced by the shared height fit; it does not force every stroke or character to have an identical thickness.

Normal displacements are bounded. Counter contours remain fixed; an opposing outer edge supplies compensation instead of consuming a narrow hole. Straight stems remain straight and smooth joins retain tangent continuity. Candidate strengths are evaluated by the same rule for every glyph. A candidate needs improved source-relative width error, no material increase in the upper error tail, at least 98% comparable sample retention, valid contours, preserved advances, and valid line bounds. Unsafe proposals retain the existing resized outline. There are no character-name decisions in this algorithm.

| Style | Original glyphs reviewed | Geometric corrections retained | Mean absolute log-width error, before → after |
| --- | ---: | ---: | ---: |
| Regular | 964 | 669 | 0.0695 → 0.0283 |
| Italic | 964 | 650 | 0.0737 → 0.0355 |
| Bold | 964 | 640 | 0.0730 → 0.0370 |
| Bold Italic | 964 | 568 | 0.0810 → 0.0478 |

The last column uses valid normal-ray samples in cubic geometry before quadratic export. It is a unitless source-relative statistic, not an error against Iosevka, a worst-stroke bound, or a readability score. Quadratic export and cleanup receive separate filled-shape and native rendering checks.

Detailed records for every original glyph are in [outline-review.json](outline-review.json). The [unhinted SVG comparison](outline-comparison.svg) and [PNG](outline-comparison.png) show the geometric result without font hinting.

## Native geometry acceptance

Continuous contour validity alone cannot predict pixel behavior. The calibration therefore checks each geometric proposal in native Windows Chromium over **8–50 px and eight horizontal phases**, trying natural, quantized, and strong fitting.

The acceptance test uses the high-resolution filled union, rather than assuming each outer contour is a disconnected component. It distinguishes resolvable features from subpixel details:

- A counter is a hard constraint when its approximate inscribed diameter reaches **2 px**.
- Component regions need at least **0.5 px²** of area; regions separated by less than **1 px** form an unresolved cluster.
- Resolvable counters are checked at middle coverage and through a 35%/50%/65% threshold sweep.
- Separate ink cores can remain visible at a higher threshold even when their antialiased halos touch. Component separation is checked through the sweep.
- Smaller holes, marks, and gray-mask changes remain fitting diagnostics and score terms. Their exact binary topology is not a visual invariant.

The completed acceptance pass retained the resized source for **23** otherwise valid proposals: **2 Regular, 5 Italic, 7 Bold, and 9 Bold Italic**. These generated constraints are recorded in [outline-native-limits.json](../reference/outline-native-limits.json). They are measured outcomes, not manually chosen letter exceptions. The rebuilt geometry passed the acceptance pass in every style.

## Generic hint fitting

All faces retain fresh **ttfautohint 1.8.4**, base mode qsq, range 8–50, limit 200, x-height increase 14, and Windows compatibility. The 1.400 s/S-only rule has been replaced by [hint-selection.mjs](../scripts/hint-selection.mjs).

The same selection function considers every glyph and size. It prefers natural or quantized fitting, scoring multiscale local ink distribution against the source-balanced outline, density, contrast, phase variation, and small-detail retention. Strong fitting is used only when the gentler modes fail the resolvable-detail constraints. The generated policy contains **seven** strong glyph-size choices across the whole family; GDI's existing strong renderer mode retains its original behavior.

The native fitting review includes **5,327,872 candidate rasterizations** across all four faces. Aggregate results for the autohinted text/mark corpus, before the final bounds safeguard below:

| Style | Local ink-distribution score, before → after | Filled ink relative to 1.400 |
| --- | ---: | ---: |
| Regular | 0.15528 → 0.14829 | 100.04% |
| Italic | 0.14821 → 0.14192 | 99.94% |
| Bold | 0.13185 → 0.12607 | 99.59% |
| Bold Italic | 0.12420 → 0.11830 | 99.60% |

Lower scores indicate closer agreement with the selected outline under this proxy. Some glyph-size cases score worse while aggregate scores improve; the report records both. Total ink is not perceived darkness, and neither quantity is a universal readability measure. The output preserves the overall weight level while addressing local balance.

The [complete fitting report](hinting-review.json) and [candidate sheets](hinting-candidates.png) record the measured choices. [hinting.mjs](../scripts/hinting.mjs) compiles them into balanced per-glyph mode guards, preserving the reviewed geometry and advances exactly. It checks ttfautohint 1.8.4's internal CVT[3] mode ABI and fingerprints every base hint program. The extra CVT flag is restored after each glyph. Tool upgrades require reviewing this ABI and recalibrating.

## Hint displacement safeguard

Local ink profiles normalize the glyph box, so they cannot alone detect a whole glyph shifted away from its baseline. The compiled review caught this in Italic integral: at 32 px, its hinted image moved about nine pixels upward even though its outline and internal ink distribution remained valid.

[hint-bounds.mjs](../scripts/hint-bounds.mjs) therefore checks every hinted glyph at all fitted sizes and phases against its outline bounds. The allowance is **2 px + PPEM/16** for raster rounding and proportional fitting: **4 px at 32 PPEM**, matching the earlier release's bound. Cell artwork keeps its tighter 1.51 px rule.

If a program exceeds that budget, the same rule requires direct rasterization to preserve bounds, visibility, resolvable counters, and separate ink cores at every tested size before omitting the program. This review bypassed three programs: integral in Regular and Italic, and U+1E1C in Bold Italic. The [bounds report](hint-bounds.json) records each measured case and maximum deviations. No glyph name selects this decision. All other source hint programs remain fingerprinted; the omitted source programs have their own recorded hashes. GDI's mode is unchanged for glyphs that retain hint programs.

## Compiled desktop and web verification

The release checks metadata, naming, all original glyphs/features/coverage, actual hint programs, quadratic contours, **18,755 spacing pairs per style**, mark placement, sanitization, and seven Linux rendering sizes. All WOFF/WOFF2 faces must retain every TTF outline, advance, hint instruction, layout table, and style metric.

The native compiled-font test covers **1,331,968 glyph cases**: all 968 output glyphs, all four styles, 43 integer sizes, and eight horizontal phases. Each compiled-policy image must match the independent fixed-mode candidate, including direct rendering for omitted programs. It also measures local ink for every glyph, tests resolvable detail preservation, disappearance, clipping, bounds at every size, s/S balance at the previously affected sizes, and both one-cell htop sort directions on dark and bright backgrounds.

The final desktop, web-format, complete-glyph, preview, browser, and native Windows checks passed. Native verification reported zero flagged cases across the glyph tests and **5,504 header cases**. An isolated rebuild from the original sources reproduced all four TTFs and eight WOFF/WOFF2 files byte for byte.

[Native comparisons](native-comparison.png), [native pixel results](native-raster-validation.json), [desktop results](validation.json), [web results](web-validation.json), [complete glyph audit](glyph-audit.json), and [browser results](web-browser-validation.json) contain the evidence and font hashes. The browser checks load all four real WOFF2 faces and forced WOFF fallbacks, validate family selection and natural spacing, and inspect the complete glyph viewer and website demo.

## Terminal artwork and sort symbols

The earlier repair to U+2500–U+259F remains: text-hint programs are removed from cell-fitted terminal artwork because they collapsed or inverted its spans on Windows. The new geometric compensation skips these glyphs.

Original Inconsolata lacks U+25B3/U+25BD, while the installed Iosevka supplies two-cell forms. htop 3.0.5 replaces one trailing space with its sort indicator, so these forms can crowd the next column. The [existing one-cell triangles](../scripts/symbols.mjs) remain unchanged: advance 500, x=60–440, y=145–585, 60/80-unit borders, upright in all styles, and direct rasterization. Their counters and adjacent header pixels are tested separately.

## Limits

Finite glyph, outline, and raster checks do not prove universally bug-free rendering. The pixel measurements are native Windows browser tests, not exact Windows Terminal equivalence; application raster settings and display scaling can differ. Review the actual installed fonts in Terminal after replacing all four TTFs and restarting it.

Very tall or stacked combining sequences can overhang the natural line box. Their bounds remain recorded in desktop validation. Inherited source contour advisories and quadratic missing-extrema notices are retained; new non-extrema outline errors are rejected.
