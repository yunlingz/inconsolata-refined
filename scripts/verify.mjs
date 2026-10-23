import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create } from 'fontkit';
import {
  root, family, styles, sources, target, fontFile, sourceBytes,
  sfntTables, checksum, sha256, tool, run, heartbeat,
} from './lib.mjs';

const done = heartbeat('Checking metadata, coverage, shaping, hint bytecode, and rendering');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-check-'));
const report = [];
try {
  const build = JSON.parse(await readFile(join(root, 'fonts/build-info.json'), 'utf8'));
  assert.equal(build.ttfautohint, sources.ttfautohint.version);
  const expectedFiles = styles.map(style => `InconsolataRefined-${style.file}.ttf`).sort();
  assert.deepEqual((await readdir(join(root, 'fonts'))).filter(file => file.endsWith('.ttf')).sort(), expectedFiles);

  for (const style of styles) {
    const bytes = await readFile(fontFile(style)), font = create(bytes);
    const original = create(await sourceBytes(style.source));
    const originalFile = join(temporary, `original-${style.source}.ttf`);
    await writeFile(originalFile, await sourceBytes(style.source));
    const tables = sfntTables(bytes), os2 = tables.get('OS/2').data;
    assert.equal(checksum(bytes), 0xb1b0afba, 'Complete SFNT checksum');
    for (const [tag, { directory, data }] of tables) {
      const copy = Buffer.from(data);
      if (tag === 'head') copy.writeUInt32BE(0, 8);
      assert.equal(checksum(copy), bytes.readUInt32BE(directory + 4), `${tag} table checksum`);
    }
    assert.equal(sha256(bytes), build.outputs.find(output => output.file.endsWith(`-${style.file}.ttf`)).sha256);
    assert.equal(font.familyName, family);
    assert.equal(font.subfamilyName, style.name);
    assert.equal(font.name.records.preferredFamily.en, family);
    assert.equal(font.name.records.preferredSubfamily.en, style.name);
    assert.equal(font.postscriptName, `InconsolataRefined-${style.file}`);
    assert.equal(font.unitsPerEm, target.unitsPerEm);
    assert.deepEqual([font.ascent, font.descent, font.lineGap], [target.ascender, target.descender, 0]);
    assert.deepEqual([os2.readInt16BE(68), os2.readInt16BE(70), os2.readInt16BE(72)], [target.ascender, target.descender, 0]);
    assert.equal(os2.readUInt16BE(4), style.weight);
    assert.equal(os2.readUInt16BE(6), 5);
    assert.equal(os2.readUInt16BE(8), 0, 'Embedding unrestricted');
    const selection = 128 | (style.italic ? 1 : 0) | (style.weight === 700 ? 32 : 0) | (style.file === 'Regular' ? 64 : 0);
    assert.equal(os2.readUInt16BE(62), selection);
    assert.equal(tables.get('head').data.readUInt16BE(44), (style.italic ? 2 : 0) | (style.weight === 700 ? 1 : 0));
    assert.equal(font.italicAngle, style.italic ? -12 : 0);
    assert.equal(tables.get('post').data.readUInt32BE(12), 1, 'Monospaced flag');
    assert.equal(os2.readInt16BE(2), target.cellWidth);
    assert.equal(font.xHeight, Math.round(font.glyphForCodePoint(0x78).bbox.maxY));
    assert.equal(font.capHeight, Math.round(font.glyphForCodePoint(0x48).bbox.maxY));
    if (style.weight === 400) assert.equal(font.xHeight, target.xHeight);
    assert.deepEqual(font.characterSet, original.characterSet, 'Original Unicode coverage');
    assert.deepEqual(font.availableFeatures.sort(), original.availableFeatures.sort(), 'Original OpenType features');
    assert.ok(!tables.has('fvar') && !tables.has('gvar'), 'Static face');
    const names = new Set(Array.from({ length: font.numGlyphs }, (_, id) => font.getGlyph(id).name));
    for (let id = 0; id < original.numGlyphs; id++) assert.ok(names.has(original.getGlyph(id).name), 'Original named glyph preserved');
    assert.equal(font.name.records.copyright.en, original.name.records.copyright.en);
    assert.equal(font.name.records.license.en, original.name.records.license.en);
    for (const code of font.characterSet) {
      const glyph = font.glyphForCodePoint(code), before = original.glyphForCodePoint(code);
      assert.equal(glyph.advanceWidth, before.advanceWidth / 500 * target.cellWidth, `Advance U+${code.toString(16)}`);
      if (glyph.path.commands.length === 0) {
        assert.equal(before.path.commands.length, 0, `Unexpected empty glyph U+${code.toString(16)}`);
        continue;
      }
      const box = glyph.bbox;
      assert.ok(Number.isFinite(box.minX + box.minY + box.maxX + box.maxY), `Outline U+${code.toString(16)}`);
      assert.ok(box.maxY <= os2.readUInt16BE(74), `Windows ascent U+${code.toString(16)}`);
      assert.ok(-box.minY <= os2.readUInt16BE(76), `Windows descent U+${code.toString(16)}`);
    }
    for (let code = 32; code <= 126; code++) assert.equal(font.glyphForCodePoint(code).advanceWidth, target.cellWidth);
    for (const [code, expected] of [
      [0x2588, [0, -480, 1200, 1900]],
      [0x2580, [0, 710, 1200, 1900]],
      [0x2584, [0, -480, 1200, 710]],
    ]) {
      const box = font.glyphForCodePoint(code).bbox;
      assert.deepEqual([box.minX, box.minY, box.maxX, box.maxY], expected, `Terminal block U+${code.toString(16)}`);
    }
    for (const tag of ['fpgm', 'prep', 'cvt ', 'gasp', 'TTFA']) assert.ok(tables.get(tag)?.data.length > 0, `${tag} hint table`);
    const loca = tables.get('loca').data, glyf = tables.get('glyf').data;
    const longLoca = tables.get('head').data.readInt16BE(50) === 1;
    for (const character of 'Hno0') {
      const id = font.glyphForCodePoint(character.codePointAt(0)).id;
      const offset = longLoca ? loca.readUInt32BE(id * 4) : loca.readUInt16BE(id * 2) * 2;
      const contours = glyf.readInt16BE(offset);
      assert.ok(contours > 0);
      assert.ok(glyf.readUInt16BE(offset + 10 + contours * 2) > 0, `${character}: glyph hint bytecode`);
    }
    assert.match(font.version, /ttfautohint \(v1\.8\.4\)/);
    const { stdout: hintInfo } = await run(tool('ttfautohint'), ['--ttfa-info', fontFile(style)]);
    assert.match(hintInfo, /1\.8\.4/);

    await run(tool('ots-sanitize'), [fontFile(style), join(temporary, `${style.file}-sanitized.ttf`)]);
    const shapingSamples = [
      ['ASCII code', 'if (a != b) { return value_01 + 42; }', ''],
      ['Accents and combining marks', 'Àéîõü ệ ỡ ḗ a\u0301 e\u0302\u0323 o\u0308', ''],
      ['Optional ligatures', 'fi fl ffi ffl', 'dlig=1'],
      ['Alternate zero', '0 000 0123456789', 'zero=1'],
      ['Stylistic alternatives', 'a g i l I 0', 'ss01=1,ss02=1,ss03=1'],
      ['Fractions and superscripts', '1/2 3/4 123', 'frac=1,sups=1'],
    ];
    for (const [label, text, features] of shapingSamples) {
      const { stdout } = await run(tool('hb-shape'), [fontFile(style), text, '--verify', '--output-format=json', `--features=${features}`]);
      const shaped = JSON.parse(stdout);
      assert.ok(shaped.length > 0, label);
      assert.ok(shaped.every(glyph => glyph.g !== '.notdef' && glyph.g !== 'gid0'), `${label}: missing glyph`);
      const before = JSON.parse((await run(tool('hb-shape'), [originalFile, text, '--verify', '--output-format=json', `--features=${features}`])).stdout);
      assert.deepEqual(shaped.map(glyph => glyph.g), before.map(glyph => glyph.g), `${label}: substitutions preserved`);
    }
    // Render the entire encoded character set, in short lines, at real screen sizes.
    // Format 4 cmap's U+FFFF sentinel is preserved, but is not display text.
    const text = font.characterSet.filter(code => code >= 32 && code !== 0x7f && code !== 0xffff).map(code => String.fromCodePoint(code));
    const lines = [];
    for (let i = 0; i < text.length; i += 48) lines.push(text.slice(i, i + 48).join(''));
    const specimen = join(temporary, 'coverage.txt');
    await writeFile(specimen, lines.join('\n'));
    for (const size of [10, 12, 14, 16, 18, 24, 32]) {
      await run(tool('hb-view'), [fontFile(style), `--text-file=${specimen}`, `--font-size=${size}`, `--font-ppem=${size}`, '--ft-load-flags=0', '--margin=24', `--output-file=${join(temporary, `${style.file}-${size}.png`)}`]);
    }
    report.push({ style: style.name, characters: font.characterSet.length, features: font.availableFeatures.length, xHeight: font.xHeight, capHeight: font.capHeight, cellWidth: target.cellWidth, sanitizer: 'pass', renderingSizes: [10, 12, 14, 16, 18, 24, 32], sha256: sha256(bytes) });
    console.log(`PASS ${style.name}: ${font.characterSet.length} characters, ${font.availableFeatures.length} features, sanitizer, shaping, seven render sizes`);
  }
  await writeFile(join(root, 'docs/validation.json'), JSON.stringify({ family, results: report }, null, 2) + '\n');
  console.log('All four font faces passed.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
