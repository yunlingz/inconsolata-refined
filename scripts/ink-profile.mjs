// Serialized into the native browser. All geometry and measurements are local
// to a glyph; this deliberately contains no character names or font globals.
export function inkTools() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.fontKerning = 'none';
  const large = document.createElement('canvas'); large.width = 1024; large.height = 1024;
  const lc = large.getContext('2d', { willReadFrequently: true });
  const thresholds = [.35, .5, .65];
  let previousRender;

  function topology(rgba, stride, box, background, range, details = false) {
    if (!box) return thresholds.map(() => ({ counters: 0, parts: 0 }));
    const [left, top, right, bottom] = box, w = right - left + 3, h = bottom - top + 3;
    return thresholds.map(threshold => {
      const ink = new Uint8Array(w * h), visited = new Uint8Array(w * h), queue = new Int32Array(w * h);
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
        if ((rgba[(y * stride + x) * 4] - background) / range >= threshold) ink[(y - top + 1) * w + x - left + 1] = 1;
      }
      let distances;
      if (details && threshold === .5) {
        distances = Float64Array.from(ink, value => value ? 0 : 1e6);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const p = y * w + x;
          if (x) distances[p] = Math.min(distances[p], distances[p - 1] + 1);
          if (y) distances[p] = Math.min(distances[p], distances[p - w] + 1);
          if (x && y) distances[p] = Math.min(distances[p], distances[p - w - 1] + Math.SQRT2);
          if (x + 1 < w && y) distances[p] = Math.min(distances[p], distances[p - w + 1] + Math.SQRT2);
        }
        for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
          const p = y * w + x;
          if (x + 1 < w) distances[p] = Math.min(distances[p], distances[p + 1] + 1);
          if (y + 1 < h) distances[p] = Math.min(distances[p], distances[p + w] + 1);
          if (x + 1 < w && y + 1 < h) distances[p] = Math.min(distances[p], distances[p + w + 1] + Math.SQRT2);
          if (x && y + 1 < h) distances[p] = Math.min(distances[p], distances[p + w - 1] + Math.SQRT2);
        }
      }
      function flood(start, value) {
        let read = 0, write = 1; queue[0] = start; visited[start] = 1;
        let minX = w, minY = h, maxX = -1, maxY = -1, radius = 0;
        while (read < write) {
          const p = queue[read++], x = p % w, y = Math.floor(p / w);
          if (distances) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); radius = Math.max(radius, distances[p] - .5); }
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            // Four-connected background / eight-connected ink are duals.
            if ((!dx && !dy) || (!value && dx && dy) || x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) continue;
            const q = p + dy * w + dx;
            if (!visited[q] && ink[q] === value) { visited[q] = 1; queue[write++] = q; }
          }
        }
        return distances ? { area: write, bounds: [minX, minY, maxX, maxY], diameter: value ? null : radius * 2 } : null;
      }
      flood(0, 0);
      let counters = 0, parts = 0;
      const counterFeatures = [], partFeatures = [];
      for (let i = 0; i < ink.length; i++) if (!visited[i]) {
        if (ink[i]) parts++; else counters++;
        const feature = flood(i, ink[i]);
        if (feature) (ink[i] ? partFeatures : counterFeatures).push(feature);
      }
      return { counters, parts, ...(distances ? { counterFeatures, partFeatures } : {}) };
    });
  }

  function measure(context, width, height, background = 40, range = 180, withTopology = true, suppliedRgba, withProfile = true, details = false) {
    const rgba = suppliedRgba ?? context.getImageData(0, 0, width, height).data;
    let signal = 0, square = 0, x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const a = Math.max(0, Math.min(1, (rgba[(y * width + x) * 4] - background) / range));
      signal += a; square += a * a;
      if (a > .01) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    const box = x1 < 0 ? null : [x0, y0, x1, y1], profile = new Float64Array(64);
    if (box && withProfile) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = Math.max(0, Math.min(1, (rgba[(y * width + x) * 4] - background) / range));
      if (!a) continue;
      const u0 = (x - x0) * 8 / (x1 + 1 - x0), u1 = (x + 1 - x0) * 8 / (x1 + 1 - x0);
      const v0 = (y - y0) * 8 / (y1 + 1 - y0), v1 = (y + 1 - y0) * 8 / (y1 + 1 - y0);
      for (let v = Math.floor(v0); v < Math.min(8, Math.ceil(v1)); v++) for (let u = Math.floor(u0); u < Math.min(8, Math.ceil(u1)); u++) {
        profile[v * 8 + u] += a * (Math.min(u + 1, u1) - Math.max(u, u0))
          * (Math.min(v + 1, v1) - Math.max(v, v0)) / (u1 - u0) / (v1 - v0) / signal;
      }
    }
    return { signal, concentration: signal ? square / signal : 0, profile: Array.from(profile),
      density: box ? signal / ((x1 - x0 + 1) * (y1 - y0 + 1)) : 0, box,
      clipped: !!box && (x0 === 0 || y0 === 0 || x1 === width - 1 || y1 === height - 1),
      topology: withTopology ? topology(rgba, width, box, background, range, details) : null,
      words: new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.byteLength / 4) };
  }

  function outline(g) {
    if (!g.bounds) return null;
    const scale = 256 / 1000;
    const width = Math.ceil((g.bounds[2] - g.bounds[0]) * scale) + 80;
    const height = Math.ceil((g.bounds[3] - g.bounds[1]) * scale) + 80;
    lc.fillStyle = '#000'; lc.fillRect(0, 0, width, height);
    lc.save(); lc.translate(40 - g.bounds[0] * scale, 40 + g.bounds[3] * scale); lc.scale(scale, -scale); lc.beginPath();
    for (const { command, args } of g.commands) lc[command](...args);
    lc.fillStyle = '#fff'; lc.fill(); lc.restore();
    const result = measure(lc, width, height, 0, 255, true, undefined, true, true); delete result.words;
    return result;
  }

  function render(family, g, size, phase, verticalPhase = 0, withProfile = true, withTopology = true) {
    const origin = 18 - Math.floor(Math.min(g.bounds?.[0] ?? 0, 0) * size / 1000);
    const baseline = 18 + Math.ceil(965 * size / 1000);
    const width = Math.ceil((Math.max(g.bounds?.[2] ?? 0, g.advance) - Math.min(g.bounds?.[0] ?? 0, 0)) * size / 1000) + 38;
    const height = Math.ceil(size * 1.25) + 38;
    ctx.fillStyle = '#282c34'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#dcdfe4';
    ctx.font = size + 'px "' + family + '"'; ctx.fillText(String.fromCodePoint(0xf0000 + g.id), origin + phase, baseline + verticalPhase);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const words = new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.byteLength / 4);
    const key = family + '/' + g.id + '/' + size + '/' + verticalPhase + '/' + withProfile + '/' + withTopology;
    if (previousRender?.key === key && words.every((value, i) => value === previousRender.result.words[i])) return previousRender.result;
    const result = measure(ctx, width, height, 40, 180, withTopology, rgba, withProfile);
    previousRender = { key, result };
    return result;
  }

  function error(actual, reference) {
    const a4 = new Float64Array(16), r4 = new Float64Array(16), ax = new Float64Array(8), rx = new Float64Array(8), ay = new Float64Array(8), ry = new Float64Array(8);
    let fine = 0;
    for (let i = 0; i < 64; i++) {
      fine += Math.abs(actual.profile[i] - reference.profile[i]);
      const x = i % 8, y = Math.floor(i / 8), p = Math.floor(y / 2) * 4 + Math.floor(x / 2);
      a4[p] += actual.profile[i]; r4[p] += reference.profile[i];
      ax[x] += actual.profile[i]; rx[x] += reference.profile[i]; ay[y] += actual.profile[i]; ry[y] += reference.profile[i];
    }
    const variation = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / 2;
    // Multiscale ink distribution detects local imbalance without assuming
    // that diagonals, curves, and stems should have identical widths.
    return .6 * fine / 2 + .3 * variation(a4, r4) + .05 * (variation(ax, rx) + variation(ay, ry))
      + .05 * Math.min(1, Math.abs(Math.log(actual.density / reference.density)));
  }

  function summarize(records, reference) {
    const errors = records.map(record => error(record, reference));
    return { score: .75 * errors.reduce((sum, value) => sum + value, 0) / errors.length + .25 * Math.max(...errors),
      errors, signal: records.reduce((sum, r) => sum + r.signal, 0) / records.length,
      concentration: records.reduce((sum, r) => sum + r.concentration, 0) / records.length,
      topology: records.map(r => r.topology), vanished: records.some(r => r.signal <= .1), clipped: records.some(r => r.clipped) };
  }
  function resolvable(reference, size, settings = {}) {
    const features = reference.topology[1], scale = size / 256;
    const counters = features.counterFeatures.filter(feature => feature.diameter * scale >= (settings.resolvableCounterDiameterPx ?? 2)).length;
    const parts = features.partFeatures.filter(feature => feature.area * scale * scale >= (settings.resolvablePartAreaPx ?? .5));
    // Components closer than one pixel form one unresolved cluster. Counting
    // fragments as independent marks would reject improved connectivity.
    const parents = parts.map((_, i) => i), find = i => parents[i] === i ? i : parents[i] = find(parents[i]);
    for (let i = 0; i < parts.length; i++) for (let j = 0; j < i; j++) {
      const a = parts[i].bounds, b = parts[j].bounds;
      const dx = Math.max(0, a[0] - b[2] - 1, b[0] - a[2] - 1), dy = Math.max(0, a[1] - b[3] - 1, b[1] - a[3] - 1);
      if (Math.hypot(dx, dy) * scale < (settings.resolvablePartGapPx ?? 1)) parents[find(i)] = find(j);
    }
    return { counters, parts: new Set(parts.map((_, i) => find(i))).size };
  }
  function boundsError(record, g, size, phase) {
    if (!record.box || !g.bounds) return 0;
    const origin = 18 - Math.floor(Math.min(g.bounds[0], 0) * size / 1000), baseline = 18 + Math.ceil(965 * size / 1000);
    const box = record.box, actual = [box[0] - origin - phase, baseline - box[3] - 1, box[2] + 1 - origin - phase, baseline - box[1]];
    return Math.max(...actual.map((value, i) => Math.abs(value - g.bounds[i] * size / 1000)));
  }
  return { measure, outline, render, error, summarize, thresholds, resolvable, boundsError };
}
