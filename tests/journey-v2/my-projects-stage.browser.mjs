import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';

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
  await page.emulateMedia({reducedMotion:'no-preference'});
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
      reducedMotion:state.reducedMotion,
      animationRunning:state.animationRunning,
      camera:state.camera,
      solarScale:scene.solar.scale.toArray(),
      sunOpacity:scene.getOrbitLayout().opacity,
      shaderOpacity:scene.solarSunMaterial.uniforms.uOpacity.value,
      shaderTime:scene.solarSunMaterial.uniforms.uTime.value,
      sunReveal:scene.solarSunMaterial.uniforms.uReveal.value,
    };
  });
}

function readCatalogVisibility(page) {
  return page.locator('#projects').evaluate(node => ({
    opacity:Number(getComputedStyle(node).opacity),
    inert:node.inert,
    ariaHidden:node.getAttribute('aria-hidden'),
  }));
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

function projectedSunBounds(page, progress) {
  return page.evaluate(progress => {
    const scene = window.__journeyScene;
    if (progress !== undefined) {
      scene.setProgress(progress, true);
      scene.frame(performance.now());
    }
    const Vector3 = scene.camera.position.constructor;
    scene.solar.updateMatrixWorld(true);
    scene.camera.updateMatrixWorld(true);
    const center = scene.solarSun.getWorldPosition(new Vector3());
    const scale = scene.solarSun.getWorldScale(new Vector3());
    const radius = scene.solarSun.geometry.parameters.radius * Math.min(scale.x, scale.y, scale.z);
    const right = new Vector3(1, 0, 0).applyQuaternion(scene.camera.quaternion);
    const up = new Vector3(0, 1, 0).applyQuaternion(scene.camera.quaternion);
    const points = [];
    for (let index = 0; index < 96; index++) {
      const angle = index / 96 * Math.PI * 2;
      const point = center.clone()
        .addScaledVector(right, Math.cos(angle) * radius)
        .addScaledVector(up, Math.sin(angle) * radius)
        .project(scene.camera);
      points.push({x:(point.x * .5 + .5) * innerWidth, y:(-point.y * .5 + .5) * innerHeight});
    }
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const projectedCenter = center.clone().project(scene.camera);
    return {
      center:{x:(projectedCenter.x * .5 + .5) * innerWidth, y:(-projectedCenter.y * .5 + .5) * innerHeight},
      left:Math.min(...xs), right:Math.max(...xs), top:Math.min(...ys), bottom:Math.max(...ys),
      width:Math.max(...xs) - Math.min(...xs), height:Math.max(...ys) - Math.min(...ys),
    };
  }, progress);
}

function decodePng(png) {
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const imageData = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (type === 'IHDR') {
      width = png.readUInt32BE(dataStart);
      height = png.readUInt32BE(dataStart + 4);
      bitDepth = png[dataStart + 8];
      colorType = png[dataStart + 9];
      interlace = png[dataStart + 12];
    } else if (type === 'IDAT') imageData.push(png.subarray(dataStart, dataStart + length));
    offset = dataStart + length + 4;
    if (type === 'IEND') break;
  }
  assert.equal(bitDepth, 8, 'browser screenshot uses 8-bit color');
  assert.ok(colorType === 2 || colorType === 6, `browser screenshot uses RGB or RGBA color, received ${colorType}`);
  assert.equal(interlace, 0, 'browser screenshot is not interlaced');
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowLength = width * bytesPerPixel;
  const raw = inflateSync(Buffer.concat(imageData));
  const pixels = Buffer.alloc(height * rowLength);
  const paeth = (left, above, upperLeft) => {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left : aboveDistance <= upperLeftDistance ? above : upperLeft;
  };
  for (let y = 0; y < height; y++) {
    const sourceRow = y * (rowLength + 1);
    const targetRow = y * rowLength;
    const filter = raw[sourceRow];
    for (let index = 0; index < rowLength; index++) {
      const left = index >= bytesPerPixel ? pixels[targetRow + index - bytesPerPixel] : 0;
      const above = y ? pixels[targetRow + index - rowLength] : 0;
      const upperLeft = y && index >= bytesPerPixel ? pixels[targetRow + index - rowLength - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft) : NaN;
      assert.ok(Number.isFinite(predictor), `PNG uses a supported row filter, received ${filter}`);
      pixels[targetRow + index] = (raw[sourceRow + 1 + index] + predictor) & 0xff;
    }
  }
  return {width, height, bytesPerPixel, pixels};
}

function measureSunRedCoverage(png, bounds) {
  const image = decodePng(png);
  const radius = Math.min(bounds.width, bounds.height) / 2;
  let diskPixels = 0, redPixels = 0;
  for (let y = Math.max(0, Math.floor(bounds.center.y - radius)); y < Math.min(image.height, Math.ceil(bounds.center.y + radius)); y++) {
    for (let x = Math.max(0, Math.floor(bounds.center.x - radius)); x < Math.min(image.width, Math.ceil(bounds.center.x + radius)); x++) {
      if ((x + .5 - bounds.center.x) ** 2 + (y + .5 - bounds.center.y) ** 2 > radius ** 2) continue;
      diskPixels++;
      const index = (y * image.width + x) * image.bytesPerPixel;
      const red = image.pixels[index], green = image.pixels[index + 1], blue = image.pixels[index + 2];
      if (red >= 185 && green <= 125 && blue <= 95 && red - green >= 70) redPixels++;
    }
  }
  return {redPixels, diskPixels, coverage:redPixels / diskPixels};
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
    const stageEntry = await setStageProgress(page, .535);
    const stageEntryBounds = await projectedSunBounds(page, .535);
    const stageMiddle = await setStageProgress(page, .72);
    assert.ok(Math.abs(stageEntry.progress - .535) < .0001, 'zero-orbit catalog follows the solar intro');
    assert.equal(stageEntry.sunReveal, 1, 'zero-orbit direct entry reveals the stage Sun detail');
    assert.ok(Math.abs(stageEntryBounds.center.x - 360) < 2 && Math.abs(stageEntryBounds.center.y - 450) < 2,
      `zero-orbit catalog centers the Sun in the left subject slot: ${JSON.stringify(stageEntryBounds)}`);
    assert.ok(Math.abs(stageEntryBounds.width - 270) < 2 && Math.abs(stageEntryBounds.height - 270) < 2,
      `zero-orbit catalog projects a round 30vh Sun: ${JSON.stringify(stageEntryBounds)}`);
    assert.deepEqual(stageMiddle.camera, stageEntry.camera, 'camera composition is settled at the zero-orbit stage entry');
    assert.deepEqual(stageMiddle.solarScale, stageEntry.solarScale, 'Sun scale stays fixed through the zero-orbit catalog stage');
    assert.equal(stageMiddle.sunReveal, stageEntry.sunReveal, 'shader reveal stays fixed through the zero-orbit catalog stage');
    assert.equal(stageMiddle.sunOpacity, stageEntry.sunOpacity, 'Sun stays fully bright throughout the zero-orbit catalog stage');
    assert.equal(stageMiddle.shaderOpacity, stageEntry.shaderOpacity, 'Sun shader stays fully bright throughout the zero-orbit catalog stage');
    assert.equal(stageEntry.sunOpacity, 1, 'Sun is fully bright when the zero-orbit stage begins');
    assert.equal(stageEntry.shaderOpacity, 1, 'Sun shader is fully bright when the zero-orbit stage begins');
    const stageEnd = await setStageProgress(page, .899);
    const stageEndBounds = await projectedSunBounds(page, .899);
    assert.deepEqual(stageEnd.camera, stageEntry.camera, 'camera composition stays fixed until the zero-orbit stage ends');
    assert.deepEqual(stageEndBounds, stageEntryBounds, 'the zero-orbit Sun projection stays fixed through .899');
    assert.deepEqual(stageEnd.solarScale, stageEntry.solarScale, 'Sun scale stays fixed until the zero-orbit stage ends');
    assert.equal(stageEnd.sunOpacity, 1, 'Sun remains fully bright through the zero-orbit stage end');
    assert.equal(stageEnd.shaderOpacity, 1, 'Sun shader remains fully bright through the zero-orbit stage end');
    assert.equal(stageEnd.sunReveal, 1, 'the molten reveal stays settled through .899');
    const zeroOrbitBoundary = await page.evaluate(() => {
      const scene = window.__journeyScene;
      document.activeElement?.blur();
      const read = () => {
        const panel = document.querySelector('#projects');
        return {opacity:Number(getComputedStyle(panel).opacity),inert:panel.inert,ariaHidden:panel.getAttribute('aria-hidden')};
      };
      scene.onProgress(.534975);
      const before = read();
      scene.onProgress(.534989);
      return {before,after:read()};
    });
    assert.equal(zeroOrbitBoundary.before.opacity, 0, 'the zero-orbit catalog stays hidden just before stage entry');
    assert.equal(zeroOrbitBoundary.after.opacity, 1, 'a tiny progress step across the zero-orbit boundary reveals the catalog');
    assert.equal(zeroOrbitBoundary.after.inert, false);
    await setStageProgress(page, .535);
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
    assert.equal(directStage.sunReveal, 1, 'direct catalog entry settles the shader reveal');
    const directSunBounds = await projectedSunBounds(page, .83);
    assert.ok(Math.abs(directSunBounds.center.x - 360) < 2 && Math.abs(directSunBounds.center.y - 450) < 2,
      `direct catalog entry puts the Sun in the left subject slot: ${JSON.stringify(directSunBounds)}`);
    assert.ok(Math.abs(directSunBounds.width - 270) < 2 && Math.abs(directSunBounds.height - 270) < 2,
      `direct catalog entry projects a round 30vh Sun: ${JSON.stringify(directSunBounds)}`);
    assert.ok(await page.evaluate(() => Boolean(document.querySelector('#project-mount').compareDocumentPosition(document.querySelector('#projects')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'orbit chapters precede the catalog section');
    assert.deepEqual(await projectIds(page), ['Catalog_0', 'Catalog_1', 'Catalog_2', 'Catalog_3']);

    const {beforeStage, afterStage} = await page.evaluate(() => {
      const scene = window.__journeyScene;
      document.activeElement?.blur();
      const read = () => {
        const panel = document.querySelector('#projects');
        return {opacity:Number(getComputedStyle(panel).opacity),inert:panel.inert,ariaHidden:panel.getAttribute('aria-hidden')};
      };
      scene.onProgress(.829975);
      const beforeStage = read();
      scene.onProgress(.829989);
      return {beforeStage,afterStage:read()};
    });
    assert.equal(beforeStage.opacity, 0, 'the catalog stays hidden just before its stage entry boundary');
    assert.equal(afterStage.opacity, 1, 'a tiny progress step across the stage boundary must reveal the catalog');
    assert.equal(afterStage.inert, false, 'the catalog becomes interactive as soon as it enters');
    assert.equal(afterStage.ariaHidden, 'false');
    await setStageProgress(page, .83);

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

    const orbitEntry = await setStageProgress(page, .565);
    const orbitOverview = await setStageProgress(page, .70);
    assert.deepEqual(orbitOverview.camera, orbitEntry.camera, 'the orbit overview is settled when the first chapter starts');
    assert.deepEqual(orbitOverview.solarScale, orbitEntry.solarScale, 'the solar model stops scaling at the first orbit chapter');
    const finalOrbitExit = await setStageProgress(page, .817);
    assert.deepEqual(finalOrbitExit.camera, orbitOverview.camera, 'the orbit overview remains steady until the final chapter content exits');
    assert.equal(finalOrbitExit.sunReveal, 0, 'molten detail stays hidden while the final orbit chapter remains visible');
    const orbitBounds = await projectedSolarBounds(page, .817);
    assert.ok(Math.abs(orbitBounds.width / 1440 - .40) < .04, `the orbit overview remains about 40vw wide before handoff: ${JSON.stringify(orbitBounds)}`);
    assert.ok(Math.abs(orbitBounds.height / 900 - .50) < .06, `the orbit overview remains about 50vh tall before handoff: ${JSON.stringify(orbitBounds)}`);
    const catalogEntry = await setStageProgress(page, .83);
    assert.notDeepEqual(catalogEntry.camera, finalOrbitExit.camera, 'the camera transitions after the orbit content exits');
    assert.equal(catalogEntry.sunReveal, 1, 'shader reveal reaches its final value at catalog entry');
    const catalogBounds = await projectedSunBounds(page, .83);
    assert.ok(Math.abs(catalogBounds.center.x - 360) < 2 && Math.abs(catalogBounds.center.y - 450) < 2,
      `wide catalog centers the Sun at 25vw / 50vh: ${JSON.stringify(catalogBounds)}`);
    assert.ok(Math.abs(catalogBounds.width - 270) < 2 && Math.abs(catalogBounds.height - 270) < 2,
      `wide catalog projects a round Sun at the 30vh cap: ${JSON.stringify(catalogBounds)}`);

    const beforePageChange = await setStageProgress(page, .86);
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__journeyScene.frame(performance.now()));
    const movingSun = await readStageState(page);
    assert.ok(movingSun.shaderTime > beforePageChange.shaderTime,
      `the procedural molten detail animates when motion is allowed: ${JSON.stringify({beforePageChange,movingSun})}`);
    assert.equal(movingSun.sunReveal, 1, 'the shader reveal remains settled throughout the catalog stage');
    const redCoverageSamples = [];
    for (const shaderTime of [0, 2, 5, 8]) {
      await page.evaluate(shaderTime => {
        const scene = window.__journeyScene;
        scene.setProgress(.86, true);
        scene.time = shaderTime;
        scene.previousTime = performance.now();
        scene.frame(performance.now());
      }, shaderTime);
      const boundsAtTime = await projectedSunBounds(page, .86);
      const coverage = measureSunRedCoverage(await page.locator('.journey-canvas').screenshot(), boundsAtTime);
      assert.ok(coverage.coverage >= .02 && coverage.coverage < .04,
        `red-orange detail stays visible and below 4% at uTime=${shaderTime}: ${JSON.stringify(coverage)}`);
      redCoverageSamples.push({shaderTime, coverage:Number((coverage.coverage * 100).toFixed(2))});
    }
    console.log(`PASS red accents stay within the 2–4% disk target across shader frames: ${JSON.stringify(redCoverageSamples)}`);
    // Keep the focused-panel accessibility override from masking its visual exit timing.
    await page.locator('.main-nav a[href="#about"]').focus();
    await setStageProgress(page, .895);
    const beforeReturn = await readCatalogVisibility(page);
    assert.deepEqual(beforeReturn, {opacity:1, inert:false, ariaHidden:'false'}, 'catalog remains fully visible and interactive through .895');
    const steadyEnd = await setStageProgress(page, .899);
    const steadyBounds = await projectedSunBounds(page, .899);
    assert.deepEqual(steadyEnd.camera, beforePageChange.camera, 'camera remains fixed throughout the catalog stage');
    assert.deepEqual(steadyBounds, catalogBounds, 'the projected Sun remains fixed from catalog entry through .899');
    assert.equal(steadyEnd.sunReveal, 1, 'shader detail remains fixed through .899');
    assert.deepEqual(steadyEnd.solarScale, beforePageChange.solarScale, 'Sun scale remains fixed throughout the catalog stage');
    assert.ok(steadyEnd.sunOpacity > .999 && beforePageChange.sunOpacity > .999, 'Sun opacity remains full through .90');
    assert.ok(steadyEnd.shaderOpacity > .999 && beforePageChange.shaderOpacity > .999, 'shader opacity remains full through .90');
    const returnStart = await setStageProgress(page, .90);
    assert.deepEqual(returnStart.camera, beforePageChange.camera, 'the return begins without a camera jump at .90');
    assert.deepEqual(returnStart.solarScale, beforePageChange.solarScale, 'the return begins without a scale jump at .90');
    assert.ok(returnStart.sunOpacity > .999, 'Sun opacity remains full at the return boundary');
    assert.equal(returnStart.sunReveal, 1, 'molten detail remains settled at the .90 return boundary');
    assert.deepEqual(await readCatalogVisibility(page), {opacity:1, inert:false, ariaHidden:'false'}, 'catalog remains visible and interactive at the .90 return boundary');
    const returning = await setStageProgress(page, .92);
    assert.notDeepEqual(returning.camera, beforePageChange.camera, 'camera movement occurs inside .90–.94');
    assert.ok(returning.sunOpacity > .35 && returning.sunOpacity < .65, 'Sun fades inside .90–.94');
    assert.ok(returning.sunReveal > .35 && returning.sunReveal < .65, 'molten detail follows the return camera blend');
    const catalogReturning = await readCatalogVisibility(page);
    assert.ok(catalogReturning.opacity > .35 && catalogReturning.opacity < .65, `catalog exit begins during .90–.94: ${JSON.stringify(catalogReturning)}`);
    assert.equal(catalogReturning.inert, false, 'catalog remains interactive while it is visibly returning');
    assert.equal(catalogReturning.ariaHidden, 'false');
    const returned = await setStageProgress(page, .94);
    assert.ok(returned.sunOpacity < .001, 'Sun is faded by the end of the return interval');
    assert.equal(returned.sunReveal, 0, 'molten detail is hidden after the return');
    assert.deepEqual(await readCatalogVisibility(page), {opacity:0, inert:true, ariaHidden:'true'}, 'catalog is hidden after the return completes');

    const beforeLocal = await setStageProgress(page, .86);
    const beforeTrackHeight = await page.locator('#journey-track').evaluate(track => track.offsetHeight);
    await previous.click();
    await page.waitForFunction(() => Math.abs(window.__journeyScene.getDebugState().targetProgress - .86) < .001
      && document.querySelector('#project-catalog-page-status').innerText.includes('Page 3 of 4'));
    const afterPageChange = await readStageState(page);
    const afterPageBounds = await projectedSunBounds(page, .86);
    assert.ok(Math.abs(afterPageChange.localProgress - beforeLocal.localProgress) < .001, 'catalog paging preserves normalized stage-local progress');
    assert.deepEqual(afterPageChange.camera, beforeLocal.camera, 'catalog paging does not move the camera');
    assert.deepEqual(afterPageBounds, catalogBounds, 'catalog paging leaves the projected Sun framing unchanged');
    assert.deepEqual(afterPageChange.solarScale, beforeLocal.solarScale, 'catalog paging does not scale the Sun');
    assert.equal(afterPageChange.sunOpacity, beforeLocal.sunOpacity, 'catalog paging does not fade the Sun');
    assert.equal(afterPageChange.shaderOpacity, beforeLocal.shaderOpacity, 'catalog paging does not fade the Sun shader');
    assert.equal(afterPageChange.sunReveal, beforeLocal.sunReveal, 'catalog paging does not change the shader reveal');

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
    const afterResizeBounds = await projectedSunBounds(page, .86);
    assert.ok(Math.abs(afterResize.localProgress - beforeLocal.localProgress) < .001, 'content and media resize preserves normalized stage-local progress');
    assert.deepEqual(afterResize.camera, beforeLocal.camera, 'content and media resize does not move the camera');
    assert.deepEqual(afterResizeBounds, catalogBounds, 'content and media remeasurement leaves the projected Sun framing unchanged');
    assert.deepEqual(afterResize.solarScale, beforeLocal.solarScale, 'content and media resize does not scale the Sun');
    assert.equal(afterResize.sunOpacity, beforeLocal.sunOpacity, 'content and media resize does not fade the Sun');
    assert.equal(afterResize.shaderOpacity, beforeLocal.shaderOpacity, 'content and media resize does not fade the Sun shader');
    assert.equal(afterResize.sunReveal, beforeLocal.sunReveal, 'content and media resize does not change the shader reveal');
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
    const sun = await projectedSunBounds(page, .535);
    const catalogBox = await page.locator('.project-index').boundingBox();
    const maxDiameter = Math.min(viewport.height * .30, viewport.width * .50);
    assert.equal(layout.columns, 1, `${viewport.width}px layout uses one column`);
    assert.ok(layout.scrollWidth <= layout.innerWidth, `${viewport.width}px layout has no horizontal overflow`);
    assert.ok(Math.abs(sun.width - sun.height) < 2, `${viewport.width}px Sun remains circular: ${JSON.stringify(sun)}`);
    assert.ok(sun.width <= maxDiameter + 2, `${viewport.width}px Sun fits the viewport size cap: ${JSON.stringify(sun)}`);
    if (viewport.width === 390) {
      assert.ok(Math.abs(sun.center.x - viewport.width * .5) < 2 && Math.abs(sun.center.y - viewport.height * .24) < 2,
        `portrait Sun centers above the catalog: ${JSON.stringify(sun)}`);
      assert.ok(catalogBox && sun.bottom + 16 < catalogBox.y,
        `portrait Sun clears the catalog heading: ${JSON.stringify({sun,catalogBox})}`);
    } else {
      assert.ok(Math.abs(sun.center.x - viewport.width * .25) < 2 && Math.abs(sun.center.y - viewport.height * .5) < 2,
        `split-layout Sun sits in the left subject slot: ${JSON.stringify(sun)}`);
      assert.ok(sun.right + 12 < viewport.width * .51,
        `split-layout Sun clears the right catalog: ${JSON.stringify(sun)}`);
    }
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
    const {page, errors} = await openScenario({count:1, orbitCount:1});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(() => window.__journeyScene.getDebugState().reducedMotion
      && window.__journeyScene.getDebugState().paused);
    await page.evaluate(() => {
      const scene = window.__journeyScene;
      document.body.classList.remove('is-reading');
      document.body.classList.add('has-journey');
      scene.setPaused(false);
      scene.setProgress(scene.projectLayout.projectsStageStart, true);
      scene.frame(performance.now());
    });
    const first = await page.evaluate(() => ({
      reducedMotion:window.__journeyScene.getDebugState().reducedMotion,
      running:window.__journeyScene.getDebugState().animationRunning,
      time:window.__journeyScene.solarSunMaterial.uniforms.uTime.value,
      reveal:window.__journeyScene.solarSunMaterial.uniforms.uReveal.value,
      target:window.__journeyScene.targetProgress,
      stageStart:window.__journeyScene.projectLayout.projectsStageStart,
      solarReveal:window.__journeyScene.solarReveal,
      paused:window.__journeyScene.getDebugState().paused,
    }));
    await page.waitForTimeout(120);
    const second = await page.evaluate(() => window.__journeyScene.solarSunMaterial.uniforms.uTime.value);
    assert.equal(first.reducedMotion, true);
    assert.equal(first.running, false);
    assert.equal(first.paused, false, 'the browser scene is unpaused for the reduced-motion stage check');
    assert.equal(first.time, 0);
    assert.equal(first.reveal, 1, `reduced motion still uses the reached catalog stage to reveal static molten detail: ${JSON.stringify(first)}`);
    assert.equal(second, first.time, 'the procedural Sun shader remains frozen under reduced motion');
    const bounds = await projectedSunBounds(page, .83);
    const redCoverage = measureSunRedCoverage(await page.locator('.journey-canvas').screenshot(), bounds);
    assert.ok(redCoverage.diskPixels > 1000, `the browser screenshot contains the visible Sun disk: ${JSON.stringify(redCoverage)}`);
    assert.ok(redCoverage.coverage >= .02 && redCoverage.coverage < .04,
      `reduced-motion red accents remain visible and under 4% of the Sun disk: ${JSON.stringify(redCoverage)}`);
    assert.deepEqual(errors, [], 'the procedural Sun shader compiles without browser errors');
    await page.close();
    console.log(`PASS reduced motion freezes shader time; red accents cover ${(redCoverage.coverage * 100).toFixed(2)}% of ${redCoverage.diskPixels} Sun pixels`);
  }
} finally {
  await browser.close();
}
