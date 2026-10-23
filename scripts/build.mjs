import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create } from 'fontkit';
import {
  root, styles, sources, target, hintOptions, fontFile, tool, run,
  heartbeat, sourceBytes, sha256, normalizeMetadata,
} from './lib.mjs';

const done = heartbeat('Building Inconsolata Refined');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-build-'));
try {
  const { stdout } = await run(tool('ttfautohint'), ['--version']);
  const version = stdout.match(/^ttfautohint ([\d.]+)/m)?.[1];
  if (version !== sources.ttfautohint.version) {
    throw new Error(`Expected ttfautohint ${sources.ttfautohint.version}; found ${version ?? 'unknown'}. Set TTFAUTOHINT to the correct executable.`);
  }
  await mkdir(join(root, 'fonts'), { recursive: true });
  const original = new Map();
  for (const weight of ['Regular', 'Bold']) {
    const bytes = await sourceBytes(weight);
    const file = join(temporary, `Inconsolata-${weight}.ttf`);
    await writeFile(file, bytes);
    original.set(weight, { file, font: create(bytes) });
  }
  const regular = original.get('Regular').font;
  const outlinePercent = (target.xHeight / target.unitsPerEm) / (regular.xHeight / regular.unitsPerEm) * 100;
  const outputs = [];
  for (const style of styles) {
    const unhinted = join(temporary, `InconsolataRefined-${style.file}-unhinted.ttf`);
    await run(tool('fontforge'), [
      '-lang=ff', '-script', join(root, 'scripts/refine.pe'),
      original.get(style.source).file, unhinted, style.file, style.name,
      style.weight === 700 ? 'Bold' : 'Regular', style.italic ? '1' : '0',
      String(outlinePercent), String(target.unitsPerEm), String(target.cellWidth),
      String(target.ascender), String(target.descender),
    ]);
    const hinted = join(temporary, `InconsolataRefined-${style.file}.ttf`);
    await run(tool('ttfautohint'), [...hintOptions, unhinted, hinted]);
    await normalizeMetadata(hinted);
    const bytes = await readFile(hinted);
    await writeFile(fontFile(style), bytes);
    outputs.push({ file: `fonts/InconsolataRefined-${style.file}.ttf`, sha256: sha256(bytes), bytes: bytes.length });
    console.log(`Built ${style.name}: ${bytes.length.toLocaleString()} bytes`);
  }
  await writeFile(join(root, 'fonts/build-info.json'), JSON.stringify({
    family: 'Inconsolata Refined', version: '1.000', releaseDate: '2026-10-24',
    inconsolataRevision: sources.inconsolata.revision,
    ttfautohint: version, hintOptions, outlineScale: outlinePercent / 100,
    targetMetrics: target, outputs,
  }, null, 2) + '\n');
  console.log('Build completed. Run npm test to validate all four faces.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
