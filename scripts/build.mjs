import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  root, styles, sources, target, version, weightTargets, hintOptions, fontFile, tool, run,
  heartbeat, sourceBytes, sha256, normalizeMetadata,
} from './lib.mjs';
import { refineInstance, cleanOutlines } from './transform.mjs';
import { addDigitAnchors } from './marks.mjs';

const done = heartbeat('Building Inconsolata Refined');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-build-'));
try {
  const { stdout } = await run(tool('ttfautohint'), ['--version']);
  const hintVersion = stdout.match(/^ttfautohint ([\d.]+)/m)?.[1];
  if (hintVersion !== sources.ttfautohint.version) {
    throw new Error(`Expected ttfautohint ${sources.ttfautohint.version}; found ${hintVersion ?? 'unknown'}. Set TTFAUTOHINT to the correct executable.`);
  }
  const { stdout: fonttoolsVersion } = await run(tool('python3'), ['-m', 'fontTools.ttx', '--version']);
  await mkdir(join(root, 'fonts'), { recursive: true });
  const variable = join(temporary, 'Inconsolata-Variable.ttf');
  await writeFile(variable, await sourceBytes('Variable'));
  const outputs = [];
  const instances = [];
  for (const style of styles) {
    const settings = weightTargets.styles[style.file];
    const instance = join(temporary, `Inconsolata-${style.file}-instance.ttf`);
    await run(tool('python3'), ['-m', 'fontTools.varLib.instancer', '-q', variable,
      `wght=${settings.axes.wght}`, `wdth=${settings.axes.wdth}`, '-o', instance]);
    const unhinted = join(temporary, `InconsolataRefined-${style.file}-unhinted.ttf`);
    const transformed = await refineInstance(instance, unhinted, style, settings);
    const clean = join(temporary, `InconsolataRefined-${style.file}-clean.ttf`);
    const outlineCleanup = await cleanOutlines(unhinted, clean, instance);
    const anchored = join(temporary, `InconsolataRefined-${style.file}-anchored.ttf`);
    const digitAnchors = await addDigitAnchors(clean, anchored, style);
    const hinted = join(temporary, `InconsolataRefined-${style.file}.ttf`);
    await run(tool('ttfautohint'), [...hintOptions, anchored, hinted]);
    await normalizeMetadata(hinted);
    const bytes = await readFile(hinted);
    await writeFile(fontFile(style), bytes);
    outputs.push({ file: `fonts/InconsolataRefined-${style.file}.ttf`, sha256: sha256(bytes), bytes: bytes.length });
    instances.push({ style: style.name, axes: settings.axes, xHeight: settings.xHeight,
      capHeight: settings.capHeight,
      outlineOffsetX: settings.outlineOffsetX, ...transformed, outlineCleanup, digitAnchors });
    console.log(`Built ${style.name}: ${bytes.length.toLocaleString()} bytes`);
  }
  await writeFile(join(root, 'fonts/build-info.json'), JSON.stringify({
    family: 'Inconsolata Refined', version, releaseDate: '2026-10-24',
    inconsolataRevision: sources.inconsolata.revision,
    ttfautohint: hintVersion, fonttools: fonttoolsVersion.trim(), hintOptions,
    targetMetrics: target, instances, outputs,
  }, null, 2) + '\n');
  console.log('Build completed. Run npm test to validate all four faces.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
