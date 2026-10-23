import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyRemoteMedia,
  loadProjectManifest,
  normalizeManifest,
  resolveProjectMedia,
  safeEmail,
  safeHttpUrl,
} from '../../assets/journey-v2/project-data.js';

const baseUrl = 'https://portfolio.example/';

test('normalizes, defaults, rejects unsafe and duplicate projects, then sorts deterministically', () => {
  const result = normalizeManifest({
    generated: '2026-10-24T00:00:00Z',
    projects: [
      { id: 'old', order: 1, date: '2025-01-01' },
      { id: 'newer', order: 1, date: '2025-03-01' },
      { id: 'high', order: 4, date: '2020-01-01' },
      { id: 'same-order-date', order: 1, date: '2025-03-01' },
      { id: 'newer', name: 'duplicate' },
      { id: '../escape' },
      { id: 'back\\slash' },
      null,
      'not a project',
      { name: 'missing id' },
    ],
  });

  assert.deepEqual(result.projects.map(project => project.id), ['high', 'newer', 'same-order-date', 'old']);
  assert.equal(result.rejected, 6);
  assert.equal(result.projects[1].name, 'newer');
  assert.equal(result.projects[1].description, '');
  assert.deepEqual(result.projects[1].tags, []);
  assert.deepEqual(result.projects[1].stack, []);
  assert.deepEqual(result.projects[1].media, []);
  assert.deepEqual(result.projects[1].links, {});
  assert.equal(result.projects[1].thumbnail, null);
  assert.equal(result.projects[1].status, 'unspecified');
});

test('rejects a missing or non-array manifest without throwing', () => {
  assert.deepEqual(normalizeManifest(null), { projects: [], rejected: 1 });
  assert.deepEqual(normalizeManifest({ projects: {} }), { projects: [], rejected: 1 });
  assert.deepEqual(normalizeManifest({ projects: [] }), { projects: [], rejected: 0 });
});

test('preserves Driftwake supported metadata and safely copies mutable fields', () => {
  const source = {
    id: 'Driftwake',
    name: 'Driftwake',
    description: 'A sailing roguelike.',
    thumbnail: './thumbnail.png',
    tags: ['game', 'godot', 'c++', '2d'],
    date: '2025-03-10',
    status: 'completed',
    order: 10,
    subhead: 'A sailing roguelike where the sea is the opponent',
    long: 'Built the engine, tools and ship-building UI from scratch.',
    stack: ['C++20', 'Godot 4', 'Box2D', 'GLSL'],
    commits: 42,
    media: [
      { type: 'image', src: './thumbnail.png', caption: 'Title screen' },
      { type: 'image', src: './screenshot1.png', caption: 'Open water, storm rolling in' },
    ],
    links: { github: 'https://github.com/you/driftwake' },
  };
  const project = normalizeManifest({ projects: [source] }).projects[0];

  assert.deepEqual(project, source);
  assert.notEqual(project.tags, source.tags);
  assert.notEqual(project.media, source.media);
  assert.notEqual(project.media[0], source.media[0]);
  assert.notEqual(project.links, source.links);
  assert.ok(Object.isFrozen(project.tags));
  assert.ok(Object.isFrozen(project.media[0]));
  source.tags.push('mutated');
  assert.deepEqual(project.tags, ['game', 'godot', 'c++', '2d']);
});

test('accepts only safe HTTP(S) URLs and validates conventional email addresses', () => {
  assert.equal(safeHttpUrl('https://example.com/a', baseUrl), 'https://example.com/a');
  assert.equal(safeHttpUrl('http://example.com/a', baseUrl), 'http://example.com/a');
  assert.equal(safeHttpUrl('../contact', baseUrl), 'https://portfolio.example/contact');
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', '', '  ', null, 7]) {
    assert.equal(safeHttpUrl(value, baseUrl), null, String(value));
  }

  assert.equal(safeEmail('person+tag@example.co.uk'), 'person+tag@example.co.uk');
  for (const value of ['bad', 'person@localhost', 'person@example', 'person@@example.com', '']) {
    assert.equal(safeEmail(value), null, String(value));
  }
});

test('resolves local media under the encoded project directory and rejects unsafe paths', () => {
  const project = { id: 'Driftwake' };
  assert.equal(resolveProjectMedia(project, './screenshot 1.png', baseUrl), './projects/Driftwake/screenshot%201.png');
  assert.equal(resolveProjectMedia({ id: 'project_one' }, './folder/a+b.png', baseUrl), './projects/project_one/folder/a%2Bb.png');
  assert.equal(resolveProjectMedia(project, 'https://cdn.example/video.mp4', baseUrl), 'https://cdn.example/video.mp4');
  assert.equal(resolveProjectMedia(project, '//cdn.example/image.png', baseUrl), 'https://cdn.example/image.png');
  assert.equal(resolveProjectMedia(project, String.fromCharCode(0xd800), baseUrl), null);

  for (const value of [
    '../secret.png', './nested/../../secret.png', '/absolute.png', 'C:\\absolute.png',
    'nested\\image.png', 'nested//image.png', './', 'nested/./image.png',
    'nested/%2e%2e/secret.png', 'nested/%2Fsecret.png', 'nested/%5csecret.png',
    'javascript:alert(1)', 'data:image/png;base64,abc', '', '   ',
  ]) {
    assert.equal(resolveProjectMedia(project, value, baseUrl), null, value);
  }
  assert.equal(resolveProjectMedia({ id: '../escape' }, 'image.png', baseUrl), null);
});

test('classifies direct video, allowlisted HTTPS embeds, and other remote URLs as links', () => {
  const cases = [
    ['https://cdn.example/video.mp4?size=large', 'direct-video', undefined],
    ['https://youtube.com/embed/abc', 'embed', 'youtube'],
    ['https://www.youtube.com/embed/abc', 'embed', 'youtube'],
    ['https://youtube-nocookie.com/embed/abc', 'embed', 'youtube'],
    ['https://player.vimeo.com/video/123', 'embed', 'vimeo'],
    ['https://itch.io/embed/123', 'embed', 'itch.io'],
    ['https://html-classic.itch.zone/html/123/index.html', 'embed', 'itch.io'],
    ['http://youtube.com/embed/abc', 'link', undefined],
    ['https://notyoutube.com/embed/abc', 'link', undefined],
    ['https://vimeo.com/123', 'link', undefined],
    ['https://example.com/watch', 'link', undefined],
  ];

  for (const [value, kind, provider] of cases) {
    const result = classifyRemoteMedia(value, baseUrl);
    assert.equal(result?.kind, kind, value);
    assert.equal(result?.url, value, value);
    assert.equal(result?.provider, provider, value);
  }
  for (const value of ['javascript:alert(1)', 'data:video/mp4,abc', './local.mp4', null]) {
    assert.equal(classifyRemoteMedia(value, baseUrl), null, String(value));
  }
});

test('loads once without cache, normalizes once, and rejects HTTP errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let callCount = 0;
    let jsonCount = 0;
    let options;
    globalThis.fetch = async (url, init) => {
      callCount += 1;
      options = init;
      assert.equal(url, './projects.json');
      return {
        ok: true,
        json: async () => {
          jsonCount += 1;
          return { projects: [{ id: 'one' }] };
        },
      };
    };
    assert.deepEqual(await loadProjectManifest(), {
      projects: [{
        id: 'one', name: 'one', description: '', thumbnail: null, tags: [], date: '',
        status: 'unspecified', order: null, subhead: '', long: '', stack: [], media: [], links: {},
      }],
      rejected: 0,
    });
    assert.deepEqual(options, { cache: 'no-store' });
    assert.equal(callCount, 1);
    assert.equal(jsonCount, 1);

    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(loadProjectManifest('/projects.json'), /HTTP 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
