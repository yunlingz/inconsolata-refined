import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { create } from 'fontkit';
import { root, family, version, styles, target, weightTargets, fontFile, sourceBytes, sha256, heartbeat, tool, run } from './lib.mjs';
import { edges, filledSpans } from './strokes.mjs';
import { validateOutlines } from './transform.mjs';

const done = heartbeat('Auditing size, advances, side bearings, and scanline profiles for every original glyph');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-glyph-audit-'));
const round = n => Number(n.toFixed(3));
const box = glyph => glyph.path.commands.length
  ? [glyph.bbox.minX, glyph.bbox.minY, glyph.bbox.maxX, glyph.bbox.maxY].map(round) : null;
const median = values => {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b), i = sorted.length >> 1;
  return round(sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2);
};
const contourCount = glyph => glyph.path.commands.filter(c => c.command === 'moveTo').length;

function profile(glyph) {
  if (!glyph.path.commands.length) return null;
  const segments = edges(glyph), b = glyph.bbox, widths = [[], []], gaps = [];
  for (const axis of [0, 1]) for (const t of [.2, .35, .5, .65, .8]) {
    const low = axis ? b.minY : b.minX, high = axis ? b.maxY : b.maxX;
    const spans = filledSpans(glyph, axis, low + (high - low) * t, segments);
    widths[axis].push(...spans.map(([a, b]) => b - a).filter(n => n >= 1));
    if (axis === 1) for (let i = 1; i < spans.length; i++) gaps.push(spans[i][0] - spans[i - 1][1]);
  }
  return { verticalCutMedian: median(widths[0]), horizontalCutMedian: median(widths[1]),
    minimumSampledCounter: gaps.length ? round(Math.min(...gaps)) : null,
    verticalCutSpans: widths[0].map(round), horizontalCutSpans: widths[1].map(round) };
}

function spacingAudit(font) {
  const levels = [-200, -100, 40, 100, 182, 260, 340, 420, 500, 620, 700, 800, 900];
  const samples = new Map();
  function sample(code) {
    if (!samples.has(code)) {
      const glyph = font.glyphForCodePoint(code), segments = edges(glyph);
      samples.set(code, levels.map(y => filledSpans(glyph, 1, y, segments)));
    }
    return samples.get(code);
  }
  const ascii = Array.from({ length: 94 }, (_, i) => i + 33);
  const codes = font.characterSet.filter(code => code >= 32 && code !== 0xffff
    && font.glyphForCodePoint(code).advanceWidth === target.cellWidth);
  const pairs = new Set();
  for (const a of ascii) for (const b of ascii) pairs.add(`${a},${b}`);
  for (const a of codes) for (const b of [a, 72, 110, 48, 40, 41, 95]) {
    pairs.add(`${a},${b}`); pairs.add(`${b},${a}`);
  }
  const overlaps = [], ordinary = [];
  let checked = 0;
  for (const pair of pairs) {
    const [a, b] = pair.split(',').map(Number), left = sample(a), right = sample(b);
    let gap = Infinity;
    for (let i = 0; i < levels.length; i++) {
      if (left[i].length && right[i].length) gap = Math.min(gap,
        target.cellWidth + right[i][0][0] - left[i].at(-1)[1]);
    }
    checked++;
    if (!Number.isFinite(gap)) continue;
    const record = { text: String.fromCodePoint(a, b), codePoints: [a, b], gap: round(gap) };
    if (gap < -1) overlaps.push({ ...record, classification: [a, b].some(code => code >= 0x2500 && code <= 0x259f)
      ? 'terminal artwork fills or touches cell edges' : 'requires contextual review' });
    if (/^[A-Za-z0-9]{2}$/.test(record.text)) ordinary.push(record);
  }
  const minimumAlphanumeric = ordinary.toSorted((a, b) => a.gap - b.gap).slice(0, 12);
  assert.ok(minimumAlphanumeric.every(pair => pair.gap > 0), 'Alphanumeric pairs remain separated');
  assert.ok(overlaps.every(pair => pair.classification !== 'requires contextual review'), 'No unexpected nonterminal overlaps');
  return { pairsChecked: checked, scanlineLevels: levels, minimumAlphanumeric, possibleOverlaps: overlaps };
}

try {
  const results = [], referenceBytes = new Map();
  const variableBytes = await sourceBytes('Variable'), variable = create(variableBytes);
  const variableFile = join(temporary, 'original-variable.ttf');
  await writeFile(variableFile, variableBytes);
  for (const style of styles) {
    const bytes = await readFile(fontFile(style)), font = create(bytes);
    const original = create(await sourceBytes(style.source));
    const design = variable.getVariation(weightTargets.styles[style.file].axes);
    const sourceNames = new Map(Array.from({ length: design.numGlyphs }, (_, id) => [design.getGlyph(id).name, design.getGlyph(id)]));
    const axes = weightTargets.styles[style.file].axes;
    const instance = join(temporary, `${style.file}-source.ttf`);
    await run(tool('python3'), ['-m', 'fontTools.varLib.instancer', '-q', variableFile,
      `wght=${axes.wght}`, `wdth=${axes.wdth}`, '-o', instance]);
    const beforeValidation = await validateOutlines(instance, join(temporary, 'source-validation.sfd'));
    const afterValidation = await validateOutlines(fontFile(style), join(temporary, 'output-validation.sfd'));
    const names = new Map(Array.from({ length: font.numGlyphs }, (_, id) => [font.getGlyph(id).name, font.getGlyph(id)]));
    const codes = new Map();
    for (const code of original.characterSet) {
      const name = original.glyphForCodePoint(code).name;
      if (!codes.has(name)) codes.set(name, []);
      codes.get(name).push(code);
    }
    const refSettings = weightTargets.references[style.file], refPath = join(root, 'reference', refSettings.file);
    let reference;
    if (existsSync(refPath)) {
      if (!referenceBytes.has(refPath)) referenceBytes.set(refPath, await readFile(refPath));
      const data = referenceBytes.get(refPath);
      assert.equal(sha256(data), refSettings.sha256);
      reference = create(data).fonts[refSettings.faceIndex];
    }
    const glyphs = [];
    for (let id = 0; id < original.numGlyphs; id++) {
      const before = original.getGlyph(id), glyph = names.get(before.name), codePoints = codes.get(before.name) ?? [];
      assert.ok(glyph, `${style.name}: original glyph ${before.name}`);
      assert.equal(glyph.advanceWidth, before.advanceWidth / 500 * target.cellWidth, `${before.name}: advance`);
      assert.equal(!!glyph.path.commands.length, !!before.path.commands.length, `${before.name}: outline presence`);
      const designBefore = sourceNames.get(before.name);
      const bounds = box(glyph), sourceBounds = box(designBefore), contours = contourCount(glyph);
      const sourceContours = contourCount(designBefore);
      if (bounds) {
        assert.ok(bounds.every(Number.isFinite), `${before.name}: finite geometry`);
        assert.ok(bounds[1] >= target.typoDescender && bounds[3] <= target.typoAscender, `${before.name}: vertical clearance`);
        assert.ok(bounds[0] < bounds[2] && bounds[1] < bounds[3], `${before.name}: nondegenerate ink`);
      }
      const strokes = profile(glyph);
      const sourceFlags = beforeValidation.states.get(before.name) ?? 0;
      const outlineFlags = afterValidation.states.get(before.name) ?? 0;
      const newOutlineFlags = outlineFlags & ~sourceFlags;
      // Missing extrema (0x20) are informational for these quadratic TTFs.
      // All other new validator warnings require investigation.
      assert.equal(newOutlineFlags & ~0x20, 0, `${before.name}: new FontForge outline warnings`);
      const code = codePoints.find(code => code >= 32 && code !== 0xffff && reference?.hasGlyphForCodePoint(code));
      const paired = code === undefined ? null : reference.glyphForCodePoint(code);
      const refBox = paired ? box(paired) : null;
      const comparison = paired ? { codePoint: code, bounds: refBox, advance: paired.advanceWidth, strokeProfile: profile(paired) } : null;
      const notes = [];
      if (contours !== sourceContours) notes.push('contours merged during filled-shape-preserving overlap cleanup');
      if (!codePoints.length) notes.push('unencoded alternate, component, or ligature');
      if (bounds && (bounds[0] < 0 || bounds[2] > glyph.advanceWidth)) notes.push(glyph.advanceWidth === 0 ? 'combining-mark placement' : 'horizontal overhang; review in context');
      glyphs.push({ name: before.name, sourceId: id, outputId: glyph.id, codePoints, advance: glyph.advanceWidth,
        bounds, sourceBounds, sideBearings: bounds ? [bounds[0], round(glyph.advanceWidth - bounds[2])] : null,
        contours, sourceContours, outlineValidation: { sourceFlags, outputFlags: outlineFlags, newFlags: newOutlineFlags },
        strokeProfile: strokes, reference: comparison, notes,
        ...(!codePoints.length && bounds ? { svg: glyph.path.toSVG() } : {}) });
    }
    const spacing = spacingAudit(font);
    results.push({ style: style.name, file: `fonts/InconsolataRefined-${style.file}.ttf`, sha256: sha256(bytes),
      originalGlyphsChecked: glyphs.length, referenceGlyphsCompared: glyphs.filter(g => g.reference).length,
      sourceCoverage: original.characterSet.length, lineBox: [target.typoDescender, target.typoAscender],
      outlineValidation: { sourceMask: beforeValidation.mask, outputMask: afterValidation.mask,
        glyphsWithNewExtremaWarnings: glyphs.filter(g => g.outlineValidation.newFlags).map(g => g.name) },
      assertions: 'All original glyphs retain outlines and advance relationships; finite nondegenerate bounds fit the line box. Cleanup equivalence is checked for every output glyph during build. All alphanumeric pairs have positive sampled clearance. No new non-extrema FontForge validation flags.',
      spacing, glyphs });
    console.log(`AUDIT ${style.name}: all ${glyphs.length} original glyphs, ${glyphs.filter(g => g.reference).length} paired Iosevka profiles, ${spacing.pairsChecked} spacing pairs; ${spacing.possibleOverlaps.length} expected terminal-artwork overlaps`);
  }
  await writeFile(join(root, 'docs/glyph-audit.json'), JSON.stringify({
    family, version, unitsPerEm: target.unitsPerEm,
    method: 'Every original named glyph is checked. Five horizontal and five vertical cuts record filled-span profiles, with the corresponding installed Iosevka character where available. Profiles describe geometry, not a universal stroke-width measurement: contours and letterforms differ. Unencoded feature glyphs have no reliable cross-family glyph-name mapping. Pair checks use actual scanline ink rather than bounding-box overlap.',
    results,
  }) + '\n');
  console.log('Saved docs/glyph-audit.json with per-glyph evidence for all four styles.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
