import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { create } from 'fontkit';
import { glyphGeometryHash, glyphInstructions, replaceTables, sfntTables, target } from './lib.mjs';

// htop 3.0.5 CRT.c uses these as one-cell sort indicators. The original
// Inconsolata has neither, and the installed Iosevka maps both to wide glyphs.
// Construct geometric symbols here; do not borrow another font's outlines.
export const terminalSymbols = [
  { code: 0x25b3, name: 'uni25B3', up: true },
  { code: 0x25bd, name: 'uni25BD', up: false },
];

function triangle(up, weight) {
  const outer = [[250, 585], [440, 145], [60, 145]];
  const radius = 190 * 440 / (190 + Math.hypot(190, 440));
  const thickness = weight === 700 ? 80 : 60, scale = 1 - thickness / radius;
  const center = [250, 145 + radius];
  const inner = outer.map(p => p.map((v, axis) => Math.round(center[axis] + (v - center[axis]) * scale))).reverse();
  const contours = [outer, inner].map(points => up ? points : points.map(([x, y]) => [x, 730 - y]).reverse());
  const points = contours.flat(), count = points.length;
  // Simple quadratic TrueType glyph, two closed on-curve polygons, no hints.
  // Fractional rasterization preserves the hole and stays inside its cell.
  const length = 10 + 2 * contours.length + 2 + count + 4 * count;
  const data = Buffer.alloc((length + 3) & ~3);
  data.writeInt16BE(2, 0); data.writeInt16BE(60, 2); data.writeInt16BE(145, 4);
  data.writeInt16BE(440, 6); data.writeInt16BE(585, 8);
  data.writeUInt16BE(2, 10); data.writeUInt16BE(5, 12); data.writeUInt16BE(0, 14);
  data.fill(1, 16, 16 + count);
  let p = 16 + count;
  for (const axis of [0, 1]) {
    let previous = 0;
    for (const point of points) { data.writeInt16BE(point[axis] - previous, p); previous = point[axis]; p += 2; }
  }
  return data;
}

function unicodeCmap(font, additions) {
  const mapping = new Map(font.characterSet.map(code => [code, font.glyphForCodePoint(code).id]));
  for (const [code, id] of additions) { assert.ok(!mapping.has(code), 'Only add missing characters'); mapping.set(code, id); }
  assert.ok([...mapping.keys()].every(code => code <= 0xffff), 'Existing font has BMP coverage');
  // Merge adjacent characters with the same glyph delta; keep the sentinel.
  const segments = [];
  for (const code of [...mapping.keys()].filter(code => code !== 0xffff).sort((a, b) => a - b)) {
    const delta = (mapping.get(code) - code) & 0xffff, previous = segments.at(-1);
    if (previous && previous[1] + 1 === code && previous[2] === delta) previous[1] = code;
    else segments.push([code, code, delta]);
  }
  segments.push([0xffff, 0xffff, 1]);
  const n = segments.length;
  const table = Buffer.alloc(16 + 8 * n);
  table.writeUInt16BE(4, 0); table.writeUInt16BE(table.length, 2); table.writeUInt16BE(2 * n, 6);
  const power = Math.floor(Math.log2(n));
  table.writeUInt16BE(2 ** (power + 1), 8); table.writeUInt16BE(power, 10);
  table.writeUInt16BE(2 * n - 2 ** (power + 1), 12);
  for (const [i, [start, end, delta]] of segments.entries()) {
    table.writeUInt16BE(end, 14 + 2 * i); table.writeUInt16BE(start, 16 + 2 * n + 2 * i);
    table.writeUInt16BE(delta, 16 + 4 * n + 2 * i);
  }
  return table;
}

export async function addTerminalSymbols(input, output, style) {
  const bytes = await readFile(input), font = create(bytes), tables = sfntTables(bytes), count = font.numGlyphs;
  assert.equal(count, 966, 'Append symbols after the complete original-derived glyph set');
  assert.equal(tables.get('head').data.readInt16BE(50), 1, 'Long glyph locations');
  assert.equal(tables.get('post').data.readUInt32BE(0), 0x20000, 'Named glyphs in post format 2');
  const polygons = terminalSymbols.map(symbol => triangle(symbol.up, style.weight));
  const glyf = tables.get('glyf').data, loca = Buffer.alloc(4 * (count + polygons.length + 1));
  tables.get('loca').data.copy(loca, 0, 0, 4 * (count + 1));
  let offset = loca.readUInt32BE(4 * count);
  assert.equal(offset, glyf.length, 'No trailing glyph data before appending');
  for (const [i, data] of polygons.entries()) { offset += data.length; loca.writeUInt32BE(offset, 4 * (count + i + 1)); }
  const hhea = Buffer.from(tables.get('hhea').data), hmtx = Buffer.alloc(4 * (count + polygons.length));
  const oldMetrics = hhea.readUInt16BE(34), oldHmtx = tables.get('hmtx').data;
  for (let id = 0; id < count; id++) {
    hmtx.writeUInt16BE(font.getGlyph(id).advanceWidth, 4 * id);
    const position = id < oldMetrics ? 4 * id + 2 : 4 * oldMetrics + 2 * (id - oldMetrics);
    hmtx.writeInt16BE(oldHmtx.readInt16BE(position), 4 * id + 2);
  }
  for (let i = 0; i < polygons.length; i++) { hmtx.writeUInt16BE(target.cellWidth, 4 * (count + i)); hmtx.writeInt16BE(60, 4 * (count + i) + 2); }
  hhea.writeUInt16BE(count + polygons.length, 34);
  const maxp = Buffer.from(tables.get('maxp').data); maxp.writeUInt16BE(count + polygons.length, 4);
  const post = tables.get('post').data, indices = Array.from({ length: count }, (_, id) => post.readUInt16BE(34 + 2 * id));
  const customCount = Math.max(257, ...indices) - 257;
  const postHead = Buffer.from(post.subarray(0, 34)); postHead.writeUInt16BE(count + polygons.length, 32);
  const newIndices = Buffer.alloc(2 * polygons.length);
  terminalSymbols.forEach((_, i) => newIndices.writeUInt16BE(258 + customCount + i, 2 * i));
  const names = terminalSymbols.map(({ name }) => Buffer.concat([Buffer.from([name.length]), Buffer.from(name, 'ascii')]));
  const cmap = tables.get('cmap').data, unicode = unicodeCmap(font, terminalSymbols.map((symbol, i) => [symbol.code, count + i]));
  const records = cmap.readUInt16BE(2), cmapHead = Buffer.from(cmap.subarray(0, 4 + records * 8)), cmapParts = [];
  const cmapOffsets = new Map();
  let cmapOffset = cmapHead.length;
  for (let i = 0; i < records; i++) {
    const position = 4 + 8 * i, oldOffset = cmap.readUInt32BE(position + 4), format = cmap.readUInt16BE(oldOffset);
    assert.ok([0, 4, 6].includes(format), 'Known existing cmap format');
    if (cmapOffsets.has(oldOffset)) { cmapHead.writeUInt32BE(cmapOffsets.get(oldOffset), position + 4); continue; }
    const data = format === 4 ? unicode : cmap.subarray(oldOffset, oldOffset + cmap.readUInt16BE(oldOffset + 2));
    cmapOffsets.set(oldOffset, cmapOffset);
    cmapHead.writeUInt32BE(cmapOffset, position + 4); cmapParts.push(data); cmapOffset += data.length;
  }
  const result = replaceTables(bytes, {
    glyf: Buffer.concat([glyf, ...polygons]), loca, hmtx, hhea, maxp,
    post: Buffer.concat([postHead, post.subarray(34, 34 + 2 * count), newIndices, post.subarray(34 + 2 * count), ...names]),
    cmap: Buffer.concat([cmapHead, ...cmapParts]),
  });
  const after = create(result), afterTables = sfntTables(result);
  assert.equal(glyphGeometryHash(after, count), glyphGeometryHash(font), 'Every existing outline and advance preserved');
  for (let id = 0; id < count; id++) assert.deepEqual(glyphInstructions(afterTables, id), glyphInstructions(tables, id), 'All existing hints preserved');
  for (const tag of ['GPOS', 'GSUB', 'GDEF']) assert.deepEqual(afterTables.get(tag).data, tables.get(tag).data, `${tag} preserved`);
  for (const code of font.characterSet) assert.equal(after.glyphForCodePoint(code).id, font.glyphForCodePoint(code).id, 'All original cmap mappings preserved');
  for (const symbol of terminalSymbols) {
    const g = after.glyphForCodePoint(symbol.code); assert.equal(g.name, symbol.name); assert.equal(g.advanceWidth, target.cellWidth);
    assert.equal(g.path.commands.filter(p => p.command === 'moveTo').length, 2, 'White triangle has a counter');
    assert.deepEqual([g.bbox.minX, g.bbox.minY, g.bbox.maxX, g.bbox.maxY], [60, 145, 440, 585]);
  }
  await writeFile(output, result);
  return { glyphs: terminalSymbols.map(({ code, name }) => ({ codePoint: code, name, advance: target.cellWidth })),
    strokeThickness: style.weight === 700 ? 80 : 60, uprightInItalic: true,
    method: 'New geometric one-cell sort triangles, direct rasterization; every existing glyph, mapping, hint and layout table preserved.' };
}
