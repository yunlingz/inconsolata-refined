import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  root, styles, sources, target, version, weightTargets, hintOptions, fontFile, tool, run,
  heartbeat, sourceBytes, sha256, normalizeMetadata,
} from './lib.mjs';
import { refineInstance, cleanOutlines } from './transform.mjs';
import { addDigitAnchors } from './marks.mjs';
import { refineHints } from './hinting.mjs';
import { addTerminalSymbols } from './symbols.mjs';
import { balanceOutlines } from './outline-balance.mjs';

const done = heartbeat('Building Inconsolata Refined');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-build-'));
const inputsArgument = process.argv.find(arg => arg.startsWith('--hint-inputs='));
const inputsDirectory = inputsArgument ? resolve(inputsArgument.slice('--hint-inputs='.length)) : null;
const destination = inputsDirectory ?? join(root, 'fonts');
try {
  const { stdout } = await run(tool('ttfautohint'), ['--version']);
  const hintVersion = stdout.match(/^ttfautohint ([\d.]+)/m)?.[1];
  if (hintVersion !== sources.ttfautohint.version) {
    throw new Error(`Expected ttfautohint ${sources.ttfautohint.version}; found ${hintVersion ?? 'unknown'}. Set TTFAUTOHINT to the correct executable.`);
  }
  const { stdout: fonttoolsVersion } = await run(tool('python3'), ['-m', 'fontTools.ttx', '--version']);
  await mkdir(destination, { recursive: true });
  const variable = join(temporary, 'Inconsolata-Variable.ttf');
  await writeFile(variable, await sourceBytes('Variable'));
  const outputs = [];
  const instances = [], outlineReviews = [];
  for (const style of styles) {
    const settings = weightTargets.styles[style.file];
    const instance = join(temporary, `Inconsolata-${style.file}-instance.ttf`);
    await run(tool('python3'), ['-m', 'fontTools.varLib.instancer', '-q', variable,
      `wght=${settings.axes.wght}`, `wdth=${settings.axes.wdth}`, '-o', instance]);
    const unhinted = join(temporary, `InconsolataRefined-${style.file}-unhinted.ttf`);
    const transformed = await refineInstance(instance, unhinted, style, settings);
    const balanced = join(temporary, `InconsolataRefined-${style.file}-balanced.ttf`);
    const outlineBalance = await balanceOutlines(unhinted, balanced, instance, style, settings);
    const clean = join(temporary, `InconsolataRefined-${style.file}-clean.ttf`);
    const outlineCleanup = await cleanOutlines(balanced, clean, instance);
    const anchored = join(temporary, `InconsolataRefined-${style.file}-anchored.ttf`);
    const digitAnchors = await addDigitAnchors(clean, anchored, style);
    const hinted = join(temporary, `InconsolataRefined-${style.file}.ttf`);
    await run(tool('ttfautohint'), [...hintOptions, anchored, hinted]);
    const tuned = join(temporary, `InconsolataRefined-${style.file}-tuned.ttf`);
    const hintRefinement = await refineHints(hinted, tuned, style, { baseOnly: !!inputsDirectory });
    const complete = join(temporary, `InconsolataRefined-${style.file}-complete.ttf`);
    const terminalSymbols = await addTerminalSymbols(tuned, complete, style);
    await normalizeMetadata(complete);
    const bytes = await readFile(complete);
    await writeFile(join(destination, `InconsolataRefined-${style.file}.ttf`), bytes);
    outputs.push({ file: `fonts/InconsolataRefined-${style.file}.ttf`, sha256: sha256(bytes), bytes: bytes.length });
    const { glyphs: outlineGlyphs, ...outlineSummary } = outlineBalance;
    outlineReviews.push({ style: style.name, sha256: sha256(bytes), ...outlineBalance });
    instances.push({ style: style.name, axes: settings.axes, xHeight: settings.xHeight,
      capHeight: settings.capHeight,
      outlineOffsetX: settings.outlineOffsetX, ...transformed, outlineBalance: outlineSummary,
      outlineCleanup, digitAnchors, hintRefinement, terminalSymbols });
    console.log(`Built ${style.name}: ${bytes.length.toLocaleString()} bytes`);
  }
  await writeFile(join(destination, 'build-info.json'), JSON.stringify({
    family: 'Inconsolata Refined', version, releaseDate: '2026-10-24',
    inconsolataRevision: sources.inconsolata.revision,
    ttfautohint: hintVersion, fonttools: fonttoolsVersion.trim(), hintOptions,
    targetMetrics: target, instances, outputs,
  }, null, 2) + '\n');
  await writeFile(join(inputsDirectory ?? join(root, 'docs'), 'outline-review.json'), JSON.stringify({
    fontVersion: version, source: 'Original Inconsolata design instances before the shared resize; not previous refined binaries.',
    method: outlineReviews[0].method, results: outlineReviews,
  }, null, 2) + '\n');
  console.log(inputsDirectory ? 'Original-source hint calibration inputs prepared.' : 'Build completed. Run npm test to validate all four faces.');
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}
