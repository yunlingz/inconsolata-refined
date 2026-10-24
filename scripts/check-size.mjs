import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { create } from 'fontkit';
import { root, version, target, styles, weightTargets, fontFile, referenceFace, sourceBytes, sha256, tool, run, heartbeat } from './lib.mjs';
import { execute, nativeWorkspace } from './native-raster.mjs';
import { terminalSymbols } from './symbols.mjs';

// This report complements the complete native glyph check. Cross-family ink
// area and bounds describe optical presence; neither is a stroke-width proof.
async function sizePage(data) {
  for (const name of ['before', 'after', 'reference']) {
    const face = new FontFace(name, `url("${name}.ttf")`);
    await face.load(); document.fonts.add(face);
  }
  const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 160;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.textBaseline = 'alphabetic'; ctx.fontKerning = 'none';
  const sizes = [10, 12, 14, 16, 18, 20, 24], phases = [0, .25, .5, .75];
  const totals = sizes.map(size => ({ size, before: {}, after: {}, reference: {} })), glyphs = [];
  const fields = ['height', 'coreHeight', 'width', 'ink'];
  function measure(text, family, size, phase) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${size}px "${family}"`; ctx.fillStyle = '#000';
    const m = ctx.measureText(text), x = 48 + phase, y = 100;
    const left = Math.floor(x - m.actualBoundingBoxLeft) - 2;
    const top = Math.floor(y - m.actualBoundingBoxAscent) - 2;
    const w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 5;
    const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 5;
    if (left < 0 || top < 0 || left + w > canvas.width || top + h > canvas.height) throw new Error('Size probe leaves canvas');
    ctx.fillText(text, x, y);
    const rgba = ctx.getImageData(left, top, w, h).data;
    let minX = w, maxX = -1, minY = h, maxY = -1, coreMin = h, coreMax = -1, ink = 0;
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const alpha = rgba[(row * w + col) * 4 + 3] / 255; ink += alpha;
      if (alpha > .1) { minX = Math.min(minX, col); maxX = Math.max(maxX, col); minY = Math.min(minY, row); maxY = Math.max(maxY, row); }
      if (alpha > .5) { coreMin = Math.min(coreMin, row); coreMax = Math.max(coreMax, row); }
    }
    return { height: Math.max(0, maxY - minY + 1), coreHeight: Math.max(0, coreMax - coreMin + 1),
      width: Math.max(0, maxX - minX + 1), ink };
  }
  for (const code of data.codes) {
    const text = String.fromCodePoint(code), rows = [];
    for (const [index, size] of sizes.entries()) {
      const row = { size };
      for (const family of ['before', 'after', 'reference']) {
        const values = phases.map(phase => measure(text, family, size, phase));
        row[family] = Object.fromEntries(fields.map(key => [key, values.reduce((sum, r) => sum + r[key], 0) / phases.length]));
        for (const key of fields) totals[index][family][key] = (totals[index][family][key] ?? 0) + row[family][key];
      }
      rows.push(row);
    }
    glyphs.push({ codePoint: code, text, rows });
  }
  return { platform: navigator.platform, userAgent: navigator.userAgent, sizes, phases,
    charactersCompared: data.codes.length, rasterizations: data.codes.length * sizes.length * phases.length * 3,
    bySize: totals.map(row => ({ ...row, beforeHeightRatio: row.before.height / row.reference.height,
      afterHeightRatio: row.after.height / row.reference.height, beforeInkRatio: row.before.ink / row.reference.ink,
      afterInkRatio: row.after.ink / row.reference.ink })), glyphs };
}

const done = heartbeat('Measuring enlarged size and Cascadia optical presence for every shared printable character');
let native;
try {
  native = await nativeWorkspace();
  const results = [];
  for (const style of styles) {
    console.log(`SIZE ${style.name}: previous release, current release, and corresponding Cascadia Code`);
    const before = await execute('git', ['show', `${target.sizeBaselineRevision}:fonts/InconsolataRefined-${style.file}.ttf`]);
    const after = await readFile(fontFile(style)), a = create(after), prior = create(before);
    const original = create(await sourceBytes(style.source));
    const originalNames = new Set(Array.from({ length: original.numGlyphs }, (_, id) => original.getGlyph(id).name));
    const symbolNames = new Set(terminalSymbols.map(symbol => symbol.name));
    const reference = weightTargets.references[style.file], path = join(root, 'reference', reference.file);
    const raw = await readFile(path); assert.equal(sha256(raw), reference.sha256);
    const ref = referenceFace(raw, reference);
    await run(tool('python3'), ['-m', 'fontTools.varLib.instancer', '-q', path,
      ...Object.entries(reference.axes).map(([axis, value]) => `${axis}=${value}`), '-o', join(native.directory, 'reference.ttf')]);
    await writeFile(join(native.directory, 'before.ttf'), before);
    await writeFile(join(native.directory, 'after.ttf'), after);
    const codes = a.characterSet.filter(code => code >= 32 && code !== 0xffff && prior.hasGlyphForCodePoint(code)
      && ref.hasGlyphForCodePoint(code) && a.glyphForCodePoint(code).path.commands.length
      && ref.glyphForCodePoint(code).path.commands.length);
    const result = await native.page(`(${sizePage.toString()})(${JSON.stringify({ codes })})`, 'size-' + style.file);
    for (let id = 0; id < a.numGlyphs; id++) {
      assert.equal(a.getGlyph(id).name, prior.getGlyph(id).name, 'Every output glyph retained');
      const scaled = originalNames.has(a.getGlyph(id).name) || symbolNames.has(a.getGlyph(id).name);
      if (!scaled) assert.equal(a.getGlyph(id).path.commands.length, 0, 'Only generated empty controls retain em-based advances');
      assert.equal(a.getGlyph(id).advanceWidth, Math.round(prior.getGlyph(id).advanceWidth * (scaled ? target.sizeScale : 1)),
        'Original and symbol advances scale; generated empty controls retain em-based advances');
    }
    results.push({ style: style.name, sha256: sha256(after), baselineSha256: sha256(before), referenceSha256: reference.sha256,
      referenceAxes: reference.axes, allGlyphAdvancesChecked: a.numGlyphs, ...result });
    console.log(`SIZE ${style.name}: ${codes.length} shared characters; ${result.rasterizations.toLocaleString()} rasterizations; all ${a.numGlyphs} advances verified`);
  }
  await writeFile(join(root, 'docs/size-review.json'), JSON.stringify({ fontVersion: version,
    baselineVersion: target.sizeBaselineVersion, baselineRevision: target.sizeBaselineRevision, sizeScale: target.sizeScale,
    method: 'Actual native Windows Chromium alpha masks, seven text sizes and four horizontal phases, for every shared printable character. Heights and widths use 10% alpha; core heights use 50%; ink is the alpha sum. Before and after use the same requested size and corresponding static Cascadia Code weights. Cross-family ink/bounds describe optical presence, not universal stroke equality or readability. Original and symbol advances grow proportionally; generated empty controls retain em-based advances. Separate glyph/raster audits cover every unencoded and nonshared glyph.',
    results }) + '\n');
  console.log('Saved docs/size-review.json.');
} finally { if (native) await native.close(); done(); }
