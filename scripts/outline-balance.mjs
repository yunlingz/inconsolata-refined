import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { create } from 'fontkit';
import { existsSync } from 'node:fs';
import { root, target, tool, run } from './lib.mjs';
import { validateOutlines } from './transform.mjs';

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, n) => [a[0] * n, a[1] * n];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const length = a => Math.hypot(...a);
const unit = a => length(a) > 1e-7 ? mul(a, 1 / length(a)) : null;
const round = n => Number(n.toFixed(4));

export function sfdGlyph(block) {
  const match = block.match(/SplineSet\n([\s\S]*?)\nEndSplineSet/);
  if (!match) return null;
  const lines = match[1].split('\n'), segments = [], nodes = [];
  let start, previous, contour = -1;
  for (let i = 0; i < lines.length; i++) {
    const tokens = lines[i].trim().split(/\s+/), command = tokens[2] === 'm' || tokens[2] === 'l' ? tokens[2] : tokens[6];
    if (command === 'm') {
      contour++; start = previous = { point: tokens.slice(0, 2).map(Number), flag: Number(tokens[3]), move: i };
      nodes.push(start);
    } else if (command === 'c' || command === 'l') {
      const p = tokens.slice(command === 'c' ? 4 : 0, command === 'c' ? 6 : 2).map(Number);
      const last = i === lines.length - 1 || /\sm\s/.test(lines[i + 1]);
      const next = last && length(sub(p, start.point)) < .01 ? start
        : { point: p, flag: Number(tokens[command === 'c' ? 7 : 3]) };
      if (next !== start) nodes.push(next);
      const segment = { p0: previous, p3: next, p1: command === 'c' ? tokens.slice(0, 2).map(Number) : add(previous.point, mul(sub(p, previous.point), 1 / 3)),
        p2: command === 'c' ? tokens.slice(2, 4).map(Number) : add(previous.point, mul(sub(p, previous.point), 2 / 3)), line: i, tokens, command, contour };
      previous.outgoing = segment; next.incoming = segment; segments.push(segment); previous = next;
    } else throw new Error('Unsupported SFD outline command: ' + lines[i]);
  }
  return { block, match, lines, segments, nodes };
}

function point(s, t) {
  const u = 1 - t;
  return [0, 1].map(i => u ** 3 * s.p0.point[i] + 3 * u * u * t * s.p1[i] + 3 * u * t * t * s.p2[i] + t ** 3 * s.p3.point[i]);
}
function tangent(s, t) {
  const u = 1 - t;
  return unit([0, 1].map(i => 3 * u * u * (s.p1[i] - s.p0.point[i]) + 6 * u * t * (s.p2[i] - s.p1[i]) + 3 * t * t * (s.p3.point[i] - s.p2[i])));
}
function flatten(glyph) {
  const edges = [];
  for (const [id, segment] of glyph.segments.entries()) {
    let a = segment.p0.point;
    for (let i = 1; i <= 24; i++) {
      const b = point(segment, i / 24), d = sub(b, a), norm = unit(d);
      if (norm) edges.push({ a, b, d, norm, id, contour: segment.contour });
      a = b;
    }
  }
  return edges;
}
function widthAt(glyph, edges, id, t, maximum) {
  const segment = glyph.segments[id], p = point(segment, t), direction = tangent(segment, t);
  if (!direction) return null;
  const inward = [direction[1], -direction[0]];
  let found;
  for (const edge of edges) {
    const denominator = cross(inward, edge.d);
    if (Math.abs(denominator) < 1e-8) continue;
    const relative = sub(edge.a, p), distance = cross(relative, edge.d) / denominator;
    const u = cross(relative, inward) / denominator;
    if (distance > .75 && distance < maximum && u >= -1e-6 && u <= 1 + 1e-6 && (!found || distance < found.width)) {
      found = { width: distance, edge };
    }
  }
  if (!found || dot(direction, found.edge.norm) > -.7) return null;
  return { width: found.width, direction, outward: mul(inward, -1), otherContour: found.edge.contour };
}

function correspondence(source, current, settings, style) {
  assert.equal(current.segments.length, source.segments.length, 'Cubic curve correspondence survives the resize');
  const sourceEdges = flatten(source), currentEdges = flatten(current);
  const sx = settings.outlineScaleX, sy = target.xHeight / settings.sourceXHeight;
  const shear = style.italic ? Math.tan(target.italicAngle * Math.PI / 180) : 0;
  const maximum = settings.referenceStems.verticalH / sx * 2.5;
  return (id, t) => {
    const before = widthAt(source, sourceEdges, id, t, maximum);
    const after = widthAt(current, currentEdges, id, t, maximum * Math.max(sx, sy) * 1.5);
    if (!before || !after || before.otherContour !== after.otherContour) return null;
    const transformedTangent = [sx * before.direction[0] + shear * sy * before.direction[1], sy * before.direction[1]];
    const desired = before.width * sx * sy / length(transformedTangent);
    return { desired, actual: after.width, outward: after.outward, otherContour: after.otherContour };
  };
}

function samples(source, current, settings, style) {
  const measure = correspondence(source, current, settings, style), records = [];
  for (let id = 0; id < current.segments.length; id++) for (const t of [.2, .4, .6, .8]) {
    const record = measure(id, t);
    if (record) records.push({ id, t, ...record });
  }
  return records;
}
function statistics(records) {
  const errors = records.map(r => Math.abs(Math.log(r.actual / r.desired))).sort((a, b) => a - b);
  return { samples: errors.length, meanLogError: errors.length ? errors.reduce((sum, e) => sum + e, 0) / errors.length : 0,
    p90LogError: errors[Math.floor(errors.length * .9)] ?? 0,
    minimumWidth: records.length ? Math.min(...records.map(r => r.actual)) : null };
}

function displace(source, current, settings, style, strength) {
  const measure = correspondence(source, current, settings, style);
  const shifts = new Map(), maximum = settings.referenceStems.verticalH * .2;
  const areas = new Map();
  for (const edge of flatten(current)) areas.set(edge.contour, (areas.get(edge.contour) ?? 0) + cross(edge.a, edge.b));
  const counters = new Set([...areas].filter(([, area]) => area > 0).map(([contour]) => contour));
  const straight = current.segments.map(segment => {
    const chord = sub(segment.p3.point, segment.p0.point), size = length(chord);
    return size > .01 && Math.abs(cross(sub(segment.p1, segment.p0.point), chord)) / size < .75
      && Math.abs(cross(sub(segment.p2, segment.p0.point), chord)) / size < .75;
  });
  const correction = (id, t) => {
    // Keep existing counter outlines exact. Correct the opposite outer edge
    // instead of consuming an already narrow hole to restore stroke weight.
    if (counters.has(current.segments[id].contour)) return null;
    const record = measure(id, t);
    if (!record) return null;
    const delta = (record.desired - record.actual) / (counters.has(record.otherContour) ? 1 : 2);
    if (Math.abs(delta) < .5) return null;
    const limited = Math.max(-Math.min(maximum, record.desired * .3), Math.min(Math.min(maximum, record.desired * .3), delta)) * strength;
    return { normal: record.outward, delta: limited };
  };
  for (const [id, segment] of current.segments.entries()) {
    for (const [node, t] of [[segment.p0, 0], [segment.p3, 1]]) {
      const proposal = correction(id, t);
      if (proposal) { if (!shifts.has(node)) shifts.set(node, []); shifts.get(node).push(proposal); }
    }
  }
  const nodeOffsets = new Map();
  for (const node of current.nodes) {
    if (counters.has(node.incoming?.contour)) { nodeOffsets.set(node, [0, 0]); continue; }
    const proposals = shifts.get(node) ?? [];
    let xx = .02, xy = 0, yy = .02, bx = 0, by = 0;
    for (const { normal: [x, y], delta } of proposals) { xx += x * x; xy += x * y; yy += y * y; bx += x * delta; by += y * delta; }
    const determinant = xx * yy - xy * xy;
    let offset = [(bx * yy - by * xy) / determinant, (by * xx - bx * xy) / determinant];
    const size = length(offset);
    if (size > maximum) offset = mul(offset, maximum / size);
    // Preserve the independently validated line box, including accents.
    offset[1] = Math.max(target.typoDescender - node.point[1], Math.min(target.typoAscender - node.point[1], offset[1]));
    nodeOffsets.set(node, offset);
  }
  const controls = current.segments.map((segment, id) => [1 / 3, 2 / 3].map((t, i) => {
    const proposal = correction(id, t);
    const offset = proposal ? mul(proposal.normal, proposal.delta)
      : mul(add(nodeOffsets.get(segment.p0), nodeOffsets.get(segment.p3)), .5);
    return add(i ? segment.p2 : segment.p1, offset);
  }));
  for (const node of current.nodes) node.point = add(node.point, nodeOffsets.get(node));
  current.segments.forEach((segment, i) => { [segment.p1, segment.p2] = controls[i]; });
  // Keep a smooth source join smooth after offsetting its two boundaries.
  for (const node of current.nodes) {
    if (counters.has(node.incoming?.contour)) continue;
    if ((node.flag & 3) !== 0 || !node.incoming || !node.outgoing) continue;
    const a = sub(node.point, node.incoming.p2), b = sub(node.outgoing.p1, node.point);
    const ua = unit(a), ub = unit(b);
    if (!ua || !ub || dot(ua, ub) < .94) continue;
    const direction = unit(add(ua, ub));
    node.incoming.p2 = sub(node.point, mul(direction, length(a)));
    node.outgoing.p1 = add(node.point, mul(direction, length(b)));
  }
  // Resizing and stroke correction must not turn a straight stem into a bow.
  current.segments.forEach((segment, i) => {
    if (!straight[i] || counters.has(segment.contour)) return;
    const chord = sub(segment.p3.point, segment.p0.point);
    segment.p1 = add(segment.p0.point, mul(chord, 1 / 3));
    segment.p2 = add(segment.p0.point, mul(chord, 2 / 3));
  });
  for (const node of current.nodes) if (node.move !== undefined) {
    const tokens = current.lines[node.move].trim().split(/\s+/); tokens[0] = round(node.point[0]); tokens[1] = round(node.point[1]);
    current.lines[node.move] = tokens.join(' ');
  }
  for (const segment of current.segments) {
    const values = segment.command === 'c' ? [...segment.p1, ...segment.p2, ...segment.p3.point] : segment.p3.point;
    current.lines[segment.line] = ' ' + [...values.map(round), ...segment.tokens.slice(segment.command === 'c' ? 6 : 2)].join(' ');
  }
  return current.block.replace(current.match[0], 'SplineSet\n' + current.lines.join('\n') + '\nEndSplineSet');
}

export async function balanceOutlines(input, output, sourceInstance, style, settings) {
  const sourceText = await readFile(input + '.sfd.source.sfd', 'utf8'), text = await readFile(input + '.sfd', 'utf8');
  const pattern = /^StartChar: ([^\n]+)\n[\s\S]*?^EndChar$/gm;
  const sources = new Map([...sourceText.matchAll(pattern)].map(match => [match[1], match[0]]));
  const font = create(await readFile(input));
  const terminal = new Set(font.characterSet.filter(code => code >= 0x2500 && code <= 0x259f).map(code => font.glyphForCodePoint(code).name));
  const sourceFont = create(await readFile(sourceInstance));
  const limitsFile = join(root, 'reference/outline-native-limits.json');
  const nativeLimits = existsSync(limitsFile) ? JSON.parse(await readFile(limitsFile, 'utf8')).styles[style.file] ?? {} : {};
  const context = { ...settings, sourceXHeight: sourceFont.glyphForCodePoint(120).bbox.maxY };
  const replacements = new Map(), report = [];
  for (const match of text.matchAll(pattern)) {
    if (report.length && report.length % 160 === 0) {
      console.log(`OUTLINES ${style.name}: ${report.length} glyphs reviewed`);
      await new Promise(resolve => setImmediate(resolve));
    }
    const name = match[1], originalBlock = match[0], sourceBlock = sources.get(name);
    const source = sourceBlock ? sfdGlyph(sourceBlock) : null, before = sfdGlyph(originalBlock);
    if (!source || !before || terminal.has(name)) { report.push({ name, status: terminal.has(name) ? 'cell artwork preserved' : 'empty glyph' }); continue; }
    const baseline = samples(source, before, context, style), beforeStats = statistics(baseline);
    if (nativeLimits[name]) {
      report.push({ name, status: 'resized source retained after native geometry acceptance', strength: 0, before: beforeStats, after: beforeStats,
        nativeConstraint: nativeLimits[name] }); continue;
    }
    let bestBlock = originalBlock, bestStats = beforeStats, selectedStrength = 0;
    for (const strength of [1, .75, .5, .25]) {
      const candidateBlock = displace(source, sfdGlyph(originalBlock), context, style, strength);
      const after = samples(source, sfdGlyph(candidateBlock), context, style);
      const afterByKey = new Map(after.map(r => [`${r.id},${r.t}`, r]));
      const comparable = baseline.filter(r => afterByKey.has(`${r.id},${r.t}`));
      if (comparable.length < baseline.length * .98) continue;
      const prior = statistics(comparable), next = statistics(comparable.map(r => afterByKey.get(`${r.id},${r.t}`)));
      if (next.meanLogError < prior.meanLogError - .001 && next.meanLogError < bestStats.meanLogError
        && next.p90LogError <= prior.p90LogError + .005) { bestBlock = candidateBlock; bestStats = next; selectedStrength = strength; }
    }
    if (selectedStrength) replacements.set(name, bestBlock);
    // Named examples select detailed report rows only, never geometry policy.
    const detailed = ['f', 's', 'S'].includes(name)
      ? new Map(samples(source, sfdGlyph(bestBlock), context, style).map(r => [`${r.id},${r.t}`, r])) : null;
    report.push({ name, status: selectedStrength ? 'stroke-preserving compensation' : 'original resized outline retained',
      strength: selectedStrength, before: beforeStats, after: bestStats,
      ...(detailed ? { samples: baseline.map(r => ({ segment: r.id, t: r.t, desired: round(r.desired), before: round(r.actual),
        after: detailed.has(`${r.id},${r.t}`) ? round(detailed.get(`${r.id},${r.t}`).actual) : null })) } : {}) });
  }
  const sfd = output + '.sfd';
  const exportFont = async () => {
    await writeFile(sfd, text.replace(pattern, (block, name) => replacements.get(name) ?? block));
    await run(tool('fontforge'), ['-lang=ff', '-script', join(root, 'scripts/export-outlines.pe'), sfd, output]);
  };
  await exportFont();
  const beforeValidation = await validateOutlines(sourceInstance, output + '-source.sfd');
  const afterValidation = await validateOutlines(output, output + '-after.sfd');
  const rejected = [];
  for (const [name, flags] of afterValidation.states) if ((flags & ~(beforeValidation.states.get(name) ?? 0)) & ~0x20) {
    if (replacements.delete(name)) rejected.push(name);
  }
  if (rejected.length) {
    for (const name of rejected) {
      const record = report.find(row => row.name === name); record.status = 'retained after contour validation'; record.strength = 0; record.after = record.before;
    }
    await exportFont();
  }
  const final = create(await readFile(output)), prior = new Map(Array.from({ length: font.numGlyphs }, (_, id) => [font.getGlyph(id).name, font.getGlyph(id)]));
  for (let id = 0; id < final.numGlyphs; id++) {
    const glyph = final.getGlyph(id), original = prior.get(glyph.name);
    assert.ok(original); assert.equal(glyph.advanceWidth, original.advanceWidth, 'Outline balancing preserves every advance');
    if (glyph.path.commands.length) assert.ok(glyph.bbox.minY >= target.typoDescender && glyph.bbox.maxY <= target.typoAscender,
      glyph.name + ': compensated outline fits the line box');
  }
  return { method: 'Pair corresponding perpendicular stroke measurements in original and resized cubic contours. Preserve the original stroke contrast under a common affine stem scale, compensate only the extra distortion from height fitting, keep smooth joins and all advances, and reject proposals that worsen source-relative width balance or introduce contour warnings. No character-name rules.',
    sourceXHeight: context.sourceXHeight, affineStemScale: [settings.outlineScaleX, target.xHeight / context.sourceXHeight],
    glyphsReviewed: report.length, glyphsCompensated: replacements.size, rejectedByContourValidation: rejected, glyphs: report };
}
