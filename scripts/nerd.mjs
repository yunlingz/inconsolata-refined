import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { create } from 'fontkit';
import { family, root, sources, sfntTables, replaceTables, sha256, run } from './lib.mjs';

export const nerdFamily = `${family} Nerd`;
export const nerdVersion = '1.601';
export const nerdFile = style => `InconsolataRefinedNerd-${style.file}.ttf`;
export const nerdOptions = ['--complete', '--single-width-glyphs', '--boxdrawing', '--quiet', '--no-progressbars'];
// A neutral ASCII seed lets the official patcher supply every non-ASCII
// symbol, including sets it would otherwise skip when already present.
export const nerdSeedUnicodes = '20-7E';
export const nerdSeedCodes = new Set(Array.from({ length: 95 }, (_, i) => 32 + i));
export function codePointRanges(codes) {
  const ranges = [];
  for (const code of codes) {
    if (ranges.at(-1)?.[1] === code - 1) ranges.at(-1)[1] = code;
    else ranges.push([code, code]);
  }
  return ranges;
}
export const expandCodePointRanges = ranges => ranges.flatMap(([start, end]) =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i));
export const nerdGlyphHash = (font, codes) => sha256(Buffer.from(JSON.stringify(codes.map(code => {
  const glyph = font.glyphForCodePoint(code);
  return [code, glyph.advanceWidth, glyph.path.commands];
}))));

export async function extractNerdSources(directory) {
  const source = sources.nerdFonts;
  const archive = join(root, source.archive);
  assert.equal(sha256(await readFile(archive)), source.sha256, 'Pinned Nerd Fonts patcher archive');
  await mkdir(directory, { recursive: true });
  await run('unzip', ['-q', archive, '-d', directory]);
  const registry = JSON.parse(await readFile(join(directory, 'glyphnames.json'), 'utf8'));
  assert.equal(registry.METADATA.version, source.version);
  return registry;
}

export function rawGlyph(tables, id) {
  const loca = tables.get('loca').data;
  const long = tables.get('head').data.readInt16BE(50) === 1;
  const offset = i => long ? loca.readUInt32BE(i * 4) : loca.readUInt16BE(i * 2) * 2;
  return tables.get('glyf').data.subarray(offset(id), offset(id + 1));
}

export function horizontalMetric(tables, id) {
  const n = tables.get('hhea').data.readUInt16BE(34), data = tables.get('hmtx').data;
  return [data.readUInt16BE(Math.min(id, n - 1) * 4),
    data.readInt16BE(id < n ? id * 4 + 2 : n * 4 + (id - n) * 2)];
}

export function nameRecords(table) {
  assert.equal(table.readUInt16BE(0), 0, 'Supported name table format');
  const start = table.readUInt16BE(4);
  return Array.from({ length: table.readUInt16BE(2) }, (_, i) => {
    const p = 6 + i * 12, length = table.readUInt16BE(p + 8), offset = table.readUInt16BE(p + 10);
    const platform = table.readUInt16BE(p), data = table.subarray(start + offset, start + offset + length);
    return { platform, encoding: table.readUInt16BE(p + 2), language: table.readUInt16BE(p + 4),
      id: table.readUInt16BE(p + 6), data,
      text: platform === 0 || platform === 3 ? Buffer.from(data).swap16().toString('utf16le') : data.toString('latin1') };
  });
}

function renamedTable(table, style) {
  const ps = `InconsolataRefinedNerd-${style.file}`;
  const names = new Map([[1, nerdFamily], [2, style.name], [3, `${nerdVersion};NONE;${ps}`],
    [4, `${nerdFamily} ${style.name}`], [6, ps], [16, nerdFamily], [17, style.name],
    [18, `${nerdFamily} ${style.name}`], [21, nerdFamily], [22, style.name]]);
  const records = nameRecords(table);
  for (const record of records) {
    const value = record.id === 5
      ? `${record.text.replace(/^Version [\d.]+/, `Version ${nerdVersion}`)}; Nerd Fonts ${sources.nerdFonts.version}` : names.get(record.id);
    if (value !== undefined) record.data = record.platform === 0 || record.platform === 3
      ? Buffer.from(value, 'utf16le').swap16() : Buffer.from(value, 'latin1');
  }
  for (const platform of [1, 3]) {
    const description = `Inconsolata Refined with complete Nerd Fonts ${sources.nerdFonts.version} icons. `
      + 'Nerd Fonts replaces overlapping symbol code points. Other text outlines, advances and hints are preserved. '
      + 'Icon authors and licenses are included in the licenses directory.';
    records.push({ platform, encoding: platform === 3 ? 1 : 0, language: platform === 3 ? 0x409 : 0, id: 10,
      data: platform === 3 ? Buffer.from(description, 'utf16le').swap16() : Buffer.from(description) });
  }
  records.sort((a, b) => a.platform - b.platform || a.encoding - b.encoding || a.language - b.language || a.id - b.id);
  const header = Buffer.alloc(6 + records.length * 12), strings = [];
  header.writeUInt16BE(records.length, 2); header.writeUInt16BE(header.length, 4);
  let offset = 0;
  for (const [i, record] of records.entries()) {
    const p = 6 + i * 12;
    [record.platform, record.encoding, record.language, record.id, record.data.length, offset]
      .forEach((v, j) => header.writeUInt16BE(v, p + j * 2));
    strings.push(record.data); offset += record.data.length;
  }
  return Buffer.concat([header, ...strings]);
}

function unicodeCmap(mapping, original) {
  const entries = [...mapping].sort(([a], [b]) => a - b), segments = [], groups = [];
  for (const [code, id] of entries) {
    assert.ok(code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff));
    const last = groups.at(-1);
    if (last && code === last[1] + 1 && id === last[2] + code - last[0]) last[1] = code;
    else groups.push([code, code, id]);
    if (code >= 0xffff) continue;
    const delta = (id - code) & 0xffff, previous = segments.at(-1);
    if (previous && previous[1] + 1 === code && previous[2] === delta) previous[1] = code;
    else segments.push([code, code, delta]);
  }
  segments.push([0xffff, 0xffff, 1]);
  const n = segments.length, power = Math.floor(Math.log2(n));
  const bmp = Buffer.alloc(16 + 8 * n), full = Buffer.alloc(16 + 12 * groups.length);
  assert.ok(bmp.length <= 0xffff, 'BMP cmap fits format 4');
  [4, bmp.length, 0, 2 * n, 2 ** (power + 1), power, 2 * n - 2 ** (power + 1)]
    .forEach((v, i) => bmp.writeUInt16BE(v, i * 2));
  for (const [i, [start, end, delta]] of segments.entries()) {
    bmp.writeUInt16BE(end, 14 + i * 2); bmp.writeUInt16BE(start, 16 + n * 2 + i * 2);
    bmp.writeUInt16BE(delta, 16 + n * 4 + i * 2);
  }
  full.writeUInt16BE(12, 0); full.writeUInt32BE(full.length, 4); full.writeUInt32BE(groups.length, 12);
  groups.forEach((group, i) => group.forEach((v, j) => full.writeUInt32BE(v, 16 + i * 12 + j * 4)));
  const records = [[0, 3, bmp], [0, 4, full], [3, 1, bmp], [3, 10, full]];
  // Retain the original Macintosh cmap in addition to both Unicode planes.
  for (let i = 0; i < original.readUInt16BE(2); i++) {
    const p = 4 + i * 8, platform = original.readUInt16BE(p), encoding = original.readUInt16BE(p + 2);
    if (platform !== 1) continue;
    const start = original.readUInt32BE(p + 4), format = original.readUInt16BE(start);
    assert.ok([0, 6].includes(format), 'Known Macintosh cmap format');
    records.push([platform, encoding, original.subarray(start, start + original.readUInt16BE(start + 2))]);
  }
  records.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const header = Buffer.alloc(4 + records.length * 8), parts = [], offsets = new Map();
  header.writeUInt16BE(records.length, 2);
  let offset = header.length;
  for (const [i, [platform, encoding, data]] of records.entries()) {
    if (!offsets.has(data)) { offsets.set(data, offset); parts.push(data); offset += data.length; }
    header.writeUInt16BE(platform, 4 + i * 8); header.writeUInt16BE(encoding, 6 + i * 8);
    header.writeUInt32BE(offsets.get(data), 8 + i * 8);
  }
  return Buffer.concat([header, ...parts]);
}

// Append the patcher's unhinted symbols and give them precedence in cmap.
// Original glyph IDs/bytes stay fixed, keeping every existing layout/hint
// reference valid and preserving any non-overlapping Unicode aliases.
export function appendNerdGlyphs(baseBytes, patchedBytes, style) {
  const base = create(baseBytes), patched = create(patchedBytes);
  const tables = sfntTables(baseBytes), iconTables = sfntTables(patchedBytes);
  assert.equal(patched.unitsPerEm, base.unitsPerEm);
  assert.equal(tables.get('head').data.readInt16BE(50), 1, 'Base uses long glyph locations');
  const mapping = new Map(base.characterSet.map(c => [c, base.glyphForCodePoint(c).id]));
  const additions = [], ids = new Map(), provided = [], replacedCodePoints = [];
  for (const code of patched.characterSet) {
    if (nerdSeedCodes.has(code)) continue;
    assert.ok(code > 0x7f, 'Pinned Nerd Fonts symbols are outside the ASCII seed');
    provided.push(code);
    if (mapping.has(code)) replacedCodePoints.push(code);
    const sourceId = patched.glyphForCodePoint(code).id;
    if (!ids.has(sourceId)) {
      ids.set(sourceId, base.numGlyphs + additions.length);
      additions.push({ code, sourceId, data: rawGlyph(iconTables, sourceId) });
    }
    mapping.set(code, ids.get(sourceId));
  }
  const count = base.numGlyphs + additions.length;
  assert.ok(count < 65535, 'TrueType glyph limit');
  const loca = Buffer.alloc((count + 1) * 4), hmtx = Buffer.alloc(count * 4);
  const hhea = Buffer.from(tables.get('hhea').data), head = Buffer.from(tables.get('head').data);
  head.writeInt32BE(Math.round(Number(nerdVersion) * 65536), 4);
  const maxp = Buffer.from(tables.get('maxp').data), polygons = [];
  tables.get('loca').data.copy(loca);
  let offset = tables.get('glyf').data.length;
  assert.equal(loca.readUInt32BE(base.numGlyphs * 4), offset);
  for (const [i, addition] of additions.entries()) {
    const data = addition.data;
    // The pinned complete patcher emits flattened, unhinted icon glyphs.
    // Reject a tool upgrade that violates this instead of copying wrong GIDs/CVTs.
    if (data.length) {
      const contours = data.readInt16BE(0);
      assert.ok(contours >= 0, `Icon U+${addition.code.toString(16)} must be flattened`);
      assert.equal(data.readUInt16BE(10 + contours * 2), 0, 'Icon must not use another font\'s hint VM');
      const points = contours ? data.readUInt16BE(8 + contours * 2) + 1 : 0;
      maxp.writeUInt16BE(Math.max(maxp.readUInt16BE(6), points), 6);
      maxp.writeUInt16BE(Math.max(maxp.readUInt16BE(8), contours), 8);
    }
    const padded = Buffer.alloc((data.length + 3) & ~3); data.copy(padded); polygons.push(padded);
    offset += padded.length; loca.writeUInt32BE(offset, (base.numGlyphs + i + 1) * 4);
  }
  let advanceMax = 0, lsbMin = Infinity, rsbMin = Infinity, extentMax = -Infinity;
  for (let id = 0; id < count; id++) {
    const addition = additions[id - base.numGlyphs];
    const [advance, bearing] = horizontalMetric(addition ? iconTables : tables, addition ? addition.sourceId : id);
    if (addition) assert.equal(advance, base.glyphForCodePoint(0x20).advanceWidth, 'Every Nerd icon uses the base monospace cell');
    hmtx.writeUInt16BE(advance, id * 4); hmtx.writeInt16BE(bearing, id * 4 + 2);
    const data = addition ? addition.data : rawGlyph(tables, id);
    const width = data.length ? data.readInt16BE(6) - data.readInt16BE(2) : 0;
    advanceMax = Math.max(advanceMax, advance); lsbMin = Math.min(lsbMin, bearing);
    rsbMin = Math.min(rsbMin, advance - bearing - width); extentMax = Math.max(extentMax, bearing + width);
    if (addition && data.length) for (let axis = 0; axis < 4; axis++) {
      const p = 36 + axis * 2, value = data.readInt16BE(2 + axis * 2);
      head.writeInt16BE(axis < 2 ? Math.min(head.readInt16BE(p), value) : Math.max(head.readInt16BE(p), value), p);
    }
  }
  hhea.writeUInt16BE(advanceMax, 10); hhea.writeInt16BE(lsbMin, 12);
  hhea.writeInt16BE(rsbMin, 14); hhea.writeInt16BE(extentMax, 16); hhea.writeUInt16BE(count, 34);
  maxp.writeUInt16BE(count, 4);
  const post = tables.get('post').data;
  assert.equal(post.readUInt32BE(0), 0x20000);
  const oldIndices = post.subarray(34, 34 + base.numGlyphs * 2);
  const customCount = Math.max(257, ...Array.from({ length: base.numGlyphs }, (_, i) => oldIndices.readUInt16BE(i * 2))) - 257;
  const postHeader = Buffer.from(post.subarray(0, 34)), indices = Buffer.alloc(additions.length * 2);
  postHeader.writeUInt16BE(count, 32);
  const names = additions.map(({ code }, i) => {
    indices.writeUInt16BE(258 + customCount + i, i * 2);
    const name = Buffer.from(`nerd.u${code.toString(16).toUpperCase()}`);
    return Buffer.concat([Buffer.from([name.length]), name]);
  });
  const os2 = Buffer.from(tables.get('OS/2').data);
  for (let p = 42; p < 58; p += 4) os2.writeUInt32BE((os2.readUInt32BE(p) | iconTables.get('OS/2').data.readUInt32BE(p)) >>> 0, p);
  os2.writeUInt16BE(Math.min(...mapping.keys(), 0xffff), 64);
  os2.writeUInt16BE(Math.min(Math.max(...mapping.keys()), 0xffff), 66);
  const bytes = replaceTables(baseBytes, { head, hhea, hmtx, maxp, 'OS/2': os2, loca,
    glyf: Buffer.concat([tables.get('glyf').data, ...polygons]),
    post: Buffer.concat([postHeader, oldIndices, indices, post.subarray(34 + base.numGlyphs * 2), ...names]),
    cmap: unicodeCmap(mapping, tables.get('cmap').data), name: renamedTable(tables.get('name').data, style) });
  assert.equal(nerdGlyphHash(create(bytes), provided), nerdGlyphHash(patched, provided), 'Every supplied Nerd symbol wins, including overlaps');
  return { bytes, appendedGlyphs: additions.length, addedCharacters: mapping.size - base.characterSet.length,
    replacedCodePoints, providedCoverage: codePointRanges(provided), providedGlyphsSha256: nerdGlyphHash(patched, provided) };
}
