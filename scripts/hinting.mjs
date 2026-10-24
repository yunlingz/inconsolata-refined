import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { create } from 'fontkit';
import { glyphGeometryHash, hintPolicy, replaceTables, sfntTables, sha256 } from './lib.mjs';

// ttfautohint 1.8.4 lib/taprep.c: CVT[3] holds -100 (natural),
// 0 (quantized), or 100 (strong). This is an internal ABI: validate its
// version and initialization before using it, and retest after tool upgrades.
const stemModeCvt = 3;

export function hintGlyphSets(font, style) {
  const terminal = new Set(font.characterSet.filter(code => code >= 0x2500 && code <= 0x259f)
    .map(code => font.glyphForCodePoint(code).id));
  const letters = new Set(font.characterSet.filter(code => /[\p{L}\p{Nd}]/u.test(String.fromCodePoint(code)))
    .map(code => font.glyphForCodePoint(code).id));
  const baseNames = new Set([...letters].map(id => font.getGlyph(id).name));
  const exceptions = new Set([...hintPolicy.protectedGlyphs, ...hintPolicy.styles[style.file].protectedGlyphs]);
  const naturalBases = new Set(hintPolicy.naturalLetterBases);
  const naturalNames = new Set(font.characterSet.filter(code =>
    naturalBases.has(String.fromCodePoint(code).normalize('NFD').replace(/\p{M}/gu, '')))
    .map(code => font.glyphForCodePoint(code).name));
  const xHeight = font.glyphForCodePoint(120).bbox.maxY;
  const eligible = new Set(), natural = new Set();
  for (let id = 0; id < font.numGlyphs; id++) {
    const glyph = font.getGlyph(id), base = glyph.name.split('.')[0];
    const text = letters.has(id) || baseNames.has(base) || /^(fi|fl|ffi|ffl)$/.test(base);
    // This excludes marks, punctuation, symbols, and scaled numerator/
    // denominator glyphs, whose tiny counters need the existing smoother fit.
    if (text && glyph.path.commands.length && glyph.advanceWidth > 0
      && glyph.bbox.maxY - glyph.bbox.minY >= xHeight * .9
      && !exceptions.has(glyph.name) && !exceptions.has(base) && !terminal.has(id)) {
      if (naturalNames.has(glyph.name) || naturalNames.has(base)) natural.add(id);
      else eligible.add(id);
    }
  }
  return { terminal, eligible, natural };
}

export function hintProgram(ranges, flagCvt) {
  assert.ok(flagCvt < 256, 'CVT index fits PUSHB');
  const code = [];
  for (const [low, high] of ranges) {
    assert.ok(Number.isInteger(low) && low >= 8 && Number.isInteger(high) && high <= 50 && low <= high);
    // CVT[3] == 0 && low <= MPPEM <= high. GDI's existing strong mode
    // and renderers using natural mode remain unchanged.
    code.push(0xb0, stemModeCvt, 0x45, 0xb0, 0, 0x54,
      0x4b, 0xb0, low, 0x53, 0x5a, 0x4b, 0xb0, high, 0x51, 0x5a,
      0x58, 0xb1, stemModeCvt, 100, 0x44, 0xb1, flagCvt, 1, 0x44, 0x59);
  }
  return Buffer.from(code);
}

export function protectedHintProgram(flagCvt, restore, mode = 0) {
  // The flag is set only when our prep policy activated stronger rounding.
  // Both fragments balance the stack. No values are left underneath the
  // original glyph program, which is allowed to clear its stack.
  const value = restore ? 100 : mode;
  assert.ok([0, -100, 100].includes(value), 'Known ttfautohint stem mode');
  const write = value < 0 ? [0xb9, 0, stemModeCvt, 0xff, 0x9c, 0x44]
    : [0xb1, stemModeCvt, value, 0x44];
  return Buffer.from([0xb0, flagCvt, 0x45, 0x58, ...write, 0x59]);
}

export async function refineHints(input, output, style) {
  const bytes = await readFile(input), tables = sfntTables(bytes), font = create(bytes);
  const info = tables.get('TTFA').data.toString('utf8');
  assert.match(info, /ttfautohint version = 1\.8\.4\n/);
  assert.match(info, /gray-stem-width-mode = quantized\n/);
  assert.match(info, /dw-cleartype-stem-width-mode = quantized\n/);
  const prep = tables.get('prep').data;
  assert.ok(prep.includes(Buffer.from([0xb9, 0, stemModeCvt, 0, 0, 0x44])), 'Expected ttfautohint mode initialization');
  const geometry = glyphGeometryHash(font);
  assert.equal(geometry, hintPolicy.geometrySha256[style.file], 'Every outline and advance agrees with v1.200');
  const { terminal, eligible, natural } = hintGlyphSets(font, style);
  const ranges = hintPolicy.styles[style.file].strongPpemRanges;
  const flagCvt = tables.get('cvt ').data.length / 2;
  const policy = hintProgram(ranges, flagCvt);
  const prefix = protectedHintProgram(flagCvt, false), suffix = protectedHintProgram(flagCvt, true);
  const naturalPrefix = protectedHintProgram(flagCvt, false, -100);
  const loca = tables.get('loca').data, glyf = tables.get('glyf').data;
  const originalLong = tables.get('head').data.readInt16BE(50) === 1;
  const offset = id => originalLong ? loca.readUInt32BE(id * 4) : loca.readUInt16BE(id * 2) * 2;
  const chunks = [], offsets = [0], protectedGlyphs = [], terminalGlyphs = [], naturalGlyphs = [];
  let length = 0, maximumInstructions = 0;
  for (let id = 0; id < font.numGlyphs; id++) {
    const glyph = font.getGlyph(id), data = glyf.subarray(offset(id), offset(id + 1));
    let rebuilt = data;
    if (data.length) {
      const contours = data.readInt16BE(0);
      assert.ok(contours >= 0, `${glyph.name}: source composites must already be unlinked`);
      const position = 10 + 2 * contours, oldLength = data.readUInt16BE(position);
      let program = data.subarray(position + 2, position + 2 + oldLength);
      if (terminal.has(id)) {
        // These shapes follow cell boundaries rather than text blue zones.
        // The generated programs collapse/invert their spans on DirectWrite.
        program = Buffer.alloc(0); terminalGlyphs.push(glyph.name);
      } else if (oldLength && natural.has(id)) {
        program = Buffer.concat([naturalPrefix, program, suffix]); naturalGlyphs.push(glyph.name);
      } else if (oldLength && glyph.path.commands.length && !eligible.has(id)) {
        program = Buffer.concat([prefix, program, suffix]); protectedGlyphs.push(glyph.name);
      }
      maximumInstructions = Math.max(maximumInstructions, program.length);
      const newLength = position + 2 + program.length + data.length - (position + 2 + oldLength);
      rebuilt = Buffer.alloc((newLength + 3) & ~3);
      data.copy(rebuilt, 0, 0, position);
      rebuilt.writeUInt16BE(program.length, position);
      program.copy(rebuilt, position + 2);
      data.copy(rebuilt, position + 2 + program.length, position + 2 + oldLength);
    }
    chunks.push(rebuilt); length += rebuilt.length; offsets.push(length);
  }
  const long = originalLong || length > 0x1fffe;
  const newLoca = Buffer.alloc((font.numGlyphs + 1) * (long ? 4 : 2));
  offsets.forEach((value, id) => long ? newLoca.writeUInt32BE(value, id * 4) : newLoca.writeUInt16BE(value / 2, id * 2));
  const head = Buffer.from(tables.get('head').data); head.writeInt16BE(long ? 1 : 0, 50);
  const maxp = Buffer.from(tables.get('maxp').data);
  maxp.writeUInt16BE(maximumInstructions, 26);
  maxp.writeUInt16BE(Math.max(maxp.readUInt16BE(24), 3), 24);
  const refinedInfo = info.trimEnd() + '\n\nrefined-hint-policy = ' + hintPolicy.policyVersion
    + '\nrefined-strong-ppems = ' + ranges.map(([a, b]) => `${a}-${b}`).join(',')
    + '\nrefined-terminal-glyphs = ' + terminalGlyphs.length
    + '\nrefined-natural-glyphs = ' + naturalGlyphs.length
    + '\nrefined-protected-glyphs = ' + protectedGlyphs.length + '\n';
  const result = replaceTables(bytes, {
    prep: Buffer.concat([prep, policy]),
    'cvt ': Buffer.concat([tables.get('cvt ').data, Buffer.alloc(2)]),
    glyf: Buffer.concat(chunks), loca: newLoca, head, maxp, TTFA: Buffer.from(refinedInfo),
  });
  assert.equal(glyphGeometryHash(create(result)), geometry, 'Hint refinement preserves every outline and advance exactly');
  await writeFile(output, result);
  return { policyVersion: hintPolicy.policyVersion, strongPpemRanges: ranges, flagCvt,
    originalPrepBytes: prep.length, policyBytecodeSha256: sha256(policy),
    eligibleGlyphs: [...eligible].map(id => font.getGlyph(id).name), naturalGlyphs, protectedGlyphs, terminalGlyphs,
    geometrySha256: geometry, geometryAndAdvancePreservation: 'exact for every output glyph' };
}
