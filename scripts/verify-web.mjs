import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { create } from 'fontkit';
import wawoff2 from 'wawoff2';
import { root, family, styles, fontFile, sfntTables, glyphInstructions, sha256, tool, run, heartbeat } from './lib.mjs';

function woffTables(bytes) {
  const tables = new Map();
  for (let i = 0; i < bytes.readUInt16BE(12); i++) {
    const pos = 44 + i * 20;
    const tag = bytes.toString('ascii', pos, pos + 4);
    const offset = bytes.readUInt32BE(pos + 4), compressed = bytes.readUInt32BE(pos + 8), length = bytes.readUInt32BE(pos + 12);
    const data = bytes.subarray(offset, offset + compressed);
    const decoded = compressed < length ? inflateSync(data) : data;
    assert.equal(decoded.length, length, `${tag}: WOFF table length`);
    tables.set(tag, { data: decoded });
  }
  return tables;
}

const done = heartbeat('Checking web font geometry, metadata, features, hint preservation, and sanitization');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-web-check-'));
const report = [];
try {
  const directory = join(root, 'webfonts');
  const manifest = JSON.parse(await readFile(join(directory, 'build-info.json'), 'utf8'));
  const files = styles.flatMap(style => ['woff', 'woff2'].map(format => `InconsolataRefined-${style.file}.${format}`));
  assert.deepEqual((await readdir(directory)).filter(file => /\.woff2?$/.test(file)).sort(), files.sort());
  const css = await readFile(join(directory, 'inconsolata-refined.css'), 'utf8');
  const faces = css.match(/@font-face\s*\{[^}]+\}/g);
  assert.equal(faces.length, 4);
  assert.equal(await readFile(join(directory, 'OFL.txt'), 'utf8'), await readFile(join(root, 'OFL.txt'), 'utf8'));

  for (const style of styles) {
    const ttf = await readFile(fontFile(style)), original = create(ttf), originalTables = sfntTables(ttf);
    const face = faces.find(rule => rule.includes(`InconsolataRefined-${style.file}.woff2`));
    assert.ok(face.includes(`font-family: '${family}'`));
    assert.ok(face.includes(`font-weight: ${style.weight};`));
    assert.ok(face.includes(`font-style: ${style.italic ? 'italic' : 'normal'};`));
    assert.ok(face.includes('font-display: swap;'));
    assert.ok(face.indexOf("format('woff2')") < face.indexOf("format('woff')"), 'WOFF2 before WOFF fallback');

    for (const format of ['woff', 'woff2']) {
      const file = `InconsolataRefined-${style.file}.${format}`;
      const bytes = await readFile(join(directory, file)), font = create(bytes);
      assert.equal(bytes.toString('ascii', 0, 4), format === 'woff' ? 'wOFF' : 'wOF2');
      assert.equal(bytes.readUInt32BE(8), bytes.length);
      const recorded = manifest.outputs.find(output => output.file === file);
      assert.equal(sha256(bytes), recorded.sha256);
      assert.equal(sha256(ttf), recorded.sourceSha256);
      assert.equal(font.familyName, family);
      assert.equal(font.subfamilyName, style.name);
      assert.equal(font.postscriptName, original.postscriptName);
      assert.equal(font.numGlyphs, original.numGlyphs);
      assert.deepEqual(font.characterSet, original.characterSet);
      assert.deepEqual(font.availableFeatures.sort(), original.availableFeatures.sort());
      assert.deepEqual([font.unitsPerEm, font.xHeight, font.capHeight, font.ascent, font.descent, font.lineGap, font.italicAngle],
        [original.unitsPerEm, original.xHeight, original.capHeight, original.ascent, original.descent, original.lineGap, original.italicAngle]);

      const decoded = format === 'woff' ? woffTables(bytes) : sfntTables(Buffer.from(await wawoff2.decompress(bytes)));
      assert.deepEqual([...decoded.keys()].sort(), [...originalTables.keys()].sort(), 'All TTF tables preserved');
      for (const [tag, table] of originalTables) {
        // WOFF2 can re-encode outlines/locations and update the head checksum.
        if (!['head', 'glyf', 'loca'].includes(tag)) assert.deepEqual(decoded.get(tag).data, table.data, `${file}: ${tag} unchanged`);
      }
      for (let id = 0; id < original.numGlyphs; id++) {
        const glyph = font.getGlyph(id), before = original.getGlyph(id);
        assert.equal(glyph.advanceWidth, before.advanceWidth, `${file}: glyph ${id} advance`);
        assert.deepEqual(glyph.path.commands, before.path.commands, `${file}: glyph ${id} geometry`);
        assert.deepEqual(glyphInstructions(decoded, id), glyphInstructions(originalTables, id), `${file}: glyph ${id} hint instructions`);
      }
      await run(tool('ots-sanitize'), [join(directory, file), join(temporary, `${style.file}-${format}.ttf`)]);
      report.push({ file, style: style.name, format, glyphs: font.numGlyphs, sourceSha256: sha256(ttf), sha256: sha256(bytes), sanitizer: 'pass', geometry: 'identical', hints: 'identical', metadataAndFeatures: 'identical' });
      console.log(`PASS ${style.name} ${format.toUpperCase()}: all ${font.numGlyphs} glyphs, hints, metadata, features, sanitizer`);
    }
  }
  await writeFile(join(root, 'docs/web-validation.json'), JSON.stringify({ family, results: report }, null, 2) + '\n');
  console.log('All eight web fonts and four CSS face mappings passed.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
