# Development context

Updated October 24, 2026. Read this before changing the fonts or build pipeline. This is the coding handoff; [README.md](../README.md) describes installation and [REVIEW.md](REVIEW.md) records the detailed font review. Update this file when a design decision, workflow, or validation status changes.

## Current state

- Family: **Inconsolata Refined**. Font version **1.100**; npm package version **1.1.0**.
- Font implementation baseline: commit `fee9990` (`Match all four styles to Cascadia stroke weights`), following the initial sizing/hinting and web font commits. The implementation was committed and pushed to `origin/master`.
- The user manually reinstalled the updated Windows fonts and reported that they look nice. This is user visual feedback; the development environment did not run an automated native DirectWrite test or confirm every style on Windows.
- The requested font work is complete. There is no pending font defect or requested adjustment as of this handoff.

## Requirements to preserve

- Exactly four static TTF variants: **Regular**, **Italic**, **Bold**, **Bold Italic**, under `fonts/`. All four generated TTFs must remain tracked in Git.
- Export the same four faces as both WOFF and WOFF2 under the separate `webfonts/` directory. All eight web fonts must remain tracked, alongside `inconsolata-refined.css`, `example.html`, and the font license.
- Keep one family name, `Inconsolata Refined`, with working style linking. Finished weights are **400** for Regular/Italic and **700** for Bold/Bold Italic. CSS uses `font-style: normal` or `italic`; `regular` is a display subfamily name, not a CSS style value.
- Match size and stroke thickness against the **corresponding Cascadia Code style**: Regular to Regular, Italic to Italic, Bold to Bold, Bold Italic to Bold Italic. Do not apply one regular-face weight correction indiscriminately to all styles.
- Preserve the complete upstream glyph coverage, combining marks, optional ligatures, stylistic sets, and other OpenType features. All original glyphs were included in the refinement; this was not a manual redraw or individual Cascadia comparison of every character.
- Use fresh ttfautohint instructions after outline changes. The user requested the latest stable release; **1.8.4** was verified upstream on October 24, 2026 and is pinned for this release. Recheck upstream when intentionally upgrading the toolchain rather than assuming this remains latest indefinitely.
- Retain the SIL Open Font License, upstream attribution, and embedded licensing records.

## Sources and stroke calibration

[upstream/sources.json](../upstream/sources.json) pins Inconsolata **3.100**, revision `fc1fc21081558b39a2db43bfd9b65bf9acb50701`, font checksums, and the ttfautohint archive/checksum.

The build instances `upstream/inconsolata/Inconsolata-Variable.ttf.gz` using FontTools. Original compressed Regular/Bold inputs remain for regression comparisons. Compressed upstream inputs are tracked; the only tracked `.ttf` files are the four finished faces.

The upright reference is the user's Windows-installed **Cascadia Code 2102.025**, at weights 400 and 700. It predates dedicated italics, so italic comparisons use **Cascadia Code Italic 2105.024**, the first official italic release, at weights 400 and 700. Its upright sampled stems agree with the installed reference. Provenance and checksums are in [reference/metrics.json](../reference/metrics.json) and [reference/weights.json](../reference/weights.json).

The reference binaries are local, ignored by `/reference/*.ttf`, and are not required to build. The default preview paths are `reference/CascadiaCode.ttf` and `reference/CascadiaCodeItalic.ttf`; preview overrides are `CASCADIA_CODE` and `CASCADIA_CODE_ITALIC`. Verification remeasures and checksum-checks references when they exist at their recorded paths.

| Output style | Source `wght` | Source `wdth` | Final x height | Largest sampled stroke difference |
| --- | ---: | ---: | ---: | ---: |
| Regular | 635 | 119 | 1060 | 4.5% |
| Italic | 635 | 116 | 1060 | 3.7% |
| Bold | 840 | 117 | 1078 | 1.0% |
| Bold Italic | 855 | 117 | 1078 | 1.5% |

These source design coordinates are separate from the finished 400/700 weight metadata. Adjusting both source weight and width, then normalizing width to the terminal cell, matched horizontal and vertical strokes better than changing weight alone. Bold's vertical stems were already close; its horizontal strokes needed more adjustment.

The calibration samples vertical stems through `H` at 25% of capital height and `n` at 35% of x height, plus the horizontal crossbar through the center of `H`. Every sample must be within **5%** of its paired reference. This is representative geometric calibration, not identical geometry or perceived weight for every glyph and renderer.

## Metrics and implementation details

- All faces: **2048** units per em, **1200** units per terminal cell, ascent **1900**, descent **-480**, line gap **0**. Preserve the established lowercase heights in the table. Regular capitals are 1424 units versus Cascadia's 1420.
- Italics are **12-degree obliques** of Inconsolata's upright designs. No separate cursive glyph designs were introduced.
- Box drawing and block characters U+2500–U+259F stay upright and are fitted separately to the terminal grid. Full blocks span x=0..1200 and y=-480..1900; half blocks meet at y=710.
- Unlink composite references before per-glyph transformations to avoid scaling accented components twice.
- FontForge rounds during `ScaleToEm`. Derive the final outline scale from the actual scaled `x` bounds, and calculate advances as **rounded source cell count × 1200**. Otherwise x heights can drift and a single-cell glyph can become 1199 units wide.
- Preserve zero-width marks and two-/three-cell ligature advances. Checks cover every original named glyph, including unencoded feature glyphs.
- Remove old hints before transforming outlines. Recompute x-height/cap-height metadata from final `x`/`H` outlines, Windows clipping bounds, fixed-pitch fields, style flags, and SFNT checksums.
- Hint options are centralized in [scripts/lib.mjs](../scripts/lib.mjs): range 8–50, limit 200, x-height increase 14, `--stem-width-mode=qsq`, Windows compatibility, detailed info, and a TTFA table. `qsq` selects quantized grayscale, strong GDI ClearType, and quantized DirectWrite ClearType stems.
- Release timestamps are fixed to `2026-10-24T00:00:00+08:00` for deterministic builds. A future release should deliberately update version/date metadata and related documentation together.

## Build and verification

From the repository root:

```sh
npm ci --ignore-scripts
npm run bootstrap
npm run build
npm test
npm run preview
```

Node.js **22+** is required. The bootstrap supports Debian/Ubuntu x86-64, including WSL, without sudo. It extracts tools into ignored `.tools/` and builds ttfautohint locally. Existing prerequisites and alternative platform setup are documented in the root README. The release used FontTools **4.29.1**; bootstrap obtains FontTools from the configured apt repositories rather than enforcing that exact version.

All project orchestration/helpers are JavaScript. Python 3 is used only to invoke the existing FontTools CLI (`python3 -m fontTools.varLib.instancer`), not custom Python helper scripts. `scripts/lib.mjs` configures the extracted toolchain's `LD_LIBRARY_PATH` and `PYTHONPATH`. Executable overrides are `PYTHON3`, `FONTFORGE`, `TTFAUTOHINT`, `HB_SHAPE`, `HB_VIEW`, and `OTS_SANITIZE`. The build rejects a ttfautohint version other than the pin, including system **1.8.3**.

- `npm run build` regenerates all four TTFs, all eight web fonts, the CSS, and build manifests.
- `npm run build:web` rebuilds only web exports from the existing TTFs; `npm run test:web` checks those exports.
- `npm test` checks desktop and web fonts and writes `docs/validation.json` and `docs/web-validation.json`.
- `npm run preview` renders `docs/preview.png` and `docs/small-sizes.png`. Both local Cascadia references are needed to regenerate `docs/stroke-comparison.png` with the paired comparisons.
- After font changes, rebuild both desktop and web formats, run relevant checks, inspect regenerated specimens, and update review/results. The previous repeat-build check produced identical hashes for **all 12** font files.
- Font version is defined in `scripts/lib.mjs`; npm version is in `package.json` and `package-lock.json`. Build manifests are generated, not the source of those settings.
- Documentation-only changes do not need a font rebuild. Check links and recorded facts without needlessly changing binary artifacts.

## File map

| File | Purpose |
| --- | --- |
| [reference/weights.json](../reference/weights.json) | Per-style source axes, target x heights, paired stroke targets, tolerance, and reference provenance |
| [reference/metrics.json](../reference/metrics.json) | Shared Cascadia sizing and terminal metrics |
| [scripts/build.mjs](../scripts/build.mjs) | Source instances, transformations, hinting, and desktop build manifest |
| [scripts/refine.pe](../scripts/refine.pe) | FontForge outline, terminal glyph, advance, and family transformations |
| [scripts/lib.mjs](../scripts/lib.mjs) | Versions, styles, tool selection, hints, metadata normalization, and checksums |
| [scripts/strokes.mjs](../scripts/strokes.mjs) | Filled-span stroke measurements, including overlapping contours |
| [scripts/build-web.mjs](../scripts/build-web.mjs) | WOFF/WOFF2 exports, shared stylesheet, and web build manifest |
| [scripts/verify.mjs](../scripts/verify.mjs) / [scripts/verify-web.mjs](../scripts/verify-web.mjs) | Desktop and web regression checks |
| [scripts/preview.mjs](../scripts/preview.mjs) | Comparison and small-size specimens |
| [scripts/bootstrap.mjs](../scripts/bootstrap.mjs) | Project-local font toolchain |
| [fonts/build-info.json](../fonts/build-info.json) / [webfonts/build-info.json](../webfonts/build-info.json) | Exact release settings and generated font hashes |
| [webfonts/example.html](../webfonts/example.html) | Website demo with semantic bold/italic and a size slider |

## Completed validation and limits

- All four TTFs and eight web fonts passed OpenType Sanitizer. Desktop checks cover checksums, metadata, hints, paired strokes, coverage, advances, clipping bounds, and HarfBuzz shaping.
- All **964 original named glyphs**, **883 source cmap entries**, and **17 OpenType features** were preserved. The cmap count includes control mappings and the U+FFFF sentinel. Outputs contain **966 glyphs**, including FontForge's standard `.null` and `nonmarkingreturn` controls.
- Web checks compare decoded geometry, advances, and glyph hint instructions for every output glyph against the source TTF, as well as other preserved tables and CSS mappings.
- FreeType/Cairo rendering checks passed at 10, 12, 14, 16, 18, 24, and 32 pixels. Comparison, paired-stroke, and small-size specimens were visually inspected. Fontconfig recognized the four family styles and monospace spacing.
- Chromium **153.0.8010.12** checks covered all four real WOFF2 faces, forced WOFF fallback, semantic `strong`/`em`, equal advances, the size slider, desktop/mobile layout, and absence of decoding/script errors. Browser report hashes match the released web fonts.
- Browser validation is recorded in [web-browser-validation.json](web-browser-validation.json), with [web-example.png](web-example.png). It was performed using a temporary helper that was cleaned up; **`npm test` does not run browser automation**. After future web font changes, rerun browser checks and refresh their hashes/report or clearly record that they are pending. Do not present an old browser report as validation of new binaries.
- The user subsequently confirmed the installed fonts look nice on their Windows setup. Automated native Windows/DirectWrite checks, Firefox, and Safari were not run. Exact appearance still depends on renderer, DPI, and display. Unsupported characters still use application fallback fonts.
- Fractional-pixel line heights can show faint seams between terminal blocks in Cairo, also seen in the Cascadia reference; font-unit block boundaries are checked. No remaining defect requiring manual glyph redrawing was identified in the reviewed specimens.

## Collaboration and Git workflow

- Use one agent unless the user explicitly requests delegation. Prefer existing project commands; use Node.js for custom helpers and uniquely named OS temporary directories for disposable tooling, cleaning them up afterward.
- Keep progress visible during extended work, roughly every 20–30 seconds, and use resumable commands with short yields. Bound HTTP connection/total times; if direct access fails, use the existing shell proxy configuration once without exposing proxy values or credentials.
- The user authorized staging, committing, and pushing project changes. Inspect the working tree, keep commits within the request, and preserve unrelated user edits. Existing commit subjects use short imperative descriptions.
- Remote: `git@github.com:yunlingz/inconsolata-refined.git`; branch: `master`, tracking `origin/master`. **Use SSH.** HTTPS credentials were unavailable and the `gh` token was expired during the session; SSH pushes succeeded.
- Before publishing a font change, confirm all four TTFs and eight web fonts remain tracked, validation reports refer to the final binaries, and the staged diff has no unintended artifacts. No temporary server or browser process from this session remains running.
