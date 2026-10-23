import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { root, styles, fontFile, sourceBytes, run, tool, heartbeat } from './lib.mjs';

const done = heartbeat('Rendering the font comparison and small-size specimens');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-preview-'));
const sample = [
  'Tasks: 55, 119 thr; 1 running   Mem: 905M/15.6G   Load: 0.01',
  'PID USER       PRI  NI  VIRT   RES   SHR S CPU% MEM%  Command',
  '  1 root        20   0  162M 11708  8588 S  0.0  0.1  /sbin/init',
  'if (value != 0) { console.log("Inconsolata Refined", value); }',
  '0O 1lI | [] {} () <> == != => -> // @ # % & * ~ _',
  'Àéîõü ÄÖÜ ñ ç ệ ỡ ḗ  |  a\u0301 e\u0302\u0323 o\u0308  |  fi fl ffi ffl',
  '┌──────────┬──────────┐   ▁▂▃▄▅▆▇█  ████████',
  '│ terminal │  aligned │   ░▒▓█████  ████████',
  '└──────────┴──────────┘',
].join('\n');
const compact = '0123456789 0O1lI {}[]() != =>  The quick brown fox jumps over the lazy dog.';
const background = [12, 12, 12, 255];
let serial = 0;

async function render(font, text, size, color = 'cccccc') {
  const file = join(temporary, `${serial++}.png`);
  await run(tool('hb-view'), [font, `--text=${text}`, `--font-size=${size}`, `--font-ppem=${size}`, '--ft-load-flags=0',
    '--margin=6', '--background=0c0c0c', `--foreground=${color}`, `--output-file=${file}`]);
  return PNG.sync.read(await readFile(file));
}

function canvas(width, height) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) for (let c = 0; c < 4; c++) png.data[i + c] = background[c];
  return png;
}

function paste(destination, source, x, y) {
  for (let row = 0; row < source.height; row++) {
    source.data.copy(destination.data, ((row + y) * destination.width + x) * 4, row * source.width * 4, (row + 1) * source.width * 4);
  }
}

try {
  await mkdir(join(root, 'docs'), { recursive: true });
  const original = join(temporary, 'Inconsolata-Regular.ttf');
  await writeFile(original, await sourceBytes('Regular'));
  const reference = process.env.CASCADIA_CODE || join(root, 'reference/CascadiaCode.ttf');
  const panels = [];
  if (existsSync(reference)) panels.push({ name: 'Cascadia Code - reference', font: reference });
  panels.push({ name: 'Inconsolata - original', font: original });
  for (const style of styles) panels.push({ name: `Inconsolata Refined - ${style.name}`, font: fontFile(style) });

  const blocks = [];
  for (const panel of panels) {
    const label = await render(fontFile(styles[0]), `${panel.name} | 16 px`, 20, '73d78b');
    const body = await render(panel.font, sample, 16);
    blocks.push({ label, body });
    console.log(`Rendered ${panel.name}`);
  }
  const width = Math.max(...blocks.flatMap(block => [block.label.width, block.body.width])) + 48;
  const height = blocks.reduce((sum, block) => sum + block.label.height + block.body.height + 32, 24);
  const preview = canvas(width, height);
  let y = 12;
  for (const block of blocks) {
    paste(preview, block.label, 24, y); y += block.label.height;
    paste(preview, block.body, 24, y); y += block.body.height + 32;
  }
  await writeFile(join(root, 'docs/preview.png'), PNG.sync.write(preview));

  const smallBlocks = [];
  for (const size of [10, 12, 14, 16, 18, 20, 24]) {
    smallBlocks.push(await render(fontFile(styles[0]), `${size} px`, 16, '73d78b'));
    for (const style of styles) smallBlocks.push(await render(fontFile(style), `${style.name.padEnd(11)} ${compact}`, size));
    smallBlocks.push(canvas(1, 18));
  }
  const small = canvas(Math.max(...smallBlocks.map(block => block.width)) + 48, smallBlocks.reduce((sum, block) => sum + block.height, 24));
  y = 12;
  for (const block of smallBlocks) { paste(small, block, 24, y); y += block.height; }
  await writeFile(join(root, 'docs/small-sizes.png'), PNG.sync.write(small));
  console.log('Saved docs/preview.png and docs/small-sizes.png.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
