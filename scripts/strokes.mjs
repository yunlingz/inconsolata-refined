// Measure filled spans rather than bounding boxes, including overlapping contours.
// Results are normalized to a 2048-unit em for the Cascadia reference.
function edges(glyph) {
  const result = [];
  let point, start;
  const line = next => { result.push([point, next]); point = next; };
  for (const { command, args } of glyph.path.commands) {
    if (command === 'moveTo') { point = args; start = args; }
    else if (command === 'lineTo') line(args);
    else if (command === 'closePath') line(start);
    else {
      const from = point, cubic = command === 'bezierCurveTo';
      if (!cubic && command !== 'quadraticCurveTo') throw new Error(`Unsupported path command: ${command}`);
      for (let i = 1; i <= 32; i++) {
        const t = i / 32, u = 1 - t;
        line([0, 1].map(c => cubic
          ? u ** 3 * from[c] + 3 * u ** 2 * t * args[c] + 3 * u * t ** 2 * args[c + 2] + t ** 3 * args[c + 4]
          : u ** 2 * from[c] + 2 * u * t * args[c] + t ** 2 * args[c + 2]));
      }
    }
  }
  return result;
}

function widths(glyph, axis, position) {
  const crossings = [];
  for (const [a, b] of edges(glyph)) {
    const direction = a[axis] <= position && b[axis] > position ? 1
      : b[axis] <= position && a[axis] > position ? -1 : 0;
    if (direction) crossings.push({
      point: a[1 - axis] + (position - a[axis]) / (b[axis] - a[axis]) * (b[1 - axis] - a[1 - axis]),
      direction,
    });
  }
  crossings.sort((a, b) => a.point - b.point);
  const result = [];
  let winding = 0, start;
  for (const crossing of crossings) {
    if (!winding) start = crossing.point;
    winding += crossing.direction;
    if (!winding && crossing.point > start) result.push(crossing.point - start);
  }
  if (!result.length || winding) throw new Error('Expected a closed, nonempty stroke sample');
  return result.reduce((a, b) => a + b, 0) / result.length;
}

export function measureStems(font) {
  const scale = 2048 / font.unitsPerEm;
  const H = font.glyphForCodePoint(72), n = font.glyphForCodePoint(110);
  return {
    verticalH: widths(H, 1, H.bbox.maxY * .25) * scale,
    verticaln: widths(n, 1, font.glyphForCodePoint(120).bbox.maxY * .35) * scale,
    horizontalH: widths(H, 0, H.advanceWidth * .5) * scale,
  };
}
