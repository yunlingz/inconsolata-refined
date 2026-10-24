// Serialized into an isolated Windows Chromium page by check-raster.mjs.
// Keep this function self-contained; it has no Node or project globals.
export async function rasterPage(data) {
  const sizes = Array.from({ length: 23 }, (_, i) => i + 10), phases = [0, .25, .5, .75];
  for (const [name, file] of Object.entries(data.fonts)) {
    const face = new FontFace(name, `url("${file}")`, { featureSettings: '"calt" 0,"liga" 0,"dlig" 0' });
    await face.load(); document.fonts.add(face);
  }
  const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 144;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.textBaseline = 'alphabetic'; ctx.fontKerning = 'none';
  const bg = [40, 44, 52], fg = [220, 223, 228];
  const linear = Array.from({ length: 256 }, (_, v) => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4);
  const luminance = rgb => rgb.reduce((sum, v, c) => sum + linear[v] * [.2126, .7152, .0722][c], 0);
  const bgY = luminance(bg), rangeY = luminance(fg) - bgY;
  function counters(pixels, stride, box) {
    if (!box) return 0;
    const [left, top, right, bottom] = box, width = right - left + 3, height = bottom - top + 3;
    const occupied = new Uint8Array(width * height), queue = new Int32Array(width * height);
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      if (pixels[(y * stride + x) * 4] >= 130) occupied[(y - top + 1) * width + x - left + 1] = 1;
    }
    const flood = start => {
      let read = 0, write = 1; queue[0] = start; occupied[start] = 1;
      while (read < write) {
        const p = queue[read++], x = p % width, y = Math.floor(p / width);
        if (x > 0 && !occupied[p - 1]) { occupied[p - 1] = 1; queue[write++] = p - 1; }
        if (x < width - 1 && !occupied[p + 1]) { occupied[p + 1] = 1; queue[write++] = p + 1; }
        if (y > 0 && !occupied[p - width]) { occupied[p - width] = 1; queue[write++] = p - width; }
        if (y < height - 1 && !occupied[p + width]) { occupied[p + width] = 1; queue[write++] = p + width; }
      }
    };
    flood(0);
    let count = 0;
    for (let i = 0; i < occupied.length; i++) if (!occupied[i]) { flood(i); count++; }
    return count;
  }
  function pixels(context, width, height, topology = false) {
    const rgba = context.getImageData(0, 0, width, height).data;
    let signal = 0, square = 0, light = 0, active = 0, faint = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let p = 0; p < width * height; p++) {
      const i = p * 4, red = rgba[i];
      if (red === 40 && rgba[i + 1] === 44 && rgba[i + 2] === 52) continue;
      const a = Math.max(0, Math.min(1, (red - 40) / 180));
      signal += a; square += a * a;
      light += (linear[red] * .2126 + linear[rgba[i + 1]] * .7152 + linear[rgba[i + 2]] * .0722 - bgY) / rangeY;
      if (a > .01) {
        active++; if (a < .5) faint++;
        const x = p % width, y = Math.floor(p / width);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const box = active ? [minX, minY, maxX, maxY] : null;
    return { signal, light, concentration: signal ? square / signal : null, faint: active ? faint / active : null,
      box, clipped: !!box && (minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1),
      ...(topology ? { counters: counters(rgba, width, box) } : {}),
      words: new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.byteLength / 4) };
  }
  function glyph(family, g, size, phase) {
    const origin = 18 - Math.floor(Math.min(g.bounds?.[0] ?? 0, 0) * size / 1000);
    const baseline = 18 + Math.ceil(965 * size / 1000);
    const width = Math.ceil((Math.max(g.bounds?.[2] ?? 0, g.advance) - Math.min(g.bounds?.[0] ?? 0, 0)) * size / 1000) + 38;
    const height = Math.ceil(size * 1.25) + 38;
    ctx.fillStyle = '#282c34'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#dcdfe4'; ctx.font = `${size}px "${family}"`;
    ctx.fillText(String.fromCodePoint(0xf0000 + g.id), origin + phase, baseline);
    const result = pixels(ctx, width, height, true);
    const b = result.box;
    result.bounds = b ? [b[0] - origin - phase, baseline - b[3] - 1, b[2] + 1 - origin - phase, baseline - b[1]] : null;
    return result;
  }
  const glyphs = [], vanished = [], clipped = [], counterRegressions = [], unexpectedChanges = [], boundErrors = [];
  const totals = sizes.map(size => ({ size, rasterizations: 0, changed: 0, beforeLight: 0, afterLight: 0 }));
  for (const g of data.glyphs) {
    let changed = 0, checked = 0;
    const changedSizes = new Set();
    let minLightRatio = Infinity, maxLightRatio = 0;
    for (const size of sizes) for (const phase of phases) {
      const before = glyph('beforeProbe', g, size, phase), after = glyph('afterProbe', g, size, phase);
      const different = before.words.some((value, i) => value !== after.words[i]);
      checked++;
      const total = totals[size - 10]; total.rasterizations++; total.beforeLight += before.light; total.afterLight += after.light;
      if (different) { changed++; changedSizes.add(size); total.changed++; }
      const active = data.ranges.some(([low, high]) => size >= low && size <= high);
      if (different && !g.terminal && !(g.eligible && active)) unexpectedChanges.push({ name: g.name, size, phase });
      if (before.signal > .1 && after.signal <= .1) vanished.push({ name: g.name, size, phase });
      if (!g.bounds && after.signal > .1) vanished.push({ name: g.name, size, phase, issue: 'expected empty glyph rendered ink' });
      if (after.clipped) clipped.push({ name: g.name, size, phase });
      // Small raster islands can be accidental holes in letters such as h/U.
      // Flag a loss only if it also drops below the outline's true counter count.
      if (!g.terminal && after.counters < before.counters && before.counters >= g.counters && after.counters < g.counters) {
        counterRegressions.push({ name: g.name, size, phase, expected: g.counters, before: before.counters, after: after.counters });
      }
      if (after.bounds && (g.terminal || size === 32)) {
        const differences = after.bounds.map((v, i) => Math.abs(v - g.bounds[i] * size / 1000));
        if (Math.max(...differences) > (g.terminal ? 1.51 : 4)) boundErrors.push({ name: g.name, size, phase,
          rendered: after.bounds, expected: g.bounds.map(v => v * size / 1000) });
      }
      if (before.light > .01) { const ratio = after.light / before.light; minLightRatio = Math.min(minLightRatio, ratio); maxLightRatio = Math.max(maxLightRatio, ratio); }
    }
    glyphs.push({ id: g.id, name: g.name, sourceId: g.sourceId, codePoints: g.codePoints,
      rasterizations: checked, changed, changedSizes: [...changedSizes], terminal: g.terminal, eligible: g.eligible,
      lightRatioRange: Number.isFinite(minLightRatio) ? [minLightRatio, maxLightRatio] : null });
  }
  const sheet = document.createElement('canvas'); sheet.width = 1280; sheet.height = Math.ceil(data.glyphs.length / 16) * 52;
  const sc = sheet.getContext('2d'); sc.fillStyle = '#282c34'; sc.fillRect(0, 0, sheet.width, sheet.height);
  for (const [index, g] of data.glyphs.entries()) {
    const x = index % 16 * 80, y = Math.floor(index / 16) * 52;
    sc.fillStyle = '#dcdfe4'; sc.font = '24px "afterProbe"';
    sc.fillText(String.fromCodePoint(0xf0000 + g.id), x + 8 - Math.min(g.bounds?.[0] ?? 0, 0) * 24 / 1000, y + 28);
    sc.fillStyle = '#8e96a4'; sc.font = '8px monospace';
    sc.fillText(g.sourceId + ' ' + (g.codePoints.length ? 'U+' + g.codePoints[0].toString(16).toUpperCase() : 'alt'), x + 2, y + 46);
  }
  const sample = 'Hn minimum 0123456789 | Completed v1.200, rebuilt from original Inconsolata.';
  const textCanvas = document.createElement('canvas'); textCanvas.width = 1600; textCanvas.height = 80;
  const tc = textCanvas.getContext('2d', { willReadFrequently: true }); tc.fontKerning = 'none';
  const text = [];
  for (const size of sizes) for (const phase of phases) {
    const measures = {};
    for (const name of ['before', 'after', 'reference']) {
      tc.fillStyle = '#282c34'; tc.fillRect(0, 0, 1600, 80);
      tc.fillStyle = '#dcdfe4'; tc.font = `${size}px "${name}"`;
      tc.fillText(sample, 8 + phase, Math.ceil(size * 1.1) + 4);
      const width = Math.ceil(tc.measureText(sample).width) + 16;
      const result = pixels(tc, width, 64); delete result.words;
      measures[name] = result;
      if (Math.abs(tc.measureText('000000000000').width - size * 6) > .001) throw new Error(name + ' cell-width mismatch');
    }
    text.push({ size, phase, ...measures });
  }
  const comparison = document.createElement('canvas'); comparison.width = 1920; comparison.height = 540;
  const cc = comparison.getContext('2d'); cc.fillStyle = '#282c34'; cc.fillRect(0, 0, 1920, 540);
  const columns = [['reference', 'Iosevka 33.3.5'], ['before', 'Refined 1.200'], ['after', 'Refined ' + data.version]];
  for (const [col, [family, title]] of columns.entries()) {
    const x = col * 640 + 16;
    cc.fillStyle = '#a6e3a1'; cc.font = '18px sans-serif'; cc.fillText(data.style + ' — ' + title, x, 25);
    let y = 58;
    for (const size of [14, 18, 24, 32]) {
      cc.fillStyle = '#8e96a4'; cc.font = '12px sans-serif'; cc.fillText(size + ' px', x, y);
      cc.fillStyle = '#dcdfe4'; cc.font = `${size}px "${family}"`;
      cc.fillText('Hn minimum 0123456789 0O1lI', x, y + size * 1.1);
      cc.fillText('if (value != 0) { return x + 42; }', x, y + size * 2.4);
      y += size * 2.6 + 18;
    }
    cc.font = `24px "${family}"`; cc.fillText('┌────┬────┐  ▁▂▃▄▅▆▇█', x, 458);
    cc.fillText('│    │    │  ████████', x, 488); cc.fillText('└────┴────┘  ████████', x, 518);
  }
  return { userAgent: navigator.userAgent, platform: navigator.platform, sizes, phases, sample, glyphs, totals, text,
    vanished, clipped, counterRegressions, unexpectedChanges, boundErrors,
    coveragePng: sheet.toDataURL('image/png'), comparisonPng: comparison.toDataURL('image/png') };
}
