import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create } from 'fontkit';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const family = 'Inconsolata Refined';
export const version = '1.300';
export const styles = [
  { file: 'Regular', name: 'Regular', source: 'Regular', weight: 400, italic: false },
  { file: 'Italic', name: 'Italic', source: 'Regular', weight: 400, italic: true },
  { file: 'Bold', name: 'Bold', source: 'Bold', weight: 700, italic: false },
  { file: 'BoldItalic', name: 'Bold Italic', source: 'Bold', weight: 700, italic: true },
];
export const sources = JSON.parse(await readFile(join(root, 'upstream/sources.json'), 'utf8'));
export const target = JSON.parse(await readFile(join(root, 'reference/metrics.json'), 'utf8'));
export const weightTargets = JSON.parse(await readFile(join(root, 'reference/weights.json'), 'utf8'));
export const hintPolicy = JSON.parse(await readFile(join(root, 'reference/hinting.json'), 'utf8'));
export const hintOptions = [
  '--hinting-range-min=8', '--hinting-range-max=50', '--hinting-limit=200',
  '--increase-x-height=14', '--stem-width-mode=qsq', '--windows-compatibility',
  '--detailed-info', '--ttfa-table',
];

export const sha256 = data => createHash('sha256').update(data).digest('hex');
export const glyphGeometryHash = font => sha256(Buffer.from(JSON.stringify(
  Array.from({ length: font.numGlyphs }, (_, id) => {
    const glyph = font.getGlyph(id);
    return [glyph.name, glyph.advanceWidth, glyph.path.commands];
  }),
)));
export const fontFile = style => join(root, 'fonts', `InconsolataRefined-${style.file}.ttf`);
export const tool = name => {
  const configured = process.env[name.toUpperCase().replaceAll('-', '_')];
  if (configured) return configured;
  for (const candidate of [join(root, '.tools/bin', name), join(root, '.tools/root/usr/bin', name)]) {
    if (existsSync(candidate)) return candidate;
  }
  return name;
};
export const toolEnv = {
  ...process.env,
  LD_LIBRARY_PATH: [join(root, '.tools/root/usr/lib/x86_64-linux-gnu'), process.env.LD_LIBRARY_PATH]
    .filter(Boolean).join(':'),
  PYTHONPATH: [join(root, '.tools/root/usr/lib/python3/dist-packages'), process.env.PYTHONPATH]
    .filter(Boolean).join(':'),
};

export async function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, env: toolEnv, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${signal ?? code}\n${stderr}${stdout}`));
    });
  });
}

export function heartbeat(phase) {
  const emit = () => process.stderr.write(`[${new Date().toISOString()}] ${phase}\n`);
  emit();
  const timer = setInterval(emit, 20_000);
  timer.unref();
  return () => clearInterval(timer);
}

export async function sourceBytes(weight) {
  const bytes = gunzipSync(await readFile(join(root, 'upstream/inconsolata', `Inconsolata-${weight}.ttf.gz`)));
  if (sha256(bytes) !== sources.inconsolata.files[weight].sha256) {
    throw new Error(`Upstream ${weight} checksum mismatch`);
  }
  return bytes;
}

// Keep untouched tables intact when fixing metadata after FontForge export.
export function sfntTables(bytes, sfntOffset = 0) {
  const tables = new Map();
  for (let i = 0; i < bytes.readUInt16BE(sfntOffset + 4); i++) {
    const pos = sfntOffset + 12 + i * 16;
    const tag = bytes.toString('ascii', pos, pos + 4);
    const offset = bytes.readUInt32BE(pos + 8), length = bytes.readUInt32BE(pos + 12);
    tables.set(tag, { directory: pos, offset, data: bytes.subarray(offset, offset + length) });
  }
  return tables;
}

export function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    let word = 0;
    for (let j = 0; j < 4; j++) word = (word * 256 + (bytes[i + j] ?? 0)) >>> 0;
    sum = (sum + word) >>> 0;
  }
  return sum;
}

// Replace existing SFNT tables while preserving every other table verbatim.
export function replaceTables(bytes, replacements, sfntOffset = 0) {
  const tables = sfntTables(bytes, sfntOffset);
  for (const [tag, data] of Object.entries(replacements)) {
    if (!tables.has(tag)) throw new Error(`Missing SFNT table ${tag}`);
    tables.get(tag).data = Buffer.from(data);
  }
  tables.get('head').data = Buffer.from(tables.get('head').data);
  tables.get('head').data.writeUInt32BE(0, 8);
  let offset = 12 + tables.size * 16;
  const output = Buffer.alloc(offset + [...tables.values()].reduce((size, table) => size + ((table.data.length + 3) & ~3), 0));
  bytes.copy(output, 0, sfntOffset, sfntOffset + 12);
  let index = 0, headOffset;
  for (const [tag, { data }] of tables) {
    const entry = 12 + index++ * 16;
    output.write(tag, entry, 4, 'ascii');
    output.writeUInt32BE(checksum(data), entry + 4);
    output.writeUInt32BE(offset, entry + 8);
    output.writeUInt32BE(data.length, entry + 12);
    data.copy(output, offset);
    if (tag === 'head') headOffset = offset;
    offset += (data.length + 3) & ~3;
  }
  output.writeUInt32BE((0xb1b0afba - checksum(output)) >>> 0, headOffset + 8);
  return output;
}

export function glyphInstructions(tables, id) {
  const loca = tables.get('loca').data, glyf = tables.get('glyf').data;
  const long = tables.get('head').data.readInt16BE(50) === 1;
  const offset = index => long ? loca.readUInt32BE(index * 4) : loca.readUInt16BE(index * 2) * 2;
  const start = offset(id), end = offset(id + 1);
  if (end - start < 12) return Buffer.alloc(0);
  const contours = glyf.readInt16BE(start);
  if (contours < 0) throw new Error('The refined fonts must have flattened outlines');
  const position = start + 10 + 2 * contours, length = glyf.readUInt16BE(position);
  if (position + 2 + length > end) throw new Error(`Invalid glyph ${id} instruction bounds`);
  return glyf.subarray(position + 2, position + 2 + length);
}

export async function normalizeMetadata(file) {
  const bytes = await readFile(file), tables = sfntTables(bytes);
  const font = create(bytes), os2 = tables.get('OS/2').data;
  os2.writeInt16BE(target.cellWidth, 2);
  os2.writeInt16BE(Math.round(font.glyphForCodePoint(0x78).bbox.maxY), 86);
  os2.writeInt16BE(Math.round(font.glyphForCodePoint(0x48).bbox.maxY), 88);
  os2.writeUInt16BE(target.typoAscender, 74);
  os2.writeUInt16BE(-target.typoDescender, 76);
  os2.writeInt16BE(target.strikeoutThickness, 26);
  os2.writeInt16BE(target.strikeoutPosition, 28);
  const post = tables.get('post').data;
  post.writeInt16BE(target.underlinePosition, 8);
  post.writeInt16BE(target.underlineThickness, 10);
  const hhea = tables.get('hhea').data;
  hhea.writeInt16BE(font.italicAngle ? 1000 : 1, 18);
  hhea.writeInt16BE(font.italicAngle ? Math.round(Math.tan(-font.italicAngle * Math.PI / 180) * 1000) : 0, 20);
  hhea.writeInt16BE(0, 22);
  const head = tables.get('head').data;
  // A fixed release date makes repeated builds byte-for-byte identical.
  const date = BigInt(Date.parse('2026-10-24T00:00:00+08:00') / 1000 + 2_082_844_800);
  head.writeBigUInt64BE(date, 20);
  head.writeBigUInt64BE(date, 28);
  tables.get('post').data.writeUInt32BE(1, 12);
  head.writeUInt32BE(0, 8);
  for (const { directory, data } of tables.values()) bytes.writeUInt32BE(checksum(data), directory + 4);
  head.writeUInt32BE((0xb1b0afba - checksum(bytes)) >>> 0, 8);
  await writeFile(file, bytes);
}
