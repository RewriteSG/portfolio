import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(process.env.JOURNEY_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JOURNEY_BASE_URL || 'http://127.0.0.1:8769/';
const output = process.env.JOURNEY_SCREENSHOT_DIR ? pathToFileURL(`${process.env.JOURNEY_SCREENSHOT_DIR.replaceAll('\\','/').replace(/\/$/,'')}/`) : new URL('../../output/playwright/task-5/', import.meta.url);
await mkdir(output, {recursive:true});
const fixture = count => ({projects:Array.from({length:count}, (_, i) => ({id:`Access_${i}`, name:`Project ${i}: A deliberately long project title that wraps clearly`, description:'A readable project description.', order:count-i, media:[]}))});
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ready = page => page.waitForFunction(() => window.__journeyScene && window.__journeyProjects);
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
try {
  for (const [width,height] of [[1440,900],[1024,768],[390,844],[360,800],[740,390]]) {
    const page = await browser.newPage({viewport:{width,height}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/projects.json', route => route.fulfill({json:fixture(width < 500 ? 64 : 8)}));
    await page.goto(`${base}#journey-project-Access_0`);
    await ready(page);
    await page.waitForFunction(() => document.activeElement?.id === 'journey-project-Access_0');
    await page.waitForTimeout(300);
    assert.equal(await noOverflow(page),true);
    const measurements = await page.evaluate(() => {
      const panel = document.querySelector('#journey-project-Access_0');
      const target = panel.querySelector('.project-view-more');
      const rect = panel.getBoundingClientRect();
      return {panel:{top:rect.top,bottom:rect.bottom,height:rect.height}, targetHeight:target.getBoundingClientRect().height,
        targets:[...document.querySelectorAll('.main-nav>a,.menu-toggle')].map(node => ({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})),
        list:document.querySelector('#orbit-control').classList.contains('is-list')};
    });
    assert.ok(measurements.panel.height > 100);
    assert.ok(measurements.targetHeight >= 44);
    assert.ok(measurements.targets.every(rect => rect.height >= 44 && rect.width >= 44));
    assert.equal(await page.locator('#projects,.solar-intro').evaluateAll(nodes => nodes.every(node => Number(node.style.opacity) < .006)),true,'the first project must not overlap the index/introduction');
    if (width < 500) assert.equal(measurements.list,true);
    await page.screenshot({path:new URL(`projects-${width}x${height}.png`,output).pathname.replace(/^\/(.:)/,'$1')});
    // A focused project action stays visible while scrolling away from its scene.
    await page.locator('#journey-project-Access_0 .project-view-more').focus();
    await page.evaluate(() => { window.__journeyScene.setProgress(1,true); window.__journeyScene.frame(performance.now()); });
    assert.equal(await page.locator('#journey-project-Access_0').evaluate(node => ({opacity:getComputedStyle(node).opacity,inert:node.inert,hidden:node.getAttribute('aria-hidden')})).then(value => JSON.stringify(value)),JSON.stringify({opacity:'1',inert:false,hidden:'false'}));
    // Tab and Shift+Tab remain inside the labelled native dialog, then Escape restores focus.
    await page.locator('#journey-project-Access_0 .project-view-more').press('Enter');
    await page.waitForFunction(() => document.querySelector('dialog').open);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')),true);
    for (let step=0;step<5;step++) await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')),true);
    assert.equal(await page.locator('dialog').evaluate(node => node.scrollWidth <= innerWidth),true);
    await page.screenshot({path:new URL(`detail-${width}x${height}.png`,output).pathname.replace(/^\/(.:)/,'$1')});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog').open && document.activeElement?.classList.contains('project-view-more'));
    for (const id of ['about','contact']) {
      await page.evaluate(id => {location.hash=id;},id);
      await page.waitForFunction(id => document.activeElement.id === id && Number(document.querySelector(`#${id}`).style.opacity) > .99,id);
      assert.equal(await noOverflow(page),true);
      await page.screenshot({path:new URL(`${id}-${width}x${height}.png`,output).pathname.replace(/^\/(.:)/,'$1')});
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS responsive/focus/dialog ${width}x${height}: ${JSON.stringify(measurements)}`);
    await page.close();
  }
  const page = await browser.newPage();
  await page.route('**/projects.json', route => route.fulfill({json:fixture(3)}));
  await page.goto(base);
  await ready(page);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className),'skip-link');
  assert.equal(await page.locator('.skip-link').evaluate(node => node.getBoundingClientRect().top >= 0),true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'about');
  await page.locator('#menu-toggle').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id),'menu-toggle');
  assert.equal(await page.locator('#more-menu').isHidden(),true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(() => document.body.classList.contains('is-reading'));
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.scene-panel[id]')].every(node => !node.inert && node.getAttribute('aria-hidden') !== 'true' && getComputedStyle(node).visibility === 'visible')),true);
  assert.deepEqual(await page.evaluate(() => {const s=window.__journeyScene.getDebugState();return [s.reducedMotion,s.paused,s.animationRunning];}),[true,true,false]);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(() => document.body.classList.contains('has-journey') && window.__journeyScene.getDebugState().animationRunning);
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(() => window.__journeyScene.getDebugState().animationRunning),false);
  const time = await page.evaluate(() => window.__journeyScene.time);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__journeyScene.time),time);
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(time => window.__journeyScene.time > time,time);
  await page.evaluate(() => {document.querySelector('canvas.journey-canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}));});
  await page.waitForFunction(() => document.body.classList.contains('is-fallback'));
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.scene-panel[id]')].every(node => !node.inert && node.getAttribute('aria-hidden') !== 'true')),true);
  console.log('PASS runtime reduced-motion on/off, visibility loop suspension/resume, context-loss fallback');
  await page.close();
  const reduced = await browser.newPage({reducedMotion:'reduce'});
  await reduced.route('**/projects.json', route => route.fulfill({json:fixture(1)}));
  await reduced.goto(`${base}#contact`);
  await ready(reduced);
  assert.equal(await reduced.locator('body').evaluate(node => node.classList.contains('is-reading')),true);
  assert.equal(await reduced.evaluate(() => document.activeElement.id),'contact');
  assert.equal(await reduced.evaluate(() => window.__journeyScene.getDebugState().animationRunning),false);
  console.log('PASS initial reduced motion exposes content immediately and focuses the direct section hash');
  await reduced.close();
  // A condensed list keeps every real HTML control reachable and scrolls focus into view.
  const many = await browser.newPage({viewport:{width:360,height:800}});
  await many.route('**/projects.json', route => route.fulfill({json:fixture(64)}));
  await many.goto(`${base}#journey-project-Access_0`);
  await ready(many);
  await many.waitForFunction(() => document.querySelector('#orbit-control.is-list'));
  await many.locator('.orbit-stop').first().focus();
  for(let step=0;step<63;step++) await many.keyboard.press('Tab');
  assert.equal(await many.evaluate(() => document.activeElement.dataset.projectId),'Access_63');
  assert.equal(await many.locator('.orbit-stop').last().evaluate(node => {const a=node.getBoundingClientRect(), b=node.parentElement.getBoundingClientRect();return a.left>=b.left && a.right<=b.right+1;}),true);
  assert.equal(await noOverflow(many),true);
  console.log('PASS keyboard traversal through all 64 condensed controls');
  await many.close();
  for (const kind of ['scene-module','manifest','all-modules','no-javascript']) {
    const context = await browser.newContext({javaScriptEnabled:kind !== 'no-javascript',viewport:{width:360,height:800}});
    const fallback = await context.newPage();
    if (kind === 'scene-module') await fallback.route('**/scene.js', route => route.abort());
    if (kind === 'all-modules') await fallback.route('**/journey-v2/app.js', route => route.abort());
    if (kind === 'manifest') await fallback.route('**/projects.json', route => route.fulfill({status:503,body:'unavailable'}));
    await fallback.goto(base);
    if (kind === 'scene-module') await fallback.waitForFunction(() => document.body.classList.contains('is-fallback'));
    if (kind === 'manifest') {await fallback.waitForSelector('#projects-retry',{state:'attached'});await fallback.locator('.main-nav a[href="#contact"]').click();}
    assert.equal(await fallback.locator('#about').textContent().then(text => text.includes('game engines')),true);
    assert.equal(await fallback.locator('.contact-email').getAttribute('href'),'mailto:hi@example.dev');
    assert.equal(await noOverflow(fallback),true);
    if (kind === 'no-javascript') assert.equal(await fallback.locator('.projects-no-script').isVisible(),true);
    await fallback.screenshot({path:new URL(`fallback-${kind}.png`,output).pathname.replace(/^\/(.:)/,'$1'),fullPage:kind !== 'manifest'});
    console.log(`PASS ${kind}: identity/About/Contact remain readable, no page overflow`);
    await context.close();
  }
} finally { await browser.close(); }
