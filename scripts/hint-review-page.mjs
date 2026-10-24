// Serialized into native Windows Chromium with the shared measurement and
// selection functions. Every glyph, including unencoded alternates, is probed.
export async function hintReviewPage(data, makeInkTools, choose) {
  const ink = makeInkTools(), rows = [], errors = [];
  for (const [name, file] of Object.entries(data.fonts)) {
    const face = new FontFace(name, `url("${file}")`, { featureSettings: '"calt" 0,"liga" 0,"dlig" 0' });
    await face.load(); document.fonts.add(face);
  }
  let rasterizations = 0;
  for (const g of data.glyphs) {
    const modes = g.directRequired ? ['q', 'n', 's', 'u'] : ['q', 'n', 's'];
    const reference = ink.outline(g);
    for (const size of data.settings.sizes) {
      const records = {};
      for (const mode of ['baseline', 'geometryBaseline', ...modes]) {
        records[mode] = data.settings.phases.map(phase => ink.render(mode, g, size, phase));
        rasterizations += records[mode].length;
      }
      if (!reference) {
        for (const mode of ['baseline', 'geometryBaseline', ...modes]) if (records[mode].some(r => r.signal > .1)) errors.push({ id: g.id, size, mode, issue: 'empty glyph has ink' });
        continue;
      }
      const baseline = ink.summarize(records.baseline, reference);
      const geometryBaseline = ink.summarize(records.geometryBaseline, reference);
      const candidates = Object.fromEntries(modes.map(mode => [mode, ink.summarize(records[mode], reference)]));
      const baselineMode = modes.find(mode => records[mode].every((r, p) =>
        r.words.length === records.baseline[p].words.length && r.words.every((value, i) => value === records.baseline[p].words[i])));
      // The new source weight and size intentionally change small raster
      // features. Preserve the same new design before compensation/hinting;
      // retain the older release as a separate visual/ink comparison.
      const safetyBaseline = { ...geometryBaseline,
        errors: geometryBaseline.errors.map((value, i) => Math.max(value, candidates.q.errors[i])) };
      const counts = ink.resolvable(reference, size, data.settings);
      const row = { ...g, counters: Math.min(g.counters, counts.counters), parts: counts.parts,
        allCounters: reference.topology[1].counters, allParts: reference.topology[1].parts,
        size, baseline: safetyBaseline, modes: candidates };
      const selected = choose(row, data.settings), result = candidates[selected];
      if (result.vanished || result.clipped) errors.push({ id: g.id, size, mode: selected, issue: result.vanished ? 'vanished' : 'clipped' });
      rows.push({ id: g.id, name: g.name, size, selected, baselineMode,
        terminal: g.terminal, hasInstructions: g.hasInstructions, bounds: g.bounds,
        beforeScore: baseline.score, afterScore: result.score,
        qScore: candidates.q.score, nScore: candidates.n.score, sScore: candidates.s.score,
        beforeSignal: baseline.signal, afterSignal: result.signal,
        beforeConcentration: baseline.concentration, afterConcentration: result.concentration });
    }
  }
  const sheet = document.createElement('canvas'); sheet.width = 2560; sheet.height = 800;
  const sc = sheet.getContext('2d'); sc.fillStyle = '#282c34'; sc.fillRect(0, 0, sheet.width, sheet.height);
  const columns = [['baselineText', 'Refined 1.400'], ['qText', 'Quantized'], ['nText', 'Natural'], ['sText', 'Strong']];
  for (const [column, [family, label]] of columns.entries()) {
    const x = column * 640 + 16;
    sc.fillStyle = '#a6e3a1'; sc.font = '18px sans-serif'; sc.fillText(data.style + ' — ' + label, x, 26);
    let y = 57;
    for (const size of [12, 16, 18, 24, 28, 32]) {
      sc.fillStyle = '#8e96a4'; sc.font = '12px sans-serif'; sc.fillText(size + ' px', x, y);
      sc.fillStyle = '#dcdfe4'; sc.font = `${size}px "${family}"`;
      sc.fillText('Hn minimum 0123456789 0O1lI', x, y + size * 1.1);
      sc.fillText('f s S e c a g 2689 äëöü ÅŮ §#', x, y + size * 2.4);
      y += size * 2.6 + 18;
    }
    const detail = document.createElement('canvas'); detail.width = 95; detail.height = 34;
    const dc = detail.getContext('2d'); dc.fillStyle = '#282c34'; dc.fillRect(0, 0, 95, 34);
    dc.fillStyle = '#dcdfe4'; dc.font = `24px "${family}"`; dc.fillText('f s e c 8', 6, 26);
    sc.imageSmoothingEnabled = false; sc.drawImage(detail, x, 605, 570, 204);
    sc.fillStyle = '#8e96a4'; sc.font = '12px sans-serif'; sc.fillText('24 px, 6× pixels', x, 601);
  }
  return { platform: navigator.platform, userAgent: navigator.userAgent, rows, errors, rasterizations,
    thresholds: ink.thresholds, candidatePng: sheet.toDataURL('image/png') };
}
