import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectLayout, projectAtProgress, buildScrollMetrics, progressAtScroll, scrollAtProgress } from '../../assets/journey-v2/project-layout.js';

for (const count of [0, 1, 3, 8, 64]) {
  test(`${count} projects have ordered centered stops and bounded orbit markers`, () => {
    const ids = Array.from({length:count}, (_, i) => `project-${i}`);
    const layout = buildProjectLayout(ids);
    assert.deepEqual(layout.ids, ids);
    assert.equal(layout.stops.length, count);
    assert.equal(layout.chapterStart, .565);
    assert.equal(layout.chapterEnd, .817);
    assert.equal(layout.markers.length, Math.min(count, 32));
    assert.equal(layout.needsActiveMarker, count > 32);
    layout.stops.forEach((stop, i) => {
      assert.equal(stop, .565 + ((i + .5) / count) * .252);
      assert.equal(projectAtProgress(layout, stop), i);
      if (i) assert.ok(Math.abs(stop - layout.stops[i - 1] - .252 / count) < 1e-12);
    });
    assert.equal(projectAtProgress(layout, -5), count ? 0 : null);
    assert.equal(projectAtProgress(layout, 9), count ? count - 1 : null);
    assert.equal(projectAtProgress(layout, NaN), count ? 0 : null);
    assert.equal(new Set(layout.markers.map(item => item.index)).size, layout.markers.length);
    assert.deepEqual(buildProjectLayout(ids), layout, 'layout and colors are deterministic');
  });
  test(`${count} projects retain readable scroll intervals and reversible jumps`, () => {
    const layout = buildProjectLayout(Array.from({length:count}, (_, i) => `p${i}`));
    const metrics = buildScrollMetrics(layout, 900, 1400);
    const base = buildScrollMetrics(buildProjectLayout([]), 900);
    assert.equal(metrics.before, base.before);
    assert.equal(metrics.after, base.after);
    if (count) assert.ok(metrics.projects / count >= 1400);
    for (const p of [0, .1, .3, .55, ...layout.stops, .89, .99, 1]) {
      assert.ok(Math.abs(progressAtScroll(metrics, scrollAtProgress(metrics, p)) - p) < 1e-12);
    }
    assert.equal(progressAtScroll(metrics, -1), 0);
    assert.equal(progressAtScroll(metrics, Infinity), 1);
  });
}

test('IDs are copied and duplicate-free without mutating input', () => {
  const ids = ['first', 'first', '', null, 'last'];
  assert.deepEqual(buildProjectLayout(ids).ids, ['first', 'last']);
  assert.deepEqual(ids, ['first', 'first', '', null, 'last']);
});
