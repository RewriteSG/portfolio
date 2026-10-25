import assert from 'node:assert/strict';
import { buildScrollMetrics, scrollAtProgress } from '../../assets/journey-v2/project-layout.js';

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
    const {catalogCameraStart, projectsStageStart:start, projectsStageEnd:end} = scene.projectLayout;
    return {
      catalogCameraStart,
      progress:state.targetProgress,
      localProgress:(state.targetProgress - start) / (end - start),
      phase:state.phase,
      reducedMotion:state.reducedMotion,
      animationRunning:state.animationRunning,
      camera:state.camera,
      look:scene.look.toArray(),
      solarScale:scene.solar.scale.toArray(),
      sunMeshScale:scene.solarSun.scale.toArray(),
      sunOpacity:scene.getOrbitLayout().opacity,
      sunMaterialType:scene.solarSun.material.type,
      sunMaterialColor:scene.solarSun.material.color?.getHex() ?? null,
      sunHasUniforms:Boolean(scene.solarSun.material.uniforms),
      haloColor:scene.solar.children.find(child => child.isSprite && child.material.color.getHex() === 0xffcf88)?.material.color.getHex() ?? null,
      cloudMaterialType:scene.cloudMaterial.type,
      returnPhases:{
        returnStart:scene.projectLayout.returnStart,
        catalogFadeEnd:scene.projectLayout.catalogFadeEnd,
        earthArrival:scene.projectLayout.earthArrival,
        earthZoomStart:scene.projectLayout.earthZoomStart,
        earthZoomEnd:scene.projectLayout.earthZoomEnd,
        returnEnd:scene.projectLayout.returnEnd,
      },
    };
  });
}

async function readCameraScrollSpans(page, {floorBinding = false} = {}) {
  const input = await page.evaluate(() => {
    const scene = window.__journeyScene;
    const height = innerHeight;
    const panels = [...document.querySelectorAll('.scene-panel')].map(panel => {
      const start = Number(panel.dataset.start);
      const end = Number(panel.dataset.end);
      const configured = Number(panel.dataset.fade) || (panel.id === 'about' ? .025 : panel.id === 'contact' ? .027 : .012);
      return {
        start,
        end,
        fade:Number.isFinite(start) && Number.isFinite(end) && end > start
          ? Math.min(configured, (end - start) / 4)
          : configured,
        overflow:Math.max(0, panel.scrollHeight - panel.clientHeight),
        minimumDuration:panel.dataset.projectId ? Math.max(640, height * .9) : 0,
      };
    });
    return {
      height,
      layout:{
        catalogCameraStart:scene.projectLayout.catalogCameraStart,
        projectsStageStart:scene.projectLayout.projectsStageStart,
        returnStart:scene.projectLayout.returnStart,
        returnEnd:scene.projectLayout.returnEnd,
        earthArrival:scene.projectLayout.earthArrival,
        earthZoomStart:scene.projectLayout.earthZoomStart,
        earthZoomEnd:scene.projectLayout.earthZoomEnd,
      },
      panels,
    };
  });
  const metrics = buildScrollMetrics(input.layout, input.height, floorBinding ? [] : input.panels);
  return {
    height:input.height,
    catalog:scrollAtProgress(metrics, input.layout.projectsStageStart)
      - scrollAtProgress(metrics, input.layout.catalogCameraStart),
    return:scrollAtProgress(metrics, input.layout.returnEnd)
      - scrollAtProgress(metrics, input.layout.returnStart),
    earthHold:scrollAtProgress(metrics, input.layout.earthZoomStart)
      - scrollAtProgress(metrics, input.layout.earthArrival),
    earthZoom:scrollAtProgress(metrics, input.layout.earthZoomEnd)
      - scrollAtProgress(metrics, input.layout.earthZoomStart),
  };
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
    scene.solarSun.updateMatrixWorld(true);
    scene.camera.updateMatrixWorld(true);
    const center = scene.solarSun.getWorldPosition(new Vector3());
    const radius = scene.solarSun.geometry.parameters.radius;
    const localEye = scene.solarSun.worldToLocal(scene.camera.position.clone());
    const eyeDistance = localEye.length();
    const eyeDirection = localEye.clone().normalize();
    const tangentCenter = eyeDirection.clone().multiplyScalar(radius ** 2 / eyeDistance);
    const tangentRadius = radius * Math.sqrt(1 - (radius / eyeDistance) ** 2);
    const reference = Math.abs(eyeDirection.y) < .95 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const right = new Vector3().crossVectors(eyeDirection, reference).normalize();
    const up = new Vector3().crossVectors(eyeDirection, right).normalize();
    const points = [];
    for (let index = 0; index < 128; index++) {
      const angle = index / 128 * Math.PI * 2;
      const point = tangentCenter.clone()
        .addScaledVector(right, Math.cos(angle) * tangentRadius)
        .addScaledVector(up, Math.sin(angle) * tangentRadius)
        .applyMatrix4(scene.solarSun.matrixWorld)
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
      silhouette:points,
    };
  }, progress);
}

function projectedEarthBounds(page, progress) {
  return page.evaluate(progress => {
    const scene = window.__journeyScene;
    scene.setProgress(progress, true);
    scene.frame(performance.now());
    const earthSurface = scene.earth.group.children[0];
    const Vector3 = scene.camera.position.constructor;
    const radius = earthSurface.geometry.parameters.radius;
    earthSurface.updateMatrixWorld(true);
    scene.camera.updateMatrixWorld(true);
    const center = earthSurface.getWorldPosition(new Vector3());
    const localEye = earthSurface.worldToLocal(scene.camera.position.clone());
    const eyeDistance = localEye.length();
    const eyeDirection = localEye.clone().normalize();
    const tangentCenter = eyeDirection.clone().multiplyScalar(radius ** 2 / eyeDistance);
    const tangentRadius = radius * Math.sqrt(1 - (radius / eyeDistance) ** 2);
    const reference = Math.abs(eyeDirection.y) < .95 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const right = new Vector3().crossVectors(eyeDirection, reference).normalize();
    const up = new Vector3().crossVectors(eyeDirection, right).normalize();
    const points = [];
    for (let index = 0; index < 128; index++) {
      const angle = index / 128 * Math.PI * 2;
      const point = tangentCenter.clone()
        .addScaledVector(right, Math.cos(angle) * tangentRadius)
        .addScaledVector(up, Math.sin(angle) * tangentRadius)
        .applyMatrix4(earthSurface.matrixWorld)
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

function assertEarthInFrame(bounds, width, height, label) {
  assert.ok(bounds.width > 0 && bounds.height > 0, `${label} has a nonempty projected Earth: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.left >= 0 && bounds.top >= 0 && bounds.right <= width && bounds.bottom <= height,
    `${label} keeps Earth fully inside the viewport: ${JSON.stringify(bounds)}`);
}

function projectedPlanetBounds(page, projectId) {
  return page.evaluate(projectId => {
    const scene=window.__journeyScene;
    const index=scene.projectLayout.ids.indexOf(projectId);
    const sphere=scene.markerForIndex(index).planet;
    const Vector3=scene.camera.position.constructor;
    scene.solar.updateMatrixWorld(true);
    sphere.updateMatrixWorld(true);
    scene.camera.updateMatrixWorld(true);
    const points=[];
    const vertices=sphere.geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++) {
      const point=new Vector3().fromBufferAttribute(vertices,i).applyMatrix4(sphere.matrixWorld).project(scene.camera);
      points.push({x:(point.x*.5+.5)*innerWidth,y:(-point.y*.5+.5)*innerHeight});
    }
    const xs=points.map(point=>point.x),ys=points.map(point=>point.y);
    const actual={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
    const center=sphere.getWorldPosition(new Vector3());
    const radius=sphere.geometry.parameters.radius*sphere.getWorldScale(new Vector3()).x;
    const angle25=25*Math.PI/180;
    const cameraDistance=scene.camera.position.distanceTo(center);
    const apparentRadius=Math.asin(radius/cameraDistance);
    const content=document.querySelector('.study-page-content').getBoundingClientRect();
    return {
      bounds:actual,
      apparentRatio:Math.tan(apparentRadius)/Math.tan(25*Math.PI/180),
      contentLeft:content.left,
    };
  }, projectId);
}

try {
  {
    const {page, errors} = await openScenario({count:0, orbitCount:0});
    assert.equal(await page.locator('#project-catalog-pager').evaluate(node => node.hidden), true, 'empty catalog hides the pager');
    assert.equal(await page.locator('#project-catalog-grid .project-card').count(), 0);
    assert.equal(await page.locator('#project-catalog-page-status').innerText(), 'No projects to show yet.');
    assert.deepEqual(await page.evaluate(() => ({orbit:window.__journeyProjects.presentation.orbitCount, chapters:window.__journeyProjects.presentation.chapters.length, details:window.__journeyProjects.presentation.details.length})), {orbit:0, chapters:0, details:0});
    const zeroOrbitStage = await readStageState(page);
    const zeroOrbitSpans = await readCameraScrollSpans(page);
    assert.equal(zeroOrbitStage.catalogCameraStart, .48, 'zero-orbit camera handoff starts at .48');
    assert.ok(Math.abs(zeroOrbitStage.progress - .535) < .0001, `zero-orbit catalog starts at .535, received ${zeroOrbitStage.progress}`);
    assert.ok(zeroOrbitSpans.catalog >= 1.5 * zeroOrbitSpans.height - 1e-7,
      `zero-orbit catalog handoff retains its 1.5× floor: ${JSON.stringify(zeroOrbitSpans)}`);
    assert.ok(zeroOrbitSpans.return >= 4.5 * zeroOrbitSpans.height - 1e-7,
      `zero-orbit return has the 4.5× floor: ${JSON.stringify(zeroOrbitSpans)}`);
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
    assert.deepEqual(stageEntry.returnPhases, {
      returnStart:.90, catalogFadeEnd:.91, earthArrival:.922, earthZoomStart:.926, earthZoomEnd:.93, returnEnd:.94,
    });
    assert.deepEqual({
      type:stageEntry.sunMaterialType,
      color:stageEntry.sunMaterialColor,
      hasUniforms:stageEntry.sunHasUniforms,
      haloColor:stageEntry.haloColor,
      cloudMaterialType:stageEntry.cloudMaterialType,
    }, {
      type:'MeshBasicMaterial', color:0xffd8a0, hasUniforms:false,
      haloColor:0xffcf88, cloudMaterialType:'ShaderMaterial',
    }, 'the Sun is a flat yellow surface with a separate halo while cloud shading remains');
    assert.ok(Math.abs(stageEntryBounds.center.x - 360) < 2 && Math.abs(stageEntryBounds.center.y - 450) < 2,
      `zero-orbit catalog centers the Sun in the left subject slot: ${JSON.stringify(stageEntryBounds)}`);
    assert.ok(Math.abs(stageEntryBounds.width - 297) < 2 && Math.abs(stageEntryBounds.height - 297) < 2,
      `zero-orbit catalog projects a round 33vh Sun: ${JSON.stringify(stageEntryBounds)}`);
    assert.ok(Math.abs(stageEntryBounds.width - stageEntryBounds.height) < 2,
      `zero-orbit catalog keeps the perspective-correct Sun silhouette circular: ${JSON.stringify(stageEntryBounds)}`);
    assert.ok(stageMiddle.camera.every((value,index) => Math.abs(value-stageEntry.camera[index])<1e-9), 'camera composition is settled at the zero-orbit stage entry');
    assert.deepEqual(stageMiddle.solarScale, stageEntry.solarScale, 'Sun scale stays fixed through the zero-orbit catalog stage');
    assert.equal(stageMiddle.sunMaterialColor, stageEntry.sunMaterialColor, 'the flat Sun color stays fixed through the zero-orbit catalog stage');
    assert.equal(stageMiddle.sunOpacity, stageEntry.sunOpacity, 'Sun stays fully bright throughout the zero-orbit catalog stage');
    assert.equal(stageEntry.sunOpacity, 1, 'Sun is fully bright when the zero-orbit stage begins');
    const stageEnd = await setStageProgress(page, .899);
    const stageEndBounds = await projectedSunBounds(page, .899);
    assert.ok(stageEnd.camera.every((value,index) => Math.abs(value-stageEntry.camera[index])<1e-9), 'camera composition stays fixed until the zero-orbit stage ends');
    assert.ok(Math.abs(stageEndBounds.center.x-stageEntryBounds.center.x)<.1 && Math.abs(stageEndBounds.center.y-stageEntryBounds.center.y)<.1
      && Math.abs(stageEndBounds.width-stageEntryBounds.width)<.1 && Math.abs(stageEndBounds.height-stageEntryBounds.height)<.1,
      'the zero-orbit Sun projection stays fixed through .899');
    assert.deepEqual(stageEnd.solarScale, stageEntry.solarScale, 'Sun scale stays fixed until the zero-orbit stage ends');
    assert.equal(stageEnd.sunOpacity, 1, 'Sun remains fully bright through the zero-orbit stage end');
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

    const zeroReturnStart = await setStageProgress(page, .90);
    const zeroFadeMiddle = await setStageProgress(page, .905);
    const zeroFadeEnd = await setStageProgress(page, .91);
    assert.deepEqual(zeroFadeMiddle.camera, zeroReturnStart.camera, 'zero-orbit camera stays in the catalog composition while it fades');
    assert.deepEqual(zeroFadeMiddle.look, zeroReturnStart.look, 'zero-orbit camera aim stays fixed while the catalog fades');
    assert.equal((await readCatalogVisibility(page)).opacity, 0, 'zero-orbit catalog fade completes at .91');
    assert.deepEqual(zeroFadeEnd.camera, zeroReturnStart.camera, 'zero-orbit camera remains held through the fade-complete boundary');
    assert.deepEqual(zeroFadeEnd.look, zeroReturnStart.look);
    const zeroTravel = await setStageProgress(page, .916);
    assert.notDeepEqual(zeroTravel.camera, zeroFadeEnd.camera, 'zero-orbit camera travel starts after the catalog fade');
    const zeroArrival = await setStageProgress(page, .922);
    const zeroArrivalBounds = await projectedEarthBounds(page, .922);
    const zeroHoldMiddle = await setStageProgress(page, .924);
    const zeroHoldMiddleBounds = await projectedEarthBounds(page, .924);
    const zeroHoldEnd = await setStageProgress(page, .925);
    const zeroHoldEndBounds = await projectedEarthBounds(page, .925);
    const zeroZoomStart = await setStageProgress(page, .926);
    const zeroZoomStartBounds = await projectedEarthBounds(page, .926);
    const zeroZoomMiddle = await setStageProgress(page, .928);
    const zeroZoomMiddleBounds = await projectedEarthBounds(page, .928);
    const zeroZoomEnd = await setStageProgress(page, .93);
    const zeroZoomEndBounds = await projectedEarthBounds(page, .93);
    assert.ok(zeroArrival.camera.some((value, index) => Math.abs(value - zeroTravel.camera[index]) > .1), 'zero-orbit travel reaches the Earth-facing pose');
    assertEarthInFrame(zeroArrivalBounds, 1440, 900, 'zero-orbit Earth arrival');
    assertEarthInFrame(zeroZoomMiddleBounds, 1440, 900, 'zero-orbit mid-zoom');
    assertEarthInFrame(zeroZoomEndBounds, 1440, 900, 'zero-orbit zoom completion');
    assert.deepEqual(zeroHoldMiddle.camera, zeroArrival.camera, 'zero-orbit Earth pose holds at .924');
    assert.deepEqual(zeroHoldEnd.camera, zeroArrival.camera, 'zero-orbit Earth pose holds at .925');
    assert.deepEqual(zeroZoomStart.camera, zeroArrival.camera, 'zero-orbit zoom starts after the arrival hold at .926');
    assert.deepEqual(zeroHoldMiddleBounds, zeroArrivalBounds, 'zero-orbit Earth bounds stay fixed through .924');
    assert.deepEqual(zeroHoldEndBounds, zeroArrivalBounds, 'zero-orbit Earth bounds stay fixed through .925');
    assert.deepEqual(zeroZoomStartBounds, zeroArrivalBounds, 'zero-orbit Earth bounds stay fixed at the .926 zoom start');
    assert.ok(zeroArrivalBounds.width < zeroZoomMiddleBounds.width && zeroZoomMiddleBounds.width < zeroZoomEndBounds.width,
      `zero-orbit Earth grows during the distinct zoom: ${JSON.stringify({zeroArrivalBounds,zeroZoomMiddleBounds,zeroZoomEndBounds})}`);
    assert.equal(zeroZoomEnd.returnPhases.earthZoomEnd, .93);
    assert.equal(zeroZoomEnd.returnPhases.earthZoomStart, .926);
    const zeroReverseTravel = await setStageProgress(page, .916);
    const zeroReverseFade = await setStageProgress(page, .905);
    assert.notDeepEqual(zeroReverseTravel.camera, zeroZoomMiddle.camera, 'zero-orbit camera scrubs back from zoom toward catalog');
    assert.deepEqual(zeroReverseFade.camera, zeroFadeMiddle.camera, 'zero-orbit reverse scrub returns to the same fade camera pose');
    assert.equal((await readCatalogVisibility(page)).opacity, .5, 'zero-orbit catalog fade reverses with scroll');
    assert.deepEqual(errors, []);
    console.log('PASS zero-orbit catalog and Earth return phases scrub in order through arrival, zoom, and reverse scroll');
    await page.close();
  }

  {
    const {page, errors} = await openScenario({count:13, orbitCount:1});
    assert.deepEqual(await page.evaluate(() => ({orbit:window.__journeyProjects.presentation.orbitCount, chapters:window.__journeyProjects.presentation.chapters.length, controls:window.__journeyProjects.presentation.controls.length, details:window.__journeyProjects.presentation.details.length})), {orbit:1, chapters:1, controls:1, details:13});
    const directStage = await readStageState(page);
    const orbitSpans = await readCameraScrollSpans(page);
    assert.equal(directStage.catalogCameraStart, .818, 'orbit camera handoff starts at .818');
    assert.ok(Math.abs(directStage.progress - .83) < .0001, `direct #projects hash starts after the featured orbit at .83, received ${directStage.progress}`);
    assert.ok(orbitSpans.catalog >= 1.5 * orbitSpans.height - 1e-7,
      `orbit catalog handoff retains its 1.5× floor: ${JSON.stringify(orbitSpans)}`);
    assert.ok(orbitSpans.return >= 4.5 * orbitSpans.height - 1e-7,
      `orbit return has the 4.5× floor: ${JSON.stringify(orbitSpans)}`);
    const floorBindingSpans = await readCameraScrollSpans(page, {floorBinding:true});
    assert.ok(Math.abs(floorBindingSpans.return - 4.5 * floorBindingSpans.height) < 1e-7,
      `floor-binding return span is exactly 4.5× viewport height: ${JSON.stringify(floorBindingSpans)}`);
    assert.ok(Math.abs(floorBindingSpans.earthHold - .45 * floorBindingSpans.height) < 1e-7,
      `floor-binding Earth hold spans .45× viewport height: ${JSON.stringify(floorBindingSpans)}`);
    assert.ok(Math.abs(floorBindingSpans.earthZoom - .45 * floorBindingSpans.height) < 1e-7,
      `floor-binding Earth zoom spans .45× viewport height: ${JSON.stringify(floorBindingSpans)}`);
    assert.equal(directStage.sunMaterialType, 'MeshBasicMaterial', 'direct catalog entry uses a flat Sun surface');
    assert.equal(directStage.sunMaterialColor, 0xffd8a0);
    const directSunBounds = await projectedSunBounds(page, .83);
    assert.ok(Math.abs(directSunBounds.center.x - 360) < 2 && Math.abs(directSunBounds.center.y - 450) < 2,
      `direct catalog entry puts the Sun in the left subject slot: ${JSON.stringify(directSunBounds)}`);
    assert.ok(Math.abs(directSunBounds.width - 297) < 2 && Math.abs(directSunBounds.height - 297) < 2,
      `direct catalog entry projects a round 33vh Sun: ${JSON.stringify(directSunBounds)}`);
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
    assert.deepEqual(finalOrbitExit.solarScale, orbitOverview.solarScale, 'the orbit overview keeps the shared solar-group scale unchanged');
    const orbitBounds = await projectedSolarBounds(page, .817);
    assert.ok(Math.abs(orbitBounds.width / 1440 - .40) < .04, `the orbit overview remains about 40vw wide before handoff: ${JSON.stringify(orbitBounds)}`);
    assert.ok(Math.abs(orbitBounds.height / 900 - .50) < .06, `the orbit overview remains about 50vh tall before handoff: ${JSON.stringify(orbitBounds)}`);
    const catalogEntry = await setStageProgress(page, .83);
    assert.notDeepEqual(catalogEntry.camera, finalOrbitExit.camera, 'the camera transitions after the orbit content exits');
    assert.deepEqual(catalogEntry.solarScale, finalOrbitExit.solarScale, 'catalog framing leaves the shared solar-group transform unchanged');
    assert.notDeepEqual(catalogEntry.sunMeshScale, finalOrbitExit.sunMeshScale, 'roundness compensation is confined to the Sun mesh');
    const catalogBounds = await projectedSunBounds(page, .83);
    assert.ok(Math.abs(catalogBounds.center.x - 360) < 2 && Math.abs(catalogBounds.center.y - 450) < 2,
      `wide catalog centers the Sun at 25vw / 50vh: ${JSON.stringify(catalogBounds)}`);
    assert.ok(Math.abs(catalogBounds.width - 297) < 2 && Math.abs(catalogBounds.height - 297) < 2,
      `wide catalog projects a round Sun at the 33vh cap: ${JSON.stringify(catalogBounds)}`);
    assert.ok(Math.abs(catalogBounds.width - catalogBounds.height) < 2,
      `wide catalog uses the perspective-correct sphere silhouette: ${JSON.stringify(catalogBounds)}`);

    const beforePageChange = await setStageProgress(page, .86);
    assert.equal(beforePageChange.sunMaterialType, 'MeshBasicMaterial');
    assert.equal(beforePageChange.sunMaterialColor, 0xffd8a0);
    assert.equal(beforePageChange.sunHasUniforms, false, 'Sun surface has no shader uniforms or animated reveal state');
    assert.equal(beforePageChange.haloColor, 0xffcf88, 'the independent soft halo remains warm colored');
    assert.equal(beforePageChange.cloudMaterialType, 'ShaderMaterial', 'unrelated cloud shading remains intact');
    // Verify the keyboard focus handoff before allowing the normal-motion catalog fade.
    await next.focus();
    await page.keyboard.press('Tab');
    const keyboardFocus = await page.evaluate(() => ({
      insideCatalog:document.querySelector('#projects').contains(document.activeElement),
      focusVisible:document.activeElement.matches(':focus-visible'),
    }));
    assert.deepEqual(keyboardFocus, {insideCatalog:true, focusVisible:true}, 'keyboard navigation leaves visible focus inside the catalog');
    await setStageProgress(page, .895);
    const beforeReturn = await readCatalogVisibility(page);
    assert.deepEqual(beforeReturn, {opacity:1, inert:false, ariaHidden:'false'}, 'catalog remains fully visible and interactive through .895');
    const steadyEnd = await setStageProgress(page, .899);
    const steadyBounds = await projectedSunBounds(page, .899);
    assert.deepEqual(steadyEnd.camera, beforePageChange.camera, 'camera remains fixed throughout the catalog stage');
    assert.deepEqual(steadyBounds, catalogBounds, 'the projected Sun remains fixed from catalog entry through .899');
    assert.deepEqual(steadyEnd.solarScale, beforePageChange.solarScale, 'Sun scale remains fixed throughout the catalog stage');
    assert.ok(steadyEnd.sunOpacity > .999 && beforePageChange.sunOpacity > .999, 'Sun opacity remains full through .90');
    const scrollBeforeHandoff = await page.evaluate(() => scrollY);
    const returnStart = await setStageProgress(page, .90);
    assert.deepEqual(returnStart.camera, beforePageChange.camera, 'the return begins without a camera jump at .90');
    assert.deepEqual(returnStart.solarScale, beforePageChange.solarScale, 'the return begins without a scale jump at .90');
    assert.ok(returnStart.sunOpacity > .999, 'Sun opacity remains full at the return boundary');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scroll-cue', 'keyboard focus moves to the visible continuation link at .90');
    assert.equal(await page.evaluate(() => scrollY), scrollBeforeHandoff, 'the keyboard focus handoff does not change the scroll position');
    assert.deepEqual(await readCatalogVisibility(page), {opacity:1, inert:false, ariaHidden:'false'}, 'catalog remains visible and interactive at the .90 return boundary');
    const fadeMiddle = await setStageProgress(page, .905);
    const catalogFadeMiddle = await readCatalogVisibility(page);
    assert.ok(catalogFadeMiddle.opacity > .45 && catalogFadeMiddle.opacity < .55, `catalog fades during .90–.91: ${JSON.stringify(catalogFadeMiddle)}`);
    assert.equal(catalogFadeMiddle.inert, false, 'catalog remains interactive while it is visibly fading');
    assert.deepEqual(fadeMiddle.camera, returnStart.camera, 'camera holds still while catalog presentation fades');
    const fadeComplete = await setStageProgress(page, .91);
    assert.deepEqual(fadeComplete.camera, returnStart.camera, 'camera remains held through the named fade-complete boundary');
    assert.deepEqual(fadeComplete.look, returnStart.look, 'camera aim remains held through the catalog fade');
    assert.deepEqual(await readCatalogVisibility(page), {opacity:0, inert:true, ariaHidden:'true'}, 'catalog is inert and hidden once its fade completes');
    assert.equal(await page.locator('.return-message').getAttribute('data-start'), '0.91', 'the return message starts only after the catalog fade completes');
    const travel = await setStageProgress(page, .916);
    assert.notDeepEqual(travel.camera, fadeComplete.camera, 'camera travel starts only after the catalog fade');
    const arrival = await setStageProgress(page, .922);
    const arrivalBounds = await projectedEarthBounds(page, .922);
    const holdMiddle = await setStageProgress(page, .924);
    const holdMiddleBounds = await projectedEarthBounds(page, .924);
    const holdLate = await setStageProgress(page, .925);
    const holdLateBounds = await projectedEarthBounds(page, .925);
    const zoomStart = await setStageProgress(page, .926);
    const zoomStartBounds = await projectedEarthBounds(page, .926);
    const zoomMiddle = await setStageProgress(page, .928);
    const zoomMiddleBounds = await projectedEarthBounds(page, .928);
    const zoomComplete = await setStageProgress(page, .93);
    const zoomCompleteBounds = await projectedEarthBounds(page, .93);
    assertEarthInFrame(arrivalBounds, 1440, 900, 'orbit Earth arrival');
    assertEarthInFrame(holdMiddleBounds, 1440, 900, 'orbit Earth hold midpoint');
    assertEarthInFrame(holdLateBounds, 1440, 900, 'orbit Earth hold end');
    assertEarthInFrame(zoomStartBounds, 1440, 900, 'orbit Earth zoom start');
    assertEarthInFrame(zoomMiddleBounds, 1440, 900, 'orbit mid-zoom');
    assertEarthInFrame(zoomCompleteBounds, 1440, 900, 'orbit zoom completion');
    assert.ok(arrivalBounds.width < zoomMiddleBounds.width && zoomMiddleBounds.width < zoomCompleteBounds.width,
      `Earth grows through a distinct zoom after arrival: ${JSON.stringify({arrivalBounds,zoomMiddleBounds,zoomCompleteBounds})}`);
    assert.notDeepEqual(arrival.camera, travel.camera, 'the camera reaches the Earth-facing arrival pose at .922');
    assert.deepEqual(holdMiddle.camera, arrival.camera, 'the arrived camera pose holds through .924');
    assert.deepEqual(holdLate.camera, arrival.camera, 'the arrived camera pose holds through .925');
    assert.deepEqual(zoomStart.camera, arrival.camera, 'the zoom begins after the identical arrival pose at .926');
    assert.deepEqual(holdMiddleBounds, arrivalBounds, 'Earth bounds stay fixed through .924');
    assert.deepEqual(holdLateBounds, arrivalBounds, 'Earth bounds stay fixed through .925');
    assert.deepEqual(zoomStartBounds, arrivalBounds, 'Earth bounds remain at arrival size at .926');
    assert.equal(zoomComplete.returnPhases.earthZoomStart, .926);
    assert.equal(zoomComplete.returnPhases.earthZoomEnd, .93);
    const returned = await setStageProgress(page, .94);
    assert.ok(returned.sunOpacity < .001, 'Sun is faded by the end of the return interval');
    assert.equal(returned.phase, 'city', 'the established Contact/city scene starts at .94');
    assert.deepEqual(await readCatalogVisibility(page), {opacity:0, inert:true, ariaHidden:'true'}, 'catalog is hidden after the return completes');

    const reverseZoom = await setStageProgress(page, .928);
    const reverseHold = await setStageProgress(page, .925);
    const reverseTravel = await setStageProgress(page, .916);
    const reverseFade = await setStageProgress(page, .905);
    assert.deepEqual(reverseZoom.camera, zoomMiddle.camera, 'reverse scrubbing returns to the same zoom pose');
    assert.deepEqual(reverseHold.camera, holdLate.camera, 'reverse scrubbing returns to the held Earth arrival pose');
    assert.deepEqual(reverseTravel.camera, travel.camera, 'reverse scrubbing returns to the same travel pose');
    assert.deepEqual(reverseFade.camera, fadeMiddle.camera, 'reverse scrubbing holds the catalog composition during fade');
    assert.ok(Math.abs((await readCatalogVisibility(page)).opacity - .5) < .001, 'catalog fade reverses with scroll progress');

    await setStageProgress(page, .86);
    await previous.click();
    assert.equal(await page.evaluate(() => document.activeElement.matches(':focus-visible')), false, 'pointer focus is not keyboard-visible');
    await setStageProgress(page, .905);
    assert.ok((await readCatalogVisibility(page)).opacity < .55, 'pointer focus does not pin the catalog while it fades');
    await setStageProgress(page, .91);
    assert.equal((await readCatalogVisibility(page)).inert, true, 'pointer-focused catalog becomes inert when its fade completes');
    await setStageProgress(page, .86);
    await next.click();
    assert.equal(await page.locator('#project-catalog-page-status').innerText(), 'Page 4 of 4; projects 13 through 13 of 13');

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
    assert.equal(afterPageChange.sunMaterialColor, beforeLocal.sunMaterialColor, 'catalog paging does not change the flat Sun color');

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
    assert.equal(afterResize.sunMaterialColor, beforeLocal.sunMaterialColor, 'content and media resize does not change the flat Sun color');
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

  for (const viewport of [
    {width:1440,height:900},
    {width:1024,height:768},
    {width:390,height:844},
    {width:667,height:375},
    {width:760,height:390},
    {width:761,height:390},
    {width:844,height:390},
  ]) {
    const {page, errors} = await openScenario({count:5, orbitCount:0, viewport});
    const layout = await page.evaluate(() => ({
      columns:getComputedStyle(document.querySelector('#project-catalog-grid')).gridTemplateColumns.split(' ').length,
      cardMediaHeight:parseFloat(getComputedStyle(document.querySelector('.project-card-media')).height),
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth,
    }));
    const sun = await projectedSunBounds(page, .535);
    const catalogBox = await page.locator('.project-index').boundingBox();
    const stacked = viewport.width <= 760;
    const subjectWidth = stacked ? viewport.width*.55 : viewport.width*.50-Math.min(24,viewport.width*.04)*2;
    const priorSubjectWidth = stacked ? viewport.width*.50 : subjectWidth;
    const maxDiameter = Math.min(viewport.height*.33, subjectWidth);
    const priorDiameter = Math.min(viewport.height*.30, priorSubjectWidth);
    const catalogLayout = await page.locator('.project-index').evaluate(node => {
      const rect=node.getBoundingClientRect();
      const expectedGutter=parseFloat(getComputedStyle(document.querySelector('.masthead')).paddingLeft);
      return {x:rect.x,right:rect.right,expectedGutter};
    });
    assert.equal(layout.columns, viewport.width>1200 ? 2 : 1, `${viewport.width}px catalog uses the expected responsive column count`);
    if (viewport.height <= 500) {
      assert.ok(Math.abs(layout.cardMediaHeight-94)<1, `${viewport.width}px short-landscape cards keep 94px media: ${JSON.stringify(layout)}`);
    }
    assert.ok(layout.scrollWidth <= layout.innerWidth, `${viewport.width}px layout has no horizontal overflow`);
    assert.ok(Math.abs(sun.width - sun.height) < 2, `${viewport.width}px Sun remains circular: ${JSON.stringify(sun)}`);
    assert.ok(Math.abs(sun.width-maxDiameter)<2, `${viewport.width}px Sun reaches its clamped .33h/.55w surface target: ${JSON.stringify({sun,maxDiameter})}`);
    const sunGrowth=sun.width/priorDiameter;
    if (maxDiameter/priorDiameter >= 1.08) {
      assert.ok(sunGrowth>=1.08 && sunGrowth<=1.12, `${viewport.width}px Sun surface grows 1.10x excluding its halo: ${JSON.stringify({sun,sunGrowth,priorDiameter,maxDiameter})}`);
    } else {
      assert.ok(Math.abs(sunGrowth-1)<.02, `${viewport.width}px width cap preserves the prior Sun size: ${JSON.stringify({sun,sunGrowth})}`);
    }
    if (stacked) {
      assert.ok(Math.abs(sun.center.x - viewport.width * .5) < 2 && Math.abs(sun.center.y - viewport.height * .24) < 2,
        `stacked Sun centers above the catalog at ${viewport.width}x${viewport.height}: ${JSON.stringify(sun)}`);
      assert.ok(catalogBox && catalogBox.y-sun.bottom >= Math.max(24,viewport.width*.03),
        `stacked Sun surface clears the catalog heading at ${viewport.width}x${viewport.height}: ${JSON.stringify({sun,catalogBox})}`);
      assert.ok(Math.abs(catalogLayout.x-catalogLayout.expectedGutter)<1 && Math.abs(viewport.width-catalogLayout.right-catalogLayout.expectedGutter)<1,
        `stacked catalog remains within safe gutters at ${viewport.width}x${viewport.height}: ${JSON.stringify(catalogLayout)}`);
    } else {
      assert.ok(Math.abs(sun.center.x - viewport.width * .25) < 2 && Math.abs(sun.center.y - viewport.height * .5) < 2,
        `split-layout Sun sits in the left subject slot: ${JSON.stringify(sun)}`);
      assert.ok(catalogBox && Math.abs(catalogBox.x-viewport.width*.48)<1,
        `split-layout catalog starts at 48vw: ${JSON.stringify({catalogBox,viewport})}`);
      assert.ok(Math.abs(viewport.width-catalogLayout.right-catalogLayout.expectedGutter)<1,
        `split-layout catalog keeps the right safe-area gutter: ${JSON.stringify(catalogLayout)}`);
      assert.ok(catalogBox && catalogBox.x-sun.right >= viewport.width*.06-2,
        `split-layout Sun clears the right catalog: ${JSON.stringify({sun,catalogBox})}`);
    }
    const arrivalBounds = await projectedEarthBounds(page, .922);
    const zoomMiddleBounds = await projectedEarthBounds(page, .928);
    const zoomEndBounds = await projectedEarthBounds(page, .93);
    assertEarthInFrame(arrivalBounds, viewport.width, viewport.height, `${viewport.width}px Earth arrival`);
    assertEarthInFrame(zoomMiddleBounds, viewport.width, viewport.height, `${viewport.width}px Earth mid-zoom`);
    assertEarthInFrame(zoomEndBounds, viewport.width, viewport.height, `${viewport.width}px Earth zoom completion`);
    assert.ok(arrivalBounds.width < zoomMiddleBounds.width && zoomMiddleBounds.width < zoomEndBounds.width,
      `${viewport.width}px Earth visibly grows through zoom: ${JSON.stringify({arrivalBounds,zoomMiddleBounds,zoomEndBounds})}`);
    await setStageProgress(page, .535);
    if (viewport.width === 667) {
      const asyncFocusAndCheck = async (locator, label) => {
        await locator.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        const focus = await locator.evaluate(node => {
          const rect=node.getBoundingClientRect();
          const style=getComputedStyle(node);
          return {
            active:document.activeElement===node,
            focusVisible:node.matches(':focus-visible'),
            visibility:style.visibility,
            opacity:Number(style.opacity),
            outlineStyle:style.outlineStyle,
            outlineWidth:parseFloat(style.outlineWidth),
            left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
          };
        });
        const catalogVisibility=await readCatalogVisibility(page);
        const state=await readStageState(page);
        assert.equal(focus.active,true,`${label} receives keyboard focus`);
        assert.equal(focus.focusVisible,true,`${label} exposes its keyboard focus state`);
        assert.equal(focus.visibility,'visible',`${label} remains visible`);
        assert.ok(focus.opacity>.99,`${label} is not faded: ${JSON.stringify(focus)}`);
        assert.ok(focus.outlineStyle!=='none' && focus.outlineWidth>0,`${label} keeps a visible focus outline: ${JSON.stringify(focus)}`);
        assert.ok(focus.left<viewport.width && focus.right>0 && focus.top<viewport.height && focus.bottom>0,
          `${label} intersects the viewport: ${JSON.stringify(focus)}`);
        assert.deepEqual(catalogVisibility,{opacity:1,inert:false,ariaHidden:'false'},`${label} stays in a visible, interactive catalog`);
        assert.ok(state.progress<state.returnPhases.returnStart,
          `${label} is reachable before return ${state.returnPhases.returnStart}: ${state.progress}`);
      };

      const firstPageActions=page.locator('#project-catalog-grid .project-card-action');
      for (let index=0;index<await firstPageActions.count();index++) {
        await asyncFocusAndCheck(firstPageActions.nth(index),`667x375 first-page card action ${index+1}`);
      }
      const next=page.locator('#project-catalog-next');
      assert.equal(await next.isEnabled(),true,'the first catalog page has an enabled Next control');
      await asyncFocusAndCheck(next,'667x375 first-page Next control');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelectorAll('#project-catalog-grid .project-card-action').length === 1);
      const secondPageAction=page.locator('#project-catalog-grid .project-card-action');
      await asyncFocusAndCheck(secondPageAction,'667x375 second-page card action');
      const previous=page.locator('#project-catalog-previous');
      assert.equal(await previous.isEnabled(),true,'the later catalog page has an enabled Previous control');
      await asyncFocusAndCheck(previous,'667x375 later-page Previous control');
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

    const focusScenario=await openScenario({count:5,orbitCount:1,viewport});
    await focusScenario.page.evaluate(() => document.querySelector('#project-card-Catalog_0 .project-card-action').click());
    await focusScenario.page.waitForFunction(() => document.querySelector('#project-detail dialog')?.open);
    await focusScenario.page.evaluate(() => {
      const scene=window.__journeyScene;
      scene.setPaused(false);
      scene.setReducedMotion(true);
      scene.setProjectFocus('Catalog_0');
      scene.frame(performance.now());
    });
    const planet=await projectedPlanetBounds(focusScenario.page,'Catalog_0');
    assert.ok(Math.abs(planet.bounds.right-viewport.width*.42)<Math.max(4,viewport.width*.005),
      `${viewport.width}px focused planet right limb sits at 42vw: ${JSON.stringify(planet)}`);
    assert.ok(planet.bounds.left<0,`${viewport.width}px focused planet keeps the intended left crop: ${JSON.stringify(planet)}`);
    assert.ok(planet.apparentRatio>=1.08 && planet.apparentRatio<=1.12,
      `${viewport.width}px focused planet surface grows 1.10x from its old 25-degree frame: ${JSON.stringify(planet)}`);
    if (viewport.width>760) {
      assert.ok(planet.contentLeft-planet.bounds.right>=viewport.width*.06-2,
        `${viewport.width}px focused planet keeps the 6vw reader-copy gap: ${JSON.stringify(planet)}`);
    }
    await focusScenario.page.close();
    assert.deepEqual(focusScenario.errors,[]);
  }

  {
    const {page, errors} = await openScenario({count:5, orbitCount:1});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(() => window.__journeyScene.setReducedMotion(true));
    await page.waitForFunction(() => window.__journeyScene.getDebugState().reducedMotion);
    await page.locator('#project-catalog-next').focus();
    await page.keyboard.press('Tab');
    const focusedCatalog = await page.evaluate(() => ({
      insideCatalog:document.querySelector('#projects').contains(document.activeElement),
      focusVisible:document.activeElement.matches(':focus-visible'),
    }));
    assert.deepEqual(focusedCatalog, {insideCatalog:true, focusVisible:true}, 'reduced-motion keyboard focus remains in the static catalog before return');
    const reducedScrollBeforeSnap = await page.evaluate(() => scrollY);
    await page.evaluate(() => {
      const scene = window.__journeyScene;
      document.body.classList.remove('is-reading');
      document.body.classList.add('has-journey');
      scene.setPaused(false);
    });
    const reducedStart = await setStageProgress(page, .90);
    const reducedArrival = await setStageProgress(page, .922);
    const reducedZoomEnd = await setStageProgress(page, .93);
    assert.equal(reducedStart.reducedMotion, true);
    assert.equal(reducedStart.animationRunning, false);
    assert.equal(reducedStart.sunMaterialType, 'MeshBasicMaterial');
    assert.equal(reducedStart.sunHasUniforms, false);
    assert.deepEqual(reducedArrival.camera, reducedStart.camera, 'reduced motion holds the catalog camera through Earth arrival');
    assert.deepEqual(reducedZoomEnd.camera, reducedStart.camera, 'reduced motion does not animate the Earth zoom');
    assert.deepEqual(await readCatalogVisibility(page), {opacity:1, inert:false, ariaHidden:'false'}, 'reduced motion keeps the complete catalog static before .94');
    const reducedBeforeSnap = await setStageProgress(page, .939);
    assert.deepEqual(reducedBeforeSnap.camera, reducedStart.camera, 'reduced-motion camera remains static through .939');
    const reducedContact = await setStageProgress(page, .94);
    assert.equal(reducedContact.phase, 'city', 'reduced motion snaps to the Contact/city pose at .94');
    assert.notDeepEqual(reducedContact.camera, reducedStart.camera, 'the Contact/city pose is reached by a snap, not animated travel');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scroll-cue', 'reduced-motion focus transfers immediately before the .94 snap');
    assert.equal(await page.evaluate(() => scrollY), reducedScrollBeforeSnap, 'reduced-motion focus transfer does not change scroll position');
    assert.deepEqual(errors, []);
    await page.close();
    console.log('PASS reduced motion holds the catalog camera until .94, then snaps to the city with focus preserved');
  }
} finally {
  await browser.close();
}
