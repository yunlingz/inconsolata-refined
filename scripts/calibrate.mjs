import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { create } from 'fontkit';
import { root, styles, target, sourceBytes, sha256, heartbeat, run, tool } from './lib.mjs';
import { measureStems } from './strokes.mjs';
import { measureSpacing, verticalFit } from './spacing.mjs';
import { refineInstance, cleanOutlines } from './transform.mjs';

const done = heartbeat('Calibrating original Inconsolata against the installed Iosevka faces');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-calibration-'));
try {
  const source = await sourceBytes('Variable'), original = create(source);
  const variable = join(temporary, 'original.ttf');
  await writeFile(variable, source);
  const nativeInstances = new Map();
  const references = {}, fonts = new Map();
  for (const style of styles) {
    const file = `Iosevka-${style.source}.ttc`;
    if (!fonts.has(file)) fonts.set(file, await readFile(join(root, 'reference', file)));
    const bytes = fonts.get(file), faceIndex = style.italic ? 4 : 0;
    const font = create(bytes).fonts[faceIndex];
    assert.equal(font.familyName, target.font);
    assert.equal(font.subfamilyName, style.name);
    assert.equal(font.unitsPerEm, target.unitsPerEm);
    assert.deepEqual([font.ascent, font.descent, font.lineGap], [target.ascender, target.descender, target.lineGap]);
    assert.deepEqual([font['OS/2'].typoAscender, font['OS/2'].typoDescender, font['OS/2'].typoLineGap],
      [target.typoAscender, target.typoDescender, target.typoLineGap]);
    references[style.file] = { file, faceIndex, family: font.familyName, style: font.subfamilyName,
      version: font.version, sha256: sha256(bytes), source: 'Windows-installed SGr-Iosevka collection; normal-width Iosevka face' };
    style.referenceFont = font;
  }
  const cache = new Map();
  function candidate(wght, wdth) {
    const key = `${wght}/${wdth}`;
    if (!cache.has(key)) {
      const f = original.getVariation({ wght, wdth });
      const glyphs = Object.fromEntries(['H', 'n', 'x'].map(c => [c, f.glyphForCodePoint(c.codePointAt(0))]));
      cache.set(key, { glyphs, cell: f.glyphForCodePoint(32).advanceWidth });
    }
    return cache.get(key);
  }
  const calibrated = {};
  for (const style of styles) {
    const ref = style.referenceFont;
    const stems = measureStems(ref), spacing = measureSpacing(ref);
    const shear = style.italic ? Math.tan(target.italicAngle * Math.PI / 180) : 0;
    const unslantedWidth = ['H', 'n'].reduce((sum, c) => {
      const box = ref.glyphForCodePoint(c.codePointAt(0)).path.transform(1, 0, -shear, 1, 0, 0).bbox;
      return sum + box.maxX - box.minX;
    }, 0);
    function evaluate(wght, wdth) {
      const { glyphs, cell } = candidate(wght, wdth);
      const xScale = unslantedWidth / ['H', 'n'].reduce((sum, c) => sum + glyphs[c].bbox.maxX - glyphs[c].bbox.minX, 0);
      const sourceX = glyphs.x.bbox.maxY, sourceCap = glyphs.H.bbox.maxY;
      const mapY = y => y <= sourceX ? y * target.xHeight / sourceX
        : target.xHeight + (y - sourceX) * (target.capHeight - target.xHeight) / (sourceCap - sourceX);
      function transformed(xOffset) {
        const mapped = {};
        for (const [c, glyph] of Object.entries(glyphs)) {
          const path = glyph.path.mapPoints((x, y) => [x * xScale + (target.cellWidth - cell * xScale) / 2
            + xOffset + shear * (mapY(y) - target.capHeight / 2), mapY(y)]);
          mapped[c] = { path, bbox: path.bbox, advanceWidth: target.cellWidth };
        }
        return { unitsPerEm: target.unitsPerEm, glyphForCodePoint: code => mapped[String.fromCodePoint(code)], hasGlyphForCodePoint: () => false };
      }
      const initial = measureSpacing(transformed(0));
      const xOffset = ['H', 'n'].reduce((sum, c) => sum
        + (spacing.inkBounds[c][0] + spacing.inkBounds[c][1] - initial.inkBounds[c][0] - initial.inkBounds[c][1]) / 2, 0) / 2;
      const fitted = transformed(xOffset), measured = measureStems(fitted), fittedSpacing = measureSpacing(fitted);
      const errors = Object.keys(stems).map(key => Math.abs(measured[key] / stems[key] - 1));
      const counterErrors = ['H', 'n'].map(c => Math.abs(fittedSpacing.counters[c] / spacing.counters[c] - 1));
      return { axes: { wght, wdth }, outlineScaleX: xScale, outlineOffsetX: xOffset,
        score: Math.max(...errors) + .15 * Math.max(...counterErrors), stems: measured };
    }
    let best;
    for (let wght = 300; wght <= 825; wght += 25) for (let wdth = 60; wdth <= 130; wdth += 5) {
      const value = evaluate(wght, wdth);
      if (!best || value.score < best.score) best = value;
    }
    const coarse = best.axes;
    for (let wght = coarse.wght - 25; wght <= coarse.wght + 25; wght += 5) {
      for (let wdth = coarse.wdth - 5; wdth <= coarse.wdth + 5; wdth++) {
        const value = evaluate(wght, wdth);
        if (value.score < best.score) best = value;
      }
    }
    async function nativeEvaluate(axes, scaleMultiplier = 1) {
      const key = `${axes.wght}-${axes.wdth}`;
      if (!nativeInstances.has(key)) {
        const path = join(temporary, `source-${key}.ttf`);
        await run(tool('python3'), ['-m', 'fontTools.varLib.instancer', '-q', variable,
          `wght=${axes.wght}`, `wdth=${axes.wdth}`, '-o', path]);
        nativeInstances.set(key, path);
      }
      const input = nativeInstances.get(key), f = create(await readFile(input)), fit = verticalFit(f, target);
      const xScale = unslantedWidth / ['H', 'n'].reduce((sum, c) => {
        const box = f.glyphForCodePoint(c.codePointAt(0)).bbox;
        return sum + box.maxX - box.minX;
      }, 0) * scaleMultiplier;
      const cell = f.glyphForCodePoint(32).advanceWidth;
      const offset = ['H', 'n'].reduce((sum, c) => {
        const path = f.glyphForCodePoint(c.codePointAt(0)).path.mapPoints((x, y) =>
          [x * xScale + (target.cellWidth - cell * xScale) / 2 + shear * (fit.map(y) - target.capHeight / 2), fit.map(y)]);
        return sum + (spacing.inkBounds[c][0] + spacing.inkBounds[c][1] - path.bbox.minX - path.bbox.maxX) / 2;
      }, 0) / 2;
      const settings = { axes, outlineScaleX: xScale, outlineOffsetX: offset };
      const output = join(temporary, 'candidate.ttf');
      await refineInstance(input, output, style, settings, true);
      const font = create(await readFile(output)), measured = measureStems(font), fittedSpacing = measureSpacing(font);
      const errors = Object.keys(stems).map(key => Math.abs(measured[key] / stems[key] - 1));
      const counterErrors = ['H', 'n'].map(c => Math.abs(fittedSpacing.counters[c] / spacing.counters[c] - 1));
      return { ...settings, scaleMultiplier, stems: measured, score: Math.max(...errors) + .15 * Math.max(...counterErrors) };
    }
    const seed = best.axes;
    let nativeBest;
    const finalists = [];
    let count = 0;
    for (const dw of [-10, -5, 0, 5, 10]) for (const dd of [-2, -1, 0, 1, 2]) {
      const value = await nativeEvaluate({ wght: seed.wght + dw, wdth: seed.wdth + dd });
      finalists.push(value);
      if (!nativeBest || value.score < nativeBest.score) nativeBest = value;
      count++;
      if (count % 5 === 0) console.log(`${style.name}: checked ${count}/25 rounded source instances`);
    }
    const balance = 2 / (nativeBest.stems.verticalH / stems.verticalH + nativeBest.stems.verticaln / stems.verticaln);
    for (const delta of [-.004, -.002, 0, .002, .004]) {
      const value = await nativeEvaluate(nativeBest.axes, balance + delta);
      finalists.push(value);
      if (value.score < nativeBest.score) nativeBest = value;
    }
    // Judge finalists on every glyph, not only the calibration stems. Small
    // coordinate changes can remove contacts introduced by TrueType rounding.
    let accepted;
    for (const candidate of finalists.toSorted((a, b) => a.score - b.score)) {
      const input = nativeInstances.get(`${candidate.axes.wght}-${candidate.axes.wdth}`);
      const raw = join(temporary, 'full-candidate.ttf'), clean = join(temporary, 'full-clean.ttf');
      try {
        await refineInstance(input, raw, style, candidate);
        await cleanOutlines(raw, clean, input);
        accepted = candidate;
        break;
      } catch (error) {
        console.log(`${style.name}: rejected full-glyph candidate ${candidate.axes.wght}/${candidate.axes.wdth}: ${error.message.split('\n')[0]}`);
      }
    }
    if (!accepted) throw new Error(`${style.name}: no full-glyph-safe candidate; inspect the native outline audit`);
    best = accepted;
    calibrated[style.file] = { reference: style.file, referenceWeight: style.weight,
      referenceStems: stems, referenceSpacing: spacing, axes: best.axes,
      outlineScaleX: best.outlineScaleX, outlineOffsetX: best.outlineOffsetX,
      xHeight: target.xHeight, capHeight: target.capHeight };
    console.log(`${style.name}: source ${best.axes.wght}/${best.axes.wdth}; x scale ${best.outlineScaleX.toFixed(6)}; max stem error ${Math.max(...Object.keys(stems).map(key => Math.abs(best.stems[key] / stems[key] - 1))).toFixed(4)}`);
  }
  await writeFile(join(root, 'reference/weights.json'), JSON.stringify({
    family: target.font, version: target.version, unitsPerEm: target.unitsPerEm,
    method: 'Original Inconsolata weight/width instances fitted to Iosevka H/n ink widths, independent horizontal placement, and shared vertical landmarks. Native rounded TrueType candidates are compared per style; no glyph-specific weight correction, Iosevka outline, or layout table is copied. Full-glyph audits complement these calibration samples.',
    maxRelativeStrokeError: .05, maxBearingDifference: 16, maxRelativeCounterError: .10,
    references, styles: calibrated,
  }, null, 2) + '\n');
  console.log('Saved reference/weights.json. Final rounded/hinted binaries must still pass npm test.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
