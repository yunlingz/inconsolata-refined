import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { PNG } from 'pngjs';
import { create } from 'fontkit';
import { root, version, family, styles, hintPolicy, weightTargets, fontFile, sourceBytes,
  sfntTables, replaceTables, glyphInstructions, glyphGeometryHash, sha256, heartbeat } from './lib.mjs';
import { hintGlyphSets } from './hinting.mjs';
import { edges } from './strokes.mjs';
import { rasterPage } from './raster-page.mjs';

async function execute(command, args, cwd = root) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = []; let stderr = '';
  child.stdout.on('data', data => chunks.push(data)); child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
  const timeout = setTimeout(() => child.kill(), 120_000);
  try {
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    if (code !== 0) throw new Error(`${command} exited ${code}: ${stderr}`);
    return Buffer.concat(chunks);
  } finally { clearTimeout(timeout); }
}
const toWindows = path => 'C:\\' + path.slice('/mnt/c/'.length).replaceAll('/', '\\');
function toWsl(path) {
  assert.match(path, /^[A-Za-z]:\\/);
  return '/mnt/' + path[0].toLowerCase() + path.slice(2).replaceAll('\\', '/');
}
function probeFont(bytes, font) {
  const tables = sfntTables(bytes), empty = font.getGlyph(0);
  // Glyph zero means "missing" to browser fallback. Address its identical
  // empty outline/advance/program through a nonzero empty glyph instead.
  const alias = Array.from({ length: font.numGlyphs }, (_, id) => font.getGlyph(id)).find(g => g.id > 0
    && g.advanceWidth === empty.advanceWidth && !g.path.commands.length && !glyphInstructions(tables, g.id).length);
  assert.ok(!empty.path.commands.length && !glyphInstructions(tables, 0).length && alias);
  const sub = Buffer.alloc(16 + 12 * font.numGlyphs);
  sub.writeUInt16BE(12, 0); sub.writeUInt32BE(sub.length, 4); sub.writeUInt32BE(font.numGlyphs, 12);
  for (let id = 0; id < font.numGlyphs; id++) {
    const p = 16 + id * 12; sub.writeUInt32BE(0xf0000 + id, p); sub.writeUInt32BE(0xf0000 + id, p + 4);
    sub.writeUInt32BE(id === 0 ? alias.id : id, p + 8);
  }
  const cmap = Buffer.alloc(12 + sub.length); cmap.writeUInt16BE(1, 2); cmap.writeUInt16BE(3, 4);
  cmap.writeUInt16BE(10, 6); cmap.writeUInt32BE(12, 8); sub.copy(cmap, 12);
  return replaceTables(bytes, { cmap });
}
function outlineCounters(glyph) {
  const contours = []; let current;
  for (const command of glyph.path.commands) {
    if (command.command === 'moveTo') { current = []; contours.push(current); }
    current?.push(command);
  }
  // FontForge uses clockwise outer contours and counterclockwise counters.
  return contours.filter(commands => edges({ path: { commands } }).reduce((sum, [a, b]) =>
    sum + a[0] * b[1] - b[0] * a[1], 0) > 0).length;
}

const done = heartbeat('Checking all glyphs at 10–32 px and four phases in native Windows Chromium');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-native-raster-'));
let windowsTemporary;
try {
  const chromium = process.env.WINDOWS_CHROMIUM ?? [
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(path => existsSync(path));
  if (!chromium) throw new Error('Native raster checks require WSL and a Windows Chromium executable; set WINDOWS_CHROMIUM.');
  const temp = (await execute('/mnt/c/Windows/System32/cmd.exe', ['/d', '/c', 'echo', '%TEMP%'], '/mnt/c/Windows')).toString('utf8').trim();
  windowsTemporary = await mkdtemp(join(toWsl(temp), 'inconsolata-raster-'));
  const web = JSON.parse(await readFile(join(root, 'webfonts/build-info.json'), 'utf8'));
  const references = new Map(), results = [], panels = [], fontHashes = [];
  for (const style of styles) {
    console.log(`RASTER ${style.name}: loading baseline and every original named glyph`);
    const beforeBytes = await execute('git', ['show', `${hintPolicy.baselineRevision}:fonts/InconsolataRefined-${style.file}.ttf`]);
    const afterBytes = await readFile(fontFile(style));
    const before = create(beforeBytes), after = create(afterBytes), original = create(await sourceBytes(style.source));
    assert.equal(glyphGeometryHash(before), hintPolicy.geometrySha256[style.file]);
    assert.equal(glyphGeometryHash(after), hintPolicy.geometrySha256[style.file], 'Every outline and advance is unchanged');
    const afterTables = sfntTables(afterBytes), beforeTables = sfntTables(beforeBytes);
    for (const tag of ['GPOS', 'GSUB', 'GDEF', 'hmtx']) assert.deepEqual(afterTables.get(tag)?.data, beforeTables.get(tag)?.data, tag + ' unchanged');
    const ref = weightTargets.references[style.file], path = join(root, 'reference', ref.file);
    if (!references.has(path)) references.set(path, await readFile(path));
    const refBytes = references.get(path); assert.equal(sha256(refBytes), ref.sha256);
    const offset = refBytes.readUInt32BE(12 + ref.faceIndex * 4);
    const standalone = replaceTables(refBytes, {}, offset);
    const files = { before: 'before.ttf', after: 'after.ttf', beforeProbe: 'before-probe.ttf', afterProbe: 'after-probe.ttf', reference: 'reference.ttf' };
    for (const [key, bytes] of Object.entries({ before: beforeBytes, after: afterBytes,
      beforeProbe: probeFont(beforeBytes, before), afterProbe: probeFont(afterBytes, after), reference: standalone })) {
      await writeFile(join(windowsTemporary, files[key]), bytes);
    }
    const names = new Map(Array.from({ length: after.numGlyphs }, (_, id) => [after.getGlyph(id).name, after.getGlyph(id)]));
    const codes = new Map();
    for (const code of original.characterSet) {
      const name = original.glyphForCodePoint(code).name;
      if (!codes.has(name)) codes.set(name, []); codes.get(name).push(code);
    }
    const { terminal, eligible } = hintGlyphSets(after, style);
    const glyphs = Array.from({ length: original.numGlyphs }, (_, sourceId) => {
      const g = names.get(original.getGlyph(sourceId).name);
      return { id: g.id, name: g.name, sourceId, codePoints: codes.get(g.name) ?? [], advance: g.advanceWidth,
        bounds: g.path.commands.length ? [g.bbox.minX, g.bbox.minY, g.bbox.maxX, g.bbox.maxY] : null,
        counters: outlineCounters(g), terminal: terminal.has(g.id), eligible: eligible.has(g.id) };
    });
    const data = { fonts: files, style: style.name, version, glyphs, ranges: hintPolicy.styles[style.file].strongPpemRanges };
    const html = `<!doctype html><meta charset="utf-8"><body>loading<script>(${rasterPage.toString()})(${JSON.stringify(data)}).then(r=>document.body.textContent='BEGIN_REPORT'+btoa(JSON.stringify(r))+'END_REPORT').catch(e=>document.body.textContent='BEGIN_REPORT'+btoa(JSON.stringify({error:e.stack}))+'END_REPORT')</script>`;
    const page = join(windowsTemporary, 'raster.html'); await writeFile(page, html);
    const fileUrl = 'file:///' + toWindows(page).replaceAll('\\', '/').split('/').map((part, i) => i ? encodeURIComponent(part) : part).join('/');
    const output = (await execute(chromium, ['--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-extensions', '--allow-file-access-from-files',
      '--virtual-time-budget=10000', '--dump-dom', '--user-data-dir=' + toWindows(join(windowsTemporary, 'profile-' + style.file)), fileUrl])).toString('utf8');
    const encoded = output.match(/<body[^>]*>BEGIN_REPORT([A-Za-z0-9+/=]+)END_REPORT/);
    if (!encoded) throw new Error('Windows browser returned no raster report: ' + output.slice(-1200));
    const result = JSON.parse(Buffer.from(encoded[1], 'base64').toString('utf8'));
    if (result.error) throw new Error(result.error);
    assert.equal(result.platform, 'Win32', 'Actual native Windows browser');
    await writeFile(join(root, `docs/native-coverage-${style.file}.png`), Buffer.from(result.coveragePng.split(',')[1], 'base64'));
    panels.push(PNG.sync.read(Buffer.from(result.comparisonPng.split(',')[1], 'base64')));
    delete result.coveragePng; delete result.comparisonPng;
    const hash = sha256(afterBytes); fontHashes.push({ file: `fonts/InconsolataRefined-${style.file}.ttf`, sha256: hash });
    results.push({ style: style.name, sha256: hash, baselineSha256: sha256(beforeBytes), referenceSha256: ref.sha256,
      geometrySha256: glyphGeometryHash(after), ...result });
    const failures = ['vanished', 'clipped', 'counterRegressions', 'unexpectedChanges', 'boundErrors'];
    const issueCount = failures.reduce((sum, key) => sum + result[key].length, 0);
    console.log(`RASTER ${style.name}: ${glyphs.length} glyphs × ${result.sizes.length} sizes × ${result.phases.length} phases; ${issueCount} flagged cases`);
    if (issueCount) await writeFile(join(root, 'docs/native-raster-validation.json'), JSON.stringify({ family, fontVersion: version, results }, null, 2) + '\n');
    for (const key of failures) assert.deepEqual(result[key], [], style.name + ' ' + key);
  }
  const image = new PNG({ width: panels[0].width, height: panels.reduce((height, panel) => height + panel.height, 0) });
  let y = 0;
  for (const panel of panels) { panel.data.copy(image.data, y * image.width * 4); y += panel.height; }
  await writeFile(join(root, 'docs/native-comparison.png'), PNG.sync.write(image));
  await writeFile(join(root, 'docs/native-raster-validation.json'), JSON.stringify({ family, fontVersion: version,
    baselineVersion: hintPolicy.baselineVersion, baselineRevision: hintPolicy.baselineRevision,
    method: 'Native Windows Chromium canvas, exact reference collections, all original named glyphs addressed through temporary private-use cmap probes. Empty glyph zero uses an identical nonzero empty glyph to avoid browser fallback. Original geometry, GPOS/GSUB/GDEF, and advances are unchanged. Pixel comparisons cover 10–32 px and four quarter-pixel phases. Counter regressions are checked against original outline counters; accidental extra raster islands are not treated as required counters. Terminal glyph raster bounds must follow their original outlines within 1.51 px. Other 32 px glyph bounds allow 4 px for existing blue-zone fitting of compact numerals. Prose luminance is sRGB-linearized; concentration is a rendering proxy, not a readability score. This is a Windows browser test, not Windows Terminal/DirectWrite application equivalence.',
    fontHashes, webFontHashes: web.outputs.map(({ file, sha256 }) => ({ file, sha256 })), results }, null, 2) + '\n');
  console.log('Native Windows raster checks passed for all four faces.');
} finally {
  if (windowsTemporary) await rm(windowsTemporary, { recursive: true, force: true });
  await rm(temporary, { recursive: true, force: true }); done();
}
