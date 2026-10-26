# Inconsolata Refined Nerd

Install all four version **1.601** TTFs, replace the previous Nerd editions, restart your terminal/editor, and select **Inconsolata Refined Nerd**. The embedded family name has exactly that spelling, with no trailing period and no additional “Font” or “Mono” suffix. Regular/Italic use weight 400; Bold/Bold Italic use 700.

| Style | File |
| --- | --- |
| Regular | [InconsolataRefinedNerd-Regular.ttf](InconsolataRefinedNerd-Regular.ttf) |
| Italic | [InconsolataRefinedNerd-Italic.ttf](InconsolataRefinedNerd-Italic.ttf) |
| Bold | [InconsolataRefinedNerd-Bold.ttf](InconsolataRefinedNerd-Bold.ttf) |
| Bold Italic | [InconsolataRefinedNerd-BoldItalic.ttf](InconsolataRefinedNerd-BoldItalic.ttf) |

These editions apply the complete **Nerd Fonts 3.5.1** patch set to the corresponding version 1.600 base fonts. Every one of the **10,995 registered icon names**, including aliases and supplementary-plane Material Design icons, uses a Nerd-provided glyph. Complete patching includes the entire box-drawing/block set, Braille and additional patcher symbols. Nerd Fonts supplies **11,040 characters**: **10,879 additions and 161 replacements**. Each face contains **12,008 glyphs / 11,764 mapped characters**.

Every added or replaced character advances exactly **540 font units**, the same **0.54 em** cell as the base font. The build uses `--single-width-glyphs`; other original zero-width marks and multiple-cell ligatures keep their existing advances. Powerline separators retain their intentional seam overlap (up to 32 units horizontally and 7 vertically); their advance remains one cell. Applications can still apply their own icon or terminal-column rules.

**Nerd Fonts wins at every shared code point.** This currently replaces U+2665 with `oct-heart` and all 160 characters in U+2500–U+259F with Nerd Fonts artwork. The patcher uses `--boxdrawing` and an ASCII-only seed to supply every symbol set, with no `--careful` restriction. Other original Unicode mappings remain unchanged. All **968 original glyph records**, including unencoded alternates, remain intact for stable layout/hint references; overlapping character mappings select the appended Nerd outlines. Original OpenType layout and global hint tables are preserved byte for byte. Nerd symbols are unhinted. U+2800 and Codicons' U+EC03 are intentionally blank.

Build with `npm run build:nerd`; verify with `npm run test:nerd`. The main `npm run build` and `npm test` commands include these editions. The pinned official patcher archive and glyph registry are tracked under [upstream/nerd-fonts](../upstream/nerd-fonts/), so builds need no downloads. FontForge is bounded to 180 seconds and 1 GiB for this larger operation. The normal base build retains its shorter timeout.

See the [preview](../docs/nerd-preview.png), [complete validation report](../docs/nerd-validation.json), [reproducibility report](../docs/nerd-reproducibility.json), and [build manifest](build-info.json). Native Windows installation and application rendering remain a manual check. The base TTFs and web fonts retain their separate family and files.

Keep [OFL.txt](OFL.txt) and the [licenses directory](licenses/) with redistributed fonts. Original Inconsolata authorship is retained; icon authors, sources and supplied licenses are listed in [icon-sets.md](licenses/icon-sets.md) and [Nerd Fonts' license](licenses/NERD-FONTS-LICENSE.md).
