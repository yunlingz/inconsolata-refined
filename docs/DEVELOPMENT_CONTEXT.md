# Development context

Updated October 24, 2026. Read before changing fonts or the pipeline. [README.md](../README.md) covers installation; [REVIEW.md](REVIEW.md) gives results and limits. Keep this handoff current when decisions or verified state change.

## Current objective and state

- Active family **Inconsolata Refined**, font version **1.400**, npm version **1.4.0**. Iosevka 33.3.5 remains the reference. This release corrects uneven `s`/`S` curve hinting and adds one-cell htop sort triangles, preserving all 966 existing outlines and advances from 1.200/1.300 exactly.
- Rebuild from the **original** Inconsolata source, never earlier refined fonts. Match Iosevka’s size, stroke weight, character/word spacing, vertical metrics, side bearings, and representative internal gaps across all four paired styles.
- Preserve Inconsolata’s character designs. The user explicitly made **1% a soft goal**: choose the best visual balance and do not redraw individual characters to force a number.
- Treat Iosevka as measured guidance, not infallible data to copy. Independently check every original glyph in every style, including unencoded alternates and ligatures.
- Desktop, web, full-glyph, Linux Chromium, and native Windows Chromium checks cover this release. The user's 1.300 installation revealed the curve and header issues corrected here. Windows Terminal review of 1.400 remains manual: browser rendering is not application equivalence.

## Deliverables and naming

- Exactly four tracked TTFs under `fonts/`: **Regular, Italic, Bold, Bold Italic**.
- Same faces as eight tracked WOFF/WOFF2 files under `webfonts/`, with CSS, example HTML, and license.
- One family `Inconsolata Refined`, weight metadata/CSS 400 or 700, CSS styles normal/italic. Display subfamily Regular is not a CSS style keyword.
- Preserve all 964 original named glyphs, 883 original cmap entries, 17 source feature tags, marks, optional ligatures/alternates, source license, and attribution. Outputs have **968 glyphs and 885 cmap entries**, with two standard controls and new `△`/`▽` symbols.

## Sources and reference

[upstream/sources.json](../upstream/sources.json) pins Inconsolata **3.100**, revision `fc1fc21081558b39a2db43bfd9b65bf9acb50701`, checksums, and ttfautohint. Compressed original variable/Regular/Bold inputs are tracked in `upstream/inconsolata/`. The only tracked .ttf files are the four finished fonts.

The exact installed Iosevka references come from `/mnt/c/Users/yunlingzhu/AppData/Local/Microsoft/Windows/Fonts/SGr-Iosevka-Regular.ttc` and the corresponding `SGr-Iosevka-Bold.ttc`. Local snapshots are ignored `reference/Iosevka-Regular.ttc` and `reference/Iosevka-Bold.ttc`. Each has normal/extended/oblique/italic faces: select **face 0** for Regular/Bold and **face 4** for Italic/Bold Italic, family exactly Iosevka. Checksums, indices, versions, targets, and source axes are in [weights.json](../reference/weights.json); shared metrics are in [metrics.json](../reference/metrics.json).

Builds need only recorded settings and original inputs. References are needed for calibration and paired previews; tests remeasure/checksum them when present. Preview overrides are `IOSEVKA_REGULAR` and `IOSEVKA_BOLD`. Old local Cascadia references/license are historical and unused.

| Output style | Source wght | Source wdth | Largest calibration-stem difference |
| --- | ---: | ---: | ---: |
| Regular | 420 | 83 | 3.21% |
| Italic | 435 | 88 | 2.72% |
| Bold | 690 | 82 | 1.04% |
| Bold Italic | 705 | 81 | 0.42% |

Source axes are separate from finished 400/700 weights. The measurements use H/n vertical spans and the H crossbar; full-glyph profiles supplement them. They do not imply every visible stroke matches within those percentages.

## Geometry and metadata

- 1000 units/em; 500-unit cell and six shared whitespace advances; x height 520; capitals 735; letter descender −215. Shared monotonic vertical fitting covers baseline, lowercase, capitals, descenders, and accent regions (top 955/bottom −275).
- hhea 965/−215/70; typo 965/−285/0; WinAscent/Descent 965/285. All give 1250-unit natural lines. Full blocks span x=0..500, y=−285..965; halves meet at y=340.
- Italics are 9° obliques; terminal artwork U+2500–U+259F stays upright. Caret rise/run is 1000/158; this is calculated independently, not copied from the reference’s 1000/25. Underline position/thickness −50/50; strikeout 265/51.
- Unlink composites before transforms. Preserve source cell counts, zero-width marks, and two-/three-cell feature advances. A common transform fits side bearings/ink width; no per-character weight correction is applied.
- FontForge nonlinear transforms need cubic contours. Its evaluator crashes on unary-negative constants; [spacing.mjs](../scripts/spacing.mjs) uses binary subtraction and simple composed hinge maps. Export returns to quadratic TTFs.
- TrueType rounding can create tiny contacts (notably percent). Full-glyph native checks reject unsafe calibration finalists. [transform.mjs](../scripts/transform.mjs) repairs only new contour intersection/direction warnings and checks every output glyph’s filled geometry before/after. Avoid blanket RemoveOverlap: it unnecessarily perturbs curves in unrelated glyphs.
- [marks.mjs](../scripts/marks.mjs) adds a separate digit/alternate-zero mark lookup before original lookups. It fixes missing digit attachment without changing existing letter anchors, outlines, or advances. All 25 supplied marks are exercised on 10 digits plus alternate zero (275 cases/style); stacking remains active.
- Very tall/stacked combining sequences can overhang the natural line box. Current bold cases involving U+0312, U+0328 are recorded in desktop validation; preserve the forms and disclose the bounds. Standalone glyphs all fit.
- Strip old instructions; generate fresh hints with pinned **ttfautohint 1.8.4**, verified latest stable October 24, 2026. Flags in [lib.mjs](../scripts/lib.mjs): range 8–50, limit 200, x-height increase 14, stem mode qsq, Windows compatibility, detailed info, TTFA table.
- [hinting.mjs](../scripts/hinting.mjs) applies policy **2** from [hinting.json](../reference/hinting.json). Suitable full-size text retains stronger rounding at Regular/Italic 22–26 PPEM and Bold/Bold Italic 16–19 and 26–28. At those ranges, `s`/`S` plus all 20 supplied canonical accented forms use **natural** stem widths: 1.300's strong rounding thickened their ends and weakened the diagonal middle. `eight` and its alternates, `zero.zero`, `ordfeminine`, and `ordmasculine` retain **quantized** widths. Other compact glyphs, marks, punctuation, symbols, and explicit `æ`/`ǽ`/`ů` exceptions remain protected. Eligibility uses the actual `x` outline height, because OS/2 x-height is normalized later.
- The policy uses ttfautohint **1.8.4’s internal CVT[3] mode** (-100 natural / 0 quantized / 100 strong), after checking the version/base `qsq` initialization. One appended zero CVT entry flags activation. Balanced entry/exit guards restore strong mode after natural or protected glyphs. Blue zones, other sizes, and GDI's existing strong mode remain untouched. Tool upgrades require reviewing this ABI and rerunning native pixel checks.
- Remove autohinter instructions from **U+2500–U+259F**. Their previous programs collapse/invert terminal geometry on Windows; direct rasterization of the existing grid-fitted outlines fixes it. All 966 existing outlines/advances, glyph IDs, and GPOS/GSUB/GDEF remain identical to 1.200. Geometry fingerprints plus `preservedGlyphCount: 966` are pinned in hinting.json and enforced in builds/tests.
- [symbols.mjs](../scripts/symbols.mjs) appends only **U+25B3/U+25BD** after hint refinement. htop 3.0.5 uses them in one cell; Inconsolata lacks them, while the installed Iosevka has two-cell `WWID` forms. New geometric outlines have advance 500, x=60..440, y=145..585, and 60/80-unit borders. They stay upright in italics and render without text hints. Their height was enlarged after native tests found disappearing bold counters in smaller prototypes. Appending updates glyf/loca/maxp/post/cmap/hmtx/hhea without altering any existing outlines, mappings, hints, layout tables, advances, or side bearings. The hmtx table is repacked, so compare existing metrics rather than full-table bytes.
- Normalize actual x/capital metadata, fixed-pitch fields, Win/caret/decoration metrics, style flags, and checksums. Release date is fixed to `2026-10-24T00:00:00+08:00` for deterministic outputs. Update version/date/documentation deliberately for a later release.

## Commands and validation

```sh
npm ci --ignore-scripts
npm run bootstrap
npm run build
npm test
npm run preview
npm run test:browser
npm run test:raster
```

Node 22+. Bootstrap is local Debian/Ubuntu x86-64/WSL, no sudo. Python is used only for the existing FontTools CLI; all custom helpers are Node.js. This build used FontTools **4.29.1**, obtained by bootstrap from apt rather than enforced as an exact pin. Tool overrides: PYTHON3, FONTFORGE, TTFAUTOHINT, HB_SHAPE, HB_VIEW, OTS_SANITIZE. Set CHROMIUM when no cached Playwright Chromium is available.

- `npm run build` creates all 12 font files, CSS, and manifests; `build:web` exports existing TTFs only.
- `npm test` runs [verify.mjs](../scripts/verify.mjs), [verify-web.mjs](../scripts/verify-web.mjs), and [audit.mjs](../scripts/audit.mjs). Checks include sanitizer, checksums, hints, original names/features/coverage, all advances, all glyph bounds, paired stems/counters, decoration/caret/line metrics, shaping, 275 digit-mark cases/style, full-font native outline validation, 18,755 spacing pairs/style, and the new triangles' hollow geometry/one-cell headers.
- All 964 original glyphs/style have size, bearing, outline, and scanline-profile records. All 880 printable source characters have paired Iosevka profiles. The 81 unencoded glyphs lack reliable cross-family naming; review their preserved source-derived outlines separately.
- [glyph-audit.html](glyph-audit.html) displays every original glyph and per-style measurements; serve the repository through HTTP. Encoded entries use real WOFF2 faces; unencoded SVG previews show geometry, not bytecode hinting. [glyph-audit.json](glyph-audit.json) also records the two new triangles under each style's `supplementalGlyphs`; the web example includes their htop headers.
- Preview produces comparison/small-size/combining-mark PNGs; verification retains four complete encoded coverage PNGs at 24 px and renders all encoded coverage at seven sizes (10–32 px).
- `test:browser` is now a permanent dependency-free CDP helper: [check-browser.mjs](../scripts/check-browser.mjs). It launches local Chromium, serves localhost, validates WOFF2/WOFF fallback and family/native spacing/demo/viewer, saves reports/screenshots, and cleans temporary processes/profile. It is separate from npm test.
- Current Chromium: **153.0.8010.12**; desktop/mobile 1280×1000 and 375×900. The browser report carries exact font/audit hashes. After font changes rerun browser checks or explicitly mark the old report stale.
- `test:raster` uses [check-raster.mjs](../scripts/check-raster.mjs) and [raster-page.mjs](../scripts/raster-page.mjs). It requires WSL, Windows Chrome/Edge (`WINDOWS_CHROMIUM` override), local references, and pinned **1.300 commit `38f47b105f10ca12ee0963980ddd7965e5fa830a`**. Temporary cmap probes address all **968 output glyphs/style**, including unencoded glyphs, controls, and symbols; empty .notdef is aliased to an identical empty nonzero glyph to prevent browser fallback. No font installation or application settings changes occur.
- Native raster checks cover all integer 10–32 px sizes and phases 0/.25/.5/.75: actual RGBA identity outside the tuning scope, required counters, empty/visible glyphs, padding, terminal-art bounds, `s`/`S` band balance, and dark/bright one-cell htop headers. Header checks compare actual neighboring ink masks; rounded bounding boxes can overlap harmlessly with half-pixel cells. They save [native-raster-validation.json](native-raster-validation.json), [native-comparison.png](native-comparison.png), and four native coverage sheets. Enlarged curves and htop rows appear in the comparison. These are rendering proxies, not readability scores or exact Windows Terminal equivalence.
- Current native user agent: Windows HeadlessChrome **155.0.0.0** (reduced version). All **356,224 glyph cases** pass, including **355,488 existing-glyph before/after comparisons**, plus **1,472** header cases. Only 27 existing glyphs/style change pixels, within the policy ranges. Regular `s` at 24 px changes from **0.741 to 1.194** middle/end coverage ratio (unchanged outline ratio 1.193). Passage luminance remains essentially unchanged: **98.23 → 98.19**, relative to Iosevka = 100. These ratios are not perpendicular stroke widths or readability scores. REVIEW.md records all styles and limits. All 12 font files reproduce identical hashes on repeat builds.
- Original variable/static inputs can differ in contour count (e.g. uni01B8). Compare geometric topology with the actual variable design instance; static inputs remain the coverage/feature regression baseline.
- Inherited FontForge warnings and new missing-extrema advisories for quadratic TTFs are recorded. All new non-extrema validation warnings fail the audit. Do not claim that passing finite tests proves universal bug-free rendering.
- After font changes regenerate both desktop/web outputs, relevant specimens/reports, and this context. Repeat-build hashes matched all 12 final font files. Documentation-only edits need no font rebuild.

## Files and Git workflow

Core files: [build.mjs](../scripts/build.mjs), [refine.pe](../scripts/refine.pe), [transform.mjs](../scripts/transform.mjs), [marks.mjs](../scripts/marks.mjs), [hinting.mjs](../scripts/hinting.mjs), [symbols.mjs](../scripts/symbols.mjs), [calibrate.mjs](../scripts/calibrate.mjs), [spacing.mjs](../scripts/spacing.mjs), and [lib.mjs](../scripts/lib.mjs). Manifests are generated [fonts/build-info.json](../fonts/build-info.json) and [webfonts/build-info.json](../webfonts/build-info.json). Reports: [desktop](validation.json), [web](web-validation.json), [glyph audit](glyph-audit.json), [browser](web-browser-validation.json), and [native raster](native-raster-validation.json).

- Use one agent unless the user explicitly requests delegation. Prefer existing commands. Node helpers only; temporary dependencies/scripts in unique OS temp directories, cleaned afterward.
- Keep progress visible roughly every 20–30 seconds, with resumable commands and short waits. Bound network fetches and use the existing shell proxy configuration once on direct failures without printing credentials.
- Staging, committing, and pushing project changes are authorized. Preserve unrelated edits. Remote `git@github.com:yunlingz/inconsolata-refined.git`; branch `master` tracks `origin/master`. Use **SSH** and short imperative commit subjects.
- Before publishing, confirm exactly four TTFs/eight web fonts are tracked, every report/hash matches the final binaries, links and staged diff are sound, and no temporary server/browser remains. Root AGENTS.md and CLAUDE.md already point here.
