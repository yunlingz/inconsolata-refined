import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create } from 'fontkit';
import { PNG } from 'pngjs';
import { root, styles, sources, fontFile, target, sfntTables, checksum, glyphInstructions, sha256, run, tool, heartbeat } from './lib.mjs';
import { nerdFamily, nerdFile, nerdOptions, extractNerdSources, rawGlyph, horizontalMetric, nameRecords } from './nerd.mjs';

const done = heartbeat('Checking every Nerd icon and preservation of all original glyphs and hints');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-nerd-check-'));
const directory = join(root, 'nerd-fonts'), results = [], panels = [];
let serial = 0;
async function render(file, text, size, color = 'dddddd') {
  const input = join(temporary, `text-${serial}.txt`), output = join(temporary, `render-${serial++}.png`);
  await writeFile(input, text);
  await run(tool('hb-view'), [file, `--text-file=${input}`, `--font-size=${size}`, `--font-ppem=${size}`,
    '--ft-load-flags=0', '--margin=12', '--background=101418', `--foreground=${color}`, `--output-file=${output}`]);
  const png = PNG.sync.read(await readFile(output));
  assert.ok(png.width > 24 && png.height > 24 && png.data.some((v, i) => i % 4 === 0 && v > 60), 'Nonempty raster output');
  return png;
}
try {
  const registry = await extractNerdSources(join(temporary, 'patcher'));
  const icons = Object.entries(registry).filter(([name]) => name !== 'METADATA');
  const uniqueIcons = [...new Set(icons.map(([, g]) => parseInt(g.code, 16)))].sort((a, b) => a - b);
  const manifest = JSON.parse(await readFile(join(directory, 'build-info.json'), 'utf8'));
  assert.equal(manifest.family, nerdFamily); assert.deepEqual(manifest.nerdFonts, sources.nerdFonts);
  assert.ok(nerdOptions.every(option => manifest.options.includes(option)));
  assert.deepEqual((await readdir(directory)).filter(f => f.endsWith('.ttf')).sort(), styles.map(nerdFile).sort());
  assert.equal(await readFile(join(directory, 'OFL.txt'), 'utf8'), await readFile(join(root, 'OFL.txt'), 'utf8'));
  assert.equal(await readFile(join(directory, 'licenses/NERD-FONTS-LICENSE.md'), 'utf8'),
    await readFile(join(root, 'upstream/nerd-fonts/LICENSE'), 'utf8'));
  let previousCoverage;
  for (const style of styles) {
    console.log(`Checking ${style.name}: all glyphs, complete icon registry, original hint VM and shaping.`);
    const file = nerdFile(style), path = join(directory, file), bytes = await readFile(path);
    const baseBytes = await readFile(fontFile(style)), base = create(baseBytes), font = create(bytes);
    const tables = sfntTables(bytes), baseTables = sfntTables(baseBytes), info = manifest.outputs.find(o => o.file === file);
    assert.equal(sha256(bytes), info.sha256); assert.equal(sha256(baseBytes), info.sourceSha256);
    assert.equal(bytes.length, info.bytes); assert.equal(checksum(bytes), 0xb1b0afba);
    for (const [tag, { directory: entry, data }] of tables) {
      const copy = Buffer.from(data); if (tag === 'head') copy.writeUInt32BE(0, 8);
      assert.equal(checksum(copy), bytes.readUInt32BE(entry + 4), `${file}: ${tag} checksum`);
    }
    assert.equal(font.familyName, nerdFamily); assert.equal(font.subfamilyName, style.name);
    assert.equal(font.name.records.preferredFamily.en, nerdFamily);
    assert.equal(font.name.records.preferredSubfamily.en, style.name);
    assert.equal(font.postscriptName, `InconsolataRefinedNerd-${style.file}`);
    assert.ok(font.version.endsWith(`; Nerd Fonts ${sources.nerdFonts.version}`));
    for (const record of nameRecords(tables.get('name').data)) {
      if ([1, 16, 21].includes(record.id)) assert.equal(record.text, nerdFamily, 'Exact family in every platform/language');
      if ([2, 17, 22].includes(record.id)) assert.equal(record.text, style.name);
      if (record.id === 6) assert.equal(record.text, font.postscriptName);
      if ([4, 18].includes(record.id)) assert.equal(record.text, `${nerdFamily} ${style.name}`);
    }
    assert.deepEqual([font.unitsPerEm, font.xHeight, font.capHeight, font.ascent, font.descent, font.lineGap, font.italicAngle],
      [base.unitsPerEm, base.xHeight, base.capHeight, base.ascent, base.descent, base.lineGap, base.italicAngle]);
    assert.equal(tables.get('post').data.readUInt32BE(12), 1, 'Monospaced flag retained');
    assert.deepEqual(tables.get('OS/2').data.subarray(2, 42), baseTables.get('OS/2').data.subarray(2, 42), 'Weight, width, embedding, decorations, Panose');
    assert.deepEqual(tables.get('OS/2').data.subarray(58, 64), baseTables.get('OS/2').data.subarray(58, 64), 'Vendor and style flags');
    assert.deepEqual(tables.get('OS/2').data.subarray(68), baseTables.get('OS/2').data.subarray(68), 'Every line/size metric');
    assert.deepEqual(tables.get('hhea').data.subarray(0, 10), baseTables.get('hhea').data.subarray(0, 10));
    assert.deepEqual(tables.get('hhea').data.subarray(18, 34), baseTables.get('hhea').data.subarray(18, 34));
    assert.deepEqual(tables.get('maxp').data.subarray(14), baseTables.get('maxp').data.subarray(14), 'Original hint VM resource limits');
    const changed = new Set(['head', 'hhea', 'hmtx', 'maxp', 'OS/2', 'name', 'cmap', 'post', 'glyf', 'loca']);
    assert.deepEqual([...tables.keys()].sort(), [...baseTables.keys()].sort());
    for (const [tag, table] of baseTables) if (!changed.has(tag)) {
      assert.deepEqual(tables.get(tag).data, table.data, `${tag}: original hint/layout table verbatim`);
    }
    assert.deepEqual(font.availableFeatures.sort(), base.availableFeatures.sort());
    for (let id = 0; id < base.numGlyphs; id++) {
      assert.deepEqual(rawGlyph(tables, id), rawGlyph(baseTables, id), `Original glyph ${id} bytes`);
      assert.deepEqual(horizontalMetric(tables, id), horizontalMetric(baseTables, id), `Original glyph ${id} metrics`);
      assert.deepEqual(glyphInstructions(tables, id), glyphInstructions(baseTables, id), `Original glyph ${id} hint program`);
      assert.equal(font.getGlyph(id).name, base.getGlyph(id).name);
      assert.deepEqual(font.getGlyph(id).path.commands, base.getGlyph(id).path.commands);
    }
    const originalCodes = new Set(base.characterSet), added = font.characterSet.filter(c => !originalCodes.has(c));
    for (const code of originalCodes) assert.equal(font.glyphForCodePoint(code).id, base.glyphForCodePoint(code).id);
    assert.equal(font.numGlyphs, info.glyphs); assert.equal(font.characterSet.length, info.characters);
    assert.equal(added.length, info.addedCharacters);
    if (previousCoverage) assert.deepEqual(font.characterSet, previousCoverage, 'Same complete coverage in all styles');
    previousCoverage = font.characterSet;
    const codes = new Set(font.characterSet), groups = {}, collisions = [];
    for (const [name, symbol] of icons) {
      const code = parseInt(symbol.code, 16);
      assert.ok(codes.has(code), `${file}: missing ${name} U+${symbol.code}`);
      assert.notEqual(font.glyphForCodePoint(code).id, 0, `${name}: mapped to real glyph`);
      const group = name.split('-')[0]; groups[group] = (groups[group] ?? 0) + 1;
      if (originalCodes.has(code)) collisions.push({ name, code: symbol.code, policy: 'Original glyph retained' });
    }
    const empty = [], bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const code of added) {
      const glyph = font.glyphForCodePoint(code);
      assert.equal(glyph.advanceWidth, target.cellWidth, `U+${code.toString(16)}: exactly one existing cell`);
      assert.equal(horizontalMetric(tables, glyph.id)[0], target.cellWidth);
      assert.equal(glyphInstructions(tables, glyph.id).length, 0, 'Icons do not borrow the text hint VM');
      if (!glyph.path.commands.length) { empty.push(code.toString(16)); continue; }
      const b = glyph.bbox;
      assert.ok(Number.isFinite(b.minX + b.minY + b.maxX + b.maxY));
      // Powerline intentionally overlaps by 0.5% vertically to hide seams.
      const overlap = Math.ceil((target.typoAscender - target.typoDescender) * .005);
      assert.ok(b.maxY <= target.typoAscender + overlap && b.minY >= target.typoDescender - overlap,
        `U+${code.toString(16)}: icon inside cell plus patcher seam allowance (${b.minY}..${b.maxY})`);
      bounds.minX = Math.min(bounds.minX, b.minX); bounds.maxX = Math.max(bounds.maxX, b.maxX);
      bounds.minY = Math.min(bounds.minY, b.minY); bounds.maxY = Math.max(bounds.maxY, b.maxY);
    }
    assert.equal(registry['cod-blank'].code, 'ec03');
    assert.deepEqual(empty, ['2800', 'ec03'], 'Only intentional Braille and Codicons blanks are empty');
    await run(tool('ots-sanitize'), [path, join(temporary, `${style.file}-sanitized.ttf`)]);
    const text = 'fiffl ffi 0O1lI a\u0301 3\u0302\u0323 △▽ ─│█';
    for (const features of ['', 'ss01,ss02,ss03,zero']) {
      const args = [`--text=${text}`, '--output-format=json', ...(features ? [`--features=${features}`] : [])];
      const before = await run(tool('hb-shape'), [fontFile(style), ...args]);
      const after = await run(tool('hb-shape'), [path, ...args]);
      assert.equal(after.stdout, before.stdout, 'Original text shaping and positions unchanged');
    }
    const rows = Array.from({ length: Math.ceil(added.length / 64) }, (_, i) => String.fromCodePoint(...added.slice(i * 64, (i + 1) * 64))).join('\n');
    for (const size of [12, 24]) await render(path, rows, size);
    const sampleCodes = [0xe0b0, 0xe0b2, 0xe5ff, 0xe700, 0xf121, 0xe200, 0x23fb, 0xf300, 0xf400, 0xea60,
      0xe000, 0xe300, 0xf0001, 0xf0219, 0x2801, 0x28ff];
    assert.ok(sampleCodes.every(c => codes.has(c)), 'Preview icons supported');
    const sample = ['git status  ~/project  branch:main',
      sampleCodes.map(c => `H${String.fromCodePoint(c)}H`).join(' '),
      '0123456789  fi fl ffi  a\u0301  △▽  ┌───┬───┐'].join('\n');
    panels.push(await render(fontFile(styles[0]), `${nerdFamily} - ${style.name} - 24 px`, 18, '83d998'));
    panels.push(await render(path, sample, 24));
    results.push({ file, sha256: sha256(bytes), sourceSha256: sha256(baseBytes), glyphs: font.numGlyphs,
      characters: font.characterSet.length, originalGlyphs: base.numGlyphs,
      originalOutlinesAndHints: 'All glyph bytes, IDs, outlines, metrics and hint programs identical',
      originalLayoutAndHintTables: 'Byte for byte identical', registeredIconNames: icons.length,
      uniqueRegisteredCodePoints: uniqueIcons.length, groups, collisions, addedCharacters: added.length,
      iconAdvance: target.cellWidth, emptyIcons: empty, bounds, sanitizer: 'pass',
      fullIconRendering: 'Every added character rendered with FreeType/HarfBuzz at 12 and 24 px',
      originalShaping: 'identical with default and stylistic features' });
    console.log(`PASS ${style.name}: all ${icons.length} registry names; ${added.length} additions exactly ${target.cellWidth} units; ${base.numGlyphs} original glyphs and hints preserved.`);
  }
  const width = Math.max(...panels.map(p => p.width)), height = panels.reduce((n, p) => n + p.height + 8, 8);
  const preview = new PNG({ width, height });
  for (let i = 0; i < preview.data.length; i += 4) preview.data.set([16, 20, 24, 255], i);
  let y = 8;
  for (const panel of panels) {
    for (let row = 0; row < panel.height; row++) panel.data.copy(preview.data, ((row + y) * width) * 4, row * panel.width * 4, (row + 1) * panel.width * 4);
    y += panel.height + 8;
  }
  await writeFile(join(root, 'docs/nerd-preview.png'), PNG.sync.write(preview));
  await writeFile(join(root, 'docs/nerd-validation.json'), JSON.stringify({ family: nerdFamily,
    nerdFonts: sources.nerdFonts.version, monoPolicy: 'All added glyphs use the unchanged base cell width; original zero/multiple-cell glyphs are preserved.',
    results }, null, 2) + '\n');
  console.log(`All four ${nerdFamily} faces passed.`);
} finally {
  done(); await rm(temporary, { recursive: true, force: true });
}
