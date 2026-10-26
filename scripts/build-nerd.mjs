import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { create } from 'fontkit';
import { root, styles, sources, version, fontFile, tool, run, sha256, heartbeat, target } from './lib.mjs';
import { nerdFamily, nerdFile, nerdOptions, extractNerdSources, appendNerdGlyphs } from './nerd.mjs';

const done = heartbeat('Building four complete single-cell Nerd Fonts editions');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-nerd-build-'));
const outputArgument = process.argv.find(a => a.startsWith('--output-dir='));
const destination = outputArgument ? resolve(outputArgument.slice('--output-dir='.length)) : join(root, 'nerd-fonts');
async function copyNotice(input, output) {
  // Keep upstream notice text while using the repository's clean LF format.
  await writeFile(output, (await readFile(input, 'utf8')).replaceAll('\r\n', '\n').replace(/[ \t]+$/gm, ''));
}
try {
  const patcher = join(temporary, 'patcher'), registry = await extractNerdSources(patcher);
  const symbols = Object.entries(registry).filter(([name]) => name !== 'METADATA');
  const outputs = [], build = JSON.parse(await readFile(join(root, 'fonts/build-info.json'), 'utf8'));
  const cell = `0:${target.cellWidth}:${target.typoDescender}:${target.typoAscender}`;
  const options = [...nerdOptions, '--metrics=TYPO', `--cell=${cell}`, '--name=Refined'];
  await mkdir(destination, { recursive: true });
  for (const style of styles) {
    console.log(`Patching ${style.name}: complete Nerd Fonts ${sources.nerdFonts.version}, ${target.cellWidth}-unit icons.`);
    const input = fontFile(style), base = await readFile(input);
    assert.equal(sha256(base), build.outputs.find(o => o.file.endsWith(`-${style.file}.ttf`)).sha256, 'Verified refined input');
    const plain = join(temporary, `input-${style.file}.ttf`), patchedDirectory = join(temporary, style.file);
    // FontForge need not decompile the custom text VM: only its added icons
    // are used. The final font takes original text bytes from input directly.
    await run(tool('python3'), ['-m', 'fontTools.subset', input, '--glyphs=*', '--no-hinting',
      '--glyph-names', '--layout-features=*', '--name-IDs=*', '--name-languages=*', '--notdef-outline',
      '--drop-tables+=TTFA', `--output-file=${plain}`]);
    await run(tool('fontforge'), ['-lang=py', '-script', join(patcher, 'font-patcher'), ...options,
      '--outputdir', patchedDirectory, plain], { timeout: 180_000 });
    const files = (await readdir(patchedDirectory)).filter(f => f.endsWith('.ttf'));
    assert.equal(files.length, 1, 'One patched face');
    const { bytes, addedGlyphs, addedCharacters } = appendNerdGlyphs(base, await readFile(join(patchedDirectory, files[0])), style);
    const font = create(bytes), codes = new Set(font.characterSet);
    for (const [name, glyph] of symbols) assert.ok(codes.has(parseInt(glyph.code, 16)), `Complete coverage: ${name}`);
    const file = nerdFile(style);
    await writeFile(join(temporary, file), bytes);
    await run(tool('ots-sanitize'), [join(temporary, file), join(temporary, `sanitized-${style.file}.ttf`)]);
    await copyFile(join(temporary, file), join(destination, file));
    outputs.push({ file, style: style.name, weight: style.weight, italic: style.italic,
      source: relative(root, input), sourceSha256: sha256(base), sha256: sha256(bytes), bytes: bytes.length,
      glyphs: font.numGlyphs, characters: codes.size, addedGlyphs, addedCharacters,
      originalGlyphsPreserved: create(base).numGlyphs, registeredIconNames: symbols.length });
    console.log(`Built ${style.name}: ${font.numGlyphs.toLocaleString()} glyphs; all ${symbols.length.toLocaleString()} registered icon names covered.`);
  }
  await copyFile(join(root, 'OFL.txt'), join(destination, 'OFL.txt'));
  const licenses = join(destination, 'licenses'); await mkdir(licenses, { recursive: true });
  await copyNotice(join(root, 'upstream/nerd-fonts/LICENSE'), join(licenses, 'NERD-FONTS-LICENSE.md'));
  await copyNotice(join(patcher, 'src/glyphs/README.md'), join(licenses, 'icon-sets.md'));
  for (const entry of await readdir(join(patcher, 'src/glyphs'), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/^(LICENSE|OFL)(\.|$)/.test(entry.name)) continue;
    const path = join(entry.parentPath, entry.name), name = relative(join(patcher, 'src/glyphs'), path).replaceAll(/[\\/]/g, '-');
    await copyNotice(path, join(licenses, name));
  }
  await writeFile(join(destination, 'build-info.json'), JSON.stringify({
    family: nerdFamily, version, nerdFonts: sources.nerdFonts, options,
    iconCellWidth: target.cellWidth, originalText: 'Every original glyph ID, glyf byte, advance, hint program and layout table is preserved.',
    iconHinting: 'Unhinted Nerd Fonts outlines; the original text retains its refined hint programs.',
    outputs,
  }, null, 2) + '\n');
  console.log(`All four Nerd editions built in ${destination}.`);
} finally {
  done(); await rm(temporary, { recursive: true, force: true });
}
