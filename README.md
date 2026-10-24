# Inconsolata Refined

Four static fonts rebuilt from original **Inconsolata 3.100**, calibrated against the user’s Windows-installed **Iosevka 33.3.5**, and freshly hinted with **ttfautohint 1.8.4**. Font version: **1.200**.

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

All **964 original named glyphs**, **883 cmap entries**, and **17 OpenType features** remain. The outputs contain 966 glyphs including two standard control glyphs. Default digits and the alternate-zero feature gain missing combining-mark attachment metadata, with exact preservation of every outline and advance.

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
- [Review and limits](docs/REVIEW.md), [per-glyph audit](docs/glyph-audit.json), [desktop validation](docs/validation.json), [web validation](docs/web-validation.json), and [browser validation](docs/web-browser-validation.json).

FreeType/Cairo specimens and Chromium checks run in Linux/WSL. Native Windows/DirectWrite rendering of this release still needs a visual check after installation. Very tall or stacked combining sequences can overhang the natural line box; their glyph shapes are retained.

## Rebuild

Node.js 22+ is required. The local bootstrap supports Debian/Ubuntu x86-64, including WSL, without sudo. It needs npm, Python 3 for the existing FontTools CLI, curl, apt indexes, dpkg-deb, tar, make, a C/C++ compiler, and runtime libraries for the font tools. It extracts/builds dependencies under ignored `.tools/`. All project helpers are JavaScript.

```sh
npm ci --ignore-scripts
npm run bootstrap
npm run build
npm test
npm run preview
npm run test:browser
```

On other systems, provide FontTools, FontForge, ttfautohint **1.8.4**, hb-shape, hb-view with PNG output, and ots-sanitize. Executable overrides are `PYTHON3, FONTFORGE, TTFAUTOHINT, HB_SHAPE, HB_VIEW, OTS_SANITIZE`. Browser checks use cached Playwright Chromium when available, or `CHROMIUM=/path/to/chrome`. No browser dependency is installed into this project.

- `npm run build` regenerates all four TTFs and eight web fonts.
- `npm test` runs desktop/web checks and the complete glyph audit, including 18,729 spacing pairs per style and 275 digit/mark cases per style.
- `npm run test:browser` checks WOFF2 and forced WOFF fallback, real family faces, natural cell/line metrics, emphasis, size slider, mobile layout, and the glyph viewer.
- `npm run build:web` / `npm run test:web` handle web exports only.
- `npm run calibrate` searches source axes and rounded native candidates, then rejects finalists that fail full-glyph outline/cleanup checks. It requires local reference collections; review the resulting fonts before release.

The measured reference files are local, ignored `reference/Iosevka-Regular.ttc` and `reference/Iosevka-Bold.ttc`, copied from the Windows `SGr-Iosevka-*.ttc` installation. Regular/Bold use face 0; Italic/Bold Italic use face 4. Their checksums and targets are pinned in [weights.json](reference/weights.json) and [metrics.json](reference/metrics.json). Building uses recorded settings and needs no Iosevka binary/network after setup. Preview overrides are `IOSEVKA_REGULAR` and `IOSEVKA_BOLD`.

The release uses FontTools 4.29.1 and ttfautohint 1.8.4, verified as the latest stable release on October 24, 2026. Hint options are centralized in [scripts/lib.mjs](scripts/lib.mjs). The build rejects other ttfautohint versions. Fixed release timestamps and checksum-verified original inputs give reproducible outputs; repeated builds matched all 12 font hashes. [Build manifests](fonts/build-info.json) record the exact settings.

## License and credits

Inconsolata Refined uses the [SIL Open Font License 1.1](OFL.txt). Original authorship and embedded licensing records are retained. See [AUTHORS.txt](upstream/inconsolata/AUTHORS.txt) and [source pins](upstream/sources.json).

Sources: [Inconsolata](https://github.com/googlefonts/Inconsolata), [Iosevka](https://github.com/be5invis/Iosevka), [ttfautohint](https://freetype.org/ttfautohint/), and [FontForge](https://fontforge.org/).
