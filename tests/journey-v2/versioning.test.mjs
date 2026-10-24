import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = JSON.parse(readFileSync(path.join(projectRoot, 'tests/journey-v2/fixtures/journey-reference-hashes.json'), 'utf8'));
const referenceRoot = path.resolve(process.env.JOURNEY_REFERENCE_ROOT || projectRoot);
const referenceFiles = Object.keys(fixture).sort();
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const read = file => readFileSync(path.join(projectRoot, file), 'utf8');
const legacyRedirectScript = read('project.html').match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)?.[1];

function legacyRedirectDestination(search) {
  let destination = null;
  runInNewContext(legacyRedirectScript, {
    URLSearchParams,
    encodeURIComponent,
    window: { location: { search, replace: value => { destination = value; } } },
  });
  return destination;
}

test('reference fixture covers every immutable Journey and shared source file', () => {
  const journeyRoot = path.join(referenceRoot, 'overwrite-design/dist/journey');
  assert.ok(
    existsSync(journeyRoot),
    `Journey reference files are unavailable under ${referenceRoot}; set JOURNEY_REFERENCE_ROOT to the repository containing overwrite-design/dist.`
  );
  const sourceFiles = readdirSync(journeyRoot)
    .map(name => `overwrite-design/dist/journey/${name}`)
    .filter(file => statSync(path.join(referenceRoot, file)).isFile());
  sourceFiles.push('overwrite-design/dist/vendor/three.module.js', 'overwrite-design/dist/vendor/three.core.js', 'overwrite-design/dist/assets/raleway.woff2');
  assert.deepEqual(referenceFiles, sourceFiles.sort());

  for (const [source, expectedHash] of Object.entries(fixture)) {
    assert.equal(sha256(path.join(referenceRoot, source)), expectedHash, `${source} changed from its recorded reference`);
  }
  assert.equal(sha256(path.join(projectRoot, 'assets/journey-v2/vendor/three.core.js')), fixture['overwrite-design/dist/vendor/three.core.js'], 'the copied Three.js core must match its immutable source');
});

test('root HTML loads only the Journey V2 production shell in the required order', () => {
  const html = read('index.html');
  assert.match(html, /<script\s+src=["']\.\/assets\/info\.js["']\s*><\/script>/i);
  assert.match(html, /<link\s+rel=["']stylesheet["']\s+href=["']\.\/assets\/journey-v2\/styles\.css["']/i);
  assert.match(html, /<link\s+rel=["']stylesheet["']\s+href=["']\.\/assets\/journey-v2\/project-pages\.css["']/i);
  assert.match(html, /<script\s+type=["']module["']\s+src=["']\.\/assets\/journey-v2\/app\.js["']\s*><\/script>/i);
  assert.ok(html.indexOf('./assets/info.js') < html.indexOf('./assets/journey-v2/app.js'), 'info.js must load before the V2 module');
  const stylesheets = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]).sort();
  assert.deepEqual(stylesheets, ['./assets/journey-v2/project-pages.css', './assets/journey-v2/styles.css'].sort());
  const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]).sort();
  assert.deepEqual(scripts, ['./assets/info.js', './assets/journey-v2/app.js'].sort());
  assert.doesNotMatch(html, /overwrite-design\//i);
  for (const asset of ['./assets/style.css', './assets/app.js']) {
    assert.ok(!html.includes(asset), `legacy rollback asset referenced: ${asset}`);
  }
});

test('Journey V2 includes all required copied assets', () => {
  const required = [
    'assets/journey-v2/app.js',
    'assets/journey-v2/styles.css',
    'assets/journey-v2/project-pages.css',
    'assets/journey-v2/scene.js',
    'assets/journey-v2/earth.js',
    'assets/journey-v2/city.js',
    'assets/journey-v2/vendor/three.module.js',
    'assets/journey-v2/vendor/three.core.js',
    'assets/journey-v2/fonts/raleway.woff2',
  ];
  for (const file of required) assert.ok(existsSync(path.join(projectRoot, file)), `missing ${file}`);
});

test('module imports and CSS URLs resolve within the Journey V2 production boundary', () => {
  const assetsRoot = path.join(projectRoot, 'assets/journey-v2');
  const isWithin = (root, target) => {
    const relative = path.relative(root, target);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  const moduleFiles = readdirSync(assetsRoot, {recursive:true})
    .filter(file => file.endsWith('.js'))
    .map(file => file.replaceAll(path.sep, '/'));
  for (const file of moduleFiles) {
    const source = read(`assets/journey-v2/${file}`);
    const imports = [...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(['"]([^'"]+)['"]\)/g)];
    for (const match of imports) {
      const value = match[1] || match[2];
      assert.ok(!value.startsWith('/') && !/^[a-z]+:/i.test(value), `${file} has a non-local import: ${value}`);
      const resolved = path.resolve(path.dirname(path.join(assetsRoot, file)), value);
      assert.ok(isWithin(assetsRoot, resolved), `${file} import escapes Journey V2: ${value}`);
      assert.ok(existsSync(resolved), `${file} import does not resolve: ${value}`);
    }
  }

  const css = `${read('assets/journey-v2/styles.css')}\n${read('assets/journey-v2/project-pages.css')}`;
  for (const [, value] of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
    if (/^(?:data:|#)/i.test(value)) continue;
    assert.ok(!/^(?:[a-z]+:|\/\/)/i.test(value), `CSS runtime dependency must be local: ${value}`);
    const resolved = path.resolve(assetsRoot, value);
    assert.ok(isWithin(assetsRoot, resolved), `CSS URL escapes Journey V2: ${value}`);
    assert.ok(existsSync(resolved), `CSS URL does not resolve inside Journey V2: ${value}`);
  }
});

test('production scene contains no prototype project identities or fixed project count', () => {
  const app = read('assets/journey-v2/app.js');
  const scene = read('assets/journey-v2/scene.js');
  assert.doesNotMatch(`${app}\n${scene}`, /northstar|lumen|field-notes|of 3/i);
  assert.doesNotMatch(scene, /index\s*\/\s*3|\[0x87c3c4,\s*0xb6a1ea,\s*0xb8c78b\]/i);
});

test('static Journey shell has identity, About, Contact, mounts, and no prototype project studies', () => {
  const html = read('index.html');
  for (const id of ['hello', 'about', 'contact', 'world', 'journey-track', 'orbit-control', 'project-detail']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id} mount/section`);
  }
  assert.match(html, /<noscript>[\s\S]*?<\/noscript>/i);
  assert.match(html, /project[^<]{0,100}(?:JavaScript|javascript|script)[^<]{0,100}(?:enabled|enable|requires)/i);
  assert.doesNotMatch(html, /Northstar|Lumen|Field Notes/i);
});

test('static fallback contains current identity, biography, contact, and skip navigation', () => {
  const html = read('index.html');
  assert.match(html, /class="skip-link" href="#about"/);
  assert.match(html, /Programmer, building across games, software, apps &amp; the web\./);
  assert.match(html, /Ten years turning ideas into working software\./);
  assert.match(html, /game engines, backend services, native apps/);
  assert.match(html, /href="mailto:hi@example\.dev"/);
  assert.match(html, /href="https:\/\/github\.com\/RewriteSG"/);
  assert.match(html, /<noscript>[\s\S]*?Projects are unavailable without JavaScript\.[\s\S]*?<\/noscript>/);
  assert.doesNotMatch(html, /hello@hazwan\.design|product designer/);
});

test('legacy project links redirect safe IDs and route missing or unsafe IDs to Projects', () => {
  assert.ok(legacyRedirectScript, 'project.html must provide an inline compatibility redirect');
  assert.equal(legacyRedirectDestination('?id=Mixed_Case-2'), './index.html#project=Mixed_Case-2');
  assert.equal(legacyRedirectDestination('?id=Drift%77ake'), './index.html#project=Driftwake');

  for (const search of ['', '?id=', '?id=../bad', '?id=%3Cscript%3E', '?id=a%20b', '?id=%E0%A4%A']) {
    assert.equal(legacyRedirectDestination(search), './index.html#projects', `unsafe or absent ID in ${search}`);
  }
});

test('README and Docs describe the production boundary and keep project JSON authoring guidance', () => {
  for (const file of ['README.md', 'Docs.md']) {
    const documentation = read(file);
    assert.match(documentation, /assets\/journey-v2[\s\S]{0,160}production|production[\s\S]{0,160}assets\/journey-v2/i, `${file} must identify Journey V2 as production`);
    assert.match(documentation, /overwrite-design\/dist\/journey\//, `${file} must identify the original Journey reference`);
    assert.match(documentation, /assets\/app\.js/, `${file} must identify the legacy app reference`);
    assert.match(documentation, /assets\/style\.css/, `${file} must identify the legacy stylesheet reference`);
    assert.match(documentation, /projects\/<[^>]+>\/index\.json/, `${file} must retain the project JSON authoring path`);
    assert.match(documentation, /projects\.json/, `${file} must explain the generated manifest`);
  }

  const docs = read('Docs.md');
  assert.match(docs, /## Schema — `projects\/<Name>\/index\.json`/);
  assert.match(docs, /`projects\.json` is generated — don't hand-edit it\./);
});
