import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectLayout, projectAtProgress, buildScrollMetrics, progressAtScroll, scrollAtProgress, sceneScrollRange } from '../../assets/journey-v2/project-layout.js';

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
    const panels = layout.intervals.map(interval => ({...interval, overflow:1400, minimumDuration:810}));
    const metrics = buildScrollMetrics(layout, 900, panels);
    const base = buildScrollMetrics(buildProjectLayout([]), 900);
    assert.ok(metrics.total >= base.total);
    for (const panel of panels) {
      const range = sceneScrollRange(panel.start, panel.end, panel.fade);
      const visibleScroll = scrollAtProgress(metrics, range.end) - scrollAtProgress(metrics, range.start);
      assert.ok(visibleScroll >= panel.overflow - 1e-9);
      assert.ok(scrollAtProgress(metrics, panel.end) - scrollAtProgress(metrics, panel.start) >= 810 - 1e-9);
    }
    for (const p of [0, .1, .3, .55, ...layout.stops, .89, .99, 1]) {
      assert.ok(Math.abs(progressAtScroll(metrics, scrollAtProgress(metrics, p)) - p) < 1e-12);
    }
    assert.equal(progressAtScroll(metrics, -1), 0);
    assert.equal(progressAtScroll(metrics, Infinity), 1);
  });
}

test('scene scroll ranges leave fade room and add root-scroll distance for overflowing copy', () => {
  const aboutRange = sceneScrollRange(.22, .48, .025);
  const indexRange = sceneScrollRange(.535, .565, .012);
  assert.ok(Math.abs(aboutRange.start - .245) < 1e-12 && Math.abs(aboutRange.end - .455) < 1e-12);
  assert.ok(Math.abs(indexRange.start - .5425) < 1e-12 && Math.abs(indexRange.end - .5575) < 1e-12);

  const layout = buildProjectLayout([]);
  const base = buildScrollMetrics(layout, 900);
  const metrics = buildScrollMetrics(layout, 900, [{start:.22, end:.48, fade:.025, overflow:5000}]);
  const range = sceneScrollRange(.22, .48, .025);
  const readableDistance = scrollAtProgress(metrics, range.end) - scrollAtProgress(metrics, range.start);

  assert.ok(metrics.total > base.total);
  assert.ok(readableDistance >= 5000 - 1e-9);
  for (const p of [0, .22, .245, .3, .455, .48, .94, 1]) {
    assert.ok(Math.abs(progressAtScroll(metrics, scrollAtProgress(metrics, p)) - p) < 1e-12);
  }
});

test('IDs are copied and duplicate-free without mutating input', () => {
  const ids = ['first', 'first', '', null, 'last'];
  assert.deepEqual(buildProjectLayout(ids).ids, ['first', 'last']);
  assert.deepEqual(ids, ['first', 'first', '', null, 'last']);
});
