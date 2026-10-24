# Inconsolata Refined web fonts

This folder is ready to copy to a website. It contains Regular, Italic, Bold, and Bold Italic in both WOFF2 and WOFF, the shared family stylesheet, a standalone HTML example, and the font license.

The current fonts are version **1.300**. Size, stroke weight, and spacing are calibrated against the corresponding Windows-installed Iosevka 33.3.5 styles. These exports come from the same newly hinted TTFs in `fonts/`, including size-aware stem refinement and repaired terminal-art rendering. Every outline and advance remains identical to version 1.200.

```html
<link rel="stylesheet" href="./inconsolata-refined.css">
<style>
  .sample { font-family: 'Inconsolata Refined', monospace; }
</style>
<p class="sample">
  Regular <em>Italic</em> <strong>Bold</strong>
  <strong><em>Bold Italic</em></strong>
</p>
```

| Style | CSS weight | CSS style |
| --- | --- | --- |
| Regular | `400` or `normal` | `normal` |
| Italic | `400` or `normal` | `italic` |
| Bold | `700` or `bold` | `normal` |
| Bold Italic | `700` or `bold` | `italic` |

`regular` is a font style name, not a CSS `font-style` value. All four `@font-face` rules use the family `Inconsolata Refined`. Browsers select the matching style through weight and style, including standard `strong` and `em` elements.

The stylesheet tries WOFF2 first and WOFF second, with `font-display: swap`. Paths are relative to the stylesheet. Serve this folder with a static web server and open `example.html` to try the four styles and size slider. Serve `.woff2` as `font/woff2`, `.woff` as `font/woff`, and `.css` as `text/css`. If fonts are hosted on a different origin, configure that server's CORS headers to allow the site.

The fonts retain the hinted TTFs' complete character coverage, OpenType features, style metadata, and hint instructions. Native spacing uses a 0.5 em cell and 1.25 em line. The example sets line-height, letter-spacing, and word-spacing to normal so these metrics are visible. Very tall/stacked combining sequences may need larger application line spacing. Italic styles are 9-degree obliques. Keep `OFL.txt` with redistributed font files.

From the repository root, `npm run build:web` regenerates the font files and CSS from the four tracked TTFs. `npm run test:web` checks both formats, including glyph geometry, hints, metadata, and OpenType Sanitizer. Output hashes are in `build-info.json`.
