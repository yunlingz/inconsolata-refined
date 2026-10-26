# Inconsolata Refined

Four static fonts rebuilt from original **Inconsolata 3.100**, with enlarged narrow proportions, **Cascadia Code** stroke weights, and fresh **ttfautohint 1.8.4** hints. Font version: **1.600**.

| Style | Installable file |
| --- | --- |
| Regular | [InconsolataRefined-Regular.ttf](fonts/InconsolataRefined-Regular.ttf) |
| Italic | [InconsolataRefined-Italic.ttf](fonts/InconsolataRefined-Italic.ttf) |
| Bold | [InconsolataRefined-Bold.ttf](fonts/InconsolataRefined-Bold.ttf) |
| Bold Italic | [InconsolataRefined-BoldItalic.ttf](fonts/InconsolataRefined-BoldItalic.ttf) |

On Windows, install all four TTFs, replace the earlier versions, restart the terminal/editor, and select **Inconsolata Refined**. Compare it with Cascadia Code at the same font size and with application spacing overrides cleared. The four styles share one family and use standard 400/700 weights.

## Nerd Fonts editions

[nerd-fonts/](nerd-fonts/) contains four additional TTFs with the exact family name **Inconsolata Refined Nerd**: Regular, Italic, Bold and Bold Italic. They include the complete **Nerd Fonts 3.5.1** patch set, covering all **10,995 registered icon names** plus Braille and additional patcher symbols. Every added character uses the base font's **540-unit monospace cell**.

Nerd Fonts takes precedence wherever it supplies an existing character, replacing the **161 overlapping symbols** (the heart and box-drawing/block set). Other original characters keep their spacing, custom hints and layout. Nerd edition **1.601** contains **12,008 glyphs** per face. [Installation and build details](nerd-fonts/README.md), [a four-style preview](docs/nerd-preview.png), and [the complete coverage/preservation report](docs/nerd-validation.json) document the result. Build with `npm run build:nerd` and verify with `npm run test:nerd`; the main build/test commands include them too.

## Size, weight, and spacing

Version 1.600 enlarges the Iosevka-derived narrow proportions by **8%**, including cells, bearings, whitespace, line height, marks, and decorations. Weight is calibrated separately to the corresponding Cascadia Code Regular, Italic, Bold, and Bold Italic. The build uses the original Inconsolata variable source and shared geometric transforms, preserving its recognizable forms and features.

Native Windows measurements show that 1.500 already had comparable overall height, and taller plain capitals, than the installed Cascadia Code. Its smaller optical presence mainly came from a narrower footprint and less ink. The enlargement addresses that preference; it does not claim identical heights between different letterforms. The [pixel size comparison](docs/size-review.json) records both releases against Cascadia at the same requested sizes.

| Metric | Original Inconsolata Regular | Installed Iosevka | Refined |
| --- | ---: | ---: | ---: |
| Units per em | 1000 | 1000 | 1000 |
| Cell and word-space width | 500 | 500 | 540 |
| Lowercase x height | 457 | 520 | 562 |
| Capital height | 623 | 735 | 794 |
| Natural line height | 1049 | 1250 | 1350 |

All faces use hhea ascent/descent/gap **1042 / −232 / 76**, typographic metrics **1042 / −308 / 0**, and Windows clipping metrics **1042 / 308**. Both line-layout routes give a **1.35 em** line; the cell is **0.54 em**, retaining the narrow aspect ratio. Dimensional metrics are rounded to whole font units. Box drawing and blocks remain upright and fit the enlarged terminal cell.

| Style | Source weight axis | Source width axis | Largest calibration-stem difference |
| --- | ---: | ---: | ---: |
| Regular | 580 | 95 | 3.88% |
| Italic | 590 | 92 | 2.82% |
| Bold | 820 | 89 | 1.38% |
| Bold Italic | 820 | 89 | 1.95% |

The finished weight metadata remains **400/700**. The last column measures three stem/crossbar samples; it is not an error bound for every stroke in two different typefaces. The 1% goal is a preference, with preservation of Inconsolata’s forms taking priority. Every original glyph also receives its own size, spacing, outline, and scanline-profile audit.

Italic and Bold Italic are **9° obliques** of the original upright designs. A common vertical fit enlarges lowercase/capitals/descenders and fits accent regions inside the line box. No per-character weight redraws are used. Newly introduced rounding intersections receive narrowly scoped, filled-shape-checked cleanup.

All **964 original named glyphs**, **883 original cmap entries**, and **17 OpenType features** remain. The outputs contain **968 glyphs** and **885 cmap entries**, including two standard controls and two new one-cell sort triangles (`△ ▽`). Default digits and the alternate-zero feature gain missing combining-mark attachment metadata, with exact preservation of every existing outline and advance.

## Small-size rendering

The source-based stroke balancing introduced in 1.500 is recalculated for the new weights and size. The shared height fit can compress strokes above capital height, notably in `f`’s upper hook. [Source-aware compensation](scripts/outline-balance.mjs) compares perpendicular strokes in the original and resized cubic contours, then corrects the extra distortion from resizing. It preserves intended stroke contrast, straight stems, counter contours, and advances. Every original glyph is reviewed; a proposal must improve measured balance and pass contour and native checks. Character names do not select the correction.

Fresh ttfautohint programs receive a newly [generated fitting policy](reference/hinting.json), measured for every glyph at **8–50 px and eight horizontal positions**. Natural or quantized fitting is preferred; stronger rounding is reserved for detail preservation. Geometry/detail acceptance uses a fresh uncompensated resize of the same original design axes and final dimensions. The older lighter release remains a separate visual/ink comparison.

The review distinguishes resolvable counters and separate ink cores from small details whose antialiasing changes across pixel positions. Those smaller features influence the fitting score rather than requiring identical binary masks. [Unhinted outlines](docs/outline-comparison.svg), [source stroke measurements](docs/outline-review.json), and [native fitting measurements](docs/hinting-review.json) expose the two stages separately. These are shape and rendering measurements, not universal readability scores.

A generic [bounds and detail safeguard](docs/hint-bounds.json) tests every hinted glyph. Displaced programs, or programs whose fitting modes lose source details, can be bypassed only after direct rendering passes bounds, visibility, and detail checks across the entire tested range. There are no character-name selection rules.

Terminal artwork renders directly from its cell-fitted outlines to avoid unsafe text hinting. The one-cell `△`/`▽` symbols grow with the 540-unit cell, keep hollow centers, and use borders adjusted to the new weight targets. [Symbol construction](scripts/symbols.mjs) remains separate from the original glyph transformations.

## Web fonts

[webfonts/](webfonts/) contains the four faces in **WOFF2 and WOFF**, [the shared stylesheet](webfonts/inconsolata-refined.css), [example.html](webfonts/example.html), and the license.

```html
<link rel="stylesheet" href="./webfonts/inconsolata-refined.css">
<style>
  .sample { font-family: 'Inconsolata Refined', monospace; }
</style>
<p class="sample">
  Regular <em>Italic</em> <strong>Bold</strong>
  <strong><em>Bold Italic</em></strong>
</p>
```

CSS uses `font-style: normal` or `italic`, and `font-weight: 400` or `700`. `regular` is a display style name. Browsers choose real faces through standard emphasis elements. For a native-spacing comparison, use `line-height: normal; letter-spacing: normal; word-spacing: normal;`. Website/terminal overrides take precedence over font defaults.

## Review and complete coverage

- [Four paired Cascadia comparisons](docs/stroke-comparison.png), [original/refined overview](docs/preview.png), and [small sizes](docs/small-sizes.png).
- [Every original glyph in all four styles](docs/glyph-audit.html), including 81 unencoded alternates/ligatures; serve the repository through HTTP to use the viewer.
- Complete encoded sheets: [Regular](docs/coverage-Regular.png), [Italic](docs/coverage-Italic.png), [Bold](docs/coverage-Bold.png), [Bold Italic](docs/coverage-BoldItalic.png).
- [All supplied combining marks on digits](docs/combining-marks.png).
- [Unhinted outline comparison](docs/outline-comparison.svg) and [its PNG](docs/outline-comparison.png), showing the geometric correction independently of hinting.
- [Native Windows before/after comparison](docs/native-comparison.png) and [pixel validation](docs/native-raster-validation.json), covering every output glyph at 8–50 px and eight fractional positions, plus enlarged curves and htop headers.
- Native Windows glyph sheets: [Regular](docs/native-coverage-Regular.png), [Italic](docs/native-coverage-Italic.png), [Bold](docs/native-coverage-Bold.png), [Bold Italic](docs/native-coverage-BoldItalic.png), including unencoded alternates and ligatures.
- [Review and limits](docs/REVIEW.md), [per-glyph audit](docs/glyph-audit.json), [desktop validation](docs/validation.json), [web validation](docs/web-validation.json), and [browser validation](docs/web-browser-validation.json).

FreeType/Cairo specimens and website checks run in Linux/WSL; the separate pixel checks run in native Windows Chromium. Windows Terminal still needs a visual check after installation: browser results do not reproduce every application’s rendering settings. Very tall or stacked combining sequences can overhang the natural line box; their glyph shapes are retained.

## Rebuild

Node.js 22+ is required. The local bootstrap supports Debian/Ubuntu x86-64, including WSL, without sudo. It needs npm, Python 3 for the existing FontTools CLI, curl, apt indexes, dpkg-deb, tar, unzip, make, a C/C++ compiler, and runtime libraries for the font tools. It extracts/builds dependencies under ignored `.tools/`. All project helpers are JavaScript; Nerd editions invoke the pinned upstream FontForge patcher.

```sh
npm ci --ignore-scripts
npm run bootstrap
npm run build
npm test
npm run preview
npm run test:browser
npm run test:raster
```

After changing the geometric fit or autohinter inputs, regenerate the measured policy with `npm run calibrate:hinting -- --reset-outline-safety`, then rebuild and rerun validation. Calibration uses native Windows Chromium under WSL and the pinned 1.400 Git baseline. Ordinary builds use the recorded policy and do not need a Windows browser. Native rejection data in [outline-native-limits.json](reference/outline-native-limits.json) is generated by the review, not a hand-authored list of glyph exceptions.

On other systems, provide FontTools, FontForge, ttfautohint **1.8.4**, hb-shape, hb-view with PNG output, and ots-sanitize. Executable overrides are `PYTHON3, FONTFORGE, TTFAUTOHINT, HB_SHAPE, HB_VIEW, OTS_SANITIZE`. Browser checks use cached Playwright Chromium when available, or `CHROMIUM=/path/to/chrome`. No browser dependency is installed into this project.

- `npm run build` regenerates four base TTFs, eight web fonts, and four Nerd TTFs.
- `npm test` runs desktop/web checks, the complete original-glyph audit (18,755 spacing pairs and 275 digit/mark cases per style), and all Nerd icon/metadata/hint-preservation checks.
- `npm run build:nerd` / `npm run test:nerd` handle the four single-cell Nerd editions independently, using the verified base TTFs. The official 3.5.1 patcher archive is pinned and tracked for offline builds.
- `npm run test:browser` checks WOFF2 and forced WOFF fallback, real family faces, natural cell/line metrics, emphasis, size slider, mobile layout, and the glyph viewer.
- `npm run test:raster` requires WSL, Windows Chrome/Edge, the local Cascadia references, and the recorded **1.400** Git baseline. It checks all **968 output glyphs/style** at every integer size from 8 through 50 px and eight pixel phases. A fresh original-source resize at the new weight and dimensions supplies the geometry/detail reference; 1.400 supplies the historical ink comparison. Compiled pixels must agree with independent fitting candidates. Visibility, bounds, resolvable details, curve balance, and dark/bright htop headers are checked. Set `WINDOWS_CHROMIUM` to override browser discovery.
- Native raster verification can resume per style: `node scripts/check-raster.mjs --checkpoint-dir=<unique-OS-temp-directory> --style=Regular`, then `Italic`, `Bold`, and `BoldItalic`. Completed results are checksum-verified; all four are required for the combined report. Remove the owned checkpoint directory afterward.
- `npm run test:size` measures every shared printable character against Cascadia and release 1.500, in native Windows Chromium at seven sizes and four phases; it also verifies proportional advances for every output glyph.
- `npm run build:web` / `npm run test:web` handle web exports only.
- `npm run calibrate` searches source axes and rounded native candidates, then rejects finalists that fail full-glyph outline/cleanup checks. It needs the local stroke and spacing references. Results are saved per style; `-- --resume` reuses only completed styles whose calibration inputs match. FontForge processes have a 30-second timeout and, on Linux with prlimit, a 1 GiB address-space limit.

The local stroke references are ignored `reference/CascadiaCode.ttf` (2102.025, matching the Windows-installed font) and `reference/CascadiaCodeItalic.ttf` (2105.024), at wght 400/700. The spacing template remains installed Iosevka 33.3.5 in `reference/Iosevka-Regular.ttc` and `reference/Iosevka-Bold.ttc`, faces 0/4. [weights.json](reference/weights.json) pins both reference roles and checksums; [metrics.json](reference/metrics.json) records enlarged dimensions. Ordinary builds use the recorded settings and original Inconsolata sources without reference binaries or network access.

The release uses FontTools 4.29.1 and ttfautohint 1.8.4, verified as the latest stable release on October 24, 2026. Base hint options are centralized in [scripts/lib.mjs](scripts/lib.mjs); the subsequent refinement is recorded in [reference/hinting.json](reference/hinting.json). The build rejects other ttfautohint versions, fingerprints every source-derived outline, advance, and base hint program against the current geometric review, and appends only the two documented symbols. Fixed release timestamps and checksum-verified original inputs give reproducible outputs; an isolated build reproduced all 12 font files byte for byte. [Build manifests](fonts/build-info.json) record the exact settings.

## License and credits

Inconsolata Refined uses the [SIL Open Font License 1.1](OFL.txt). Original authorship and embedded licensing records are retained. See [AUTHORS.txt](upstream/inconsolata/AUTHORS.txt) and [source pins](upstream/sources.json).

Sources: [Inconsolata](https://github.com/googlefonts/Inconsolata), [Iosevka](https://github.com/be5invis/Iosevka), [ttfautohint](https://freetype.org/ttfautohint/), and [FontForge](https://fontforge.org/).

The separate Nerd editions also include [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts) icons; keep their [supplied notices and licenses](nerd-fonts/licenses/) with redistributed fonts.
