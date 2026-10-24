import assert from 'node:assert/strict';

const {chromium} = await import(process.env.JOURNEY_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base = process.env.JOURNEY_BASE_URL || 'http://127.0.0.1:8769/';
const manifest = {projects:[
  {id:'Preflight_One', name:'Preflight One', description:'A preflight test project.', order:0},
  {id:'Preflight_Two', name:'Preflight Two', description:'Another preflight test project.', order:1},
]};

async function assertGate(page, busy = 'true', sceneRequests = 0) {
  const gate = page.locator('#journey-startup-gate');
  await gate.waitFor({state:'visible'});
  const state = await page.evaluate(() => ({
    pending:document.body.classList.contains('preflight-pending'),
    shellVisibility:getComputedStyle(document.querySelector('.journey-shell')).visibility,
    busy:document.querySelector('#journey-startup-gate').getAttribute('aria-busy'),
    scene:Boolean(window.__journeyScene),
    projects:Boolean(window.__journeyProjects),
    canvas:Boolean(document.querySelector('#world canvas')),
    orbitStops:document.querySelectorAll('#orbit-stops .orbit-stop').length,
    focused:document.activeElement?.id === 'journey-startup-gate',
  }));
  assert.equal(state.pending, true, 'the Journey must remain in its preflight state');
  assert.equal(state.shellVisibility, 'hidden', 'portfolio content and controls must remain visually hidden');
  assert.equal(state.busy, busy, 'the startup gate busy state should match its preflight state');
  assert.equal(state.scene, false, 'JourneyScene must not exist before successful preflight');
  assert.equal(state.projects, false, 'project rendering must not run before successful preflight');
  assert.equal(state.canvas, false, 'the WebGL scene must not create a canvas before successful preflight');
  assert.equal(state.orbitStops, 0, 'orbit controls must not be created before successful preflight');
  assert.equal(sceneRequests, 0, 'JourneyScene must not be imported before successful preflight');
  assert.equal(state.focused, true, 'focus should remain on the startup gate while preflight is pending or blocked');
  return state;
}

try {
  const delayedPage = await browser.newPage({viewport:{width:1280, height:900}});
  try {
    let releaseSettings;
    let releaseManifest;
    const settingsGate = new Promise(resolve => { releaseSettings = resolve; });
    const manifestGate = new Promise(resolve => { releaseManifest = resolve; });
    let sceneRequests = 0;
    delayedPage.on('request', request => {
      if (request.url().endsWith('/assets/journey-v2/scene.js')) sceneRequests++;
    });
    await delayedPage.route('**/assets/journey-v2/settings.json', async route => {
      await settingsGate;
      await route.fulfill({json:{orbitCount:1}});
    });
    await delayedPage.route('**/projects.json', async route => {
      await manifestGate;
      await route.fulfill({json:manifest});
    });
    const settingsRequest = delayedPage.waitForRequest('**/assets/journey-v2/settings.json');
    const manifestRequest = delayedPage.waitForRequest('**/projects.json');
    await delayedPage.goto(base, {waitUntil:'domcontentloaded'});
    await Promise.all([settingsRequest, manifestRequest]);
    await assertGate(delayedPage, 'true', sceneRequests);

    const settingsResponse = delayedPage.waitForResponse('**/assets/journey-v2/settings.json');
    releaseSettings();
    await settingsResponse;
    await assertGate(delayedPage, 'true', sceneRequests);

    const manifestResponse = delayedPage.waitForResponse('**/projects.json');
    releaseManifest();
    await manifestResponse;
    await delayedPage.waitForFunction(() => window.__journeyScene && window.__journeyProjects && !document.body.classList.contains('preflight-pending'));
    assert.equal(await delayedPage.locator('#journey-startup-gate').isVisible(), false, 'the gate should leave after both resources validate');
    assert.ok(await delayedPage.locator('#orbit-stops .orbit-stop').count() > 0, 'valid preflight should initialize project controls');
    console.log('PASS startup gate waits for settings and manifest before revealing controls or creating the scene');
  } finally {
    await delayedPage.close();
  }

  const invalidPage = await browser.newPage({viewport:{width:1280, height:900}});
  try {
    await invalidPage.route('**/assets/journey-v2/settings.json', route => route.fulfill({json:{orbitCount:3}}));
    await invalidPage.route('**/projects.json', route => route.fulfill({json:manifest}));
    await invalidPage.goto(base, {waitUntil:'domcontentloaded'});
    await invalidPage.locator('#startup-error').waitFor({state:'visible'});
    await assertGate(invalidPage, 'false');
    const error = await invalidPage.locator('#startup-error').innerText();
    assert.match(error, /assets\/journey-v2\/settings\.json/);
    assert.match(error, /3/);
    assert.match(error, /0\.\.2/);
    assert.match(error, /reload/i);
    assert.equal(await invalidPage.locator('#startup-retry').isVisible(), false, 'invalid configuration must block without a retry action');
    console.log('PASS invalid settings remain blocking and report the setting path, value, range, and reload instruction');
  } finally {
    await invalidPage.close();
  }

  const retryPage = await browser.newPage({viewport:{width:1280, height:900}});
  try {
    let settingsRequests = 0;
    let manifestRequests = 0;
    await retryPage.route('**/assets/journey-v2/settings.json', route => {
      settingsRequests++;
      return settingsRequests === 1
        ? route.fulfill({status:503, body:'temporary settings failure'})
        : route.fulfill({json:{orbitCount:1}});
    });
    await retryPage.route('**/projects.json', route => {
      manifestRequests++;
      return route.fulfill({json:manifest});
    });
    await retryPage.goto(base, {waitUntil:'domcontentloaded'});
    await retryPage.locator('#startup-retry').waitFor({state:'visible'});
    await assertGate(retryPage, 'false');
    await retryPage.locator('#startup-retry').click();
    await retryPage.waitForFunction(() => window.__journeyScene && window.__journeyProjects && !document.body.classList.contains('preflight-pending'));
    assert.ok(settingsRequests >= 2, 'retry should fetch settings again');
    assert.ok(manifestRequests >= 2, 'retry should reload the manifest as part of complete preflight');
    console.log('PASS fetch failure keeps the gate and retry reruns the complete preflight');
  } finally {
    await retryPage.close();
  }
} finally {
  await browser.close();
}
