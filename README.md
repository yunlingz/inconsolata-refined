# Inconsolata Refined

Four static TrueType fonts based on Inconsolata 3.100, enlarged for terminal settings that suit Cascadia Code and freshly hinted with **ttfautohint 1.8.4**.

| Style | Installable file |
| --- | --- |
| Regular | [InconsolataRefined-Regular.ttf](fonts/InconsolataRefined-Regular.ttf) |
| Italic | [InconsolataRefined-Italic.ttf](fonts/InconsolataRefined-Italic.ttf) |
| Bold | [InconsolataRefined-Bold.ttf](fonts/InconsolataRefined-Bold.ttf) |
| Bold Italic | [InconsolataRefined-BoldItalic.ttf](fonts/InconsolataRefined-BoldItalic.ttf) |

Install all four files, then choose **Inconsolata Refined** in your terminal or editor. On Windows, select the four TTFs in `fonts/`, right-click **Install**, and restart the application. Keep the font size you used for Cascadia Code when comparing.

The styles belong to one family, with weight and italic flags set so applications can select the real Bold and Italic files.

## Size and design

The sizing reference is your Windows-installed Cascadia Code 2102.025. Its measured metrics and checksum are recorded in [reference/metrics.json](reference/metrics.json). The reference binary remains local and is excluded from Git.

| Metric, as a fraction of an em | Original Inconsolata Regular | Cascadia Code reference | Refined Regular |
| --- | ---: | ---: | ---: |
| Character advance | 0.50000 | 0.58594 | 0.58594 |
| Lowercase x height | 0.45700 | 0.51758 | 0.51758 |
| Capital height | 0.62300 | 0.69336 | 0.70557 |
| Typographic line height | 1.04900 | 1.16211 | 1.16211 |

Letter outlines are uniformly enlarged **13.26%**, preserving their proportions. Additional side bearings give the exact Cascadia cell width, **17.19%** wider than the original. Line height increases **10.78%**. Capitals remain about 1.8% taller than Cascadia's, a deliberate tradeoff that preserves Inconsolata's proportions while matching lowercase height.

Both weights use the same transformation. Bold retains its original slightly larger lowercase height. The output uses a 2048-unit em, a 1200-unit cell, ascent 1900, descent -480, and zero line gap. Windows clipping bounds cover the actual outlines; typographic and horizontal metrics use the chosen line spacing.

Upstream Inconsolata supplies upright designs. **Italic and Bold Italic are 12-degree obliques** derived from those designs. They retain Inconsolata's letterforms rather than introducing newly drawn cursive forms. Box drawing and block characters remain upright and are fitted separately to the terminal cell.

Original glyphs, combining marks, optional ligatures, stylistic sets, alternate zero, and other OpenType features are preserved. The source fonts are stored as lossless `.ttf.gz` inputs, so the only tracked `.ttf` files are the four finished faces.

## Preview and review

- [Comparison with Cascadia Code and original Inconsolata](docs/preview.png), at the same 16-pixel size.
- [All four styles at 10–24 pixels](docs/small-sizes.png).
- [Review findings and remaining limits](docs/REVIEW.md).
- [Machine-readable validation results](docs/validation.json).

The images use FreeType/Cairo. Windows Terminal uses DirectWrite, so its exact antialiasing also depends on your display, DPI, and terminal settings.

## Rebuild

The included bootstrap is for Debian/Ubuntu x86-64, including WSL. It requires Node.js 22+, npm, curl, apt package indexes, `dpkg-deb`, tar, make, a C/C++ compiler, and the system runtime libraries required by FontForge, FreeType, HarfBuzz, and Cairo. It downloads packages into a temporary directory, extracts tools under `.tools/`, and compiles ttfautohint locally. It does not require sudo.

```sh
npm ci --ignore-scripts
npm run bootstrap
npm run build
npm test
npm run preview
```

On other platforms, provide FontForge, ttfautohint **1.8.4**, `hb-shape`, `hb-view` with PNG output, and `ots-sanitize` in `PATH`. The environment variables `FONTFORGE`, `TTFAUTOHINT`, `HB_SHAPE`, `HB_VIEW`, and `OTS_SANITIZE` can override the executables. `npm run build` needs only FontForge and ttfautohint; the other tools perform verification and make previews.

Previewing includes Cascadia when `reference/CascadiaCode.ttf` exists. Alternatively, set `CASCADIA_CODE` to a reference font path. Without a reference binary, previews still include original Inconsolata and all four refined styles. The build itself uses recorded metrics and needs no Cascadia binary or network access after setup.

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
