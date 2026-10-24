import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PNG } from 'pngjs';
import { create } from 'fontkit';
import { root, version, family, styles, target, hintPolicy, weightTargets, fontFile, sourceBytes, tool, run,
  referenceFace, sfntTables, glyphInstructions, glyphGeometryHash, sha256, heartbeat } from './lib.mjs';
import { hintGlyphSets, modeHintProgram, restoreHintProgram } from './hinting.mjs';
import { baselineHintPrograms, measuredHintPrograms, modeCandidate, hintFingerprint } from './hinting-candidates.mjs';
import { execute, probeFont, outlineTopology, nativeWorkspace } from './native-raster.mjs';
import { inkTools } from './ink-profile.mjs';
import { rasterPage } from './raster-page.mjs';
import { terminalSymbols } from './symbols.mjs';
import { nativeBaseline } from './native-baseline.mjs';

const done = heartbeat('Checking every glyph at 8–50 px and eight phases in native Windows Chromium');
const checkpointArgument = process.argv.find(arg => arg.startsWith('--checkpoint-dir='));
const checkpointDirectory = checkpointArgument ? resolve(checkpointArgument.slice('--checkpoint-dir='.length))
  : await mkdtemp(join(tmpdir(), 'inconsolata-raster-checkpoints-'));
const onlyStyle = process.argv.find(arg => arg.startsWith('--style='))?.slice('--style='.length);
if (onlyStyle) assert.ok(styles.some(style => style.file === onlyStyle), 'Known style');
let native;
try {
  await mkdir(checkpointDirectory, { recursive: true });
  native = await nativeWorkspace();
  const web = JSON.parse(await readFile(join(root, 'webfonts/build-info.json'), 'utf8'));
  const build = JSON.parse(await readFile(join(root, 'fonts/build-info.json'), 'utf8'));
  const baselineBuild = JSON.parse((await execute('git', ['show', hintPolicy.baselineRevision + ':fonts/build-info.json'])).toString('utf8'));
  const references = new Map(), results = [], panels = [], fontHashes = [];
  const fingerprint = sha256(Buffer.from(JSON.stringify({ build, web, hintPolicy, weightTargets, target,
    scripts: await Promise.all(['check-raster.mjs', 'raster-page.mjs', 'ink-profile.mjs', 'native-raster.mjs',
      'native-baseline.mjs', 'hinting-candidates.mjs', 'hinting.mjs', 'lib.mjs', 'transform.mjs', 'symbols.mjs', 'refine.pe', 'spacing.mjs']
      .map(async file => sha256(await readFile(join(root, 'scripts', file))))) })));
  const failures = ['vanished', 'clipped', 'counterRegressions', 'unexpectedChanges', 'boundErrors',
    'strokeBalanceErrors', 'headerErrors', 'detailRegressions', 'modeMismatches'];
  for (const style of styles) {
    const checkpointFile = join(checkpointDirectory, style.file + '.json');
    const checkpointPanel = join(checkpointDirectory, style.file + '.png');
    let cached;
    try { cached = JSON.parse(await readFile(checkpointFile, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    if (cached?.fingerprint === fingerprint && cached.result.style === style.name
      && cached.result.sha256 === sha256(await readFile(fontFile(style)))
      && cached.resultSha256 === sha256(Buffer.from(JSON.stringify(cached.result)))) {
      const panel = await readFile(checkpointPanel);
      assert.equal(sha256(panel), cached.panelSha256, 'Checkpoint comparison image checksum');
      for (const key of failures) assert.deepEqual(cached.result[key], [], 'Completed checkpoint remains valid');
      results.push(cached.result); panels.push(PNG.sync.read(panel));
      fontHashes.push({ file: 'fonts/InconsolataRefined-' + style.file + '.ttf', sha256: cached.result.sha256 });
      console.log('RASTER ' + style.name + ': reused complete, fingerprint-verified checkpoint');
      continue;
    }
    if (onlyStyle && style.file !== onlyStyle) continue;
    console.log('RASTER ' + style.name + ': all glyphs, local ink, counters, parts, modes, bounds, and headers');
    const beforeBytes = await execute('git', ['show', hintPolicy.baselineRevision + ':fonts/InconsolataRefined-' + style.file + '.ttf']);
    const afterBytes = await readFile(fontFile(style));
    const before = create(beforeBytes), after = create(afterBytes), original = create(await sourceBytes(style.source));
    assert.equal(glyphGeometryHash(before, hintPolicy.preservedGlyphCount), hintPolicy.previousGeometrySha256[style.file]);
    assert.equal(glyphGeometryHash(after, hintPolicy.preservedGlyphCount), hintPolicy.geometrySha256[style.file], 'Reviewed geometry is exact');
    assert.equal(before.numGlyphs, after.numGlyphs);
    assert.deepEqual(before.availableFeatures.toSorted(), after.availableFeatures.toSorted(), 'Original layout features preserved');
    const advanceScale = target.cellWidth / baselineBuild.targetMetrics.cellWidth;
    const originalNames = new Set(Array.from({ length: original.numGlyphs }, (_, id) => original.getGlyph(id).name));
    const symbolNames = new Set(terminalSymbols.map(symbol => symbol.name));
    for (let id = 0; id < before.numGlyphs; id++) {
      assert.equal(after.getGlyph(id).name, before.getGlyph(id).name, 'Glyph IDs preserved');
      const scaled = originalNames.has(after.getGlyph(id).name) || symbolNames.has(after.getGlyph(id).name);
      if (!scaled) assert.equal(after.getGlyph(id).path.commands.length, 0, 'Only generated empty controls retain em-based advances');
      assert.equal(after.getGlyph(id).advanceWidth, Math.round(before.getGlyph(id).advanceWidth * (scaled ? advanceScale : 1)),
        'Original and symbol advances scale; generated empty controls retain em-based advances');
    }
    const { terminal, selected, direct } = hintGlyphSets(after, style);
    const refinement = build.instances.find(instance => instance.style === style.name).hintRefinement;
    const base = measuredHintPrograms(afterBytes, refinement, selected, modeHintProgram, restoreHintProgram(refinement.flagCvt));
    assert.equal(hintFingerprint(base, hintPolicy.preservedGlyphCount), hintPolicy.styles[style.file].baseHintSha256);
    const ref = weightTargets.references[style.file], path = join(root, 'reference', ref.file);
    if (!references.has(path)) references.set(path, await readFile(path));
    const refBytes = references.get(path); assert.equal(sha256(refBytes), ref.sha256);
    const reference = referenceFace(refBytes, ref), referenceFile = join(native.directory, 'reference-static.ttf');
    await run(tool('python3'), ['-m', 'fontTools.varLib.instancer', '-q', path,
      ...Object.entries(ref.axes).map(([axis, value]) => `${axis}=${value}`), '-o', referenceFile]);
    const standalone = await readFile(referenceFile);
    const geometryBaseline = await nativeBaseline(style, native.directory);
    const geometryFont = create(geometryBaseline);
    assert.equal(geometryFont.numGlyphs, after.numGlyphs);
    for (let id = 0; id < after.numGlyphs; id++) {
      assert.equal(geometryFont.getGlyph(id).name, after.getGlyph(id).name, 'Fresh baseline glyph IDs agree');
      assert.equal(geometryFont.getGlyph(id).advanceWidth, after.getGlyph(id).advanceWidth, 'Fresh baseline advances agree');
    }
    assert.equal(sha256(geometryBaseline), hintPolicy.styles[style.file].geometryBaselineSha256,
      'Fresh original-source geometry baseline matches the reviewed calibration');
    const files = { before: 'before.ttf', after: 'after.ttf', beforeProbe: 'before-probe.ttf',
      afterProbe: 'after-probe.ttf', reference: 'reference.ttf', geometryProbe: 'geometry-probe.ttf',
      qProbe: 'q-probe.ttf', nProbe: 'n-probe.ttf', sProbe: 's-probe.ttf' };
    for (const [key, bytes] of Object.entries({ before: beforeBytes, after: afterBytes,
      beforeProbe: probeFont(beforeBytes, before), afterProbe: probeFont(afterBytes, after), reference: standalone,
      geometryProbe: probeFont(geometryBaseline, create(geometryBaseline)),
      qProbe: probeFont(base, create(base)), nProbe: probeFont(modeCandidate(base, 'n'), create(base)),
      sProbe: probeFont(modeCandidate(base, 's'), create(base)) })) await writeFile(join(native.directory, files[key]), bytes);
    const codes = new Map();
    for (const code of original.characterSet) {
      const name = original.glyphForCodePoint(code).name;
      if (!codes.has(name)) codes.set(name, []); codes.get(name).push(code);
    }
    const old = baselineBuild.instances.find(instance => instance.style === style.name).hintRefinement;
    const previousTables = sfntTables(baselineHintPrograms(beforeBytes, old)), baseTables = sfntTables(base);
    const globalHintsChanged = ['fpgm', 'prep', 'cvt '].some(tag => !previousTables.get(tag).data.equals(baseTables.get(tag).data));
    const oldEligible = new Set(old.eligibleGlyphs), oldNatural = new Set(old.naturalGlyphs);
    const sourceIds = new Map(Array.from({ length: original.numGlyphs }, (_, id) => [original.getGlyph(id).name, id]));
    const symbolCodes = new Map(terminalSymbols.map(({ code, name }) => [name, code]));
    const glyphs = Array.from({ length: after.numGlyphs }, (_, id) => {
      const g = after.getGlyph(id), prior = before.getGlyph(id), symbol = symbolCodes.has(g.name);
      const geometryChanged = JSON.stringify(g.path.commands) !== JSON.stringify(prior.path.commands);
      const program = glyphInstructions(baseTables, id), oldProgram = glyphInstructions(previousTables, id);
      const sourceHintsChanged = !!(program.length || oldProgram.length) && (globalHintsChanged || !program.equals(oldProgram));
      const selection = selected.get(id) ?? null;
      const allowedSizes = hintPolicy.selection.sizes.filter(size => {
        if (geometryChanged || sourceHintsChanged) return true;
        const oldMode = old.strongPpemRanges.some(([low, high]) => size >= low && size <= high)
          ? oldNatural.has(g.name) ? 'n' : oldEligible.has(g.name) ? 's' : 'q' : 'q';
        const mode = ['n', 's'].find(mode => selection?.[mode].some(([low, high]) => size >= low && size <= high)) ?? 'q';
        return mode !== oldMode;
      });
      return { id: g.id, name: g.name, sourceId: sourceIds.get(g.name) ?? null,
        codePoints: symbol ? [symbolCodes.get(g.name)] : codes.get(g.name) ?? [], advance: g.advanceWidth,
        bounds: g.path.commands.length ? [g.bbox.minX, g.bbox.minY, g.bbox.maxX, g.bbox.maxY] : null,
        commands: g.path.commands, ...outlineTopology(g), terminal: terminal.has(g.id),
        geometryChanged, sourceHintsChanged, directRaster: direct.has(id), selection, allowedSizes, existed: true, symbol };
    });
    const data = { fonts: files, style: style.name, version, baselineVersion: hintPolicy.baselineVersion, glyphs,
      metrics: target, referenceName: ref.family,
      cellWidths: { before: baselineBuild.targetMetrics.cellWidth / 1000, after: target.cellWidth / 1000,
        reference: reference.glyphForCodePoint(32).advanceWidth / reference.unitsPerEm },
      sizes: hintPolicy.selection.sizes, phases: hintPolicy.selection.phases, settings: hintPolicy.selection, legacyRanges: old.strongPpemRanges };
    const result = await native.page('(' + rasterPage.toString() + ')(' + JSON.stringify(data) + ',' + inkTools.toString() + ')', 'validate-' + style.file);
    await writeFile(join(root, 'docs/native-coverage-' + style.file + '.png'), Buffer.from(result.coveragePng.split(',')[1], 'base64'));
    const panelBytes = Buffer.from(result.comparisonPng.split(',')[1], 'base64');
    panels.push(PNG.sync.read(panelBytes));
    delete result.coveragePng; delete result.comparisonPng;
    const hash = sha256(afterBytes); fontHashes.push({ file: 'fonts/InconsolataRefined-' + style.file + '.ttf', sha256: hash });
    results.push({ style: style.name, sha256: hash, baselineSha256: sha256(beforeBytes), referenceSha256: ref.sha256,
      geometrySha256: glyphGeometryHash(after), geometryBaselineSha256: sha256(geometryBaseline), ...result });
    const issueCount = failures.reduce((sum, key) => sum + result[key].length, 0);
    console.log('RASTER ' + style.name + ': ' + glyphs.length + ' glyphs × ' + result.sizes.length + ' sizes × ' + result.phases.length + ' phases; ' + issueCount + ' flagged cases');
    if (issueCount) await writeFile(join(root, 'docs/native-raster-validation.json'), JSON.stringify({ family, fontVersion: version, results }, null, 2) + '\n');
    for (const key of failures) assert.deepEqual(result[key], [], style.name + ' ' + key);
    await writeFile(checkpointPanel, panelBytes);
    await writeFile(checkpointFile, JSON.stringify({ fingerprint, result: results.at(-1),
      resultSha256: sha256(Buffer.from(JSON.stringify(results.at(-1)))), panelSha256: sha256(panelBytes) }) + '\n');
    console.log('RASTER ' + style.name + ': complete checkpoint saved');
  }
  if (results.length !== styles.length) {
    console.log(`Completed ${results.length}/${styles.length} native style checks; continue with the same --checkpoint-dir.`);
  } else {
  const image = new PNG({ width: panels[0].width, height: panels.reduce((height, panel) => height + panel.height, 0) });
  let y = 0; for (const panel of panels) { panel.data.copy(image.data, y * image.width * 4); y += panel.height; }
  await writeFile(join(root, 'docs/native-comparison.png'), PNG.sync.write(image));
  await writeFile(join(root, 'docs/native-raster-validation.json'), JSON.stringify({ family, fontVersion: version,
    checkerSha256: fingerprint,
    baselineVersion: hintPolicy.baselineVersion, baselineRevision: hintPolicy.baselineRevision,
    method: 'Native Windows Chromium. Every output glyph is addressed through a private-use probe. Original-source outlines receive shared source-relative perpendicular stroke compensation, reviewed separately in outline-review.json; advances, glyph IDs, coverage and features are preserved. Every glyph is tested at integer 8–50 px and eight horizontal phases. Actual compiled-policy pixels must equal independent fixed natural/quantized/strong candidates. Counter and component regressions are checked at 35%, 50%, and 65% coverage. Local multiscale ink profiles describe all glyphs, with s/S and f/curved-letter visual regressions and one-cell htop headers. Measurements are rendering/shape proxies, not readability scores or Windows Terminal equivalence.',
    fontHashes, webFontHashes: web.outputs.map(({ file, sha256 }) => ({ file, sha256 })), results }, null, 2) + '\n');
  console.log('Native Windows raster checks passed for all four faces.');
  }
} finally {
  if (native) await native.close();
  if (!checkpointArgument) await rm(checkpointDirectory, { recursive: true, force: true });
  done();
}
