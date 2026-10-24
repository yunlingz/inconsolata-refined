import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile, readdir, mkdtemp, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create } from 'fontkit';
import {
  root, family, version, styles, sources, target, weightTargets, fontFile, sourceBytes,
  sfntTables, checksum, sha256, tool, run, heartbeat,
} from './lib.mjs';
import { measureStems } from './strokes.mjs';
import { measureSpacing } from './spacing.mjs';

const done = heartbeat('Checking metadata, coverage, shaping, hint bytecode, and rendering');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-check-'));
const report = [];
try {
  const build = JSON.parse(await readFile(join(root, 'fonts/build-info.json'), 'utf8'));
  assert.equal(build.ttfautohint, sources.ttfautohint.version);
  assert.equal(build.version, version);
  const references = new Map();
  for (const [name, reference] of Object.entries(weightTargets.references)) {
    const path = join(root, 'reference', reference.file);
    if (existsSync(path)) {
      const bytes = await readFile(path);
      assert.equal(sha256(bytes), reference.sha256, 'Installed Iosevka reference checksum');
      const face = create(bytes).fonts[reference.faceIndex];
      assert.equal(face.familyName, reference.family);
      assert.equal(face.subfamilyName, reference.style);
      references.set(name, face);
    }
  }
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
    assert.ok(font.version.startsWith(`Version ${version}`), 'Updated version for replacement installs');
    assert.equal(font.unitsPerEm, target.unitsPerEm);
    assert.deepEqual([font.ascent, font.descent, font.lineGap], [target.ascender, target.descender, target.lineGap]);
    assert.deepEqual([os2.readInt16BE(68), os2.readInt16BE(70), os2.readInt16BE(72)], [target.typoAscender, target.typoDescender, target.typoLineGap]);
    assert.equal(font.ascent - font.descent + font.lineGap,
      target.typoAscender - target.typoDescender + target.typoLineGap, 'Both line metric paths agree');
    assert.equal(os2.readUInt16BE(4), style.weight);
    assert.equal(os2.readUInt16BE(6), 5);
    assert.equal(os2.readUInt16BE(8), 0, 'Embedding unrestricted');
    assert.deepEqual([os2.readUInt16BE(74), os2.readUInt16BE(76)], [target.typoAscender, -target.typoDescender], 'Windows metrics agree with the natural line box');
    assert.deepEqual([font.post.underlinePosition, font.post.underlineThickness], [target.underlinePosition, target.underlineThickness]);
    assert.deepEqual([os2.readInt16BE(26), os2.readInt16BE(28)], [target.strikeoutThickness, target.strikeoutPosition]);
    assert.deepEqual([font.hhea.caretSlopeRise, font.hhea.caretSlopeRun, font.hhea.caretOffset],
      [style.italic ? 1000 : 1, style.italic ? Math.round(Math.tan(target.italicAngle * Math.PI / 180) * 1000) : 0, 0], 'Caret follows the actual slant');
    const selection = 128 | (style.italic ? 1 : 0) | (style.weight === 700 ? 32 : 0) | (style.file === 'Regular' ? 64 : 0);
    assert.equal(os2.readUInt16BE(62), selection);
    assert.equal(tables.get('head').data.readUInt16BE(44), (style.italic ? 2 : 0) | (style.weight === 700 ? 1 : 0));
    assert.equal(font.italicAngle, style.italic ? -target.italicAngle : 0);
    assert.equal(tables.get('post').data.readUInt32BE(12), 1, 'Monospaced flag');
    assert.equal(os2.readInt16BE(2), target.cellWidth);
    assert.equal(font.xHeight, Math.round(font.glyphForCodePoint(0x78).bbox.maxY));
    assert.equal(font.capHeight, Math.round(font.glyphForCodePoint(0x48).bbox.maxY));
    assert.equal(font.xHeight, target.xHeight, 'Matched lowercase height');
    assert.equal(font.capHeight, target.capHeight, 'Matched capital height');
    assert.equal(font.glyphForCodePoint(112).bbox.minY, target.letterDescender, 'Matched letter descender');
    const stems = measureStems(font), weightTarget = weightTargets.styles[style.file];
    if (references.has(weightTarget.reference)) {
      assert.deepEqual(measureStems(references.get(weightTarget.reference)),
        weightTarget.referenceStems, 'Recorded strokes match the actual installed Iosevka face');
      assert.deepEqual(measureSpacing(references.get(weightTarget.reference)), weightTarget.referenceSpacing);
    }
    const strokeErrors = {};
    for (const [sample, expected] of Object.entries(weightTarget.referenceStems)) {
      strokeErrors[sample] = stems[sample] / expected - 1;
      assert.ok(Math.abs(strokeErrors[sample]) <= weightTargets.maxRelativeStrokeError,
        `${style.name} ${sample}: ${stems[sample]} vs Iosevka ${expected}`);
    }
    const spacing = measureSpacing(font);
    assert.deepEqual(spacing.spaces, weightTarget.referenceSpacing.spaces, 'All shared whitespace widths');
    for (const character of ['H', 'n']) {
      for (let side = 0; side < 2; side++) assert.ok(Math.abs(spacing.inkBounds[character][side]
        - weightTarget.referenceSpacing.inkBounds[character][side]) <= weightTargets.maxBearingDifference,
      `${style.name} ${character}: balanced side bearings`);
      assert.ok(Math.abs(spacing.counters[character] / weightTarget.referenceSpacing.counters[character] - 1)
        <= weightTargets.maxRelativeCounterError, `${style.name} ${character}: open counter`);
    }
    assert.deepEqual(font.characterSet, original.characterSet, 'Original Unicode coverage');
    assert.deepEqual(font.availableFeatures.sort(), original.availableFeatures.sort(), 'Original OpenType features');
    assert.ok(!tables.has('fvar') && !tables.has('gvar'), 'Static face');
    const namedGlyphs = new Map(Array.from({ length: font.numGlyphs }, (_, id) => {
      const glyph = font.getGlyph(id);
      return [glyph.name, glyph];
    }));
    for (let id = 0; id < original.numGlyphs; id++) {
      const before = original.getGlyph(id), glyph = namedGlyphs.get(before.name);
      assert.ok(glyph, 'Original named glyph preserved');
      assert.equal(glyph.advanceWidth, before.advanceWidth / 500 * target.cellWidth,
        `Advance for named glyph ${before.name}, including unencoded ligatures`);
      if (glyph.path.commands.length) {
        assert.ok(glyph.bbox.maxY <= target.typoAscender && glyph.bbox.minY >= target.typoDescender,
          `Line-box clearance for named glyph ${before.name}`);
      }
    }
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
      [0x2588, [0, target.typoDescender, target.cellWidth, target.typoAscender]],
      [0x2580, [0, (target.typoAscender + target.typoDescender) / 2, target.cellWidth, target.typoAscender]],
      [0x2584, [0, target.typoDescender, target.cellWidth, (target.typoAscender + target.typoDescender) / 2]],
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
      ['Operator ligatures', '-> => === !== <= >= <-', 'dlig=1'],
      ['Alternate zero', '0 000 0123456789', 'zero=1'],
      ['Stylistic alternatives', 'a g i l I 0', 'ss01=1,ss02=1,ss03=1'],
      ['Fractions and superscripts', '1/2 3/4 123', 'frac=1,sups=1'],
    ];
    for (const [label, text, features] of shapingSamples) {
      const { stdout } = await run(tool('hb-shape'), [fontFile(style), `--text=${text}`, '--verify', '--output-format=json', `--features=${features}`]);
      const shaped = JSON.parse(stdout);
      assert.ok(shaped.length > 0, label);
      assert.ok(shaped.every(glyph => glyph.g !== '.notdef' && glyph.g !== 'gid0'), `${label}: missing glyph`);
      const before = JSON.parse((await run(tool('hb-shape'), [originalFile, `--text=${text}`, '--verify', '--output-format=json', `--features=${features}`])).stdout);
      assert.deepEqual(shaped.map(glyph => glyph.g), before.map(glyph => glyph.g), `${label}: substitutions preserved`);
    }
    // Regression for upstream's missing digit anchors: every supplied combining
    // mark must attach in the same cell, including the alternate zero.
    const marks = font.characterSet.filter(code => /\p{M}/u.test(String.fromCodePoint(code)));
    let markPairsChecked = 0;
    const digitMarkOverhangs = [];
    const shear = style.italic ? Math.tan(target.italicAngle * Math.PI / 180) : 0;
    for (const alternate of [false, true]) {
      const pairs = (alternate ? [48] : Array.from({ length: 10 }, (_, i) => 48 + i))
        .flatMap(code => marks.map(mark => ({ text: String.fromCodePoint(code, mark), mark })));
      const input = join(temporary, 'digit-marks.txt');
      await writeFile(input, pairs.map(pair => pair.text).join('\n'));
      const { stdout } = await run(tool('hb-shape'), [fontFile(style), `--text-file=${input}`, '--verify', '--output-format=json',
        ...(alternate ? ['--features=zero=1'] : [])]);
      const shaped = stdout.trim().split('\n').map(line => JSON.parse(line));
      assert.equal(shaped.length, pairs.length);
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i], glyphs = shaped[i];
        assert.equal(glyphs.length, 2, `${pair.text}: base and mark`);
        assert.equal(glyphs[0].ax + glyphs[1].ax, target.cellWidth, `${pair.text}: one cell`);
        assert.equal(glyphs[1].ax, 0, `${pair.text}: mark remains zero width`);
        const base = namedGlyphs.get(glyphs[0].g).bbox, mark = namedGlyphs.get(glyphs[1].g).bbox;
        const minY = mark.minY + glyphs[1].dy, maxY = mark.maxY + glyphs[1].dy;
        if (minY < target.typoDescender || maxY > target.typoAscender) digitMarkOverhangs.push({
          text: pair.text, alternateZero: alternate, minY, maxY,
          reason: 'Tall combining sequences may exceed natural line spacing; glyph shapes are preserved',
        });
        const above = pair.mark < 0x31b, below = pair.mark >= 0x323 && pair.mark < 0x335;
        if (above || below) {
          if (above) assert.ok(minY >= base.maxY + .5, `${pair.text}: above-mark clearance`);
          else assert.ok(maxY <= base.minY + 2, `${pair.text}: below-mark placement`);
          const anchorY = above ? minY : maxY;
          const expectedX = (base.minX + base.maxX) / 2 + shear * (anchorY - (base.minY + base.maxY) / 2);
          const actualX = (mark.minX + mark.maxX) / 2 + glyphs[0].ax + glyphs[1].dx;
          assert.ok(Math.abs(actualX - expectedX) <= 1.51, `${pair.text}: mark centering`);
        }
        markPairsChecked++;
      }
    }
    const stack = JSON.parse((await run(tool('hb-shape'), [fontFile(style), '0\u0301\u0308', '--output-format=json'])).stdout);
    assert.equal(stack.length, 3, 'Digit and two stacked marks');
    assert.equal(stack.reduce((sum, glyph) => sum + glyph.ax, 0), target.cellWidth);
    assert.ok(stack[2].dy > stack[1].dy, 'Original mark-to-mark positioning still stacks accents');
    // Render the entire encoded character set, in short lines, at real screen sizes.
    // Format 4 cmap's U+FFFF sentinel is preserved, but is not display text.
    const text = font.characterSet.filter(code => code >= 32 && code !== 0x7f && code !== 0xffff).map(code => String.fromCodePoint(code));
    const lines = [];
    for (let i = 0; i < text.length; i += 48) lines.push(text.slice(i, i + 48).join(' '));
    const specimen = join(temporary, 'coverage.txt');
    await writeFile(specimen, lines.join('\n'));
    for (const size of [10, 12, 14, 16, 18, 24, 32]) {
      await run(tool('hb-view'), [fontFile(style), `--text-file=${specimen}`, `--font-size=${size}`, `--font-ppem=${size}`, '--ft-load-flags=0', '--margin=24', `--output-file=${join(temporary, `${style.file}-${size}.png`)}`]);
      if (size === 24) await copyFile(join(temporary, `${style.file}-${size}.png`), join(root, `docs/coverage-${style.file}.png`));
    }
    report.push({ style: style.name, characters: font.characterSet.length, features: font.availableFeatures.length,
      xHeight: font.xHeight, capHeight: font.capHeight, cellWidth: target.cellWidth,
      sourceAxes: weightTarget.axes, referenceStyle: style.name, referenceStems: weightTarget.referenceStems,
      stems, strokeErrors, spacing, digitMarkPairsChecked: markPairsChecked, digitMarkOverhangs,
      lineMetrics: { hhea: [font.ascent, font.descent, font.lineGap],
        typo: [target.typoAscender, target.typoDescender, target.typoLineGap] },
      sanitizer: 'pass', renderingSizes: [10, 12, 14, 16, 18, 24, 32], sha256: sha256(bytes) });
    console.log(`PASS ${style.name}: ${font.characterSet.length} characters, ${font.availableFeatures.length} features, sanitizer, shaping, seven render sizes`);
  }
  await writeFile(join(root, 'docs/validation.json'), JSON.stringify({ family, results: report }, null, 2) + '\n');
  console.log('All four font faces passed.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
