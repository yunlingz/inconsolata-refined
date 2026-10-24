import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { create } from 'fontkit';
import { target, run, tool } from './lib.mjs';

// Upstream supplies no digit anchors. A small, separate mark lookup provides
// fallback attachment without changing original letter anchors or any outlines.
export async function addDigitAnchors(input, output, style) {
  const font = create(await readFile(input));
  const digits = new Map(Array.from({ length: 10 }, (_, i) => {
    const glyph = font.glyphForCodePoint(48 + i); return [glyph.name, glyph];
  }));
  for (const glyph of font.layout('0', ['zero']).glyphs) digits.set(glyph.name, glyph);
  const marks = font.characterSet.filter(code => /\p{M}/u.test(String.fromCodePoint(code)));
  const lines = ['Open($argv[1])',
    'AddLookup("RefinedDigitMarks", "gpos_mark2base", 0, [["mark", [["DFLT", ["dflt"]], ["latn", ["dflt"]]]]])',
    'AddLookupSubtable("RefinedDigitMarks", "RefinedDigitMarkAnchors")'];
  const shear = style.italic ? Math.tan(target.italicAngle * Math.PI / 180) : 0;
  const point = (glyph, name, type, x, y) => {
    lines.push(`Select(${JSON.stringify(glyph.name)})`,
      `AddAnchorPoint(${JSON.stringify(name)}, ${JSON.stringify(type)}, ${Math.round(x)}, ${Math.round(y)})`);
  };
  for (const code of marks) {
    const glyph = font.glyphForCodePoint(code), b = glyph.bbox;
    const name = `RefinedDigitMark${code.toString(16)}`;
    lines.push(`AddAnchorClass(${JSON.stringify(name)}, "default", "RefinedDigitMarkAnchors")`);
    const kind = code === 0x31b ? 'horn' : code >= 0x335 ? 'overlay' : code >= 0x323 ? 'below' : 'above';
    const mx = kind === 'horn' ? b.minX : (b.minX + b.maxX) / 2;
    const my = kind === 'above' || kind === 'horn' ? b.minY : kind === 'below' ? b.maxY : (b.minY + b.maxY) / 2;
    point(glyph, name, 'mark', mx, my);
    for (const digit of digits.values()) {
      const d = digit.bbox, height = b.maxY - b.minY;
      let y = (d.minY + d.maxY) / 2;
      if (kind === 'above') {
        const compact = target.typoAscender - height - 4;
        y = compact >= d.maxY + 1 ? Math.min(d.maxY + 12, compact) : d.maxY + 12;
      } else if (kind === 'below') {
        const ideal = d.minY - ([0x327, 0x328].includes(code) ? 0 : 12);
        const compact = target.typoDescender + height + 4;
        y = compact <= d.minY + 1 ? Math.max(ideal, compact) : ideal;
      }
      else if (kind === 'horn') y = d.maxY - height * .65;
      let x = (d.minX + d.maxX) / 2 + shear * (y - (d.minY + d.maxY) / 2);
      if (kind === 'horn') x = Math.min(d.maxX - 4, target.cellWidth - (b.maxX - b.minX) - 8);
      if (kind === 'above') assert.ok(y >= d.maxY + 1, `${style.name} ${digit.name}: enough room for mark U+${code.toString(16)}`);
      point(digit, name, 'base', x, y);
    }
  }
  lines.push('Generate($argv[2], "", 0x8008)', 'Close()');
  const script = join(dirname(output), 'digit-anchors.pe');
  await writeFile(script, lines.join('\n') + '\n');
  await run(tool('fontforge'), ['-lang=ff', '-script', script, input, output]);
  const after = create(await readFile(output));
  assert.deepEqual(after.availableFeatures.sort(), font.availableFeatures.sort());
  const names = new Map(Array.from({ length: after.numGlyphs }, (_, id) => [after.getGlyph(id).name, after.getGlyph(id)]));
  for (let id = 0; id < font.numGlyphs; id++) {
    const before = font.getGlyph(id), glyph = names.get(before.name);
    assert.equal(glyph.advanceWidth, before.advanceWidth, `${before.name}: anchors preserve advance`);
    assert.deepEqual(glyph.path.commands, before.path.commands, `${before.name}: anchors preserve exact outline`);
  }
  return { method: 'Separate fallback mark lookup for digits, inserted before upstream lookups; original letter anchors retained',
    baseGlyphs: [...digits.keys()], marks: marks.length, outlineAndAdvancePreservation: 'exact for every glyph' };
}
