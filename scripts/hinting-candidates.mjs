import assert from 'node:assert/strict';
import { create } from 'fontkit';
import { sfntTables, replaceTables, glyphInstructions, sha256 } from './lib.mjs';

// The review baseline is the pinned 1.400 release. Recover its unmodified
// ttfautohint programs so all candidates have identical geometry and blue
// zones. Shipping builds still start from the original variable font.
export function baselineHintPrograms(bytes, refinement) {
  assert.equal(refinement.policyVersion, 2, 'Expected the pinned 1.400 policy');
  const tables = sfntTables(bytes), font = create(bytes), glyf = Buffer.from(tables.get('glyf').data);
  const loca = tables.get('loca').data, long = tables.get('head').data.readInt16BE(50) === 1;
  const offset = i => long ? loca.readUInt32BE(i * 4) : loca.readUInt16BE(i * 2) * 2;
  const natural = new Set(refinement.naturalGlyphs), protectedNames = new Set(refinement.protectedGlyphs);
  function guard(restore, mode = 0) {
    const value = restore ? 100 : mode;
    const write = value < 0 ? [0xb9, 0, 3, 0xff, 0x9c, 0x44] : [0xb1, 3, value, 0x44];
    return Buffer.from([0xb0, refinement.flagCvt, 0x45, 0x58, ...write, 0x59]);
  }
  for (let id = 0; id < font.numGlyphs; id++) {
    const name = font.getGlyph(id).name;
    if (!natural.has(name) && !protectedNames.has(name)) continue;
    const start = offset(id), end = offset(id + 1), position = start + 10 + glyf.readInt16BE(start) * 2;
    const length = glyf.readUInt16BE(position), prefix = guard(false, natural.has(name) ? -100 : 0), suffix = guard(true);
    assert.deepEqual(glyf.subarray(position + 2, position + 2 + prefix.length), prefix);
    assert.deepEqual(glyf.subarray(position + 2 + length - suffix.length, position + 2 + length), suffix);
    const program = Buffer.from(glyf.subarray(position + 2 + prefix.length, position + 2 + length - suffix.length));
    const rest = Buffer.from(glyf.subarray(position + 2 + length, end));
    glyf.writeUInt16BE(program.length, position); program.copy(glyf, position + 2); rest.copy(glyf, position + 2 + program.length);
    glyf.fill(0, position + 2 + program.length + rest.length, end);
  }
  return replaceTables(bytes, { glyf, prep: tables.get('prep').data.subarray(0, refinement.originalPrepBytes),
    'cvt ': tables.get('cvt ').data.subarray(0, refinement.flagCvt * 2) });
}

export function modeCandidate(bytes, mode) {
  assert.ok(['q', 'n', 's', 'u'].includes(mode));
  if (mode === 'q') return bytes;
  const tables = sfntTables(bytes);
  if (mode === 'u') {
    const font = create(bytes), glyf = Buffer.from(tables.get('glyf').data), loca = tables.get('loca').data;
    const long = tables.get('head').data.readInt16BE(50) === 1;
    const offset = i => long ? loca.readUInt32BE(i * 4) : loca.readUInt16BE(i * 2) * 2;
    for (let id = 0; id < font.numGlyphs; id++) {
      const start = offset(id), end = offset(id + 1);
      if (end - start < 12) continue;
      const position = start + 10 + glyf.readInt16BE(start) * 2, length = glyf.readUInt16BE(position);
      const rest = Buffer.from(glyf.subarray(position + 2 + length, end));
      glyf.writeUInt16BE(0, position); rest.copy(glyf, position + 2); glyf.fill(0, position + 2 + rest.length, end);
    }
    return replaceTables(bytes, { glyf });
  }
  // Change only a quantized renderer. Keep the existing GDI strong mode.
  const write = mode === 'n' ? [0xb9, 0, 3, 0xff, 0x9c, 0x44] : [0xb1, 3, 100, 0x44];
  return replaceTables(bytes, { prep: Buffer.concat([tables.get('prep').data,
    Buffer.from([0xb0, 3, 0x45, 0xb0, 0, 0x54, 0x58, ...write, 0x59])]) });
}

export function hintFingerprint(bytes, count, overrides = new Map()) {
  const tables = sfntTables(bytes);
  return sha256(Buffer.from(JSON.stringify([
    ...['fpgm', 'prep', 'cvt '].map(tag => tables.get(tag).data.toString('base64')),
    ...Array.from({ length: count }, (_, id) => (overrides.get(id) ?? glyphInstructions(tables, id)).toString('base64')),
  ])));
}

export function measuredHintPrograms(bytes, refinement, selected, prefixForEntry, suffix) {
  const tables = sfntTables(bytes), glyf = Buffer.from(tables.get('glyf').data), loca = tables.get('loca').data;
  const long = tables.get('head').data.readInt16BE(50) === 1;
  const offset = i => long ? loca.readUInt32BE(i * 4) : loca.readUInt16BE(i * 2) * 2;
  for (const [id, entry] of selected) {
    const start = offset(id), end = offset(id + 1), position = start + 10 + glyf.readInt16BE(start) * 2;
    const length = glyf.readUInt16BE(position), prefix = prefixForEntry(entry, refinement.flagCvt);
    assert.deepEqual(glyf.subarray(position + 2, position + 2 + prefix.length), prefix);
    assert.deepEqual(glyf.subarray(position + 2 + length - suffix.length, position + 2 + length), suffix);
    const program = Buffer.from(glyf.subarray(position + 2 + prefix.length, position + 2 + length - suffix.length));
    const rest = Buffer.from(glyf.subarray(position + 2 + length, end));
    glyf.writeUInt16BE(program.length, position); program.copy(glyf, position + 2); rest.copy(glyf, position + 2 + program.length);
    glyf.fill(0, position + 2 + program.length + rest.length, end);
  }
  return replaceTables(bytes, { glyf, prep: tables.get('prep').data.subarray(0, refinement.originalPrepBytes),
    'cvt ': tables.get('cvt ').data.subarray(0, refinement.flagCvt * 2) });
}
