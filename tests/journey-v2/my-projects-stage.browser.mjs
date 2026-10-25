import assert from 'node:assert/strict';
import { buildScrollMetrics, progressAtScroll, scrollAtProgress } from '../../assets/journey-v2/project-layout.js';

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
    const background = scene.scene.background;
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
      cloudCover:state.cloudCover,
      backgroundHex:background.getHex(),
      backgroundColor:[background.r, background.g, background.b],
      distantStarOpacity:scene.distantStars.material.opacity,
      distantStarsVisible:scene.distantStars.visible,
      cityVisible:state.cityVisible,
      earthVisible:state.earthVisible,
      returnPhases:{
        returnStart:scene.projectLayout.returnStart,
        catalogFadeEnd:scene.projectLayout.catalogFadeEnd,
        earthArrival:scene.projectLayout.earthArrival,
        cloudRevealStart:scene.projectLayout.cloudRevealStart,
        cloudRevealEnd:scene.projectLayout.cloudRevealEnd,
        earthZoomStart:scene.projectLayout.earthZoomStart,
        earthZoomEnd:scene.projectLayout.earthZoomEnd,
        returnEnd:scene.projectLayout.returnEnd,
      },
    };
  });
}

function readReturnInkState(page) {
  return page.evaluate(() => {
    const color = selector => getComputedStyle(document.querySelector(selector)).color;
    return {
      active:document.body.classList.contains('is-return-city-ink'),
      contact:document.body.classList.contains('is-contact'),
      title:color('.return-message > p'),
      subtitle:color('.return-message > span'),
      footer:color('.journey-footer'),
      footerPlace:color('.footer-place'),
      sceneLabel:color('.scene-label'),
      scrollCue:color('.scroll-cue'),
      progressTrack:getComputedStyle(document.querySelector('.page-progress')).backgroundColor,
      progressFill:getComputedStyle(document.querySelector('.page-progress > span')).backgroundColor,
    };
  });
}

function readCityChromeState(page) {
  return page.evaluate(() => {
    const style = selector => getComputedStyle(document.querySelector(selector));
    const values = selector => {
      const current = style(selector);
      return {
        color:current.color,
        opacity:Number(current.opacity),
        display:current.display,
        outlineColor:current.outlineColor,
        backgroundColor:current.backgroundColor,
      };
    };
    return {
      returnInk:document.body.classList.contains('is-return-city-ink'),
      contact:document.body.classList.contains('is-contact'),
      masthead:values('.masthead'),
      wordmark:values('.wordmark'),
      navLink:values('.main-nav > a[href="#contact"]'),
      menuToggle:values('#menu-toggle'),
      caption:values('.identity-caption'),
      footer:values('.journey-footer'),
      footerPlace:values('.footer-place'),
      sceneLabel:values('.scene-label'),
      scrollCue:values('.scroll-cue'),
      coordinate:values('.footer-place > span'),
      menu:values('.more-menu'),
      menuAction:values('#reading-toggle'),
    };
  });
}

function readFocusedControlState(page) {
  return page.evaluate(() => {
    const current = document.activeElement;
    const style = getComputedStyle(current);
    return {
      id:current.id,
      href:current.getAttribute('href'),
      focusVisible:current.matches(':focus-visible'),
      outlineColor:style.outlineColor,
      outlineStyle:style.outlineStyle,
    };
  });
}

function readBackdropMidpoint(page) {
  return page.evaluate(() => {
    const current = window.__journeyScene.scene.background;
    const expected = current.clone().set(0x050711)
      .lerp(new current.constructor(0xbccfcf), .5);
    return [expected.r, expected.g, expected.b];
  });
}

function expectedDistantStarOpacity(progress) {
  const t = Math.max(0, Math.min(1, (progress - .90) / (.94 - .90)));
  const cityBlend = t * t * (3 - 2 * t);
  return .66 * (1 - cityBlend);
}

function assertColorClose(actual, expected, label, tolerance = .000001) {
  assert.ok(actual.every((component, index) => Math.abs(component - expected[index]) < tolerance),
    `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

async function waitForStableSceneAndRoot(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    let previous = '';
    let stableFrames = 0;
    const startedAt = performance.now();
    const sample = () => {
      const state = window.__journeyScene.getDebugState();
      const current = [scrollY, state.targetProgress.toFixed(8), state.progress.toFixed(8), document.documentElement.scrollHeight].join(':');
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 3) resolve();
      else if (performance.now() - startedAt > 5000) reject(new Error('scene/root state did not stabilize after resize'));
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
}

async function setRootScrollProgress(page, progress, rounding = 'ceil') {
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
      },
      panels,
    };
  });
  const metrics = buildScrollMetrics(input.layout, input.height, input.panels);
  const exactScrollTop = scrollAtProgress(metrics, progress);
  const scrollTop = Math[rounding](exactScrollTop);
  const expectedProgress = progressAtScroll(metrics, scrollTop);
  await page.evaluate(top => scrollTo({top, behavior:'instant'}), scrollTop);
  await page.waitForFunction(expectedTop => Math.round(scrollY) === expectedTop, scrollTop);
  await page.waitForFunction(expected => {
    const state = window.__journeyScene.getDebugState();
    return Math.abs(state.targetProgress - expected) < .0000001
      && Math.abs(state.progress - state.targetProgress) < .00000001;
  }, expectedProgress);
  return page.evaluate(expected => {
    const state = window.__journeyScene.getDebugState();
    return {
      scrollY,
      expectedProgress:expected,
      targetProgress:state.targetProgress,
      renderedProgress:state.progress,
      returnInk:document.body.classList.contains('is-return-city-ink'),
      contact:document.body.classList.contains('is-contact'),
    };
  }, expectedProgress);
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
    assert.ok(zeroOrbitSpans.return >= 9 * zeroOrbitSpans.height - 1e-7,
      `zero-orbit return has the 9× floor: ${JSON.stringify(zeroOrbitSpans)}`);
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
      returnStart:.90, catalogFadeEnd:.91, earthArrival:.922,
      cloudRevealStart:.924, cloudRevealEnd:.928,
      earthZoomStart:.926, earthZoomEnd:.93, returnEnd:.94,
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

    const cloudCheckpoints = [.90, .922, .924, .925, .926, .928, .93, .938, .94, .958, .976];
    const forwardCloudStates = new Map();
    for (const progress of cloudCheckpoints) forwardCloudStates.set(progress, await setStageProgress(page, progress));
    for (const progress of [.90, .922, .924]) {
      assert.equal(forwardCloudStates.get(progress).cloudCover, 0, `cloud cover remains absent through ${progress}`);
    }
    for (const progress of [.90, .922]) {
      assert.equal(forwardCloudStates.get(progress).backgroundHex, 0x050711,
        `space backdrop remains exact through ${progress}`);
    }
    const midpointColor = await readBackdropMidpoint(page);
    assertColorClose(forwardCloudStates.get(.924).backgroundColor, midpointColor,
      'backdrop uses the Three.Color linear-space midpoint at .924');
    assert.equal(forwardCloudStates.get(.926).backgroundHex, 0xbccfcf,
      'backdrop reaches exact city color at the zoom start .926');
    assert.ok(Math.abs(forwardCloudStates.get(.926).cloudCover - .5) < .001,
      'cloud cover is halfway revealed at the zoom start .926');
    assert.ok(Math.abs(forwardCloudStates.get(.928).cloudCover - 1) < .001,
      'cloud cover reaches full at the Earth zoom midpoint .928');
    for (const progress of [.928, .93, .938, .94]) {
      assert.ok(Math.abs(forwardCloudStates.get(progress).cloudCover - 1) < .001,
        `cloud cover is full at ${progress}`);
    }
    for (const progress of [.926, .928, .93, .938, .94, .958, .976]) {
      assert.equal(forwardCloudStates.get(progress).backgroundHex, 0xbccfcf,
        `city backdrop stays exact through the cloud hold/fade at ${progress}`);
    }
    for (const progress of cloudCheckpoints) {
      const state = forwardCloudStates.get(progress);
      assert.ok(Math.abs(state.distantStarOpacity - expectedDistantStarOpacity(progress)) < .000001,
        `distant stars retain their independent .90–.94 fade at ${progress}`);
      assert.equal(state.distantStarsVisible, progress < .94,
        `distant-star visibility retains its .94 boundary at ${progress}`);
    }
    assert.equal(forwardCloudStates.get(.938).earthVisible, true, 'Earth remains the visible scene through the covered hold');
    assert.equal(forwardCloudStates.get(.938).cityVisible, false, 'city remains hidden until the covered .94 arrival');
    assert.equal(forwardCloudStates.get(.94).phase, 'city', 'Contact/city starts at .94 under full cloud cover');
    assert.equal(forwardCloudStates.get(.94).earthVisible, false, 'Earth leaves the scene at the .94 Contact/city boundary');
    assert.equal(forwardCloudStates.get(.94).cityVisible, true, 'city is ready beneath the cloud veil at .94');
    assert.ok(Math.abs(forwardCloudStates.get(.958).cloudCover - .5) < .001,
      'the existing city reveal fade reaches its midpoint at .958');
    await setStageProgress(page, .958);
    const contactOpacity = await page.locator('#contact').evaluate(node => Number(getComputedStyle(node).opacity));
    assert.ok(contactOpacity > .5, `Contact remains legible above the cloud fade at .958: ${contactOpacity}`);
    assert.equal(forwardCloudStates.get(.976).cloudCover, 0, 'cloud cover clears by .976');
    for (const progress of [...cloudCheckpoints].reverse()) {
      const reverse = await setStageProgress(page, progress);
      assert.equal(reverse.cloudCover, forwardCloudStates.get(progress).cloudCover,
        `reverse scrub restores the same cloud cover at ${progress}`);
      assert.equal(reverse.backgroundHex, forwardCloudStates.get(progress).backgroundHex,
        `reverse scrub restores the same backdrop at ${progress}`);
      assertColorClose(reverse.backgroundColor, forwardCloudStates.get(progress).backgroundColor,
        `reverse scrub restores the same backdrop color at ${progress}`);
      assert.equal(reverse.distantStarOpacity, forwardCloudStates.get(progress).distantStarOpacity,
        `reverse scrub restores the same star opacity at ${progress}`);
      assert.deepEqual(reverse.camera, forwardCloudStates.get(progress).camera,
        `reverse scrub restores the same camera pose at ${progress}`);
    }
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
    assert.ok(orbitSpans.return >= 9 * orbitSpans.height - 1e-7,
      `orbit return has the 9× floor: ${JSON.stringify(orbitSpans)}`);
    const floorBindingSpans = await readCameraScrollSpans(page, {floorBinding:true});
    assert.ok(Math.abs(floorBindingSpans.return - 9 * floorBindingSpans.height) < 1e-7,
      `floor-binding return span is exactly 9× viewport height: ${JSON.stringify(floorBindingSpans)}`);
    assert.ok(Math.abs(floorBindingSpans.earthHold - .9 * floorBindingSpans.height) < 1e-7,
      `floor-binding Earth hold spans .9× viewport height: ${JSON.stringify(floorBindingSpans)}`);
    assert.ok(Math.abs(floorBindingSpans.earthZoom - .9 * floorBindingSpans.height) < 1e-7,
      `floor-binding Earth zoom spans .9× viewport height: ${JSON.stringify(floorBindingSpans)}`);
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
    const zoomState = await setStageProgress(page, .926);
    assert.ok(Math.abs(zoomState.cloudCover - .5) < .001,
      `${viewport.width}px cloud cover is halfway revealed at zoom start .926`);
    if (viewport.width === 390) {
      await page.setViewportSize({width:412,height:844});
      await page.waitForFunction(() => Math.abs(window.__journeyScene.getDebugState().targetProgress - .926) < .001
        && Math.abs(window.__journeyScene.getDebugState().cloudCover - .5) < .001);
      const afterViewportResize = await readStageState(page);
      assert.ok(Math.abs(afterViewportResize.progress - zoomState.progress) < .001,
        'mobile viewport resize preserves normalized progress at zoom start');
      assert.ok(Math.abs(afterViewportResize.cloudCover - zoomState.cloudCover) < .001,
        'mobile viewport resize preserves synchronized cloud cover');
      assertColorClose(afterViewportResize.backgroundColor, zoomState.backgroundColor,
        'mobile viewport resize preserves the backdrop color at .926', .0002);
      assert.equal(afterViewportResize.backgroundHex, zoomState.backgroundHex,
        'mobile viewport resize preserves the completed backdrop color');
      assert.ok(Math.abs(afterViewportResize.distantStarOpacity - zoomState.distantStarOpacity) < .0001,
        'mobile viewport resize preserves independent distant-star opacity');
      await page.setViewportSize(viewport);
      await page.waitForFunction(() => {
        const state = window.__journeyScene.getDebugState();
        return Math.abs(state.progress - state.targetProgress) < .00000001;
      });
      // Let resize-driven root remapping finish before direct progress test injection.
      await waitForStableSceneAndRoot(page);
    }
    await setStageProgress(page, .9279999999999999);
    assert.equal((await readReturnInkState(page)).active, true,
      `${viewport.width}x${viewport.height} treats the rounded scroll representation of .928 as the city-ink boundary`);
    const contrastForward = new Map();
    for (const progress of [.926, .928, .938, .94]) {
      await setStageProgress(page, progress);
      contrastForward.set(progress, await readReturnInkState(page));
    }
    assert.equal(contrastForward.get(.926).active, false,
      `${viewport.width}x${viewport.height} keeps the light return ink below .928`);
    assert.equal(contrastForward.get(.926).title, 'rgb(239, 244, 237)',
      `${viewport.width}x${viewport.height} keeps the existing pale return title at .926`);
    assert.equal(contrastForward.get(.928).active, true,
      `${viewport.width}x${viewport.height} enables city ink when full cloud cover completes at .928`);
    assert.equal(contrastForward.get(.928).contact, false,
      `${viewport.width}x${viewport.height} leaves Contact inactive during the return ink band`);
    assert.equal(contrastForward.get(.928).title, 'rgb(35, 65, 57)');
    assert.equal(contrastForward.get(.928).subtitle, 'rgb(24, 50, 41)');
    assert.equal(contrastForward.get(.928).footer, 'rgb(24, 50, 41)');
    assert.equal(contrastForward.get(.928).footerPlace, 'rgb(24, 50, 41)');
    assert.equal(contrastForward.get(.928).sceneLabel, 'rgb(24, 50, 41)');
    assert.equal(contrastForward.get(.928).scrollCue, 'rgb(24, 50, 41)');
    assert.equal(contrastForward.get(.928).progressFill, 'rgb(69, 111, 96)');
    const progressTrackChannels = contrastForward.get(.928).progressTrack.match(/[\d.]+/g).map(Number);
    assert.deepEqual(progressTrackChannels.slice(0, 3), [66, 98, 83],
      `${viewport.width}x${viewport.height} uses Contact green for the temporary progress track`);
    assert.ok(progressTrackChannels[3] > .12 && progressTrackChannels[3] < .14,
      `${viewport.width}x${viewport.height} keeps the progress track translucent`);
    assert.equal(contrastForward.get(.938).active, true,
      `${viewport.width}x${viewport.height} retains city ink through .938`);
    assert.equal(contrastForward.get(.938).subtitle, 'rgb(24, 50, 41)',
      `${viewport.width}x${viewport.height} uses dark subtitle ink through .938`);
    assert.deepEqual(contrastForward.get(.938), contrastForward.get(.928),
      `${viewport.width}x${viewport.height} keeps the same contrast treatment through the band`);
    assert.equal(contrastForward.get(.94).active, false,
      `${viewport.width}x${viewport.height} removes temporary city ink at .94`);
    assert.equal(contrastForward.get(.94).contact, true,
      `${viewport.width}x${viewport.height} hands off to Contact at .94`);
    if (viewport.width === 390) {
      const belowCloudEnd = await setRootScrollProgress(page, .928, 'floor');
      assert.ok(belowCloudEnd.expectedProgress < .928,
        `390x844 floor pixel remains below .928: ${JSON.stringify(belowCloudEnd)}`);
      assert.equal(belowCloudEnd.returnInk, false,
        `390x844 root scroll keeps light ink below .928: ${JSON.stringify(belowCloudEnd)}`);
      const aboveCloudEnd = await setRootScrollProgress(page, .928, 'ceil');
      assert.ok(aboveCloudEnd.expectedProgress >= .928,
        `390x844 ceil pixel reaches the .928 band: ${JSON.stringify(aboveCloudEnd)}`);
      assert.equal(aboveCloudEnd.returnInk, true,
        `390x844 root scroll enables city ink at .928: ${JSON.stringify(aboveCloudEnd)}`);
      const belowContact = await setRootScrollProgress(page, .94, 'floor');
      assert.ok(belowContact.expectedProgress < .94,
        `390x844 floor pixel remains below .94: ${JSON.stringify(belowContact)}`);
      assert.equal(belowContact.returnInk, true,
        `390x844 root scroll retains city ink below .94: ${JSON.stringify(belowContact)}`);
      assert.equal(belowContact.contact, false,
        `390x844 Contact remains inactive below .94: ${JSON.stringify(belowContact)}`);
      await setRootScrollProgress(page, .938, 'ceil');
      const aboveContact = await setRootScrollProgress(page, .94, 'ceil');
      assert.ok(aboveContact.expectedProgress >= .94,
        `390x844 ceil pixel reaches Contact at .94: ${JSON.stringify(aboveContact)}`);
      assert.equal(aboveContact.returnInk, false,
        `390x844 root scroll clears city ink at .94: ${JSON.stringify(aboveContact)}`);
      assert.equal(aboveContact.contact, true,
        `390x844 root scroll activates Contact at .94: ${JSON.stringify(aboveContact)}`);
      const reverseContact = await setRootScrollProgress(page, .938, 'ceil');
      assert.equal(reverseContact.returnInk, true,
        `390x844 reverse scrub restores city ink below .94: ${JSON.stringify(reverseContact)}`);
      assert.equal(reverseContact.contact, false,
        `390x844 reverse scrub restores the return state below .94: ${JSON.stringify(reverseContact)}`);
      const reverseCloud = await setRootScrollProgress(page, .928, 'ceil');
      assert.equal(reverseCloud.returnInk, true,
        `390x844 reverse scrub retains city ink above .928: ${JSON.stringify(reverseCloud)}`);
      const reverseBeforeCloud = await setRootScrollProgress(page, .928, 'floor');
      assert.equal(reverseBeforeCloud.returnInk, false,
        `390x844 reverse scrub restores light ink below .928: ${JSON.stringify(reverseBeforeCloud)}`);
      await setRootScrollProgress(page, .535, 'ceil');
    }
    for (const progress of [.938, .928, .926]) {
      await setStageProgress(page, progress);
      const reverse = await readReturnInkState(page);
      assert.deepEqual(reverse, contrastForward.get(progress),
        `${viewport.width}x${viewport.height} reverse scrub restores the same contrast state at ${progress}`);
    }
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
    const reducedCloudStart = await setStageProgress(page, .924);
    const reducedZoomStart = await setStageProgress(page, .926);
    const reducedCloudEnd = await setStageProgress(page, .928);
    const reducedZoomEnd = await setStageProgress(page, .93);
    assert.equal(reducedStart.reducedMotion, true);
    assert.equal(reducedStart.animationRunning, false);
    assert.equal(reducedStart.sunMaterialType, 'MeshBasicMaterial');
    assert.equal(reducedStart.sunHasUniforms, false);
    assert.deepEqual(reducedArrival.camera, reducedStart.camera, 'reduced motion holds the catalog camera through Earth arrival');
    assert.deepEqual(reducedZoomEnd.camera, reducedStart.camera, 'reduced motion does not animate the Earth zoom');
    assert.equal(reducedStart.cloudCover, 0, 'reduced motion starts with the veil hidden');
    assert.equal(reducedArrival.cloudCover, 0, 'reduced motion keeps the veil hidden through arrival');
    assert.equal(reducedCloudStart.cloudCover, 0, 'reduced motion keeps the veil hidden at its reveal start');
    assert.equal(reducedZoomStart.cloudCover, 0, 'reduced motion keeps the veil hidden at zoom start');
    assert.equal(reducedCloudEnd.cloudCover, 0, 'reduced motion keeps the veil hidden at its reveal end');
    assert.equal(reducedZoomEnd.cloudCover, 0, 'reduced motion does not animate the veil with the zoom');
    assert.equal((await readReturnInkState(page)).active, false,
      'reduced motion does not show the temporary city ink while the backdrop remains in space');
    for (const state of [reducedStart, reducedArrival, reducedCloudStart, reducedZoomStart, reducedCloudEnd, reducedZoomEnd]) {
      assert.equal(state.backgroundHex, 0x050711, 'reduced motion holds the exact space backdrop before .94');
      assert.equal(state.distantStarOpacity, .66, 'reduced motion preserves the space star opacity before .94');
    }
    assert.deepEqual(await readCatalogVisibility(page), {opacity:1, inert:false, ariaHidden:'false'}, 'reduced motion keeps the complete catalog static before .94');
    const reducedBeforeSnap = await setStageProgress(page, .939);
    assert.equal((await readReturnInkState(page)).active, false,
      'reduced motion keeps temporary city ink disabled through .939');
    assert.deepEqual(reducedBeforeSnap.camera, reducedStart.camera, 'reduced-motion camera remains static through .939');
    assert.equal(reducedBeforeSnap.cloudCover, 0, 'reduced-motion veil remains hidden through .939');
    assert.equal(reducedBeforeSnap.backgroundHex, 0x050711, 'reduced motion holds the space backdrop through .939');
    assert.equal(reducedBeforeSnap.distantStarOpacity, .66, 'reduced motion keeps stars on their adjusted-progress curve through .939');
    const reducedContact = await setStageProgress(page, .94);
    const reducedContactInk = await readReturnInkState(page);
    const reducedEnd = await setStageProgress(page, .976);
    assert.equal(reducedContactInk.active, false, 'reduced motion clears the temporary city ink at .94');
    assert.equal(reducedContactInk.contact, true, 'reduced motion activates Contact styling at .94');
    assert.equal(reducedContact.phase, 'city', 'reduced motion snaps to the Contact/city pose at .94');
    assert.notDeepEqual(reducedContact.camera, reducedStart.camera, 'the Contact/city pose is reached by a snap, not animated travel');
    assert.equal(reducedContact.cloudCover, 0, 'reduced motion does not cover the snapped Contact/city scene');
    assert.equal(reducedContact.backgroundHex, 0xbccfcf, 'reduced motion snaps to the exact city backdrop at .94');
    assert.equal(reducedContact.distantStarOpacity, 0, 'reduced motion completes the independent star fade at the city snap');
    assert.equal(reducedEnd.cloudCover, 0, 'reduced motion keeps the veil hidden through .976');
    assert.equal(reducedEnd.backgroundHex, 0xbccfcf, 'reduced motion holds the exact city backdrop through .976');
    assert.equal(reducedEnd.distantStarOpacity, 0, 'reduced motion keeps distant stars hidden through .976');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scroll-cue', 'reduced-motion focus transfers immediately before the .94 snap');
    assert.equal(await page.evaluate(() => scrollY), reducedScrollBeforeSnap, 'reduced-motion focus transfer does not change scroll position');
    assert.deepEqual(errors, []);
    await page.close();
    console.log('PASS reduced motion holds the catalog camera until .94, then snaps to the city with focus preserved');
  }

  {
    const paper = 'rgb(239, 244, 237)';
    const darkCity = 'rgb(24, 50, 41)';
    const contactCity = 'rgb(35, 65, 57)';
    const contactFooter = 'rgb(61, 89, 79)';
    const lightFocus = 'rgb(189, 243, 241)';
    const contactFocus = 'rgb(33, 75, 62)';
    const menuSurface = 'rgb(20, 38, 51)';
    const viewports = [
      {width:1440,height:900},
      {width:1101,height:900},
      {width:1100,height:900},
      {width:412,height:844},
      {width:390,height:844},
      {width:844,height:390},
    ];

    for (const viewport of viewports) {
      const {page, errors} = await openScenario({count:5,orbitCount:0,viewport});
      const captionVisible = viewport.width > 760 && viewport.height > 500;
      const coordinateVisible = viewport.width > 1100;
      const snapshots = new Map();

      const assertChromeAt = async progress => {
        await setStageProgress(page, progress);
        const state = await readCityChromeState(page);
        const inBand = progress >= .928 && progress < .94;
        const inContact = progress >= .94;
        const mastheadInk = inBand ? darkCity : inContact ? contactCity : paper;
        const footerInk = inBand ? darkCity : inContact ? contactFooter : 'rgb(196, 214, 215)';
        const sceneLabelInk = inBand ? darkCity : inContact ? contactFooter : 'rgb(169, 190, 197)';
        const scrollCueInk = inBand ? darkCity : inContact ? contactFooter : 'rgb(216, 231, 227)';
        const captionInk = inBand || inContact ? darkCity : paper;
        const expectedCaptionDisplay = captionVisible ? 'block' : 'none';
        const coordinateInk = inBand || inContact ? darkCity : 'rgb(196, 214, 215)';

        assert.equal(state.returnInk,inBand,`${viewport.width}x${viewport.height} return-ink band at ${progress}`);
        assert.equal(state.contact,inContact,`${viewport.width}x${viewport.height} Contact state at ${progress}`);
        assert.equal(state.masthead.color,mastheadInk,`${viewport.width}x${viewport.height} masthead ink at ${progress}`);
        assert.equal(state.wordmark.color,mastheadInk,`${viewport.width}x${viewport.height} wordmark ink at ${progress}`);
        assert.equal(state.navLink.color,mastheadInk,`${viewport.width}x${viewport.height} navigation ink at ${progress}`);
        assert.equal(state.menuToggle.color,mastheadInk,`${viewport.width}x${viewport.height} More toggle ink at ${progress}`);
        assert.equal(state.caption.display,expectedCaptionDisplay,
          `${viewport.width}x${viewport.height} identity caption keeps its existing visibility breakpoint`);
        if (captionVisible) {
          assert.equal(state.caption.color,captionInk,`${viewport.width}x${viewport.height} caption ink at ${progress}`);
          assert.equal(state.caption.opacity,inBand || inContact ? 1 : .65,
            `${viewport.width}x${viewport.height} caption opacity at ${progress}`);
        }
        assert.equal(state.footer.color,footerInk,`${viewport.width}x${viewport.height} fixed footer ink at ${progress}`);
        assert.equal(state.footerPlace.color,footerInk,`${viewport.width}x${viewport.height} left place ink at ${progress}`);
        assert.equal(state.sceneLabel.color,sceneLabelInk,`${viewport.width}x${viewport.height} scene label ink at ${progress}`);
        assert.equal(state.scrollCue.color,scrollCueInk,`${viewport.width}x${viewport.height} scroll cue ink at ${progress}`);
        if (coordinateVisible) assert.notEqual(state.coordinate.display,'none',
          `${viewport.width}x${viewport.height} coordinate remains visible above its breakpoint at ${progress}`);
        else assert.equal(state.coordinate.display,'none',
          `${viewport.width}x${viewport.height} coordinate remains hidden at its breakpoint at ${progress}`);
        assert.equal(state.coordinate.color,coordinateInk,`${viewport.width}x${viewport.height} coordinate ink at ${progress}`);
        assert.equal(state.coordinate.opacity,inBand || inContact ? 1 : .5,
          `${viewport.width}x${viewport.height} coordinate opacity at ${progress}`);
        snapshots.set(progress,state);
      };

      const assertMenuFocusAt = async (progress, first = false) => {
        if (first) {
          await page.locator('#menu-toggle').click();
          await page.keyboard.press('Tab');
        } else {
          await page.keyboard.press('Tab');
          await page.keyboard.press('Tab');
        }

        const action = await readCityChromeState(page);
        const actionFocus = await readFocusedControlState(page);
        assert.equal(action.menu.display,'grid',`${viewport.width}px More menu remains open at ${progress}`);
        assert.equal(action.menu.backgroundColor,menuSurface,`${viewport.width}px More menu keeps its opaque background at ${progress}`);
        assert.equal(action.menu.color,paper,`${viewport.width}px More menu keeps light text at ${progress}`);
        assert.equal(action.menuAction.color,paper,`${viewport.width}px More action keeps light text at ${progress}`);
        assert.deepEqual(actionFocus,{id:'reading-toggle',href:null,focusVisible:true,outlineColor:lightFocus,outlineStyle:'solid'},
          `${viewport.width}px menu action retains its visible light focus outline at ${progress}`);

        await page.keyboard.press('Shift+Tab');
        const toggleFocus = await readFocusedControlState(page);
        const expectedExposedFocus = progress >= .928 && progress < .94 ? darkCity
          : progress >= .94 ? contactFocus : lightFocus;
        assert.deepEqual(toggleFocus,{id:'menu-toggle',href:null,focusVisible:true,outlineColor:expectedExposedFocus,outlineStyle:'solid'},
          `${viewport.width}px exposed menu toggle focus follows the scene at ${progress}`);

        await page.keyboard.press('Shift+Tab');
        const navFocus = await readFocusedControlState(page);
        assert.deepEqual(navFocus,{id:'',href:'#contact',focusVisible:true,outlineColor:expectedExposedFocus,outlineStyle:'solid'},
          `${viewport.width}px exposed masthead link focus follows the scene at ${progress}`);
      };

      for (const [index,progress] of [.926,.928,.938,.94].entries()) {
        await assertChromeAt(progress);
        await assertMenuFocusAt(progress,index === 0);
      }

      for (const progress of [.938,.928,.926]) {
        await assertChromeAt(progress);
        await assertMenuFocusAt(progress);
        assert.equal(snapshots.get(progress).masthead.color,(await readCityChromeState(page)).masthead.color,
          `${viewport.width}x${viewport.height} reverse scrub restores masthead state at ${progress}`);
      }

      if (viewport.width === 1440 || viewport.width === 390) {
        for (const [progress,rounding,expectedBand,expectedContact] of [
          [.928,'floor',false,false],
          [.928,'ceil',true,false],
          [.94,'floor',true,false],
          [.938,'ceil',true,false],
          [.94,'ceil',false,true],
          [.938,'ceil',true,false],
          [.928,'ceil',true,false],
          [.928,'floor',false,false],
        ]) {
          const root = await setRootScrollProgress(page,progress,rounding);
          const state = await readCityChromeState(page);
          assert.equal(root.returnInk,expectedBand,`${viewport.width}x${viewport.height} real root scroll ${rounding} at ${progress}: ${JSON.stringify(root)}`);
          assert.equal(root.contact,expectedContact,`${viewport.width}x${viewport.height} real Contact boundary ${rounding} at ${progress}: ${JSON.stringify(root)}`);
          assert.equal(state.masthead.color,expectedBand ? darkCity : expectedContact ? contactCity : paper,
            `${viewport.width}x${viewport.height} computed masthead ink follows real root progress ${rounding} at ${progress}`);
          assert.equal(state.coordinate.color,expectedBand || expectedContact ? darkCity : 'rgb(196, 214, 215)',
            `${viewport.width}x${viewport.height} coordinate ink follows real root progress ${rounding} at ${progress}`);
          assert.equal(state.coordinate.opacity,expectedBand || expectedContact ? 1 : .5,
            `${viewport.width}x${viewport.height} coordinate opacity follows real root progress ${rounding} at ${progress}`);
        }
      }

      await page.keyboard.press('Escape');
      if (viewport.width === 1440) {
        await setStageProgress(page,.928);
        const cue = page.locator('#scroll-cue');
        await cue.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        assert.deepEqual(await readFocusedControlState(page),{
          id:'scroll-cue',href:'#contact',focusVisible:true,outlineColor:darkCity,outlineStyle:'solid',
        },'keyboard focus on the scroll cue uses return-band dark focus ink');
      }
      await page.close();
      assert.deepEqual(errors,[]);
      console.log(`PASS Task 9 final contrast surfaces ${viewport.width}x${viewport.height}`);
    }

    for (const {width,expectedDisplay} of [
      {width:761,expectedDisplay:'block'},
      {width:760,expectedDisplay:'none'},
    ]) {
      const viewport = {width,height:844};
      const {page,errors} = await openScenario({count:5,orbitCount:0,viewport});
      await setStageProgress(page,.928);
      const caption = (await readCityChromeState(page)).caption;
      assert.equal(caption.display,expectedDisplay,
        `${width}x844 identity caption follows the exact 760px visibility breakpoint`);
      await page.close();
      assert.deepEqual(errors,[]);
      console.log(`PASS identity caption visibility edge ${width}x844`);
    }

    const {page,errors} = await openScenario({count:5,orbitCount:0,viewport:{width:1440,height:900}});
    const beforeToggle = await setRootScrollProgress(page,.938,'ceil');
    assert.ok(beforeToggle.expectedProgress >= .938 && beforeToggle.expectedProgress < .94,
      `runtime reduced-motion toggle starts in the return band: ${JSON.stringify(beforeToggle)}`);
    assert.equal((await readCityChromeState(page)).masthead.color,darkCity,
      'runtime reduced-motion toggle starts with city masthead ink');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(() => !document.body.classList.contains('is-return-city-ink'));
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),true,
      'runtime reduced-motion preference changes while the page is open');
    const duringReducedMotion = await readCityChromeState(page);
    assert.equal(duringReducedMotion.returnInk,false,'runtime reduced motion clears the temporary city class immediately');
    assert.equal(duringReducedMotion.masthead.color,paper,'runtime reduced motion restores the reading masthead ink');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForFunction(() => document.body.classList.contains('is-return-city-ink'));
    const afterToggle = await setRootScrollProgress(page,.938,'ceil');
    assert.ok(afterToggle.expectedProgress >= .938 && afterToggle.expectedProgress < .94,
      `runtime reduced-motion toggle returns to the same root progress band: ${JSON.stringify(afterToggle)}`);
    const resumedMotion = await readCityChromeState(page);
    assert.equal(resumedMotion.returnInk,true,'runtime motion resume restores the progress-derived city state');
    assert.equal(resumedMotion.masthead.color,darkCity,'runtime motion resume restores dark masthead ink');
    assert.deepEqual(errors,[]);
    await page.close();
    console.log('PASS Task 9 final contrast runtime reduced-motion toggle');
  }
} finally {
  await browser.close();
}
