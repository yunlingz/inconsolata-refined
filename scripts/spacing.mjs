import { filledSpans } from './strokes.mjs';

export const spacingSamples = ['H', 'n'];
export const whitespaceCodes = [0x20, 0xa0, 0x2007, 0x2008, 0x2009, 0x200a];

export function measureSpacing(font) {
  const scale = 1000 / font.unitsPerEm;
  const inkBounds = {}, counters = {};
  for (const character of spacingSamples) {
    const glyph = font.glyphForCodePoint(character.codePointAt(0));
    inkBounds[character] = [glyph.bbox.minX * scale, glyph.bbox.maxX * scale];
    const y = character === 'H' ? glyph.bbox.maxY * .25 : font.glyphForCodePoint(120).bbox.maxY * .35;
    const spans = filledSpans(glyph, 1, y);
    if (spans.length !== 2) throw new Error(`${character}: expected two stems surrounding a counter`);
    counters[character] = (spans[1][0] - spans[0][1]) * scale;
  }
  return {
    inkBounds, counters,
    spaces: Object.fromEntries(whitespaceCodes.filter(code => font.hasGlyphForCodePoint(code))
      .map(code => [code.toString(16), font.glyphForCodePoint(code).advanceWidth * scale])),
  };
}

// Use one monotonic map for all outlines and anchors, fitting accent regions too.
export function verticalFit(font, target) {
  const terminal = new Set(font.characterSet.filter(code => code >= 0x2500 && code <= 0x259f)
    .map(code => font.glyphForCodePoint(code).id));
  let bottom = 0, top = 0;
  for (let id = 0; id < font.numGlyphs; id++) {
    const glyph = font.getGlyph(id);
    if (terminal.has(id) || !glyph.path.commands.length) continue;
    bottom = Math.min(bottom, glyph.bbox.minY);
    top = Math.max(top, glyph.bbox.maxY);
  }
  const knots = [
    [Math.floor(bottom), target.accentBottom],
    [font.glyphForCodePoint(112).bbox.minY, target.letterDescender],
    [font.glyphForCodePoint(72).bbox.minY, 0],
    [font.glyphForCodePoint(120).bbox.maxY, target.xHeight],
    [font.glyphForCodePoint(72).bbox.maxY, target.capHeight],
    [Math.ceil(top), target.accentTop],
  ];
  for (let i = 1; i < knots.length; i++) {
    if (knots[i][0] <= knots[i - 1][0] || knots[i][1] <= knots[i - 1][1]) {
      throw new Error('Vertical fitting requires strictly increasing source and target landmarks');
    }
  }
  const segment = (y, i) => knots[i][1] + (y - knots[i][0])
    * (knots[i + 1][1] - knots[i][1]) / (knots[i + 1][0] - knots[i][0]);
  const map = y => {
    let i = 0;
    while (i < knots.length - 2 && y > knots[i + 1][0]) i++;
    return segment(y, i);
  };
  const slopes = knots.slice(0, -1).map((point, i) =>
    (knots[i + 1][1] - point[1]) / (knots[i + 1][0] - point[0]));
  // FontForge's evaluator crashes on unary minus. Spell negative constants as
  // binary subtraction and compose simple affine/hinge expressions.
  const literal = number => number < 0 ? `(0 - ${-number})` : String(number);
  const expressions = [`y * ${slopes[0]} + ${literal(knots[0][1] - slopes[0] * knots[0][0])}`];
  for (let i = 1; i < slopes.length; i++) {
    const y = knots[i][1];
    expressions.push(`y <= ${literal(y)} ? y : ${literal(y)} + (y - ${literal(y)}) * ${slopes[i] / slopes[i - 1]}`);
  }
  return { knots, map, expressions };
}
