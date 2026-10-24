import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { root, sfntTables, replaceTables, glyphInstructions } from './lib.mjs';
import { edges } from './strokes.mjs';

export async function execute(command, args, cwd = root) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks = []; let stderr = '';
  child.stdout.on('data', data => chunks.push(data)); child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
  const timeout = setTimeout(() => child.kill(), 240_000);
  try {
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    if (code !== 0) throw new Error(`${command} exited ${code}: ${stderr}`);
    return Buffer.concat(chunks);
  } finally { clearTimeout(timeout); }
}
export const toWindows = path => 'C:\\' + path.slice('/mnt/c/'.length).replaceAll('/', '\\');
const toWsl = path => {
  assert.match(path, /^[A-Za-z]:\\/);
  return '/mnt/' + path[0].toLowerCase() + path.slice(2).replaceAll('\\', '/');
};

export function probeFont(bytes, font) {
  const tables = sfntTables(bytes), empty = font.getGlyph(0);
  const alias = Array.from({ length: font.numGlyphs }, (_, id) => font.getGlyph(id)).find(g => g.id > 0
    && g.advanceWidth === empty.advanceWidth && !g.path.commands.length && !glyphInstructions(tables, g.id).length);
  assert.ok(!empty.path.commands.length && !glyphInstructions(tables, 0).length && alias);
  const sub = Buffer.alloc(16 + 12 * font.numGlyphs);
  sub.writeUInt16BE(12, 0); sub.writeUInt32BE(sub.length, 4); sub.writeUInt32BE(font.numGlyphs, 12);
  for (let id = 0; id < font.numGlyphs; id++) {
    const p = 16 + id * 12; sub.writeUInt32BE(0xf0000 + id, p); sub.writeUInt32BE(0xf0000 + id, p + 4);
    sub.writeUInt32BE(id === 0 ? alias.id : id, p + 8);
  }
  const cmap = Buffer.alloc(12 + sub.length); cmap.writeUInt16BE(1, 2); cmap.writeUInt16BE(3, 4);
  cmap.writeUInt16BE(10, 6); cmap.writeUInt32BE(12, 8); sub.copy(cmap, 12);
  return replaceTables(bytes, { cmap });
}

export function outlineTopology(glyph) {
  const contours = []; let current;
  for (const command of glyph.path.commands) {
    if (command.command === 'moveTo') { current = []; contours.push(current); }
    current?.push(command);
  }
  const signs = contours.map(commands => Math.sign(edges({ path: { commands } }).reduce((sum, [a, b]) =>
    sum + a[0] * b[1] - b[0] * a[1], 0)));
  return { counters: signs.filter(value => value > 0).length, parts: signs.filter(value => value < 0).length };
}

export async function nativeWorkspace() {
  const chromium = process.env.WINDOWS_CHROMIUM ?? [
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(path => existsSync(path));
  if (!chromium) throw new Error('Native raster checks require WSL and a Windows Chromium executable; set WINDOWS_CHROMIUM.');
  const temp = (await execute('/mnt/c/Windows/System32/cmd.exe', ['/d', '/c', 'echo', '%TEMP%'], '/mnt/c/Windows')).toString('utf8').trim();
  const directory = await mkdtemp(join(toWsl(temp), 'inconsolata-raster-'));
  let sequence = 0;
  return {
    directory,
    async page(script, label) {
      const page = join(directory, 'raster.html');
      await writeFile(page, '<!doctype html><meta charset="utf-8"><body>loading<script>' + script
        + '.then(r=>document.body.textContent="BEGIN_REPORT"+btoa(JSON.stringify(r))+"END_REPORT")'
        + '.catch(e=>document.body.textContent="BEGIN_REPORT"+btoa(JSON.stringify({error:e.stack}))+"END_REPORT")</script>');
      const fileUrl = 'file:///' + toWindows(page).replaceAll('\\', '/').split('/').map((part, i) => i ? encodeURIComponent(part) : part).join('/');
      const output = (await execute(chromium, ['--headless=new', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--disable-component-update', '--disable-extensions', '--allow-file-access-from-files',
        '--virtual-time-budget=10000', '--dump-dom', '--user-data-dir=' + toWindows(join(directory, 'profile-' + label + '-' + ++sequence)), fileUrl])).toString('utf8');
      const encoded = output.match(/<body[^>]*>BEGIN_REPORT([A-Za-z0-9+/=]+)END_REPORT/);
      if (!encoded) throw new Error('Windows browser returned no raster report: ' + output.slice(-1200));
      const result = JSON.parse(Buffer.from(encoded[1], 'base64').toString('utf8'));
      if (result.error) throw new Error(result.error);
      assert.equal(result.platform, 'Win32', 'Actual native Windows browser');
      return result;
    },
    async close() { await rm(directory, { recursive: true, force: true }); },
  };
}
