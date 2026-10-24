// A font-wide selection rule. Names identify the resulting bytecode records;
// they never influence which candidate wins.
export const selectionSettings = {
  algorithmVersion: 6, sizes: Array.from({ length: 43 }, (_, i) => i + 8), phases: [0, .125, .25, .375, .5, .625, .75, .875],
  modePenalty: { q: 0, n: .0015, s: .004 }, maxPhaseRegression: .015,
  contrastAllowance: .02, contrastPenalty: .2,
  resolvableCounterDiameterPx: 2, resolvablePartAreaPx: .5, resolvablePartGapPx: 1,
};

export function selectHintMode(row, settings = selectionSettings) {
  if (row.terminal || !row.hasInstructions || !row.bounds) return 'q';
  const valid = mode => {
    const candidate = row.modes[mode];
    if (candidate.vanished || candidate.clipped) return false;
    for (let phase = 0; phase < row.baseline.topology.length; phase++) {
      for (const field of ['counters', 'parts']) {
        const before = row.baseline.topology[phase], after = candidate.topology[phase];
        if (field === 'counters' && after[1][field] < Math.min(row[field], before[1][field])) return false;
        // High thresholds can open a soft antialiased boundary; low ones can
        // close a narrow gap. Preserve actual middle-coverage topology and
        // details visible anywhere in the threshold sweep, not every mask.
        const required = Math.min(row[field], Math.max(...before.map(t => t[field])));
        if (Math.max(...after.map(t => t[field])) < required) return false;
      }
    }
    return true;
  };
  // Extra integer snapping caused the reported curve imbalance. Do not
  // introduce it merely because a low-resolution aggregate score likes it.
  // Retain it only when both gentler modes fail the safety constraints.
  let candidates = ['q', 'n'].filter(valid);
  if (!candidates.length && valid('s')) candidates = ['s'];
  if (!candidates.length) throw new Error('No safe candidate for glyph ' + row.id + ' (' + row.name + ') at ' + row.size + ' px: '
    + JSON.stringify({ baseline: row.baseline, candidates: row.modes }));
  const cost = mode => row.modes[mode].score + settings.modePenalty[mode]
    + settings.contrastPenalty * Math.max(0, row.modes.q.concentration - row.modes[mode].concentration - settings.contrastAllowance)
    + row.modes[mode].errors.reduce((sum, value, i) => sum + Math.max(0, value - row.baseline.errors[i] - settings.maxPhaseRegression), 0) / row.modes[mode].errors.length
    + .01 * row.baseline.topology.reduce((sum, before, i) => sum
      + Math.max(0, Math.min(row.allCounters, before[1].counters) - row.modes[mode].topology[i][1].counters)
      + Math.max(0, Math.min(row.allParts, before[1].parts) - row.modes[mode].topology[i][1].parts), 0) / row.baseline.topology.length;
  return candidates.reduce((best, mode) => cost(mode) < cost(best) - 1e-10 ? mode : best);
}
