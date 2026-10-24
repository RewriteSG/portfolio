import assert from 'node:assert/strict';

const {chromium} = await import(process.env.JOURNEY_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JOURNEY_BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const fixture = count => Array.from({length:count}, (_, index) => ({
  id:`Catalog_${index}`,
  name:`Catalog Project ${index}`,
  description:`Summary for catalog project ${index}.`,
  subhead:`A short editorial summary for project ${index}.`,
  thumbnail:`thumbnail-${index}.svg`,
  order:count - index,
  media:[],
}));
const ready = page => page.waitForFunction(() => window.__journeyScene && window.__journeyProjects && !document.body.classList.contains('preflight-pending'));

async function openScenario({count, orbitCount, viewport = {width:1440, height:900}}) {
  const page = await browser.newPage({viewport});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/assets/journey-v2/settings.json', route => route.fulfill({json:{orbitCount}}));
  await page.route('**/projects.json', route => route.fulfill({json:{projects:fixture(count)}}));
  await page.route('**/projects/**', route => route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#173040"/></svg>'}));
  await page.goto(`${base}#projects`);
  await ready(page);
  await page.waitForFunction(() => document.activeElement?.id === 'projects');
  return {page, errors};
}

function projectIds(page) {
  return page.locator('#project-catalog-grid .project-card').evaluateAll(cards => cards.map(card => card.dataset.projectId));
}

function readStageState(page) {
  return page.evaluate(() => {
    const scene = window.__journeyScene;
    const state = scene.getDebugState();
    const {projectsStageStart:start, projectsStageEnd:end} = scene.projectLayout;
    return {
      progress:state.targetProgress,
      localProgress:(state.targetProgress - start) / (end - start),
      camera:state.camera,
      solarScale:scene.solar.scale.toArray(),
      sunOpacity:scene.getOrbitLayout().opacity,
      shaderOpacity:scene.solarSunMaterial.uniforms.uOpacity.value,
      shaderTime:scene.solarSunMaterial.uniforms.uTime.value,
    };
  });
}

async function setStageProgress(page, progress) {
  await page.evaluate(progress => {
    const scene = window.__journeyScene;
    scene.setProgress(progress, true);
    scene.frame(performance.now());
  }, progress);
  return readStageState(page);
}

function projectedSolarBounds(page, progress = .86) {
  return page.evaluate(progress => {
    const scene = window.__journeyScene;
    scene.setProgress(progress, true);
    scene.frame(performance.now());
    const Vector3 = scene.camera.position.constructor;
    scene.solar.updateMatrixWorld(true);
    scene.camera.updateMatrixWorld(true);
    const points = [];
    for (let index = 0; index < 128; index++) {
      const angle = index / 128 * Math.PI * 2;
      const point = new Vector3(Math.cos(angle) * 96, 0, Math.sin(angle) * 96)
        .applyMatrix4(scene.solar.matrixWorld)
        .project(scene.camera);
      points.push({x:(point.x * .5 + .5) * innerWidth, y:(-point.y * .5 + .5) * innerHeight});
    }
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    return {
      left:Math.min(...xs), right:Math.max(...xs), top:Math.min(...ys), bottom:Math.max(...ys),
      width:Math.max(...xs) - Math.min(...xs), height:Math.max(...ys) - Math.min(...ys),
    };
  }, progress);
}

try {
  {
    const {page, errors} = await openScenario({count:0, orbitCount:0});
    assert.equal(await page.locator('#project-catalog-pager').evaluate(node => node.hidden), true, 'empty catalog hides the pager');
    assert.equal(await page.locator('#project-catalog-grid .project-card').count(), 0);
    assert.equal(await page.locator('#project-catalog-page-status').innerText(), 'No projects to show yet.');
    assert.deepEqual(await page.evaluate(() => ({orbit:window.__journeyProjects.presentation.orbitCount, chapters:window.__journeyProjects.presentation.chapters.length, details:window.__journeyProjects.presentation.details.length})), {orbit:0, chapters:0, details:0});
    const zeroOrbitStage = await readStageState(page);
    assert.ok(Math.abs(zeroOrbitStage.progress - .535) < .0001, `zero-orbit catalog starts at .535, received ${zeroOrbitStage.progress}`);
    assert.ok(await page.evaluate(() => Boolean(document.querySelector('#project-mount').compareDocumentPosition(document.querySelector('#projects')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'the orbit mount precedes the catalog stage in DOM order');
    assert.deepEqual(errors, []);
    console.log('PASS empty catalog starts at .535 after solar intro and hides pagination');
    await page.close();
  }

  {
    const {page, errors} = await openScenario({count:1, orbitCount:0});
    assert.equal(await page.locator('#project-catalog-pager').evaluate(node => node.hidden), false);
    assert.equal(await page.locator('#project-catalog-page-number').innerText(), '01 / 01');
    assert.equal(await page.getByRole('group', {name:'Page 1 of 1'}).count(), 1, 'the single-page indicator exposes its computed accessible name');
    assert.equal(await page.locator('#project-catalog-previous').isDisabled(), true);
    assert.equal(await page.locator('#project-catalog-next').isDisabled(), true);
    assert.equal(await page.locator('#project-catalog-previous').getAttribute('aria-disabled'), null);
    assert.deepEqual(await projectIds(page), ['Catalog_0']);
    assert.equal(await page.locator('#orbit-stops .orbit-stop').count(), 0, 'catalog page count is independent of orbitCount');
    assert.ok(Math.abs((await readStageState(page)).progress - .535) < .0001, 'zero-orbit catalog follows the solar intro');
    assert.equal(await page.locator('#project-catalog-grid img').getAttribute('alt'), 'Catalog Project 0 project preview');
    assert.deepEqual(errors, []);
    console.log('PASS single-project catalog shows 01 / 01 with native disabled arrows and no orbit markers');
    await page.close();
  }

  {
    const {page, errors} = await openScenario({count:13, orbitCount:1});
    assert.deepEqual(await page.evaluate(() => ({orbit:window.__journeyProjects.presentation.orbitCount, chapters:window.__journeyProjects.presentation.chapters.length, controls:window.__journeyProjects.presentation.controls.length, details:window.__journeyProjects.presentation.details.length})), {orbit:1, chapters:1, controls:1, details:13});
    const directStage = await readStageState(page);
    assert.ok(Math.abs(directStage.progress - .83) < .0001, `direct #projects hash starts after the featured orbit at .83, received ${directStage.progress}`);
    assert.ok(await page.evaluate(() => Boolean(document.querySelector('#project-mount').compareDocumentPosition(document.querySelector('#projects')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'orbit chapters precede the catalog section');
    assert.deepEqual(await projectIds(page), ['Catalog_0', 'Catalog_1', 'Catalog_2', 'Catalog_3']);

    const accessibleState = await page.evaluate(() => {
      const grid = document.querySelector('#project-catalog-grid');
      const pageStatus = document.querySelector('#project-catalog-page-status');
      return {
        pagerLabel:document.querySelector('#project-catalog-pager').getAttribute('aria-label'),
        controls:[...document.querySelectorAll('#project-catalog-previous,#project-catalog-next')].map(button => button.getAttribute('aria-controls')),
        pageStatus:{role:pageStatus.getAttribute('role'), live:pageStatus.getAttribute('aria-live'), atomic:pageStatus.getAttribute('aria-atomic')},
        gridLive:grid.hasAttribute('aria-live'),
        cardLive:grid.querySelector('[aria-live],[role="status"]') !== null,
        statusOutsideGrid:!grid.contains(pageStatus),
      };
    });
    assert.deepEqual(accessibleState, {
      pagerLabel:'Project pages',
      controls:['project-catalog-grid', 'project-catalog-grid'],
      pageStatus:{role:'status', live:'polite', atomic:'true'},
      gridLive:false, cardLive:false, statusOutsideGrid:true,
    });
    assert.equal(await page.locator('#project-catalog-page-status').innerText(), 'Page 1 of 4; projects 1 through 4 of 13');

    const previous = page.locator('#project-catalog-previous');
    await previous.focus();
    await page.evaluate(() => document.querySelector('#project-catalog-previous').click());
    assert.equal(await page.getByRole('group', {name:'Page 1 of 4'}).count(), 1, 'previous at the first page is a no-op');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'project-catalog-previous', 'a boundary no-op keeps focus');
    assert.equal(await previous.getAttribute('disabled'), null, 'multi-page boundary controls are not natively disabled');
    assert.equal(await previous.getAttribute('aria-disabled'), 'true');

    const next = page.locator('#project-catalog-next');
    for (const expected of [1, 2, 3]) {
      await next.click();
      assert.equal(await page.getByRole('group', {name:`Page ${expected + 1} of 4`}).count(), 1, 'the page indicator exposes its computed accessible name');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'project-catalog-next', 'accepted page changes retain pager focus');
      assert.equal(await next.getAttribute('disabled'), null, 'multi-page arrows remain natively enabled');
      assert.deepEqual(await projectIds(page), fixture(13).slice(expected * 4, expected * 4 + 4).map(project => project.id));
    }
    assert.equal(await page.locator('#project-catalog-page-status').innerText(), 'Page 4 of 4; projects 13 through 13 of 13');
    assert.equal(await next.getAttribute('aria-disabled'), 'true');
    await next.focus();
    await page.evaluate(() => document.querySelector('#project-catalog-next').click());
    assert.equal(await page.getByRole('group', {name:'Page 4 of 4'}).count(), 1, 'next at the last page is a no-op');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'project-catalog-next', 'a boundary no-op keeps focus');

    const reached = [];
    for (let pageIndex = 3; pageIndex >= 0; pageIndex--) {
      reached.unshift(...await projectIds(page));
      if (pageIndex) await previous.click();
    }
    assert.deepEqual(reached, fixture(13).map(project => project.id), 'every project is reachable over the catalog pages');
    assert.deepEqual(await page.evaluate(() => window.__journeyProjects.presentation.chapters.map(item => item.id)), ['Catalog_0'], 'catalog reachability does not expand the orbit');
    for (let pageIndex = 0; pageIndex < 3; pageIndex++) await next.click();

    const beforePageChange = await setStageProgress(page, .86);
    await page.waitForTimeout(100);
    const movingSun = await readStageState(page);
    assert.ok(movingSun.shaderTime > beforePageChange.shaderTime, 'the procedural lava shader animates when motion is allowed');
    const bounds = await projectedSolarBounds(page, .86);
    assert.ok(Math.abs(bounds.width / 1440 - .40) < .04, `wide solar bounds should be about 40vw: ${JSON.stringify(bounds)}`);
    assert.ok(Math.abs(bounds.height / 900 - .50) < .06, `wide solar bounds should be about 50vh: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.left >= 1440 * .03 && bounds.left <= 1440 * .07
      && bounds.right >= 1440 * .43 && bounds.right <= 1440 * .47, `wide solar bounds sit around x=5–45vw: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.top >= 900 * .22 && bounds.top <= 900 * .28
      && bounds.bottom >= 900 * .72 && bounds.bottom <= 900 * .78, `wide solar bounds sit around y=25–75vh: ${JSON.stringify(bounds)}`);
    const steadyEnd = await setStageProgress(page, .899);
    assert.deepEqual(steadyEnd.camera, beforePageChange.camera, 'camera remains fixed throughout the catalog stage');
    assert.deepEqual(steadyEnd.solarScale, beforePageChange.solarScale, 'Sun scale remains fixed throughout the catalog stage');
    assert.ok(steadyEnd.sunOpacity > .999 && beforePageChange.sunOpacity > .999, 'Sun opacity remains full through .90');
    assert.ok(steadyEnd.shaderOpacity > .999 && beforePageChange.shaderOpacity > .999, 'shader opacity remains full through .90');
    const returnStart = await setStageProgress(page, .90);
    assert.deepEqual(returnStart.camera, beforePageChange.camera, 'the return begins without a camera jump at .90');
    assert.deepEqual(returnStart.solarScale, beforePageChange.solarScale, 'the return begins without a scale jump at .90');
    assert.ok(returnStart.sunOpacity > .999, 'Sun opacity remains full at the return boundary');
    const returning = await setStageProgress(page, .92);
    assert.notDeepEqual(returning.camera, beforePageChange.camera, 'camera movement occurs inside .90–.94');
    assert.ok(returning.sunOpacity > .35 && returning.sunOpacity < .65, 'Sun fades inside .90–.94');
    const returned = await setStageProgress(page, .94);
    assert.ok(returned.sunOpacity < .001, 'Sun is faded by the end of the return interval');

    const beforeLocal = await setStageProgress(page, .86);
    const beforeTrackHeight = await page.locator('#journey-track').evaluate(track => track.offsetHeight);
    await previous.click();
    await page.waitForFunction(() => Math.abs(window.__journeyScene.getDebugState().targetProgress - .86) < .001
      && document.querySelector('#project-catalog-page-status').innerText.includes('Page 3 of 4'));
    const afterPageChange = await readStageState(page);
    assert.ok(Math.abs(afterPageChange.localProgress - beforeLocal.localProgress) < .001, 'catalog paging preserves normalized stage-local progress');
    assert.deepEqual(afterPageChange.camera, beforeLocal.camera, 'catalog paging does not move the camera');
    assert.deepEqual(afterPageChange.solarScale, beforeLocal.solarScale, 'catalog paging does not scale the Sun');
    assert.equal(afterPageChange.sunOpacity, beforeLocal.sunOpacity, 'catalog paging does not fade the Sun');
    assert.equal(afterPageChange.shaderOpacity, beforeLocal.shaderOpacity, 'catalog paging does not fade the Sun shader');

    await page.evaluate(() => {
      const content = document.querySelector('#project-catalog-grid .project-card-content');
      const paragraph = document.createElement('p');
      paragraph.id = 'catalog-resize-copy';
      paragraph.textContent = 'Catalog content resize fixture. '.repeat(32);
      const media = document.createElement('img');
      media.id = 'catalog-resize-media';
      media.alt = 'Resized catalog media';
      media.style.cssText = 'display:block;width:100%;height:320px;object-fit:cover';
      media.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" fill="%23f60"/%3E%3C/svg%3E';
      content.append(paragraph, media);
    });
    await page.waitForFunction(height => document.querySelector('#journey-track').offsetHeight > height + 100, beforeTrackHeight);
    await page.waitForFunction(() => Math.abs(window.__journeyScene.getDebugState().targetProgress - .86) < .001
      && document.querySelector('#catalog-resize-media')?.complete);
    const afterResize = await readStageState(page);
    assert.ok(Math.abs(afterResize.localProgress - beforeLocal.localProgress) < .001, 'content and media resize preserves normalized stage-local progress');
    assert.deepEqual(afterResize.camera, beforeLocal.camera, 'content and media resize does not move the camera');
    assert.deepEqual(afterResize.solarScale, beforeLocal.solarScale, 'content and media resize does not scale the Sun');
    assert.equal(afterResize.sunOpacity, beforeLocal.sunOpacity, 'content and media resize does not fade the Sun');
    assert.equal(afterResize.shaderOpacity, beforeLocal.shaderOpacity, 'content and media resize does not fade the Sun shader');
    await next.click();

    const columns = await page.evaluate(() => getComputedStyle(document.querySelector('#project-catalog-grid')).gridTemplateColumns.split(' ').length);
    assert.equal(columns, 2, 'wide layouts use two catalog columns');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the wide catalog has no horizontal overflow');

    await page.locator('#project-card-Catalog_12 .project-card-action').click();
    await page.waitForFunction(() => document.querySelector('#project-detail dialog')?.open);
    assert.equal(await page.locator('#project-detail-heading').innerText(), 'Catalog Project 12', 'a non-orbit catalog item opens its full details');
    assert.equal(await page.locator('.study-kicker').first().innerText(), 'Project 13 / 13', 'detail counters retain the full manifest count');
    assert.equal(await page.locator('.study-next a').count(), 1, 'full-manifest details retain previous/next links');
    await page.locator('.study-close').click();
    await page.waitForFunction(() => !document.querySelector('#project-detail dialog')?.open);
    assert.deepEqual(errors, []);
    console.log('PASS multi-page catalog exposes all 13 projects independently of the one-project orbit, with guarded focusable boundaries and atomic status');
    await page.close();
  }

  for (const viewport of [{width:1024, height:768}, {width:390, height:844}, {width:844, height:390}]) {
    const {page, errors} = await openScenario({count:5, orbitCount:0, viewport});
    const layout = await page.evaluate(() => ({
      columns:getComputedStyle(document.querySelector('#project-catalog-grid')).gridTemplateColumns.split(' ').length,
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth,
    }));
    assert.equal(layout.columns, 1, `${viewport.width}px layout uses one column`);
    assert.ok(layout.scrollWidth <= layout.innerWidth, `${viewport.width}px layout has no horizontal overflow`);
    if (viewport.width === 844) {
      for (const action of await page.locator('#project-catalog-grid .project-card-action').all()) {
        await action.focus();
        await page.waitForTimeout(30);
        assert.ok((await readStageState(page)).progress < .90, 'each short-landscape card action is reachable before return');
      }
      await page.locator('#project-catalog-next').focus();
      await page.waitForTimeout(30);
      const pagerState = await readStageState(page);
      assert.ok(pagerState.progress < .90, 'the short-landscape pager is reachable before return');
      const pagerBox = await page.locator('#project-catalog-pager').boundingBox();
      assert.ok(pagerBox && pagerBox.y < viewport.height && pagerBox.y + pagerBox.height > 0, 'short-landscape pager intersects the viewport');
    }
    await page.close();
    assert.deepEqual(errors, []);
    console.log(`PASS catalog responsive layout ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`);
  }

  {
    const page = await browser.newPage({viewport:{width:1440, height:900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.route('**/assets/journey-v2/settings.json', route => route.fulfill({json:{orbitCount:1}}));
    await page.route('**/projects.json', route => route.fulfill({json:{projects:fixture(1)}}));
    await page.route('**/projects/**', route => route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#173040"/></svg>'}));
    await page.goto(`${base}#projects`);
    await ready(page);
    const first = await page.evaluate(() => ({
      reducedMotion:window.__journeyScene.getDebugState().reducedMotion,
      running:window.__journeyScene.getDebugState().animationRunning,
      time:window.__journeyScene.solarSunMaterial.uniforms.uTime.value,
    }));
    await page.waitForTimeout(120);
    const second = await page.evaluate(() => window.__journeyScene.solarSunMaterial.uniforms.uTime.value);
    assert.equal(first.reducedMotion, true);
    assert.equal(first.running, false);
    assert.equal(first.time, 0);
    assert.equal(second, first.time, 'the procedural Sun shader remains frozen under reduced motion');
    assert.deepEqual(errors, [], 'the procedural Sun shader compiles without browser errors');
    await page.close();
    console.log('PASS reduced motion freezes the procedural Sun shader');
  }
} finally {
  await browser.close();
}
