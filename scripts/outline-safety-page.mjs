// Fast geometry acceptance pass: try gentler fitting first and inspect the
// remaining modes only when required. No ink-profile optimization occurs here.
export async function outlineSafetyPage(data, makeInkTools) {
  const ink = makeInkTools(), failures = [];
  for (const [name, file] of Object.entries(data.fonts)) {
    const face = new FontFace(name, `url("${file}")`); await face.load(); document.fonts.add(face);
  }
  let cases = 0;
  for (const g of data.glyphs) {
    const reference = ink.outline(g);
    if (!reference || g.terminal) continue;
    for (const size of data.settings.sizes) {
      const counts = ink.resolvable(reference, size, data.settings); counts.counters = Math.min(counts.counters, g.counters);
      const baseline = data.settings.phases.map(phase => ink.render('baseline', g, size, phase, 0, false));
      let safe = false;
      for (const mode of ['q', 'n', 's']) {
        const records = data.settings.phases.map(phase => ink.render(mode, g, size, phase, 0, false));
        cases += records.length;
        safe = records.every((record, p) => {
          if (record.clipped || (baseline[p].signal > .1 && record.signal <= .1)) return false;
          return ['counters', 'parts'].every(field => (field !== 'counters' || record.topology[1][field] >= Math.min(counts[field], baseline[p].topology[1][field]))
            && Math.max(...record.topology.map(t => t[field])) >= Math.min(counts[field], Math.max(...baseline[p].topology.map(t => t[field]))));
        });
        if (safe) break;
      }
      if (!safe) failures.push({ id: g.id, name: g.name, size });
    }
  }
  return { platform: navigator.platform, userAgent: navigator.userAgent, failures, cases };
}
