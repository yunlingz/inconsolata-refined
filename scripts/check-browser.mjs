import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { root, version, target, heartbeat, sha256 } from './lib.mjs';

const done = heartbeat('Checking WOFF2/WOFF loading, native spacing, website demo, and complete glyph viewer in Chromium');
const temporary = await mkdtemp(join(tmpdir(), 'inconsolata-browser-check-'));
let child, socket, server, blockWoff2 = false;
const loaded = [], pending = new Map(), events = new Map(), errors = [];
let sequence = 0;
const types = { '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
function call(method, params = {}, sessionId) {
  return new Promise((resolvePromise, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15_000);
    pending.set(id, { resolve: resolvePromise, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
function event(method, session) {
  return new Promise((resolvePromise, reject) => {
    const key = `${session}/${method}`;
    const timer = setTimeout(() => { events.delete(key); reject(new Error(`Browser event timeout: ${method}`)); }, 20_000);
    events.set(key, value => { clearTimeout(timer); resolvePromise(value); });
  });
}
async function evaluate(session, expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function navigate(session, url) {
  const ready = event('Page.loadEventFired', session);
  await call('Page.navigate', { url }, session); await ready;
}
async function screenshot(session, file, full = false) {
  const layout = full ? await call('Page.getLayoutMetrics', {}, session) : null;
  const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full,
    ...(full ? { clip: { x: 0, y: 0, width: layout.cssContentSize.width, height: layout.cssContentSize.height, scale: 1 } } : {}) }, session);
  await writeFile(join(root, 'docs', file), Buffer.from(result.data, 'base64'));
}
try {
  let executable = process.env.CHROMIUM;
  if (!executable) {
    const cache = join(homedir(), '.cache/ms-playwright');
    for (const name of existsSync(cache) ? (await readdir(cache)).toSorted().reverse() : []) {
      const candidate = join(cache, name, 'chrome-linux64/chrome');
      if (name.startsWith('chromium-') && existsSync(candidate)) { executable = candidate; break; }
    }
  }
  if (!executable) throw new Error('Set CHROMIUM to a Chromium or Chrome executable');
  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname}`);
    if (!path.startsWith(`${root}/`) || pathname.split('/').some(part => part.startsWith('.'))) { response.writeHead(403).end(); return; }
    if (blockWoff2 && path.endsWith('.woff2')) { response.writeHead(404).end(); return; }
    try {
      const bytes = await readFile(path);
      response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(bytes);
      if (/\.woff2?$/.test(path)) loaded.push(path.split('/').at(-1));
    } catch { response.writeHead(404).end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = `http://127.0.0.1:${server.address().port}`;
  child = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${join(temporary, 'profile')}`], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolvePromise, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error('Chromium startup timeout')), 15_000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stderr.on('data', data => {
      text += data;
      const found = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) { clearTimeout(timer); resolvePromise(found[1]); }
    });
  });
  socket = new WebSocket(endpoint); await once(socket, 'open');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id); clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error))); else waiter.resolve(message.result);
    } else {
      const key = `${message.sessionId}/${message.method}`, waiter = events.get(key);
      if (waiter) { events.delete(key); waiter(message.params); }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (message.method === 'Log.entryAdded' && /decode|OTS parsing/i.test(message.params.entry.text)) errors.push(message.params.entry.text);
    }
  });
  const browser = (await call('Browser.getVersion')).product;
  const results = [];
  for (const format of ['woff2', 'woff']) {
    blockWoff2 = format === 'woff'; loaded.length = 0;
    const { browserContextId } = await call('Target.createBrowserContext');
    const { targetId } = await call('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']) await call(method, {}, sessionId);
    await call('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
    await navigate(sessionId, `${address}/webfonts/example.html`);
    const data = await evaluate(sessionId, `(async () => {
      const variants = [['normal',400],['italic',400],['normal',700],['italic',700]];
      for (const [style,weight] of variants) await document.fonts.load(style+' '+weight+' 20px "Inconsolata Refined"','Hn0');
      await document.fonts.ready;
      const canvas = document.createElement('canvas').getContext('2d');
      const metrics = variants.map(([style,weight]) => {
        canvas.font = style+' '+weight+' 20px "Inconsolata Refined"';
        const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;white-space:pre;font:'+style+' '+weight+' 20px/normal "Inconsolata Refined"';
        probe.textContent = 'HH\\nHH\\nHH'; document.body.append(probe); const height = probe.getBoundingClientRect().height; probe.remove();
        return { twelveCells:canvas.measureText('000000000000').width, word:canvas.measureText('H n').width, threeLines:height };
      });
      const faces = [...document.fonts].map(f=>({family:f.family.replaceAll("'",''),weight:f.weight,style:f.style,status:f.status}));
      const semanticStyles = [...document.querySelectorAll('#inline-example > em, #inline-example > strong')].map(e=>({weight:getComputedStyle(e).fontWeight,style:getComputedStyle(e).fontStyle}));
      const slider = document.getElementById('sample-size'); slider.value=28; slider.dispatchEvent(new Event('input',{bubbles:true}));
      const sliderWorks = getComputedStyle(document.querySelector('.specimen')).fontSize === '28px' && document.getElementById('size-output').value === '28 px';
      slider.value=20; slider.dispatchEvent(new Event('input',{bubbles:true})); return {faces,metrics,semanticStyles,sliderWorks};
    })()`);
    assert.equal(data.faces.length, 4); assert.ok(data.faces.every(f => f.status === 'loaded'));
    const cell = target.cellWidth / target.unitsPerEm * 20;
    const lines = (target.ascender - target.descender + target.lineGap) / target.unitsPerEm * 20 * 3;
    assert.ok(data.metrics.every(m => Math.abs(m.twelveCells - cell * 12) < .01 && Math.abs(m.word - cell * 3) < .01
      && Math.abs(m.threeLines - lines) < .01), JSON.stringify(data.metrics));
    assert.ok(data.sliderWorks);
    assert.deepEqual(data.semanticStyles, [{ weight: '400', style: 'italic' }, { weight: '700', style: 'normal' }, { weight: '700', style: 'normal' }]);
    const fontRequests = [...new Set(loaded)].sort();
    assert.equal(fontRequests.length, 4); assert.ok(fontRequests.every(file => file.endsWith(`.${format}`)));
    if (format === 'woff2') await screenshot(sessionId, 'web-example.png', true);
    await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId);
    const mobileFits = await evaluate(sessionId, 'document.documentElement.scrollWidth <= innerWidth'); assert.ok(mobileFits);
    if (format === 'woff2') await screenshot(sessionId, 'web-example-mobile.png', true);
    results.push({ format, loadedFonts: fontRequests, ...data, mobileLayout: 'pass', browserErrors: [...errors] });
    console.log(`BROWSER ${format.toUpperCase()}: all four faces; ${target.cellWidth / target.unitsPerEm} em cells, ${(target.ascender - target.descender + target.lineGap) / target.unitsPerEm} em natural lines, emphasis, slider, mobile layout`);
    if (format === 'woff2') {
      await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
      await navigate(sessionId, `${address}/docs/glyph-audit.html`);
      const audit = await evaluate(sessionId, `(async()=>{
        for(let i=0;i<100 && !document.getElementById('status').dataset.glyphs;i++) await new Promise(r=>setTimeout(r,50));
        const status=document.getElementById('status'),page=document.getElementById('page');
        const counts={glyphs:Number(status.dataset.glyphs),styles:Number(status.dataset.styles),pages:page.options.length};
        page.value=page.options.length-1;page.dispatchEvent(new Event('change'));
        counts.lastSourceId=Number(document.querySelector('#glyphs tr:last-child').dataset.sourceId);return counts;
      })()`);
      assert.deepEqual(audit, { glyphs: 964, styles: 4, pages: 16, lastSourceId: 963 });
      results.at(-1).glyphViewer = audit;
      const unencoded = await evaluate(sessionId, `(()=>{
        const filter=document.getElementById('unencoded');filter.checked=true;filter.dispatchEvent(new Event('change'));
        return {pages:document.getElementById('page').options.length,visible:document.querySelectorAll('#glyphs tr').length};
      })()`);
      assert.ok(unencoded.pages >= 1 && unencoded.visible > 0);
      for (let page = 0; page < unencoded.pages; page++) {
        await evaluate(sessionId, `(()=>{const page=document.getElementById('page');page.value=${page};page.dispatchEvent(new Event('change'));return true;})()`);
        await screenshot(sessionId, `unencoded-${page + 1}.png`, true);
      }
      results.at(-1).glyphViewer.unencodedPages = unencoded.pages;
      await navigate(sessionId, `${address}/docs/outline-comparison.svg`);
      await screenshot(sessionId, 'outline-comparison.png', true);
    }
    await call('Target.disposeBrowserContext', { browserContextId });
  }
  assert.deepEqual(errors, []);
  const web = JSON.parse(await readFile(join(root, 'webfonts/build-info.json'), 'utf8'));
  const glyphAudit = await readFile(join(root, 'docs/glyph-audit.json'));
  await writeFile(join(root, 'docs/web-browser-validation.json'), JSON.stringify({ browser, fontVersion: version,
    viewport: '1280x1000 and 375x900', fontHashes: web.outputs.map(({ file, sha256 }) => ({ file, sha256 })),
    glyphAuditSha256: sha256(glyphAudit), results }, null, 2) + '\n');
  console.log('Saved the current browser report and desktop/mobile website screenshots.');
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await call('Browser.close').catch(() => {}); socket.close(); }
  for (const waiter of pending.values()) clearTimeout(waiter.timer);
  if (child && child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, 'exit'); }
  if (server) await new Promise(resolvePromise => server.close(resolvePromise));
  await rm(temporary, { recursive: true, force: true }); done();
}
