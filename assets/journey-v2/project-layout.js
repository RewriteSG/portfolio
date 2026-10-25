const START = .565;
const SPAN = .265;
const END = .83;
const RETURN_START = .90;
const CATALOG_FADE_END = .91;
const EARTH_ARRIVAL = .922;
const EARTH_ZOOM_END = .93;
const RETURN_END = .94;
const clamp = value => Math.max(0, Math.min(1, Number.isNaN(value) ? 0 : value));

/** Stable positions and colors, independent of rendering and the browser. */
export function projectOrbit(layout, index) {
  const id = layout.ids[index];
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return {id, index, angle:-Math.PI / 2 + index / layout.ids.length * Math.PI * 2, hue:(hash >>> 0) % 360};
}

export function buildProjectLayout(projectIds = []) {
  const ids = [...new Set(projectIds.filter(id => typeof id === 'string' && id.trim()))];
  const count = ids.length;
  const stops = ids.map((_, index) => START + ((index + .5) / count) * SPAN);
  const intervals = ids.map((_, index) => {
    const start = START + (index / count) * SPAN;
    const end = START + ((index + 1) / count) * SPAN;
    return {start, end, progress:stops[index], fade:Math.min(.012, (end - start) / 4)};
  });
  const layout = {
    ids,
    stops,
    intervals,
    chapterStart:START,
    chapterEnd:END,
    catalogCameraStart:count ? .818 : .48,
    projectsStageStart:count ? END : .535,
    projectsStageEnd:RETURN_START,
    returnStart:RETURN_START,
    catalogFadeEnd:CATALOG_FADE_END,
    earthArrival:EARTH_ARRIVAL,
    earthZoomEnd:EARTH_ZOOM_END,
    returnEnd:RETURN_END,
  };
  const markerCount = Math.min(32, count);
  layout.markers = Array.from({length:markerCount}, (_, index) => projectOrbit(layout, Math.floor(index * count / markerCount)));
  layout.needsActiveMarker = count > 32;
  return layout;
}

/** Outside the chapter, use its nearest item; empty layouts have no selection. */
export function projectAtProgress(layout, progress) {
  if (!layout.ids.length) return null;
  return Math.min(layout.ids.length - 1, Math.floor(clamp((progress - START) / SPAN) * layout.ids.length));
}

/** The panel's content scrolls only while the scene is visible on the journey. */
export function sceneScrollRange(start, end, fade = 0) {
  const from = clamp(Number(start));
  const to = clamp(Number(end));
  if (!(to > from)) return {start:from, end:to};
  const fadeWidth = Math.min(Math.max(0, Number(fade) || 0), (to - from) / 4);
  return {
    start:from === 0 ? from : from + fadeWidth,
    end:to === 1 ? to : to - fadeWidth,
  };
}

function buildSegments(baseline, demands) {
  const boundaries = [...new Set([0, 1, ...demands.flatMap(({start, end}) => [start, end])])].sort((a, b) => a - b);
  const segments = [];
  let total = 0;
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const span = end - start;
    let length = baseline * span;
    demands.forEach(demand => {
      const overlap = Math.max(0, Math.min(end, demand.end) - Math.max(start, demand.start));
      if (overlap) length += demand.extra * overlap / (demand.end - demand.start);
    });
    const scrollStart = total;
    total += length;
    segments.push({start, end, scrollStart, scrollEnd:total});
  }
  return {segments, total};
}

/** Compose panel requirements, then top up the two named camera intervals. */
export function buildScrollMetrics(layout, viewportHeight, panelMetrics = []) {
  const height = Math.max(1, viewportHeight);
  const baseline = Math.max(6500, 16 * height) - height;
  const demands = (Array.isArray(panelMetrics) ? panelMetrics : []).flatMap(panel => {
    const start = Number(panel.start);
    const end = Number(panel.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const from = clamp(start);
    const to = clamp(end);
    const span = to - from;
    if (!span) return [];
    const range = sceneScrollRange(from, to, panel.fade);
    const visibleShare = (range.end - range.start) / span;
    const overflow = Math.max(0, Number(panel.overflow) || 0);
    const contentDuration = visibleShare > 0 ? overflow / visibleShare : overflow;
    const minimumDuration = Math.max(0, Number(panel.minimumDuration) || 0);
    const baseDuration = baseline * span;
    return [{start:from, end:to, extra:Math.max(0, Math.max(contentDuration, minimumDuration) - baseDuration)}];
  });

  let metrics = buildSegments(baseline, demands);
  const catalogCameraFloor = 1.5 * height;
  const returnCameraFloor = 2.25 * height;
  const intervals = [
    {start:layout?.catalogCameraStart, end:layout?.projectsStageStart, floor:catalogCameraFloor},
    {start:layout?.returnStart, end:layout?.returnEnd, floor:returnCameraFloor},
  ];
  for (const interval of intervals) {
    const start = Number(interval.start);
    const end = Number(interval.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const from = clamp(start);
    const to = clamp(end);
    if (to <= from) continue;
    const existingDistance = scrollAtProgress(metrics, to) - scrollAtProgress(metrics, from);
    const deficit = Math.max(0, interval.floor - existingDistance);
    if (deficit > 0) {
      demands.push({start:from, end:to, extra:deficit});
      metrics = buildSegments(baseline, demands);
    }
  }
  return metrics;
}

export function progressAtScroll(metrics, scroll) {
  const value = Number(scroll);
  const offset = Math.max(0, Math.min(metrics.total, Number.isNaN(value) ? 0 : value));
  const segment = metrics.segments.find(item => offset <= item.scrollEnd) || metrics.segments.at(-1);
  if (!segment) return 0;
  const amount = (offset - segment.scrollStart) / (segment.scrollEnd - segment.scrollStart);
  return segment.start + amount * (segment.end - segment.start);
}

export function scrollAtProgress(metrics, progress) {
  const p = clamp(progress);
  const segment = metrics.segments.find(item => p <= item.end) || metrics.segments.at(-1);
  if (!segment) return 0;
  const amount = (p - segment.start) / (segment.end - segment.start);
  return segment.scrollStart + amount * (segment.scrollEnd - segment.scrollStart);
}
