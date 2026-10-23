const DEFAULT_BASE_URL = 'https://portfolio.invalid/';
const PROJECT_ID = /^[a-z0-9_-]+$/i;
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const EMBED_PROVIDERS = new Map([
  ['youtube.com', 'youtube'],
  ['www.youtube.com', 'youtube'],
  ['youtube-nocookie.com', 'youtube'],
  ['player.vimeo.com', 'vimeo'],
  ['itch.io', 'itch.io'],
  ['html-classic.itch.zone', 'itch.io'],
]);

function stringOr(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value) {
  return Array.isArray(value)
    ? Object.freeze(value.filter(item => typeof item === 'string').slice())
    : Object.freeze([]);
}

function dateValue(value) {
  if (typeof value !== 'string' || !value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function orderValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mediaItems(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  const items = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (!['image', 'video', 'embed'].includes(item.type) || typeof item.src !== 'string' || !item.src.trim()) continue;
    const copy = { type: item.type, src: item.src };
    if (typeof item.caption === 'string') copy.caption = item.caption;
    if (typeof item.alt === 'string') copy.alt = item.alt;
    if (typeof item.cardPreview === 'boolean') copy.cardPreview = item.cardPreview;
    items.push(Object.freeze(copy));
  }
  return Object.freeze(items);
}

function copyLinks(value) {
  const links = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, url] of Object.entries(value)) {
      if (typeof url === 'string') Object.defineProperty(links, key, {
        value: url,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  }
  return Object.freeze(links);
}

function normalizeProject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.id !== 'string' || !PROJECT_ID.test(value.id)) return null;

  const project = {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : value.id,
    description: stringOr(value.description),
    thumbnail: typeof value.thumbnail === 'string' && value.thumbnail.trim() ? value.thumbnail : null,
    tags: stringArray(value.tags),
    date: stringOr(value.date),
    status: typeof value.status === 'string' && value.status.trim() ? value.status : 'unspecified',
    order: orderValue(value.order),
    subhead: stringOr(value.subhead),
    long: stringOr(value.long),
    stack: stringArray(value.stack),
    media: mediaItems(value.media),
    links: copyLinks(value.links),
  };

  if (typeof value.commits === 'string' || (typeof value.commits === 'number' && Number.isFinite(value.commits))) {
    project.commits = value.commits;
  }
  return Object.freeze(project);
}

/** Validate a manifest and return a deterministic, immutable project list. */
export function normalizeManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.projects)) {
    return Object.freeze({ projects: Object.freeze([]), rejected: 1 });
  }

  let rejected = 0;
  const seenIds = new Set();
  const projects = [];
  input.projects.forEach((entry, index) => {
    const project = normalizeProject(entry);
    if (!project || seenIds.has(project.id)) {
      rejected += 1;
      return;
    }
    seenIds.add(project.id);
    projects.push({ project, index });
  });

  projects.sort((a, b) => {
    const orderA = a.project.order === null ? -Infinity : a.project.order;
    const orderB = b.project.order === null ? -Infinity : b.project.order;
    if (orderA !== orderB) return orderB - orderA;
    const dateDiff = dateValue(b.project.date) - dateValue(a.project.date);
    return dateDiff || a.index - b.index;
  });

  return Object.freeze({
    projects: Object.freeze(projects.map(entry => entry.project)),
    rejected,
  });
}

/** Resolve a URL only when it uses HTTP(S). Relative values use baseUrl. */
export function safeHttpUrl(value, baseUrl = DEFAULT_BASE_URL) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, baseUrl || DEFAULT_BASE_URL);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Keep the legacy contact-address syntax and length validation. */
export function safeEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL.test(value) ? value : null;
}

function hasExplicitScheme(value) {
  return /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//');
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Resolve local media within projects/<id>/, or accept a safe remote URL. */
export function resolveProjectMedia(project, src, baseUrl = DEFAULT_BASE_URL) {
  if (typeof src !== 'string' || !src.trim() || /[\u0000-\u001f\u007f]/.test(src)) return null;
  if (hasExplicitScheme(src)) return safeHttpUrl(src, baseUrl);

  const id = project && typeof project.id === 'string' && PROJECT_ID.test(project.id) ? project.id : null;
  if (!id || src.startsWith('/') || src.includes('\\')) return null;

  const localPath = src.startsWith('./') ? src.slice(2) : src;
  if (!localPath) return null;
  const segments = localPath.split('/');
  if (segments.some(segment => !segment)) return null;

  const encodedSegments = [];
  for (const segment of segments) {
    const decoded = decodePathSegment(segment);
    if (decoded === null || decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) return null;
    try {
      encodedSegments.push(encodeURIComponent(decoded));
    } catch {
      return null;
    }
  }
  return `./projects/${encodeURIComponent(id)}/${encodedSegments.join('/')}`;
}

/** Classify a safe remote media URL without granting arbitrary iframe access. */
export function classifyRemoteMedia(value, baseUrl = DEFAULT_BASE_URL) {
  const url = safeHttpUrl(value, baseUrl);
  if (!url || !/^https?:\/\//i.test(value)) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (/\.(?:mp4|webm|ogv|ogg|mov)$/i.test(parsed.pathname)) {
    return Object.freeze({ kind: 'direct-video', url });
  }

  const provider = parsed.protocol === 'https:' ? EMBED_PROVIDERS.get(parsed.hostname.toLowerCase()) : null;
  if (provider) return Object.freeze({ kind: 'embed', url, provider });
  return Object.freeze({ kind: 'link', url });
}

/** Fetch the generated root manifest without relying on browser globals. */
export async function loadProjectManifest(url = './projects.json') {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const manifest = await response.json();
  return normalizeManifest(manifest);
}
