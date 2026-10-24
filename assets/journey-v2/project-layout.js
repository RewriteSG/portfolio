const START = .565;
const SPAN = .252;
const END = .817;
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
  const layout = {ids, stops, intervals, chapterStart:START, chapterEnd:END};
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

/** Only the solar chapter grows. Each project's readable interval scales with content. */
export function buildScrollMetrics(layout, viewportHeight, contentHeight = 0) {
  const height = Math.max(1, viewportHeight);
  const baseline = Math.max(6500, 16 * height) - height;
  const before = baseline * START;
  const after = baseline * (1 - END);
  const interval = Math.max(640, height * .9, contentHeight);
  const projects = Math.max(baseline * SPAN, layout.ids.length * interval);
  return {before, projects, after, total:before + projects + after};
}

export function progressAtScroll(metrics, scroll) {
  const offset = Math.max(0, Math.min(metrics.total, scroll));
  if (offset <= metrics.before) return offset / metrics.before * START;
  if (offset <= metrics.before + metrics.projects) return START + (offset - metrics.before) / metrics.projects * SPAN;
  return END + (offset - metrics.before - metrics.projects) / metrics.after * (1 - END);
}

export function scrollAtProgress(metrics, progress) {
  const p = clamp(progress);
  if (p <= START) return p / START * metrics.before;
  if (p <= END) return metrics.before + (p - START) / SPAN * metrics.projects;
  return metrics.before + metrics.projects + (p - END) / (1 - END) * metrics.after;
}
