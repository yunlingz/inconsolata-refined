import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import ttf2woff from 'ttf2woff';
import wawoff2 from 'wawoff2';
import { root, family, styles, fontFile, sha256, heartbeat } from './lib.mjs';

const done = heartbeat('Compressing the four hinted TTFs into WOFF and WOFF2');
try {
  const directory = join(root, 'webfonts');
  await mkdir(directory, { recursive: true });
  const build = JSON.parse(await readFile(join(root, 'fonts/build-info.json'), 'utf8'));
  const outputs = [];
  for (const style of styles) {
    const ttf = await readFile(fontFile(style));
    const source = build.outputs.find(output => output.file.endsWith(`-${style.file}.ttf`));
    if (sha256(ttf) !== source.sha256) throw new Error(`${style.name}: TTF differs from its recorded build hash`);
    const formats = [
      ['woff', Buffer.from(ttf2woff(ttf))],
      ['woff2', Buffer.from(await wawoff2.compress(ttf))],
    ];
    for (const [format, bytes] of formats) {
      const file = `InconsolataRefined-${style.file}.${format}`;
      await writeFile(join(directory, file), bytes);
      outputs.push({ file, format, style: style.name, bytes: bytes.length, sha256: sha256(bytes), source: source.file, sourceSha256: source.sha256 });
    }
    console.log(`Built ${style.name}: WOFF ${formats[0][1].length.toLocaleString()} bytes, WOFF2 ${formats[1][1].length.toLocaleString()} bytes`);
  }
  const css = '/* Inconsolata Refined. SIL Open Font License 1.1; see OFL.txt. */\n\n' + styles.map(style => `@font-face {
  font-family: '${family}';
  src: url('./InconsolataRefined-${style.file}.woff2') format('woff2'),
       url('./InconsolataRefined-${style.file}.woff') format('woff');
  font-weight: ${style.weight};
  font-style: ${style.italic ? 'italic' : 'normal'};
  font-display: swap;
}`).join('\n\n') + '\n';
  await writeFile(join(directory, 'inconsolata-refined.css'), css);
  await copyFile(join(root, 'OFL.txt'), join(directory, 'OFL.txt'));
  const packages = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  await writeFile(join(directory, 'build-info.json'), JSON.stringify({
    family, version: build.version, sourceTtfautohint: build.ttfautohint,
    converters: { ttf2woff: packages.devDependencies.ttf2woff, wawoff2: packages.devDependencies.wawoff2 },
    outputs,
  }, null, 2) + '\n');
  console.log('Saved eight web fonts, the family stylesheet, license, and build hashes in webfonts/.');
} finally {
  done();
}
