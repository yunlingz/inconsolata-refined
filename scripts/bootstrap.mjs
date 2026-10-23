import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir, availableParallelism } from 'node:os';
import { join } from 'node:path';
import { root, sources, run, tool, toolEnv, sha256, heartbeat } from './lib.mjs';

// An unprivileged, project-local toolchain for Debian/Ubuntu x86-64.
// Other platforms can supply the four tools through PATH or environment variables.
if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error('This bootstrap supports Debian/Ubuntu x86-64. On other platforms install FontForge, ttfautohint 1.8.4, HarfBuzz tools, and OpenType Sanitizer; see README.md.');
}
const done = heartbeat('Preparing the project-local font toolchain');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-refined-toolchain-'));
const cache = join(root, '.tools/downloads');
try {
  await mkdir(cache, { recursive: true });
  const installed = [
    '.tools/root/usr/bin/fontforge', '.tools/root/usr/bin/hb-view',
    '.tools/root/usr/bin/hb-shape', '.tools/root/usr/bin/ots-sanitize',
    '.tools/root/usr/include/freetype2/ft2build.h', '.tools/root/usr/include/harfbuzz/hb.h',
  ].every(path => existsSync(join(root, path)));
  if (!installed) {
    console.log('Downloading FontForge, render/check tools, and compiler headers; no system installation.');
    await run('apt-get', [
      '-o', 'Acquire::http::Timeout=10', '-o', 'Acquire::https::Timeout=10', '-o', 'Acquire::Retries=0',
      'download', 'fontforge-nox', 'fontforge-common', 'libfontforge4', 'libspiro1',
      'libuninameslist1', 'libwoff1', 'libfreetype-dev', 'libharfbuzz-dev',
      'libharfbuzz-bin', 'opentype-sanitizer',
    ], { cwd: temporary });
    for (const file of await readdir(temporary)) {
      if (file.endsWith('.deb')) await run('dpkg-deb', ['-x', join(temporary, file), join(root, '.tools/root')]);
    }
  }
  const { stdout: fontforgeVersion } = await run(tool('fontforge'), ['-version']);
  console.log(fontforgeVersion.trim());
  let currentVersion = '';
  try { currentVersion = (await run(tool('ttfautohint'), ['--version'])).stdout; } catch { /* Build below. */ }
  if (!currentVersion.startsWith(`ttfautohint ${sources.ttfautohint.version}\n`)) {
    const archive = join(cache, `ttfautohint-${sources.ttfautohint.version}.tar.gz`);
    const validArchive = existsSync(archive) && sha256(await readFile(archive)) === sources.ttfautohint.sha256;
    if (!validArchive) {
      console.log(`Downloading upstream ttfautohint ${sources.ttfautohint.version}.`);
      const curlArgs = ['--connect-timeout', '5', '--max-time', '20', '-fsSL', sources.ttfautohint.sourceArchive, '-o', archive];
      try {
        await run('curl', curlArgs);
      } catch (error) {
        // One fallback: reuse the user's shell proxy setup, without printing it.
        const shell = existsSync(join(homedir(), '.zshrc')) ? 'zsh' : 'bash';
        const startup = join(homedir(), shell === 'zsh' ? '.zshrc' : '.bashrc');
        if (!existsSync(startup)) throw error;
        console.log('Direct fetch failed; retrying with the existing shell proxy configuration.');
        await run(shell, ['-c', 'source "$1" >/dev/null 2>&1; shift; curl "$@"', 'font-bootstrap', startup, ...curlArgs]);
      }
    }
    assertArchive(sha256(await readFile(archive)));
    await run('tar', ['-xzf', archive, '-C', temporary]);
    const build = join(temporary, 'build');
    await mkdir(build);
    const options = { cwd: build, env: {
      ...toolEnv,
      FREETYPE_CFLAGS: `-I${join(root, '.tools/root/usr/include/freetype2')}`,
      FREETYPE_LIBS: '-l:libfreetype.so.6',
      HARFBUZZ_CFLAGS: `-I${join(root, '.tools/root/usr/include/harfbuzz')}`,
      HARFBUZZ_LIBS: '-l:libharfbuzz.so.0',
    } };
    console.log('Configuring ttfautohint.');
    await run(join(temporary, `ttfautohint-${sources.ttfautohint.version}/configure`), [
      '--without-qt', '--without-doc', '--disable-shared', `--prefix=${join(root, '.tools')}`,
    ], options);
    console.log('Compiling ttfautohint.');
    await run('make', [`-j${Math.min(3, availableParallelism())}`], options);
    await run('make', ['install'], options);
  }
  const { stdout: version } = await run(tool('ttfautohint'), ['--version']);
  if (!version.startsWith(`ttfautohint ${sources.ttfautohint.version}\n`)) throw new Error('ttfautohint version verification failed');
  await writeFile(join(root, '.tools/toolchain.json'), JSON.stringify({ ttfautohint: version.trim(), fontforge: fontforgeVersion.trim() }, null, 2) + '\n');
  console.log(`Ready: ttfautohint ${sources.ttfautohint.version}, FontForge, HarfBuzz, and OpenType Sanitizer.\nRun npm run build, npm test, and npm run preview.`);
} finally {
  done();
  await rm(temporary, { recursive: true, force: true });
}

function assertArchive(actual) {
  if (actual !== sources.ttfautohint.sha256) throw new Error('ttfautohint source archive checksum mismatch');
}
