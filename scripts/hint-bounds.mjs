import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create } from 'fontkit';
import { root, version, styles, glyphInstructions, sfntTables, sha256, heartbeat } from './lib.mjs';
import { nativeWorkspace, probeFont } from './native-raster.mjs';
import { modeCandidate, hintFingerprint } from './hinting-candidates.mjs';
import { inkTools } from './ink-profile.mjs';
import { nativeBaseline } from './native-baseline.mjs';

async function boundsPage(data, makeInkTools) {
  const ink = makeInkTools(), direct = [], failures = [];
  for (const [name, file] of Object.entries(data.fonts)) {
    const face = new FontFace(name, `url("${file}")`); await face.load(); document.fonts.add(face);
  }
  let cases = 0;
  const modeFor = (g, size) => ['n', 's'].find(mode => g.selection?.[mode].some(([low, high]) => size >= low && size <= high)) ?? 'q';
  for (const g of data.glyphs) {
    if (!g.bounds || g.terminal || !g.hasInstructions) continue;
    const badSizes = new Set(); let maximum = 0;
    for (const size of data.settings.sizes) for (const phase of data.settings.phases) {
      const result = ink.render(modeFor(g, size), g, size, phase, 0, false, false);
      const deviation = ink.boundsError(result, g, size, phase); cases++;
      maximum = Math.max(maximum, deviation);
      if (deviation > 2 + size / 16) badSizes.add(size);
    }
    if (!badSizes.size && !g.directRequired) continue;
    const reference = ink.outline(g);
    let unhintedMaximum = 0, safe = true;
    for (const size of data.settings.sizes) for (const phase of data.settings.phases) {
      const hinted = ink.render(modeFor(g, size), g, size, phase, 0, false);
      const source = ink.render('geometryBaseline', g, size, phase, 0, false);
      const unhinted = ink.render('u', g, size, phase, 0, false), counts = ink.resolvable(reference, size, data.settings);
      const error = ink.boundsError(unhinted, g, size, phase); cases++; unhintedMaximum = Math.max(unhintedMaximum, error);
      if (error > 2 + size / 16 || unhinted.clipped || (hinted.signal > .1 && unhinted.signal <= .1)) safe = false;
      for (const field of ['counters', 'parts']) {
        if (field === 'counters' && unhinted.topology[1][field] < Math.min(counts[field], source.topology[1][field])) safe = false;
        if (Math.max(...unhinted.topology.map(t => t[field])) < Math.min(counts[field], Math.max(...source.topology.map(t => t[field])))) safe = false;
      }
    }
    const result = { id: g.id, name: g.name, failingSizes: [...new Set([...badSizes, ...(g.directRequired?.failingSizes ?? [])])],
      reason: g.directRequired ? 'No natural/quantized/strong mode preserves resized-source details' : 'Hint displacement exceeds the outline bounds budget',
      maximumHintedDeviationPx: maximum,
      maximumDirectDeviationPx: unhintedMaximum };
    if (safe) direct.push(result); else failures.push(result);
  }
  return { platform: navigator.platform, userAgent: navigator.userAgent, cases, direct, failures };
}

export async function calibrateHintBounds(policy, inputs, geometryReferences) {
  const native = await nativeWorkspace(), reports = [];
  try {
    for (const style of styles) {
      console.log('HINT BOUNDS ' + style.name + ': every glyph and fitting size');
      const base = await readFile(join(inputs, 'InconsolataRefined-' + style.file + '.ttf')), font = create(base), tables = sfntTables(base);
      const fonts = {};
      for (const mode of ['q', 'n', 's', 'u']) {
        fonts[mode] = mode + '.ttf'; const bytes = modeCandidate(base, mode);
        await writeFile(join(native.directory, fonts[mode]), probeFont(bytes, create(bytes)));
      }
      fonts.geometryBaseline = 'geometry-baseline.ttf';
      await writeFile(join(native.directory, fonts.geometryBaseline),
        probeFont(geometryReferences?.get(style.file) ?? await nativeBaseline(style, inputs), font));
      const terminal = new Set(font.characterSet.filter(code => code >= 0x2500 && code <= 0x259f).map(code => font.glyphForCodePoint(code).id));
      const glyphs = Array.from({ length: font.numGlyphs }, (_, id) => {
        const g = font.getGlyph(id);
        return { id, name: g.name, advance: g.advanceWidth,
          bounds: g.path.commands.length ? [g.bbox.minX, g.bbox.minY, g.bbox.maxX, g.bbox.maxY] : null,
          commands: g.path.commands, selection: policy.styles[style.file].selections[g.name], terminal: terminal.has(id),
          directRequired: policy.styles[style.file].directRasterGlyphs?.[g.name],
          hasInstructions: glyphInstructions(tables, id).length > 0 };
      });
      const result = await native.page(`(${boundsPage.toString()})(${JSON.stringify({ fonts, glyphs, settings: policy.selection })},${inkTools.toString()})`, 'bounds-' + style.file);
      assert.deepEqual(result.failures, [], style.name + ': direct fallback must preserve bounds and resolvable details at every tested size');
      const records = {};
      for (const entry of result.direct) {
        records[entry.name] = { ...entry, sourceProgramSha256: sha256(glyphInstructions(tables, entry.id)) };
        delete policy.styles[style.file].selections[entry.name];
      }
      policy.styles[style.file].directRasterGlyphs = records;
      policy.styles[style.file].baseHintSha256 = hintFingerprint(base, policy.preservedGlyphCount,
        new Map(result.direct.map(entry => [entry.id, Buffer.alloc(0)])));
      reports.push({ style: style.name, sourceSha256: sha256(base), ...result });
      console.log('HINT BOUNDS ' + style.name + ': ' + result.cases + ' cases; ' + result.direct.length + ' unsafe hint programs bypassed');
    }
    return { fontVersion: version, method: 'Test every hinted glyph at all fitted sizes/phases against its outline bounds. Allow 2 px plus PPEM/16. Programs exceeding this budget, or whose fitting modes lose resolvable source details, can be bypassed only after direct rendering passes bounds, visibility and detail checks across the entire range. Detail reference: uncompensated original-source resize at the same new design axes and dimensions. No character-name selection rules.', results: reports };
  } finally { await native.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = process.argv.find(arg => arg.startsWith('--inputs='));
  assert.ok(argument, 'Pass the original-source calibration input directory with --inputs=');
  const done = heartbeat('Checking hint displacement against every original-source outline');
  try {
    const policy = JSON.parse(await readFile(join(root, 'reference/hinting.json'), 'utf8'));
    const report = await calibrateHintBounds(policy, resolve(argument.slice('--inputs='.length)));
    const bytes = Buffer.from(JSON.stringify(policy, null, 2) + '\n'); await writeFile(join(root, 'reference/hinting.json'), bytes);
    await writeFile(join(root, 'docs/hint-bounds.json'), JSON.stringify(report, null, 2) + '\n');
    const review = JSON.parse(await readFile(join(root, 'docs/hinting-review.json'), 'utf8'));
    review.policySha256 = sha256(bytes); review.boundsSafety = report;
    for (const style of styles) {
      const result = review.results.find(row => row.style === style.name);
      result.calibrationBaseHintSha256 ??= result.baseHintSha256;
      result.baseHintSha256 = policy.styles[style.file].baseHintSha256;
      result.directRasterGlyphs = policy.styles[style.file].directRasterGlyphs;
      result.fittingMetricsStage = 'before final hint-bounds safeguard';
    }
    await writeFile(join(root, 'docs/hinting-review.json'), JSON.stringify(review, null, 2) + '\n');
  } finally { done(); }
}
