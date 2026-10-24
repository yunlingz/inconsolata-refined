# Inconsolata Refined

Four static fonts rebuilt from original **Inconsolata 3.100**, calibrated against the user’s Windows-installed **Iosevka 33.3.5**, and freshly hinted with **ttfautohint 1.8.4**. Font version: **1.400**.

| Style | Installable file |
| --- | --- |
| Regular | [InconsolataRefined-Regular.ttf](fonts/InconsolataRefined-Regular.ttf) |
| Italic | [InconsolataRefined-Italic.ttf](fonts/InconsolataRefined-Italic.ttf) |
| Bold | [InconsolataRefined-Bold.ttf](fonts/InconsolataRefined-Bold.ttf) |
| Bold Italic | [InconsolataRefined-BoldItalic.ttf](fonts/InconsolataRefined-BoldItalic.ttf) |

On Windows, install all four TTFs, replace the earlier versions, restart the terminal/editor, and select **Inconsolata Refined**. Compare it with Iosevka at the same font size and with application spacing overrides cleared. The four styles share one family and use standard 400/700 weights.

## Size, weight, and spacing

Iosevka guides the visual calibration. The build uses Inconsolata’s original variable source, its weight/width axes, and shared outline/spacing transforms. It preserves the recognizable letterforms and original features. It does not use a previously refined font as input or copy Iosevka outlines/layout tables.

| Metric | Original Inconsolata Regular | Installed Iosevka | Refined |
| --- | ---: | ---: | ---: |
| Units per em | 1000 | 1000 | 1000 |
| Cell and word-space width | 500 | 500 | 500 |
| Lowercase x height | 457 | 520 | 520 |
| Capital height | 623 | 735 | 735 |
| Natural line height | 1049 | 1250 | 1250 |

All faces use hhea ascent/descent/gap **965 / −215 / 70**, typographic metrics **965 / −285 / 0**, and Windows clipping metrics **965 / 285**. Each route gives a 1.25 em line; the cell is 0.5 em. Baseline, descenders, side bearings, whitespace, representative counters, underline/strikeout positions, and italic caret slope are checked. Box drawing and blocks remain upright and fit the complete terminal cell.

| Style | Source weight axis | Source width axis | Largest calibration-stem difference |
| --- | ---: | ---: | ---: |
| Regular | 420 | 83 | 3.21% |
| Italic | 435 | 88 | 2.72% |
| Bold | 690 | 82 | 1.04% |
| Bold Italic | 705 | 81 | 0.42% |

The finished weight metadata remains **400/700**. The last column measures three stem/crossbar samples; it is not an error bound for every stroke in two different typefaces. The 1% goal is a preference, with preservation of Inconsolata’s forms taking priority. Every original glyph also receives its own size, spacing, outline, and scanline-profile audit.

Italic and Bold Italic are **9° obliques** of the original upright designs. A common vertical fit enlarges lowercase/capitals/descenders and fits accent regions inside the line box. No per-character weight redraws are used. Newly introduced rounding intersections receive narrowly scoped, filled-shape-checked cleanup.

All **964 original named glyphs**, **883 original cmap entries**, and **17 OpenType features** remain. The outputs contain **968 glyphs** and **885 cmap entries**, including two standard controls and two new one-cell sort triangles (`△ ▽`). Default digits and the alternate-zero feature gain missing combining-mark attachment metadata, with exact preservation of every existing outline and advance.

## Small-size rendering

Version **1.400** corrects uneven curve fitting in 1.300 while preserving **all 966 existing outlines and advances from 1.200 exactly**. Stronger stem rounding had thickened the ends of `s` while thinning its diagonal middle; a higher overall text brightness had concealed this local imbalance. Full-size `s`/`S` and all 20 supplied accented forms now use natural stem widths when the adaptive policy is active. `8`, alternate zero, and ordinal letters retain quantized fitting. No letter is redrawn or individually thickened.

Other suitable text retains stronger rounding at Regular/Italic **22–26 PPEM** and Bold/Bold Italic **16–19 and 26–28 PPEM**. Other sizes, blue zones, and existing GDI strong mode remain as before. Compact glyphs, marks, punctuation, symbols, narrow `æ` forms, and Bold Italic `ů` remain protected. Native regression checks now measure the middle versus ends of `s`/`S`, alongside the complete glyph audit.

Native Windows testing uncovered an older hinting defect: full blocks and several vertical box-drawing characters collapsed or appeared on the wrong side of the baseline. Terminal artwork now renders directly from its cell-fitted outlines, without those faulty text-hinting instructions. The rest of the font retains fresh ttfautohint bytecode and the scoped stem policy. [Hint settings](reference/hinting.json) and [implementation](scripts/hinting.mjs) record the details.

The htop header `CPU%▽MEM%` exposed a separate missing-symbol problem: the original Inconsolata lacks `△`/`▽`, while the installed Iosevka uses two-cell forms. Version 1.400 adds original geometric triangles with 500-unit advances, upright in all four styles. They render directly without text hints, retain hollow centers, and fit htop’s one-cell allocation. Existing glyphs, cmap mappings, GPOS/GSUB/GDEF tables, size, and spacing are preserved. [Symbol construction](scripts/symbols.mjs) is separate from the original font transformations.

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

- [Four paired Iosevka comparisons](docs/stroke-comparison.png), [original/refined overview](docs/preview.png), and [small sizes](docs/small-sizes.png).
- [Every original glyph in all four styles](docs/glyph-audit.html), including 81 unencoded alternates/ligatures; serve the repository through HTTP to use the viewer.
- Complete encoded sheets: [Regular](docs/coverage-Regular.png), [Italic](docs/coverage-Italic.png), [Bold](docs/coverage-Bold.png), [Bold Italic](docs/coverage-BoldItalic.png).
- [All supplied combining marks on digits](docs/combining-marks.png).
- [Native Windows before/after comparison](docs/native-comparison.png) and [pixel validation](docs/native-raster-validation.json), covering every output glyph at 10–32 px and four fractional positions, plus enlarged curves and htop headers.
- Native Windows glyph sheets: [Regular](docs/native-coverage-Regular.png), [Italic](docs/native-coverage-Italic.png), [Bold](docs/native-coverage-Bold.png), [Bold Italic](docs/native-coverage-BoldItalic.png), including unencoded alternates and ligatures.
- [Review and limits](docs/REVIEW.md), [per-glyph audit](docs/glyph-audit.json), [desktop validation](docs/validation.json), [web validation](docs/web-validation.json), and [browser validation](docs/web-browser-validation.json).

FreeType/Cairo specimens and website checks run in Linux/WSL; the separate pixel checks run in native Windows Chromium. Windows Terminal still needs a visual check after installation: browser results do not reproduce every application’s rendering settings. Very tall or stacked combining sequences can overhang the natural line box; their glyph shapes are retained.

## Rebuild

Node.js 22+ is required. The local bootstrap supports Debian/Ubuntu x86-64, including WSL, without sudo. It needs npm, Python 3 for the existing FontTools CLI, curl, apt indexes, dpkg-deb, tar, make, a C/C++ compiler, and runtime libraries for the font tools. It extracts/builds dependencies under ignored `.tools/`. All project helpers are JavaScript.

```sh
npm ci --ignore-scripts
npm run bootstrap
npm run build
npm test
npm run preview
npm run test:browser
npm run test:raster
```

On other systems, provide FontTools, FontForge, ttfautohint **1.8.4**, hb-shape, hb-view with PNG output, and ots-sanitize. Executable overrides are `PYTHON3, FONTFORGE, TTFAUTOHINT, HB_SHAPE, HB_VIEW, OTS_SANITIZE`. Browser checks use cached Playwright Chromium when available, or `CHROMIUM=/path/to/chrome`. No browser dependency is installed into this project.

- `npm run build` regenerates all four TTFs and eight web fonts.
- `npm test` runs desktop/web checks and the complete glyph audit, including 18,755 spacing pairs per style and 275 digit/mark cases per style.
- `npm run test:browser` checks WOFF2 and forced WOFF fallback, real family faces, natural cell/line metrics, emphasis, size slider, mobile layout, and the glyph viewer.
- `npm run test:raster` requires WSL, Windows Chrome/Edge, the local reference collections, and the recorded **1.300** Git baseline. It checks all **968 output glyphs/style** at every integer size from 10 through 32 px and four pixel phases, plus stroke-band balance, dark/bright htop headers, prose density, counters, unchanged pixels outside the tuning scope, and terminal-art bounds. Set `WINDOWS_CHROMIUM` to override browser discovery. It uses temporary fonts/profiles and changes no installed fonts or application settings.
- `npm run build:web` / `npm run test:web` handle web exports only.
- `npm run calibrate` searches source axes and rounded native candidates, then rejects finalists that fail full-glyph outline/cleanup checks. It requires local reference collections; review the resulting fonts before release.

The measured reference files are local, ignored `reference/Iosevka-Regular.ttc` and `reference/Iosevka-Bold.ttc`, copied from the Windows `SGr-Iosevka-*.ttc` installation. Regular/Bold use face 0; Italic/Bold Italic use face 4. Their checksums and targets are pinned in [weights.json](reference/weights.json) and [metrics.json](reference/metrics.json). Building uses recorded settings and needs no Iosevka binary/network after setup. Preview overrides are `IOSEVKA_REGULAR` and `IOSEVKA_BOLD`.

The release uses FontTools 4.29.1 and ttfautohint 1.8.4, verified as the latest stable release on October 24, 2026. Base hint options are centralized in [scripts/lib.mjs](scripts/lib.mjs); the subsequent refinement is recorded in [reference/hinting.json](reference/hinting.json). The build rejects other ttfautohint versions, checks all 966 existing glyphs against the 1.200 geometry fingerprint, and appends only the two documented symbols. Fixed release timestamps and checksum-verified original inputs give reproducible outputs. [Build manifests](fonts/build-info.json) record the exact settings.

## License and credits

Inconsolata Refined uses the [SIL Open Font License 1.1](OFL.txt). Original authorship and embedded licensing records are retained. See [AUTHORS.txt](upstream/inconsolata/AUTHORS.txt) and [source pins](upstream/sources.json).

Sources: [Inconsolata](https://github.com/googlefonts/Inconsolata), [Iosevka](https://github.com/be5invis/Iosevka), [ttfautohint](https://freetype.org/ttfautohint/), and [FontForge](https://fontforge.org/).
