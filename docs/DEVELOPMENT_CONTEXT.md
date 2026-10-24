# Development context

Updated October 24, 2026. Read before changing fonts or the pipeline. [README.md](../README.md) covers installation; [REVIEW.md](REVIEW.md) explains the measurements and their limits. Keep this handoff current.

## Objective and current state

- Family **Inconsolata Refined**, font version **1.500**, npm **1.5.0**. Four TTFs and eight WOFF/WOFF2 files are built. Desktop, web-format, complete-glyph, spacing, preview, browser, and compiled native raster checks passed. Native verification reported zero flagged cases across **1,331,968 glyph cases** and **5,504 header cases**. An isolated rebuild from the original sources reproduced all **12 font binaries byte for byte**.
- The user requested a **generic** correction of uneven strokes, explicitly including **original outline geometry** and hinting. Matching the corresponding Iosevka faces' overall weight remains required. Do not treat hinting as the sole cause or add hand-selected s/f exceptions.
- Always rebuild from **original Inconsolata sources**, never an earlier refined binary. Preserve recognizable Inconsolata forms, all original glyphs/features/coverage, advances, and the established size/spacing. **1% is a soft goal**, not a reason to redraw characters into another typeface.
- Treat installed Iosevka as measured guidance, not infallible data to copy. Check every original glyph in each style, including unencoded alternates/ligatures.

## Deliverables, sources, and reference

- Exactly four tracked TTFs in fonts/: **Regular, Italic, Bold, Bold Italic**.
- Eight tracked WOFF/WOFF2 files in webfonts/, one family stylesheet, example HTML, and license.
- One family, weights **400/700**, CSS **normal/italic**. The display subfamily Regular is not a CSS style keyword.
- All **964 original named glyphs**, **883 original cmap entries**, and **17 feature tags** remain. Outputs contain **968 glyphs and 885 cmap entries**: original glyphs plus two standard controls and the two one-cell sort triangles.
- [upstream/sources.json](../upstream/sources.json) pins Inconsolata **3.100**, revision fc1fc21081558b39a2db43bfd9b65bf9acb50701, compressed source checksums, and **ttfautohint 1.8.4**, verified latest stable October 24, 2026. Original variable/Regular/Bold inputs are in upstream/inconsolata/. Only the four final TTFs are tracked as .ttf files.
- Reference **Iosevka 33.3.5** is the user's installed collection: /mnt/c/Users/yunlingzhu/AppData/Local/Microsoft/Windows/Fonts/SGr-Iosevka-Regular.ttc and the corresponding Bold collection. Ignored local snapshots are reference/Iosevka-Regular.ttc and reference/Iosevka-Bold.ttc.
- Select **face 0** for Regular/Bold and **face 4** for Italic/Bold Italic, family exactly Iosevka. [weights.json](../reference/weights.json) pins versions, hashes, indices, source axes, and stem/spacing targets. [metrics.json](../reference/metrics.json) records shared metrics.
- Shipping builds need original sources and recorded settings, not reference font binaries. References are needed for paired audits/previews/native comparisons. Preview overrides: IOSEVKA_REGULAR and IOSEVKA_BOLD. Old Cascadia files are historical and unused.

| Style | Source wght | Source wdth | Largest H/n calibration-stem difference |
| --- | ---: | ---: | ---: |
| Regular | 420 | 83 | 3.21% |
| Italic | 435 | 88 | 2.72% |
| Bold | 690 | 82 | 1.04% |
| Bold Italic | 705 | 81 | 0.42% |

Source axes are separate from finished 400/700 metadata. These samples are not a bound on every visible stroke in two different designs.

## Shared sizing and metadata

- 1000 units/em, 500-unit cell, six equal whitespace advances, x height 520, capitals 735, letter descender −215. A shared monotonic vertical map fits baseline, lowercase, capitals, descenders, and accent regions.
- hhea **965/−215/70**; typo **965/−285/0**; Win ascent/descent **965/285**. Every route gives 1250-unit natural lines. Full blocks cover x=0..500, y=−285..965, halves meet at y=340.
- Italics are **9° obliques**. U+2500–U+259F artwork remains upright. Caret rise/run is 1000/158, independently calculated rather than copying the reference's inconsistent value. Underline −50/50; strikeout 265/51.
- Unlink composites before transforms. Preserve source cell counts, zero-width marks, and two-/three-cell feature advances. The horizontal fit and italic pivot remain as before.
- FontForge nonlinear transforms require cubic contours. Its evaluator crashes on unary-negative constants; [spacing.mjs](../scripts/spacing.mjs) uses binary subtraction and composed hinge expressions.
- Normalize actual x/cap metadata, fixed-pitch fields, Win/caret/decoration metrics, style flags, and checksums. Release date is fixed to **2026-10-24T00:00:00+08:00** for reproducibility. Update version/date deliberately for later releases.

## Generic outline stroke preservation

The shared height map compresses the region above capitals and can thin curved strokes before hinting. In Regular f, the minimum sampled perpendicular width in the resized cubic outline was 41.18 units; compensation raises it to 60.35 while preserving the common stem calibration.

- [refine.pe](../scripts/refine.pe) saves original and fitted **cubic** SFDs in the build's temporary directory. This gives curve correspondence before quadratic export.
- [outline-balance.mjs](../scripts/outline-balance.mjs) measures corresponding perpendicular strokes, accepting compatible opposing boundaries. Intended width is source width × abs(det(A)) / length(A × source unit tangent), where A is the established horizontal/lowercase scale plus italic shear.
- This preserves original stroke contrast under a common stem scale while correcting extra distortion from height fitting. It does not equalize every stroke or copy Iosevka letterforms.
- Normal displacements are bounded by 20% of the reference vertical stem and 30% of the intended local width. Existing counter contours stay fixed; the opposite outer edge supplies compensation. Straight stems stay straight and smooth joins retain tangent continuity.
- Candidate strengths 1/.75/.5/.25 use one acceptance rule: improved source-relative normal-width error, a protected error tail, at least 98% comparable samples, no new non-extrema contour warnings, preserved advances, and valid line bounds. Named f/s/S checks select detailed report rows only; names never select a correction.
- All **964 source glyphs/style** are reviewed. Retained geometric corrections: **669 Regular, 650 Italic, 640 Bold, 568 Bold Italic**. [outline-review.json](outline-review.json) records every glyph and valid normal-ray statistics in cubic geometry. These are source-relative metrics, not Iosevka errors or universal readability scores.
- Native acceptance may reject a geometric proposal. [outline-native-limits.json](../reference/outline-native-limits.json) is generated data, currently **23** rejections (2/5/7/9 by style). Do not hand-author a list of letter exceptions.
- [export-outlines.pe](../scripts/export-outlines.pe) returns to quadratic TTF. [transform.mjs](../scripts/transform.mjs) repairs only new intersection/direction warnings and checks filled geometry before/after cleanup. Avoid blanket RemoveOverlap: it perturbs unrelated curves. Proposals such as unsafe percent corrections retain the prior resized source before the established cleanup.
- [Unhinted SVG](outline-comparison.svg) and [PNG](outline-comparison.png) separate the geometric effect from raster hinting.

## Generic hint policy

- Generate fresh hints with pinned **ttfautohint 1.8.4**: range 8–50, limit 200, x-height increase 14, **qsq**, Windows compatibility, detailed info, TTFA table. Settings are in [lib.mjs](../scripts/lib.mjs).
- [hinting.json](../reference/hinting.json) uses **policy 3, selection algorithm 6**. [hint-selection.mjs](../scripts/hint-selection.mjs) chooses natural or quantized fitting for every glyph/size using local multiscale ink distribution, density, contrast, phase variation, and small-detail retention. Strong fitting is a fallback for resolvable details: currently **seven glyph-size choices** (0/6/1/0 by style).
- The 1.400 s/S-only rule and hand-selected letter protections are gone. The generated name/ID/range records are measurement results.
- [hinting.mjs](../scripts/hinting.mjs) uses ttfautohint **1.8.4's internal CVT[3] ABI**: −100 natural / 0 quantized / 100 strong. Check version/base initialization before use. Balanced entry/exit programs restore quantized mode and clear a new CVT flag; GDI's existing strong renderer mode and natural renderers keep their behavior.
- Every source-derived geometry and every base hint program is fingerprinted. A build fails if it does not match the calibrated geometry and fpgm/prep/cvt/glyph programs. Hint refinement preserves that reviewed geometry and all advances exactly. Tool upgrades require reviewing this ABI and recalibrating.
- [hint-bounds.mjs](../scripts/hint-bounds.mjs) additionally checks every hinted glyph at every fitted size/phase. Text fitting permits 2 px + PPEM/16 (4 px at 32 PPEM); cell artwork retains 1.51 px. A program that exceeds this budget is omitted only after direct rendering passes all-size bounds, visibility, and resolvable-detail checks. Current generated fallbacks: Regular/Italic integral and Bold Italic U+1E1C. Names never select the rule. Omitted source programs have recorded hashes; the remaining programs retain their combined fingerprint. GDI's normal mode is preserved for glyphs retaining hint programs.
- U+2500–U+259F text hint programs are removed: their old programs collapsed/inverted cell geometry on Windows. Two appended one-cell sort triangles also render directly.
- Earlier **1.400 commit 2b83b5cca96a41efab1b07d0c74905e429d02dda** is a comparison baseline, not a shipping build input. Unlike 1.400, this release intentionally changes outline geometry and regenerates global hint parameters. Retain glyph IDs, advances, coverage, and feature behavior, not old glyf/GPOS bytes.

## Native measurements and their interpretation

[ink-profile.mjs](../scripts/ink-profile.mjs) uses direct paths at 256 px/em to measure the filled union. Raw outer-contour counts are not connected components.

- Review all integer **8–50 px** and phases **0/.125/.25/.375/.5/.625/.75/.875**.
- Resolvable counters have approximately **2 px inscribed diameter**. Component regions need **0.5 px²**, with regions separated by less than **1 px** grouped into unresolved clusters.
- Hard checks preserve resolvable middle-coverage counters and distinct ink cores through a **35%/50%/65%** threshold sweep. Halos can touch while two bright dots remain distinct; do not require identical connectivity at every threshold.
- Smaller details contribute to scores/diagnostics; exact subpixel binary topology is not a valid universal invariant. Do not weaken meaningful outline or visibility checks to force a result.
- Native geometry acceptance rebuilds rejected proposals before final fitting. [outline-safety-page.mjs](../scripts/outline-safety-page.mjs), [hint-review-page.mjs](../scripts/hint-review-page.mjs), and [calibrate-hinting.mjs](../scripts/calibrate-hinting.mjs) implement the review.
- The fitting review covers **5,327,872 candidate rasterizations**. Filled ink relative to 1.400 for the autohinted corpus is **100.04%, 99.94%, 99.59%, 99.60%**. Average local distortion scores improve, while some glyph-size cases worsen. These are proxies, not readability scores.
- [check-raster.mjs](../scripts/check-raster.mjs) compares compiled mode pixels with independent fixed-mode candidates, tests every output glyph, local ink, resolvable detail, bounds, clipping/disappearance, s/S regressions, and one-cell headers. All 968 glyphs/style, including unencoded glyphs and controls, use private-use cmap probes. Empty glyph zero aliases an identical nonzero empty glyph to prevent fallback.
- Expected compiled coverage: **1,331,968 glyph cases** plus **5,504 header cases**. Each glyph case also checks its compiled mode against the corresponding fixed candidate. Web conversion must preserve every outline and hint exactly.
- Windows user agent is HeadlessChrome **155.0.0.0** (reduced version); Linux browser **153.0.8010.12**. Browser rendering is not Windows Terminal equivalence. The user must reinstall all four TTFs/restart Terminal for actual visual approval. No fonts are installed or application settings changed automatically.

## Build, calibration, and checks

Node 22+. Bootstrap is unprivileged Debian/Ubuntu x86-64/WSL, no sudo. Python is used only for the established FontTools CLI; custom helpers are **Node.js**. This toolchain uses FontTools **4.29.1** from apt and the recorded FontForge build. Overrides: PYTHON3, FONTFORGE, TTFAUTOHINT, HB_SHAPE, HB_VIEW, OTS_SANITIZE, CHROMIUM, WINDOWS_CHROMIUM.

    npm ci --ignore-scripts
    npm run bootstrap
    npm run build
    npm test
    npm run preview
    npm run test:browser
    npm run test:raster

- Normal builds use recorded settings and original sources, without a Windows browser.
- After changing geometric fit/axes/autohinter inputs, run **npm run calibrate:hinting -- --reset-outline-safety**, then build and validate again. This needs WSL, Windows Chrome/Edge, and the pinned 1.400 Git history.
- Calibration prepares original-source inputs, performs native geometry acceptance, rebuilds rejected proposals, and chooses fitting modes. Debug reuse: node scripts/build.mjs --hint-inputs=<unique-OS-temp-directory>, then node scripts/calibrate-hinting.mjs --inputs=<directory>. Delete owned temporary inputs after use.
- Calibration ends with the hint-bounds safeguard. It can be rerun against prepared original-source inputs using node scripts/hint-bounds.mjs --inputs=<directory>; then rebuild and validate. [hint-bounds.json](hint-bounds.json) records its evidence. Aggregate fitting ink scores in hinting-review.json precede this final safeguard; the compiled native report uses the actual final programs.
- npm test checks metadata, original names/features/coverage, all advances/bounds, H/n stems/counters/bearings, marks, sanitization, seven Linux sizes, every original glyph, and **18,755 spacing pairs/style**.
- All 25 combining marks are exercised on 10 digits plus alternate zero (275 pairs/style). [marks.mjs](../scripts/marks.mjs) recomputes missing digit attachment against current geometry; original letter lookups remain. Very tall/stacked sequences can overhang the natural line box; their actual bounds are recorded rather than deforming glyphs to force a fit.
- Browser checks load real WOFF2 and forced WOFF faces, verify family/emphasis and native 0.5 em cells/1.25 em lines, mobile layout, demo slider, and every viewer page. The viewer indexes **964 original glyphs**; the two new symbols have supplemental records.
- Keep reports current after font changes: [desktop](validation.json), [web](web-validation.json), [glyph audit](glyph-audit.json), [browser](web-browser-validation.json), [native raster](native-raster-validation.json), [outline review](outline-review.json), [hint review](hinting-review.json). Font hashes must match final binaries. Repeat-build hashes must match all 12 font files before publication.
- Finite checks do not prove universal bug-free rendering. Preserve source forms and disclose meaningful limits.

## Files and Git workflow

Core: build.mjs, refine.pe, transform.mjs, outline-balance.mjs, export-outlines.pe, marks.mjs, hinting.mjs, hint-selection.mjs, calibrate-hinting.mjs, symbols.mjs, spacing.mjs, lib.mjs. Generated manifests: fonts/build-info.json and webfonts/build-info.json.

- One agent unless the user explicitly requests delegation. Use existing commands and Node helpers. Disposable scripts/dependencies/artifacts belong in unique OS temporary directories and must be cleaned.
- Keep progress visible around every 20–30 seconds, with resumable commands and short waits. Bound network fetches and use the existing shell proxy configuration once on direct failures without printing credentials.
- Staging, committing, and pushing are authorized. Preserve unrelated edits. Branch **master** tracks origin/master, SSH remote **git@github.com:yunlingz/inconsolata-refined.git**. Use short imperative commit subjects.
- Before publishing, confirm exactly four TTFs/eight web fonts tracked, matching report hashes, valid local documentation links, a clean staged diff, and no temporary server/browser left.
- Root AGENTS.md and CLAUDE.md already point to this context.
