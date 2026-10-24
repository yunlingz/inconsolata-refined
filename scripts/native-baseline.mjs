import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { weightTargets, sourceBytes, tool, run, normalizeMetadata } from './lib.mjs';
import { refineInstance, cleanOutlines } from './transform.mjs';
import { addTerminalSymbols } from './symbols.mjs';

// A neutral geometry reference: the same original design axes, final size,
// spacing and symbols, before stroke compensation and without text hinting.
export async function nativeBaseline(style, directory) {
  const prefix = join(directory, 'resize-baseline-' + style.file);
  const variable = prefix + '-variable.ttf', instance = prefix + '-instance.ttf';
  await writeFile(variable, await sourceBytes('Variable'));
  const settings = weightTargets.styles[style.file];
  await run(tool('python3'), ['-m', 'fontTools.varLib.instancer', '-q', variable,
    `wght=${settings.axes.wght}`, `wdth=${settings.axes.wdth}`, '-o', instance]);
  const raw = prefix + '-raw.ttf', clean = prefix + '-clean.ttf', output = prefix + '.ttf';
  await refineInstance(instance, raw, style, settings);
  await cleanOutlines(raw, clean, instance);
  await addTerminalSymbols(clean, output, style);
  await normalizeMetadata(output);
  return readFile(output);
}
