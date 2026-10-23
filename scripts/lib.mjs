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
export const version = '1.100';
export const styles = [
  { file: 'Regular', name: 'Regular', source: 'Regular', weight: 400, italic: false },
  { file: 'Italic', name: 'Italic', source: 'Regular', weight: 400, italic: true },
  { file: 'Bold', name: 'Bold', source: 'Bold', weight: 700, italic: false },
  { file: 'BoldItalic', name: 'Bold Italic', source: 'Bold', weight: 700, italic: true },
];
export const sources = JSON.parse(await readFile(join(root, 'upstream/sources.json'), 'utf8'));
export const target = JSON.parse(await readFile(join(root, 'reference/metrics.json'), 'utf8'));
export const weightTargets = JSON.parse(await readFile(join(root, 'reference/weights.json'), 'utf8'));
export const hintOptions = [
  '--hinting-range-min=8', '--hinting-range-max=50', '--hinting-limit=200',
  '--increase-x-height=14', '--stem-width-mode=qsq', '--windows-compatibility',
  '--detailed-info', '--ttfa-table',
];

export const sha256 = data => createHash('sha256').update(data).digest('hex');
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
    child.on('close', code => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stderr || stdout}`));
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
export function sfntTables(bytes) {
  const tables = new Map();
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const pos = 12 + i * 16;
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

export async function normalizeMetadata(file) {
  const bytes = await readFile(file), tables = sfntTables(bytes);
  const font = create(bytes), os2 = tables.get('OS/2').data;
  os2.writeInt16BE(target.cellWidth, 2);
  os2.writeInt16BE(Math.round(font.glyphForCodePoint(0x78).bbox.maxY), 86);
  os2.writeInt16BE(Math.round(font.glyphForCodePoint(0x48).bbox.maxY), 88);
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
