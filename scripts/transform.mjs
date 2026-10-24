import { readFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { create } from 'fontkit';
import { root, target, version, tool, run } from './lib.mjs';
import { verticalFit } from './spacing.mjs';
import assert from 'node:assert/strict';
import { edges, filledSpans } from './strokes.mjs';

export async function validateOutlines(file, saved) {
  const { stdout } = await run(tool('fontforge'), ['-lang=ff', '-script', join(root, 'scripts/check-outlines.pe'), file, saved]);
  const states = new Map();
  let name;
  for (const line of (await readFile(saved, 'utf8')).split('\n')) {
    if (line.startsWith('StartChar: ')) name = line.slice(11);
    else if (line.startsWith('Validated: ')) states.set(name, Number(line.slice(11)) & ~1);
  }
  return { mask: Number(stdout.trim()), states };
}

export async function cleanOutlines(input, output, baseline) {
  const original = await validateOutlines(baseline, join(dirname(output), 'source-validation.sfd'));
  const current = await validateOutlines(input, join(dirname(output), 'raw-validation.sfd'));
  const repairedGlyphs = [...current.states].filter(([name, flags]) =>
    (flags & ~(original.states.get(name) ?? 0)) & (0x4 | 0x8)).map(([name]) => name);
  if (repairedGlyphs.length) {
    await run(tool('fontforge'), ['-lang=ff', '-script', join(root, 'scripts/clean-outlines.pe'), input, output, ...repairedGlyphs]);
  } else await copyFile(input, output);
  const cleaned = await validateOutlines(output, join(dirname(output), 'clean-validation.sfd'));
  for (const [name, flags] of cleaned.states) assert.equal((flags & ~(original.states.get(name) ?? 0)) & ~0x20,
    0, `${name}: unresolved contour-validation warning after cleanup`);
  const before = create(await readFile(input)), after = create(await readFile(output));
  const names = new Map(Array.from({ length: after.numGlyphs }, (_, id) => [after.getGlyph(id).name, after.getGlyph(id)]));
  let maximumCutDifference = 0, comparisons = 0;
  const changedContours = [];
  for (let id = 0; id < before.numGlyphs; id++) {
    const a = before.getGlyph(id), b = names.get(a.name);
    assert.ok(b, `${a.name}: retained after contour cleanup`);
    assert.equal(a.advanceWidth, b.advanceWidth, `${a.name}: cleanup advance`);
    assert.equal(!!a.path.commands.length, !!b.path.commands.length, `${a.name}: cleanup ink`);
    if (!a.path.commands.length) continue;
    const contours = glyph => glyph.path.commands.filter(p => p.command === 'moveTo').length;
    if (contours(a) !== contours(b)) changedContours.push(a.name);
    for (const property of ['minX', 'minY', 'maxX', 'maxY']) assert.ok(Math.abs(a.bbox[property] - b.bbox[property]) <= 1.01, `${a.name}: cleanup bounds ${property}`);
    const segments = [edges(a), edges(b)];
    for (const axis of [0, 1]) for (const t of [.1, .2, .35, .5, .65, .8, .9]) {
      const low = axis ? a.bbox.minY : a.bbox.minX, high = axis ? a.bbox.maxY : a.bbox.maxX;
      const cuts = [a, b].map((glyph, index) => filledSpans(glyph, axis, low + t * (high - low), segments[index]));
      const events = cuts.flatMap((spans, set) => spans.flatMap(([start, end]) =>
        [{ position: start, set, delta: 1 }, { position: end, set, delta: -1 }])).sort((a, b) => a.position - b.position);
      const active = [0, 0]; let previous = events[0]?.position, difference = 0;
      for (const event of events) {
        if (!!active[0] !== !!active[1]) difference += event.position - previous;
        active[event.set] += event.delta; previous = event.position;
      }
      const length = cuts[0].reduce((sum, [a, b]) => sum + b - a, 0);
      // Each filled interval has two rounded boundaries. Several thin strokes
      // can accumulate harmless sub-unit changes, so account for their count.
      assert.ok(difference <= Math.max(2 * Math.max(1, cuts[0].length, cuts[1].length), length * .015), `${a.name}: cleanup changes filled cut by ${difference} units`);
      maximumCutDifference = Math.max(maximumCutDifference, difference); comparisons++;
    }
  }
  return { method: 'Repair only newly introduced contour intersections/directions; retain other outlines. No glyph-specific redrawing.', repairedGlyphs,
    glyphsChecked: before.numGlyphs, scanlineComparisons: comparisons,
    maximumCutDifference, permittedCutDifference: 'max(2 units per filled interval, 1.5% of filled span length)', changedContours };
}

export async function refineInstance(input, output, style, settings, samples = false) {
  const font = create(await readFile(input)), fitting = verticalFit(font, target);
  const sourceCell = font.glyphForCodePoint(32).advanceWidth;
  const { stdout } = await run(tool('fontforge'), [
    '-lang=ff', '-script', join(root, 'scripts/refine.pe'),
    input, output, style.file, style.name, style.weight === 700 ? 'Bold' : 'Regular', style.italic ? '1' : '0',
    String(target.xHeight), String(target.unitsPerEm), String(target.cellWidth),
    String(target.typoAscender), String(target.typoDescender),
    String(settings.outlineScaleX), String(sourceCell / font.unitsPerEm), version,
    fitting.expressions[0], String(target.ascender), String(target.descender), String(target.lineGap),
    String(target.typoLineGap), String(target.italicAngle), String(settings.outlineOffsetX), String(target.capHeight),
    ...fitting.expressions.slice(1), samples ? 'samples' : 'all', output + '.sfd',
  ]);
  return { verticalLandmarks: fitting.knots, ...JSON.parse(stdout.trim()) };
}
