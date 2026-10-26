# Inconsolata Refined Nerd

Install all four TTFs and select **Inconsolata Refined Nerd** in your terminal or editor. The embedded family name has exactly that spelling, with no trailing period and no additional “Font” or “Mono” suffix. Regular/Italic use weight 400; Bold/Bold Italic use 700.

| Style | File |
| --- | --- |
| Regular | [InconsolataRefinedNerd-Regular.ttf](InconsolataRefinedNerd-Regular.ttf) |
| Italic | [InconsolataRefinedNerd-Italic.ttf](InconsolataRefinedNerd-Italic.ttf) |
| Bold | [InconsolataRefinedNerd-Bold.ttf](InconsolataRefinedNerd-Bold.ttf) |
| Bold Italic | [InconsolataRefinedNerd-BoldItalic.ttf](InconsolataRefinedNerd-BoldItalic.ttf) |

These editions add the complete **Nerd Fonts 3.5.1** patch set to the corresponding version 1.600 base fonts. Every one of the **10,995 registered icon names**, including aliases and supplementary-plane Material Design icons, has a supported code point. Complete patching also includes Braille and the patcher's additional symbols. Each face contains **11,847 glyphs / 11,764 mapped characters**, including **10,879 added characters**.

Every added character advances exactly **540 font units**, the same **0.54 em** cell as the base font. The build uses `--single-width-glyphs`; the original zero-width marks and multiple-cell ligatures keep their existing advances. Powerline separators retain their intentional seam overlap (up to 32 units horizontally and 7 vertically); their advance remains one cell. Applications can still apply their own icon or terminal-column rules.

All **968 original glyphs** retain their exact glyph IDs, outline bytes, bearings, advances and custom hints. Original OpenType layout and global hint tables are preserved byte for byte. Icons use the patcher's unhinted outlines. `--careful` preserves the original heart at U+2665, which shares a code point with `oct-heart`; the complete symbol repertoire remains available. U+2800 and Codicons' U+EC03 are intentionally blank.

Build with `npm run build:nerd`; verify with `npm run test:nerd`. The main `npm run build` and `npm test` commands include these editions. The pinned official patcher archive and glyph registry are tracked under [upstream/nerd-fonts](../upstream/nerd-fonts/), so builds need no downloads. FontForge is bounded to 180 seconds and 1 GiB for this larger operation. The normal base build retains its shorter timeout.

See the [preview](../docs/nerd-preview.png), [complete validation report](../docs/nerd-validation.json), [reproducibility report](../docs/nerd-reproducibility.json), and [build manifest](build-info.json). Native Windows installation and application rendering remain a manual check. The base TTFs and web fonts retain their separate family and files.

Keep [OFL.txt](OFL.txt) and the [licenses directory](licenses/) with redistributed fonts. Original Inconsolata authorship is retained; icon authors, sources and supplied licenses are listed in [icon-sets.md](licenses/icon-sets.md) and [Nerd Fonts' license](licenses/NERD-FONTS-LICENSE.md).
