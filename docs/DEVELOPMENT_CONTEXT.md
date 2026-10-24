# Development context

Updated October 25, 2026. Read before changing fonts or the pipeline. [README.md](../README.md) covers installation; [REVIEW.md](REVIEW.md) explains measurements and limits. Keep this handoff current.

## Requirements and release state

- Family **Inconsolata Refined**, font version **1.600**, npm **1.6.0**. Four TTFs and eight WOFF/WOFF2 files are generated. Desktop/web-format, complete-glyph/spacing, preview, browser, pixel sizing, and isolated reproducibility checks passed. Exhaustive compiled native raster validation also passed with zero flags across **1,331,968 glyph cases and 5,504 header cases**. All four style checkpoints were independently completed and combined.
- The latest user request **supersedes the earlier Iosevka weight target**: enlarge the narrow proportions a little, and match **Cascadia Code stroke thickness separately for all four styles**. The chosen enlargement is **8%** from 1.500. Preserve recognizable Inconsolata forms; 1% is a soft preference, never a reason to redraw characters into another family.
- Always build from **original Inconsolata**, never previous refined binaries. Preserve every original glyph, cmap mapping, feature, mark, and cell-count relationship, including unencoded alternates/ligatures. Review all glyphs; avoid manually selected s/f corrections.
- Stroke balance is addressed in both original outline geometry and fresh hinting. Do not treat hinting as the sole cause. Reference metadata is guidance requiring independent checks.
- Current 1.600 checks use 1000 UPM, 540-unit cells and 1350-unit natural lines. Root AGENTS.md and CLAUDE.md point here.

## Deliverables and sources

- Exactly four tracked TTFs in fonts/: **Regular, Italic, Bold, Bold Italic**. Eight tracked WOFF/WOFF2 files, family CSS, example HTML, and license in webfonts/.
- One family, finished weights **400/700**, CSS styles **normal/italic**. Source weight-axis values are independent of finished style metadata.
- Retain all **964 original named glyphs**, **883 original cmap entries**, and **17 feature tags**. Outputs contain **968 glyphs and 885 cmap entries**, including two standard generated empty controls and the two one-cell sort triangles.
- [upstream/sources.json](../upstream/sources.json) pins original Inconsolata **3.100**, revision fc1fc21081558b39a2db43bfd9b65bf9acb50701, compressed source checksums, and **ttfautohint 1.8.4**, verified latest stable October 24, 2026. Only four final .ttf files are tracked; original inputs are compressed in upstream/inconsolata/.
- Release timestamps are fixed to **2026-10-24T00:00:00+08:00** for reproducibility. Update version/date deliberately on later releases.

## Reference roles and calibration

- **Stroke reference:** ignored local reference/CascadiaCode.ttf, version **2102.025**, matching /mnt/c/Windows/Fonts/CascadiaCode.ttf; reference/CascadiaCodeItalic.ttf is the recorded **2105.024** companion. Select wght **400/700** for corresponding styles. [weights.json](../reference/weights.json) pins hashes, versions, axes, measured stems and targets.
- **Proportions/spacing template:** installed **Iosevka 33.3.5**, ignored reference/Iosevka-Regular.ttc and Iosevka-Bold.ttc. Original installation is /mnt/c/Users/yunlingzhu/AppData/Local/Microsoft/Windows/Fonts/SGr-Iosevka-Regular.ttc and Bold. Upright face **0**, italic face **4**, family exactly Iosevka. These are now spacingReferences in weights.json, not the weight target.
- [metrics.json](../reference/metrics.json) records final enlarged dimensions and sizeScale 1.08. Its Iosevka font/version fields identify the proportional template. Do not mistake them for the current stroke target or unscaled reference metrics.
- Ordinary shipping builds need recorded settings and original Inconsolata, without reference binaries/network. Calibration needs both reference roles; previews/native pixel comparisons need Cascadia. referenceFace in lib.mjs supports TTC faces and variable TTF axes. Cross-family audit profiles normalize the reference UPM before comparing.

| Style | Source wght | Source wdth | Largest H/n calibration-stem difference from Cascadia |
| --- | ---: | ---: | ---: |
| Regular | 580 | 95 | 3.88% |
| Italic | 590 | 92 | 2.82% |
| Bold | 820 | 89 | 1.38% |
| Bold Italic | 820 | 89 | 1.95% |

These are three stem/crossbar samples, not bounds on all strokes. Every original glyph has its own geometric audit. The native sizing comparison covers **738 upright / 739 italic shared printable characters**, seven sizes and four phases, **248,136 rasterizations** total. 1.500 already had similar aggregate height and taller plain capitals than installed Cascadia; the new increase addresses optical presence, not literal equal cross-family heights. At 16 px, new ink area relative to Cascadia is 105.6%/109.2%/101.9%/102.0%; alpha area is not a universal stroke or readability measure.

## Shared geometry and spacing

- UPM **1000**, cell **540**, six equal whitespace advances, x height **562**, capitals **794**, letter descender **−232**, accents **−297..1031**. Whole-unit rounding preserves the former proportions within one font unit. A shared monotonic vertical map fits baseline, lowercase, capitals, descenders, and accents.
- hhea **1042/−232/76**; typo **1042/−308/0**; Win **1042/308**. Both layout routes give **1350-unit** lines. Full blocks fill x=0..540, y=−308..1042; halves meet at y=367.
- Italics remain **9° obliques**. U+2500–U+259F artwork stays upright. Caret rise/run **1000/158** follows the actual slant independently. Underline **−54/54**; strikeout **286/55**.
- Unlink composites before transforms. Preserve original zero-/one-/two-/three-cell relationships. All original glyph and triangle advances grow proportionally. Generated empty controls retain their em-based advances: nonmarkingreturn stays **333**, not 360; these are not printable source glyphs.
- FontForge nonlinear fitting requires cubic contours. Its evaluator crashes on unary-negative constants; spacing.mjs uses binary subtraction and composed hinges.
- Thicker stems need adjusted counter targets; targetSpacing is distinct from the raw Cascadia referenceSpacing. Verify whitespace, ink bearings, counters, scanline pair clearance and mark placement independently.

## Generic outline balance

- refine.pe saves corresponding original and resized **cubic** SFDs. outline-balance.mjs measures compatible opposing boundaries along local normals. Intended width is source width × abs(det(A)) / length(A × source unit tangent); A contains the calibrated horizontal/lowercase scale and italic shear.
- Compensate extra distortion from the height map while retaining original stroke contrast. Bounds: 20% of the reference vertical stem and 30% of intended local width. Counter contours remain fixed; outer boundaries provide compensation. Preserve straight stems and smooth tangent joins.
- Candidate strengths 1/.75/.5/.25 use a common acceptance rule: improved normal-width error, protected error tail, at least 98% comparable samples, no new non-extrema contour warnings, valid line bounds and unchanged advances. Names only select detailed report examples.
- All **964 source glyphs/style** are reviewed. Retained compensations: **670/611/607/533**. Regular f minimum sampled width improves **67.94 → 85.40** in cubic geometry. [outline-review.json](outline-review.json) records every glyph; these are source-relative metrics, not universal Cascadia errors.
- Native acceptance rejected **28** proposals (**6/3/8/11**), stored as generated data in [outline-native-limits.json](../reference/outline-native-limits.json). Rejected glyphs retain the uncompensated resized source. Never hand-author exception names.
- export-outlines.pe returns to quadratic TTF. transform.mjs repairs only new intersection/direction warnings and checks filled geometry. Avoid blanket RemoveOverlap: it perturbs unrelated curves.

## Geometry reference, hinting and bounds

- native-baseline.mjs independently rebuilds an **uncompensated, unhinted original-source resize at the same new axes and dimensions**. Native geometry/detail checks use this neutral reference. Its glyph IDs, advances, and byte hash are verified again in compiled testing.
- This reference matters because deliberate weight/size changes alter tiny pixel topology. Do not require the old lighter design's exact subpixel components; preserve resolvable source details against the same new design. **1.400 (2b83b5cca96a41efab1b07d0c74905e429d02dda)** remains a historical visual/ink comparator. **1.500 (4cfd441)** is the size comparator. Neither is a shipping input.
- Fresh **ttfautohint 1.8.4**, range **8–50**, limit **200**, x-height increase **14**, **qsq**, Windows compatibility, detailed info and TTFA. Options are centralized in lib.mjs. [hinting.json](../reference/hinting.json): policy **3**, selection algorithm **7**.
- hint-selection.mjs chooses natural/quantized fitting by local multiscale ink distribution, density, contrast, phase variation and detail retention. Strong fitting is reserved for preservation: **8 glyph-size choices**, 2/3/1/2 by style. Fitting review covers **6,662,936 candidate rasterizations**; its statistics precede the final bounds safeguard and are proxies, not readability scores.
- Internal ttfautohint CVT[3] ABI is guarded: **−100 natural / 0 quantized / 100 strong**. Mode guards restore quantized state and clear a new CVT flag after each glyph. Remaining GDI strong/natural renderer paths retain their original behavior. Tool upgrades require reviewing this ABI and recalibrating.
- hint-bounds.mjs checks every hinted glyph. Text displacement budget is **2 px + PPEM/16**; cell artwork keeps **1.51 px**. Displaced programs and glyphs whose three fitting modes lose source details can be bypassed only after direct rendering passes all sizes/phases for bounds, visibility and source details.
- Final generated direct fallbacks: **3/5/2/5**. [hint-bounds.json](hint-bounds.json) records causes, IDs, failing sizes and source-program hashes. Original geometry/advances remain exact. Names identify measured results, never policy decisions.
- Text programs stay removed from U+2500–U+259F. Constructed triangles remain upright and directly rendered: cell **540**, x=65..475, y=157..632, borders adjusted from corresponding stroke targets. Header counters and neighboring pixels are separately checked.
- ink-profile.mjs uses filled union paths at **256 px/em**, with glyph-relative canvas bounds rather than hard-coded old line metrics. Counter resolvability is approximately **2 px** inscribed diameter; part area **0.5 px²**, component gap **1 px**, with **35%/50%/65%** coverage sweeps. Smaller details are diagnostic/score terms.
- Native report transport uses UTF-8 before Base64 so non-Latin glyph text is safe.

## Workflow and verification

Node 22+. All helpers are **Node.js**; Python is only the established FontTools CLI. Toolchain: FontTools **4.29.1**, recorded FontForge, ttfautohint **1.8.4**. Bootstrap is unprivileged Debian/Ubuntu x86-64/WSL, no sudo. Overrides: PYTHON3, FONTFORGE, TTFAUTOHINT, HB_SHAPE, HB_VIEW, OTS_SANITIZE, CHROMIUM, WINDOWS_CHROMIUM.

    npm ci --ignore-scripts
    npm run bootstrap
    npm run build
    npm test
    npm run preview
    npm run test:browser
    npm run test:raster
    npm run test:size

- After changing geometry, source axes or autohinter inputs: **npm run calibrate:hinting -- --reset-outline-safety**, then build and validate. Use a unique OS temporary input directory to retain diagnostics when investigating: node scripts/build.mjs --hint-inputs=<directory>; node scripts/calibrate-hinting.mjs --inputs=<directory>. Remove owned inputs after completion.
- npm run calibrate searches source axes and rounded native candidates, then checks every glyph in finalists. Results save after each style; **-- --resume** reuses only completed styles with matching input fingerprints. FontForge commands have **30-second timeouts**, and **1 GiB address-space limits** on Linux with prlimit, preventing the runaway candidate that previously forced a WSL restart.
- npm test checks metadata, all original names/features/coverage, advances/bounds, representative stems/bearings/counters, combining marks, sanitization, seven Linux sizes, every original glyph, and **18,755 spacing pairs/style**. All 25 marks are attached to 10 digits plus alternate zero: **275 cases/style**.
- Browser tests load real WOFF2 and forced WOFF, verify all family/emphasis faces, **0.54 em cells / 1.35 em lines**, mobile demo, slider and the **964-glyph** viewer. Viewer bounds come from audit metrics, not old constants.
- Native compiled testing supports resumable, checksum-verified style checkpoints. Use a unique OS temporary directory for the current build: node scripts/check-raster.mjs --checkpoint-dir=<directory> --style=Regular, then Italic, Bold, and BoldItalic. A complete public report is written only when all four pass; caches verify font/code/policy fingerprints and result/image hashes. Do not reuse a checkpoint directory for unrelated work.
- Native compiled testing covers all **968 glyphs/style** at every integer **8–50 px** and eight phases: expected **1,331,968 glyph cases + 5,504 header cases**. Private-use probes include unencoded glyphs. Compiled pixels must match independent fitting candidates; direct fallbacks must match direct geometry. Check details, local ink, visibility, bounds, curve balance and headers.
- npm run test:size compares every shared printable character with corresponding static Cascadia weights and 1.500 at seven sizes/four phases. All 968 glyph advances are checked, including unchanged em-based generated controls.
- [reproducibility.json](reproducibility.json) verifies an isolated original-source rebuild reproduces all **12 font binaries byte for byte**, without local reference binaries.
- Keep all report hashes current after changes: desktop, web, glyph audit, browser, native raster, size, outline, hint review, and bounds. Do not change fonts after verification without rebuilding/rechecking affected outputs.
- Actual Windows installation and Terminal visual approval remain manual. Browser pixels are not exact Terminal equivalence. Finite checks cannot guarantee universal bug-free rendering; tall/stacked combining sequences may overhang natural lines, with bounds recorded.

## Files and Git

Core: scripts/build.mjs, refine.pe, transform.mjs, outline-balance.mjs, export-outlines.pe, marks.mjs, hinting.mjs, hint-selection.mjs, calibrate-hinting.mjs, native-baseline.mjs, symbols.mjs, spacing.mjs, lib.mjs. Manifests: fonts/build-info.json and webfonts/build-info.json. [REVIEW.md](REVIEW.md) links evidence and images.

- One agent unless explicitly requested otherwise. Use existing tools and Node helpers. Disposable artifacts go in unique OS temporary directories and must be cleaned.
- Keep commentary visible about every 20–30 seconds with resumable commands and short waits. Bound network fetches; use the existing proxy configuration once after direct failure without printing credentials.
- **Staging, committing and pushing are authorized.** master tracks origin/master; SSH remote **git@github.com:yunlingz/inconsolata-refined.git**. Use short imperative commit subjects and preserve unrelated edits.
- Before publication: exactly four tracked TTFs/eight web fonts, matching report hashes, valid local links, clean staged whitespace, reproducibility, all required checks, and no owned temporary server/browser remaining.
- WSL termination can leave Windows browser children. Inspect and stop only processes whose command lines contain the exact owned temporary profile path before removing that directory; never terminate unrelated Chrome sessions.
- The 1.600 review inputs, checkpoints, and isolated rebuild workspace were disposable. Retain the tracked reports and create a new unique OS temporary directory for future work.
