import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { create } from 'fontkit';
import { glyphGeometryHash, glyphInstructions, hintPolicy, replaceTables, sfntTables, sha256 } from './lib.mjs';
import { hintFingerprint } from './hinting-candidates.mjs';

// ttfautohint 1.8.4's internal CVT[3]: -100 natural, 0 quantized,
// 100 strong. Validate its version and initialization before using this ABI.
const stemModeCvt = 3;

export function hintGlyphSets(font, style) {
  const terminal = new Set(font.characterSet.filter(code => code >= 0x2500 && code <= 0x259f)
    .map(code => font.glyphForCodePoint(code).id));
  const selected = new Map();
  const direct = new Map();
  for (const [name, entry] of Object.entries(hintPolicy.styles[style.file].directRasterGlyphs ?? {})) {
    assert.equal(font.getGlyph(entry.id).name, name, 'Direct fallback uses the measured glyph ID');
    direct.set(entry.id, entry);
  }
  for (const [name, entry] of Object.entries(hintPolicy.styles[style.file].selections)) {
    assert.equal(font.getGlyph(entry.id).name, name, 'Measured glyph ID/name agrees with the original geometry');
    assert.ok(!terminal.has(entry.id), 'Terminal geometry does not receive text hints');
    assert.ok(!direct.has(entry.id), 'An unsafe program cannot also receive a mode guard');
    selected.set(entry.id, entry);
  }
  return { terminal, selected, direct };
}

export function modeHintProgram(entry, flagCvt) {
  assert.ok(flagCvt < 256, 'CVT flag fits PUSHB');
  // Only quantized rendering opts into the measured policy. GDI's existing
  // strong mode and renderers using natural mode retain their own behavior.
  const code = [0xb0, stemModeCvt, 0x45, 0xb0, 0, 0x54, 0x58], seen = new Set();
  for (const mode of ['n', 's']) for (const [low, high] of entry[mode]) {
    assert.ok(Number.isInteger(low) && low >= 8 && Number.isInteger(high) && high <= 50 && low <= high);
    for (let size = low; size <= high; size++) { assert.ok(!seen.has(size), 'Mode ranges are disjoint'); seen.add(size); }
    const write = mode === 'n' ? [0xb9, 0, stemModeCvt, 0xff, 0x9c, 0x44] : [0xb1, stemModeCvt, 100, 0x44];
    code.push(0x4b, 0xb0, low, 0x53, 0x4b, 0xb0, high, 0x51, 0x5a, 0x58,
      ...write, 0xb1, flagCvt, 1, 0x44, 0x59);
  }
  code.push(0x59);
  return Buffer.from(code);
}

export function restoreHintProgram(flagCvt) {
  return Buffer.from([0xb0, flagCvt, 0x45, 0x58, 0xb1, stemModeCvt, 0, 0x44,
    0xb1, flagCvt, 0, 0x44, 0x59]);
}

export async function refineHints(input, output, style, { baseOnly = false } = {}) {
  if (!baseOnly) assert.equal(hintPolicy.policyVersion, 3);
  const bytes = await readFile(input), tables = sfntTables(bytes), font = create(bytes);
  const info = tables.get('TTFA').data.toString('utf8');
  assert.match(info, /ttfautohint version = 1\.8\.4\n/);
  assert.match(info, /gray-stem-width-mode = quantized\n/);
  assert.match(info, /dw-cleartype-stem-width-mode = quantized\n/);
  const prep = tables.get('prep').data;
  assert.ok(prep.includes(Buffer.from([0xb9, 0, stemModeCvt, 0, 0, 0x44])), 'Expected ttfautohint mode initialization');
  const geometry = glyphGeometryHash(font);
  if (!baseOnly) assert.equal(geometry, hintPolicy.geometrySha256[style.file], 'Every source-derived outline and advance agrees with the geometric review');
  const { terminal, selected, direct } = baseOnly ? {
    terminal: new Set(font.characterSet.filter(code => code >= 0x2500 && code <= 0x259f).map(code => font.glyphForCodePoint(code).id)), selected: new Map(), direct: new Map(),
  } : hintGlyphSets(font, style);
  for (const [id, entry] of direct) assert.equal(sha256(glyphInstructions(tables, id)), entry.sourceProgramSha256, 'Unsafe source program matches the bounds review');
  const baseHintSha256 = hintFingerprint(bytes, hintPolicy.preservedGlyphCount,
    new Map([...terminal, ...direct.keys()].map(id => [id, Buffer.alloc(0)])));
  if (!baseOnly) assert.equal(baseHintSha256, hintPolicy.styles[style.file].baseHintSha256, 'Measured policy matches every original hint program');
  const flagCvt = tables.get('cvt ').data.length / 2, suffix = restoreHintProgram(flagCvt);
  const reset = Buffer.from([0xb1, flagCvt, 0, 0x44]);
  const loca = tables.get('loca').data, glyf = tables.get('glyf').data;
  const originalLong = tables.get('head').data.readInt16BE(50) === 1;
  const offset = id => originalLong ? loca.readUInt32BE(id * 4) : loca.readUInt16BE(id * 2) * 2;
  const chunks = [], offsets = [0], terminalGlyphs = [], selectedGlyphs = [], directRasterGlyphs = [];
  let length = 0, maximumInstructions = 0;
  for (let id = 0; id < font.numGlyphs; id++) {
    const glyph = font.getGlyph(id), data = glyf.subarray(offset(id), offset(id + 1));
    let rebuilt = data;
    if (data.length) {
      const contours = data.readInt16BE(0);
      assert.ok(contours >= 0, glyph.name + ': source composites must already be unlinked');
      const position = 10 + 2 * contours, oldLength = data.readUInt16BE(position);
      let program = data.subarray(position + 2, position + 2 + oldLength);
      if (terminal.has(id)) { program = Buffer.alloc(0); terminalGlyphs.push(glyph.name); }
      else if (direct.has(id)) { program = Buffer.alloc(0); directRasterGlyphs.push(glyph.name); }
      else if (selected.has(id)) {
        assert.ok(program.length, glyph.name + ': measured mode requires original hint bytecode');
        program = Buffer.concat([modeHintProgram(selected.get(id), flagCvt), program, suffix]);
        selectedGlyphs.push(glyph.name);
      }
      maximumInstructions = Math.max(maximumInstructions, program.length);
      const newLength = position + 2 + program.length + data.length - (position + 2 + oldLength);
      rebuilt = Buffer.alloc((newLength + 3) & ~3);
      data.copy(rebuilt, 0, 0, position); rebuilt.writeUInt16BE(program.length, position);
      program.copy(rebuilt, position + 2); data.copy(rebuilt, position + 2 + program.length, position + 2 + oldLength);
    }
    chunks.push(rebuilt); length += rebuilt.length; offsets.push(length);
  }
  const long = originalLong || length > 0x1fffe, newLoca = Buffer.alloc(offsets.length * (long ? 4 : 2));
  offsets.forEach((value, id) => long ? newLoca.writeUInt32BE(value, id * 4) : newLoca.writeUInt16BE(value / 2, id * 2));
  const head = Buffer.from(tables.get('head').data); head.writeInt16BE(long ? 1 : 0, 50);
  const maxp = Buffer.from(tables.get('maxp').data); maxp.writeUInt16BE(maximumInstructions, 26);
  maxp.writeUInt16BE(Math.max(maxp.readUInt16BE(24), 3), 24);
  const refinedInfo = baseOnly ? info : info.trimEnd() + '\n\nrefined-hint-policy = ' + hintPolicy.policyVersion
    + '\nrefined-selection-algorithm = ' + hintPolicy.selection.algorithmVersion
    + '\nrefined-measured-glyphs = ' + selectedGlyphs.length
    + '\nrefined-direct-glyphs = ' + directRasterGlyphs.length
    + '\nrefined-terminal-glyphs = ' + terminalGlyphs.length + '\n';
  const result = replaceTables(bytes, {
    prep: baseOnly ? prep : Buffer.concat([prep, reset]), 'cvt ': baseOnly ? tables.get('cvt ').data : Buffer.concat([tables.get('cvt ').data, Buffer.alloc(2)]),
    glyf: Buffer.concat(chunks), loca: newLoca, head, maxp, TTFA: Buffer.from(refinedInfo),
  });
  assert.equal(glyphGeometryHash(create(result)), geometry, 'Every outline and advance survives hint refinement exactly');
  await writeFile(output, result);
  if (baseOnly) return { policyVersion: 0, baseHintSha256, terminalGlyphs, geometrySha256: geometry };
  return { policyVersion: hintPolicy.policyVersion, algorithmVersion: hintPolicy.selection.algorithmVersion,
    flagCvt, originalPrepBytes: prep.length, resetBytecodeSha256: sha256(reset), baseHintSha256,
    selectedGlyphs, terminalGlyphs, directRasterGlyphs, geometrySha256: geometry,
    geometryAndAdvancePreservation: 'exact for every output glyph' };
}
