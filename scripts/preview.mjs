import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { create } from 'fontkit';
import { root, version, hintPolicy, styles, weightTargets, fontFile, sourceBytes, run, tool, heartbeat } from './lib.mjs';
import { execute } from './native-raster.mjs';

const done = heartbeat('Rendering the font comparison and small-size specimens');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-preview-'));
const sample = [
  'Tasks: 55, 119 thr; 1 running   Mem: 905M/15.6G   Load: 0.01',
  'PID USER       PRI  NI  VIRT   RES   SHR S CPU%▽MEM%  Command',
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

async function render(font, text, size, color = 'cccccc', variations = '', faceIndex = 0, lineSpace = 0) {
  const file = join(temporary, `${serial++}.png`);
  await run(tool('hb-view'), [font, `--text=${text}`, `--font-size=${size}`, `--font-ppem=${size}`, '--ft-load-flags=0',
    '--margin=6', '--background=0c0c0c', `--foreground=${color}`, `--output-file=${file}`, `--face-index=${faceIndex}`, `--line-space=${lineSpace}`,
    ...(variations ? [`--variations=${variations}`] : [])]);
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
  const reference = process.env.IOSEVKA_REGULAR || join(root, 'reference/Iosevka-Regular.ttc');
  const panels = [];
  if (existsSync(reference)) panels.push({ name: 'Iosevka 33.3.5 - installed reference', font: reference });
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
  const characterSet = create(await readFile(fontFile(styles[0]))).characterSet;
  const marks = characterSet.filter(code => /\p{M}/u.test(String.fromCodePoint(code)));
  const matrixText = marks.map(code => `U+${code.toString(16).toUpperCase()}  `
    + Array.from({ length: 10 }, (_, i) => String.fromCodePoint(48 + i, code)).join(' ')).join('\n');
  const markPanels = [];
  for (const style of styles) markPanels.push([
    await render(fontFile(styles[0]), `${style.name} - all 25 combining marks on digits, 24 px`, 17, '73d78b'),
    await render(fontFile(style), matrixText, 24, 'cccccc', '', 0, 8),
  ]);
  const columnWidth = Math.max(...markPanels.flat().map(panel => panel.width)) + 24;
  const rowHeight = Math.max(...markPanels.map(panels => panels.reduce((sum, panel) => sum + panel.height, 0))) + 24;
  const markImage = canvas(columnWidth * 2 + 48, rowHeight * 2 + 24);
  markPanels.forEach((panels, index) => {
    let y = 12 + Math.floor(index / 2) * rowHeight;
    for (const panel of panels) { paste(markImage, panel, 24 + (index % 2) * columnWidth, y); y += panel.height; }
  });
  await writeFile(join(root, 'docs/combining-marks.png'), PNG.sync.write(markImage));
  console.log('Saved docs/combining-marks.png.');

  const boldReference = process.env.IOSEVKA_BOLD || join(root, 'reference/Iosevka-Bold.ttc');
  if (existsSync(reference) && existsSync(boldReference)) {
    const text = 'Hn minimum 0123456789 0O1lI\nif (value != 0) { return x + 42; }\n{} [] () @ # % & _ = -> != + /';
    const rows = [];
    for (const style of styles) {
      const ref = style.weight === 700 ? boldReference : reference;
      const faceIndex = style.italic ? 4 : 0;
      const settings = weightTargets.styles[style.file];
      const columns = [];
      for (const [label, path, axes] of [
        [`Iosevka ${style.name}`, ref, faceIndex],
        [`Inconsolata Refined ${style.name}`, fontFile(style), 0],
      ]) {
        columns.push([
          await render(fontFile(styles[0]), label, 17, '73d78b'),
          await render(path, '16 px\n' + text, 16, 'cccccc', '', axes),
          await render(path, '24 px\n' + text, 24, 'cccccc', '', axes),
        ]);
      }
      rows.push(columns);
      console.log(`Compared ${style.name} against installed Iosevka weight ${settings.referenceWeight}`);
    }
    const columnWidth = Math.max(...rows.flat(2).map(block => block.width)) + 24;
    const rowHeights = rows.map(columns => Math.max(...columns.map(blocks => blocks.reduce((sum, block) => sum + block.height, 0))) + 28);
    const comparison = canvas(columnWidth * 2 + 48, rowHeights.reduce((a, b) => a + b, 24));
    let top = 12;
    rows.forEach((columns, row) => {
      columns.forEach((blocks, column) => {
        let y = top;
        for (const block of blocks) { paste(comparison, block, 24 + column * columnWidth, y); y += block.height; }
      });
      top += rowHeights[row];
    });
    await writeFile(join(root, 'docs/stroke-comparison.png'), PNG.sync.write(comparison));
    console.log('Saved docs/stroke-comparison.png with all four paired references.');
  } else {
    console.log('Paired stroke preview needs both local Iosevka collections; see reference/weights.json.');
  }
  const outlineParts = ['<svg xmlns="http://www.w3.org/2000/svg" width="2040" height="1220" viewBox="0 0 2040 1220">',
    '<rect width="2040" height="1220" fill="#282c34"/>',
    '<g font-family="sans-serif" fill="#dcdfe4"><text x="24" y="28" font-size="20">Original-source stroke compensation — outlines without hinting</text>',
    '<text x="24" y="52" font-size="14">Same size and advances; resize-only 1.400 (left) and source-aware ' + version + ' (right). Paths at 160 px/em.</text></g>'];
  const characters = ['f', 's', 'S', 'e', 'c', 'g', '8', 'ä', 'Å'];
  for (const [row, style] of styles.entries()) {
    const previous = create(await execute('git', ['show', hintPolicy.baselineRevision + ':fonts/InconsolataRefined-' + style.file + '.ttf']));
    const current = create(await readFile(fontFile(style))), top = 78 + row * 280, baseline = top + 190;
    outlineParts.push('<g font-family="sans-serif" font-size="15" fill="#a6e3a1"><text x="24" y="' + top + '">' + style.name + '</text></g>');
    for (const height of [0, 520, 735]) outlineParts.push('<path d="M24 ' + (baseline - height * .16) + 'H2010" stroke="#3a424f" stroke-width="1"/>');
    for (const [column, character] of characters.entries()) {
      const x = 24 + column * 220;
      outlineParts.push('<g font-family="sans-serif" font-size="12" fill="#8e96a4"><text x="' + x + '" y="' + (top + 24) + '">' + character + ' · 1.400 / ' + version + '</text></g>');
      for (const [index, font] of [previous, current].entries()) {
        const glyph = font.glyphForCodePoint(character.codePointAt(0));
        outlineParts.push('<path fill="#dcdfe4" d="' + glyph.path.toSVG() + '" transform="translate(' + (x + 8 + index * 108) + ' ' + baseline + ') scale(.16 -.16)"/>');
      }
    }
  }
  outlineParts.push('</svg>');
  await writeFile(join(root, 'docs/outline-comparison.svg'), outlineParts.join('\n') + '\n');
  console.log('Saved docs/outline-comparison.svg with unhinted geometry in all four styles.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
