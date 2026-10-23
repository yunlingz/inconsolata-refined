# Inconsolata Refined

Four static TrueType fonts based on Inconsolata 3.100, sized and weighted against Cascadia Code and freshly hinted with **ttfautohint 1.8.4**. The current font version is **1.100**.

| Style | Installable file |
| --- | --- |
| Regular | [InconsolataRefined-Regular.ttf](fonts/InconsolataRefined-Regular.ttf) |
| Italic | [InconsolataRefined-Italic.ttf](fonts/InconsolataRefined-Italic.ttf) |
| Bold | [InconsolataRefined-Bold.ttf](fonts/InconsolataRefined-Bold.ttf) |
| Bold Italic | [InconsolataRefined-BoldItalic.ttf](fonts/InconsolataRefined-BoldItalic.ttf) |

Install all four files, then choose **Inconsolata Refined** in your terminal or editor. On Windows, select the four TTFs in `fonts/`, right-click **Install**, replace the previous versions if prompted, and restart the application. Keep the font size you used for Cascadia Code when comparing.

The styles belong to one family, with weight and italic flags set so applications can select the real Bold and Italic files.

## Size and design

The sizing reference is your Windows-installed Cascadia Code 2102.025. Its measured metrics and checksum are recorded in [reference/metrics.json](reference/metrics.json). The reference binary remains local and is excluded from Git.

| Metric, as a fraction of an em | Original Inconsolata Regular | Cascadia Code reference | Refined Regular |
| --- | ---: | ---: | ---: |
| Character advance | 0.50000 | 0.58594 | 0.58594 |
| Lowercase x height | 0.45700 | 0.51758 | 0.51758 |
| Capital height | 0.62300 | 0.69336 | 0.69531 |
| Typographic line height | 1.04900 | 1.16211 | 1.16211 |

Version 1.100 matches stroke weight separately for each face: Regular to Cascadia Regular, Italic to Cascadia Italic, Bold to Cascadia Bold, and Bold Italic to Cascadia Bold Italic. It uses Inconsolata's original variable design, adjusting both weight and width before fitting the outlines to the existing terminal cell. This brings horizontal and vertical strokes closer together in weight, with a smaller change to Bold because its vertical stems were already close to the reference.

The previous lowercase heights are preserved: 1060 units for Regular/Italic and 1078 for Bold/Bold Italic. All faces retain a 2048-unit em, a 1200-unit cell, ascent 1900, descent -480, and zero line gap. Regular's capitals are now 1424 units, compared with Cascadia's 1420. Windows clipping bounds cover the actual outlines.

| Output style | Source `wght` | Source `wdth` | Largest measured stroke difference from paired Cascadia face |
| --- | ---: | ---: | ---: |
| Regular | 635 | 119 | 4.5% |
| Italic | 635 | 116 | 3.7% |
| Bold | 840 | 117 | 1.0% |
| Bold Italic | 855 | 117 | 1.5% |

These source axes are design inputs; the finished fonts still use conventional **400/700** weights. The comparison measures the vertical stems of `H` and `n` and the horizontal crossbar of `H`. It is a calibrated visual match, not a claim that every stroke in two different typefaces has identical geometry. See [the four paired specimens](docs/stroke-comparison.png), [reference/weights.json](reference/weights.json), and [the review](docs/REVIEW.md).

The installed Cascadia 2102.025 reference has no dedicated italic design. Italic comparisons use **Cascadia Code Italic 2105.024**, its first official italic release. That release's upright stroke samples agree with the installed reference. Both reference binaries remain local and are excluded from Git; their checksums and provenance are recorded.

Upstream Inconsolata supplies upright designs. **Italic and Bold Italic are 12-degree obliques** derived from those designs. They retain Inconsolata's letterforms rather than introducing newly drawn cursive forms. Box drawing and block characters remain upright and are fitted separately to the terminal cell.

Original glyphs, combining marks, optional ligatures, stylistic sets, alternate zero, and other OpenType features are preserved. The variable source and the original Regular/Bold fonts used for regression checks are stored as lossless `.ttf.gz` inputs, so the only tracked `.ttf` files are the four finished faces.

## Web fonts

The separate [webfonts/](webfonts/) folder contains all four styles in **WOFF2 and WOFF**, plus [inconsolata-refined.css](webfonts/inconsolata-refined.css), [example.html](webfonts/example.html), and the font license. Copy the folder to a website and include the stylesheet:

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

All four faces use the same CSS family. Regular and Italic use `font-weight: 400`; Bold and Bold Italic use `700`. Upright styles use `font-style: normal`, while italic styles use `italic`. CSS `font-weight: normal` equals `400`, and `bold` equals `700`.

The stylesheet tries WOFF2 first, with WOFF as a fallback. The compressed files preserve the hinted TTFs' outlines, metrics, metadata, features, and hint instructions. See [webfonts/README.md](webfonts/README.md) for deployment details.

`npm run build:web` regenerates only the web fonts and stylesheet from the four tracked TTFs. `npm run test:web` verifies all eight web fonts, their hint preservation, and the CSS family mappings. The main build and test commands include the web fonts as well.

## Preview and review

- [Comparison with Cascadia Code and original Inconsolata](docs/preview.png), at the same 16-pixel size.
- [Stroke comparison against each of the four corresponding Cascadia styles](docs/stroke-comparison.png), at 16 and 24 pixels.
- [All four styles at 10–24 pixels](docs/small-sizes.png).
- [Review findings and remaining limits](docs/REVIEW.md).
- [Machine-readable validation results](docs/validation.json).
- [Web font validation results](docs/web-validation.json).
- [Website example screenshot](docs/web-example.png) and [Chromium validation results](docs/web-browser-validation.json).

The images use FreeType/Cairo. Windows Terminal uses DirectWrite, so its exact antialiasing also depends on your display, DPI, and terminal settings.

## Rebuild

The included bootstrap is for Debian/Ubuntu x86-64, including WSL. It requires Node.js 22+, npm, Python 3 for the FontTools CLI, curl, apt package indexes, `dpkg-deb`, tar, make, a C/C++ compiler, and the system runtime libraries required by FontForge, FreeType, HarfBuzz, and Cairo. It downloads packages into a temporary directory, extracts tools under `.tools/`, and compiles ttfautohint locally. It does not require sudo.

```sh
npm ci --ignore-scripts
npm run bootstrap
npm run build
npm test
npm run preview
```

On other platforms, provide Python 3 with FontTools, FontForge, ttfautohint **1.8.4**, `hb-shape`, `hb-view` with PNG output, and `ots-sanitize` in `PATH`. The environment variables `PYTHON3`, `FONTFORGE`, `TTFAUTOHINT`, `HB_SHAPE`, `HB_VIEW`, and `OTS_SANITIZE` can override the executables. The build invokes FontTools' existing `varLib.instancer` CLI to generate static source instances; all project orchestration is JavaScript.

Previewing includes Cascadia when `reference/CascadiaCode.ttf` exists. Set `CASCADIA_CODE` to override its path. With `reference/CascadiaCodeItalic.ttf` (or `CASCADIA_CODE_ITALIC`) present as well, it also generates the four paired stroke comparisons. Without reference binaries, previews still include original Inconsolata and all four refined styles. The build uses recorded metrics and axes and needs no Cascadia binary or network access after setup.

The build verifies upstream font checksums, removes old instructions before transforming the outlines, and generates fresh hints with:

```text
ttfautohint 1.8.4
--hinting-range-min=8 --hinting-range-max=50 --hinting-limit=200
--increase-x-height=14 --stem-width-mode=qsq --windows-compatibility
--detailed-info --ttfa-table
```

`qsq` means quantized grayscale stems, strong GDI ClearType stems, and quantized DirectWrite ClearType stems. The version and options are embedded in the fonts. The build rejects other ttfautohint versions, including the older system 1.8.3.

Release timestamps are fixed to October 24, 2026, midnight at UTC+08:00. Rebuilding with the same toolchain produces identical TTF checksums. [fonts/build-info.json](fonts/build-info.json) records the release settings and output hashes. [upstream/sources.json](upstream/sources.json) pins the Inconsolata revision and ttfautohint source archive.

The upstream release page listed **1.8.4, released August 21, 2021**, as the current stable ttfautohint release when checked on October 24, 2026. The upstream Inconsolata inputs contain hints from a later development snapshot; those instructions are discarded before this fresh stable-release hinting pass.

## License and credits

Inconsolata Refined is distributed under the [SIL Open Font License 1.1](OFL.txt). Original authorship and license records are retained inside every font. See [upstream/inconsolata/AUTHORS.txt](upstream/inconsolata/AUTHORS.txt).

Sources: [Google Fonts Inconsolata](https://github.com/googlefonts/Inconsolata), [Cascadia Code](https://github.com/microsoft/cascadia-code), [ttfautohint](https://freetype.org/ttfautohint/), and [FontForge](https://fontforge.org/).
