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
    assert.equal(layout.chapterEnd, .83);
    assert.equal(layout.projectsStageStart, count ? .83 : .535);
    assert.equal(layout.catalogCameraStart, count ? .818 : .48);
    assert.equal(layout.projectsStageEnd, .90);
    assert.equal(layout.returnStart, .90);
    assert.equal(layout.catalogFadeEnd, .91);
    assert.equal(layout.earthArrival, .922);
    assert.equal(layout.cloudRevealStart, .924);
    assert.equal(layout.cloudRevealEnd, .928);
    assert.equal(layout.earthZoomStart, .926);
    assert.equal(layout.earthZoomEnd, .93);
    assert.equal(layout.returnEnd, .94);
    assert.equal(layout.projectsStageEnd, layout.returnStart, 'the catalog stage ends exactly where the return starts');
    assert.ok(layout.returnEnd > layout.returnStart, 'the return has a nonempty interval');
    assert.equal(layout.markers.length, Math.min(count, 32));
    assert.equal(layout.needsActiveMarker, count > 32);
    layout.stops.forEach((stop, i) => {
      assert.equal(stop, .565 + ((i + .5) / count) * .265);
      assert.equal(projectAtProgress(layout, stop), i);
      if (i) assert.ok(Math.abs(stop - layout.stops[i - 1] - .265 / count) < 1e-12);
      if (i) assert.equal(layout.intervals[i - 1].end, layout.intervals[i].start, 'orbit chapter intervals have no gaps or overlaps');
    });
    if (count) {
      assert.equal(layout.intervals[0].start, .565);
      assert.equal(layout.intervals.at(-1).end, .83);
    } else assert.deepEqual(layout.intervals, []);
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

for (const count of [0, 1, 3]) {
  for (const height of [390, 768, 900]) {
    test(`${count} projects at ${height}px keep the catalog at 1.5× and return at 9× viewport height`, () => {
      const layout = buildProjectLayout(Array.from({length:count}, (_, i) => `handoff-${i}`));
      const panels = layout.intervals.map(interval => ({...interval, overflow:1400, minimumDuration:810}));
      const metrics = buildScrollMetrics(layout, height, panels);
      const catalogFloor = 1.5 * height;
      const returnFloor = 9 * height;
      const span = (start, end) => scrollAtProgress(metrics, end) - scrollAtProgress(metrics, start);

      assert.equal(layout.catalogCameraStart, count ? .818 : .48);
      assert.equal(layout.projectsStageStart, count ? .83 : .535);
      assert.equal(layout.cloudRevealStart, .924);
      assert.equal(layout.cloudRevealEnd, .928);
      assert.ok(span(layout.catalogCameraStart, layout.projectsStageStart) >= catalogFloor - 1e-7,
        `catalog camera span ${span(layout.catalogCameraStart, layout.projectsStageStart)} is below ${catalogFloor}`);
      assert.ok(span(layout.returnStart, layout.returnEnd) >= returnFloor - 1e-7,
        `return camera span ${span(layout.returnStart, layout.returnEnd)} is below ${returnFloor}`);
      assert.ok(Math.abs(span(layout.earthArrival, layout.earthZoomStart) - .9 * height) < 1e-7,
        `Earth hold span ${span(layout.earthArrival, layout.earthZoomStart)} should be .9× viewport height`);
      assert.ok(Math.abs(span(layout.earthZoomStart, layout.earthZoomEnd) - .9 * height) < 1e-7,
        `Earth zoom span ${span(layout.earthZoomStart, layout.earthZoomEnd)} should be .9× viewport height`);
      for (const progress of [layout.catalogCameraStart, layout.projectsStageStart, .90, .91, .922, .926, .93, .94]) {
        assert.ok(Math.abs(progressAtScroll(metrics, scrollAtProgress(metrics, progress)) - progress) < 1e-12,
          `progress round-trips at ${progress}`);
      }
    });
  }
}

test('catalog camera top-up composes with overlapping final orbit content by max, not addition', () => {
  const height = 900;
  const floor = 1.5 * height;
  const layout = buildProjectLayout(['first', 'second', 'last']);
  const panel = {...layout.intervals.at(-1), minimumDuration:0};
  const baseline = Math.max(6500, 16 * height) - height;
  const cameraStart = layout.catalogCameraStart;
  const stageStart = layout.projectsStageStart;
  const span = panel.end - panel.start;
  const contentRange = sceneScrollRange(panel.start, panel.end, panel.fade);
  const visibleShare = (contentRange.end - contentRange.start) / span;

  for (const overflow of [0, 10000]) {
    const contentDuration = overflow / visibleShare;
    const extra = Math.max(0, contentDuration - baseline * span);
    const overlap = Math.max(0, Math.min(stageStart, panel.end) - Math.max(cameraStart, panel.start));
    const contentOnlyDistance = baseline * (stageStart - cameraStart) + extra * overlap / span;
    const metrics = buildScrollMetrics(layout, height, [{...panel, overflow}]);
    const finalDistance = scrollAtProgress(metrics, stageStart) - scrollAtProgress(metrics, cameraStart);

    assert.equal(contentOnlyDistance < floor, overflow === 0, 'fixture exercises both sides of the 1.5× floor');
    assert.ok(Math.abs(finalDistance - Math.max(contentOnlyDistance, floor)) < 1e-7,
      `final span ${finalDistance} should equal max(${contentOnlyDistance}, ${floor})`);
    if (contentOnlyDistance < floor) {
      assert.ok(Math.abs(finalDistance - floor) < 1e-7,
        `below-floor catalog span ${finalDistance} should be exactly ${floor}`);
    }
    for (const progress of [cameraStart, stageStart]) {
      assert.ok(Math.abs(progressAtScroll(metrics, scrollAtProgress(metrics, progress)) - progress) < 1e-12);
    }
  }
});

test('return camera top-up composes below- and above-floor content by max, not addition', () => {
  const height = 900;
  const floor = 9 * height;
  const layout = buildProjectLayout(['first', 'second', 'last']);
  const start = layout.returnStart;
  const end = layout.returnEnd;
  const baseline = Math.max(6500, 16 * height) - height;
  const baseDistance = baseline * (end - start);

  for (const overflow of [floor / 2, floor * 2]) {
    const contentOnlyDistance = Math.max(baseDistance, overflow);
    const metrics = buildScrollMetrics(layout, height, [{start, end, overflow, minimumDuration:0}]);
    const finalDistance = scrollAtProgress(metrics, end) - scrollAtProgress(metrics, start);

    assert.equal(contentOnlyDistance < floor, overflow === floor / 2,
      'fixture exercises both sides of the 9× floor');
    assert.ok(Math.abs(finalDistance - Math.max(contentOnlyDistance, floor)) < 1e-7,
      `final span ${finalDistance} should equal max(${contentOnlyDistance}, ${floor})`);
    for (const progress of [start, .91, .922, .926, .93, end]) {
      assert.ok(Math.abs(progressAtScroll(metrics, scrollAtProgress(metrics, progress)) - progress) < 1e-12,
        `progress round-trips at ${progress}`);
    }
  }
});

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
