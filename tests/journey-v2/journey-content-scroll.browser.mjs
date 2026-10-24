import assert from 'node:assert/strict';

const {chromium} = await import(process.env.JOURNEY_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base = process.env.JOURNEY_BASE_URL || 'http://127.0.0.1:8769/';
const manifest = {projects:Array.from({length:64}, (_, index) => ({
  id:`Scroll_${index}`,
  name:`Scroll study ${index + 1}`,
  description:'A short introduction to this selected project.',
  order:index,
}))};

try {
  const delayedManifestPage = await browser.newPage({viewport:{width:1280, height:900}});
  try {
    let releaseManifest;
    const manifestGate = new Promise(resolve => { releaseManifest = resolve; });
    await delayedManifestPage.route('**/assets/journey-v2/settings.json', route => route.fulfill({json:{orbitCount:1}}));
    await delayedManifestPage.route('**/projects.json', async route => {
      await manifestGate;
      await route.fulfill({json:manifest});
    });
    const manifestRequest = delayedManifestPage.waitForRequest('**/projects.json');
    await delayedManifestPage.goto(`${base}#projects`);
    await manifestRequest;
    const gateState = await delayedManifestPage.evaluate(() => ({
      gateVisible:document.querySelector('#journey-startup-gate')?.checkVisibility(),
      pending:document.body.classList.contains('preflight-pending'),
      scene:Boolean(window.__journeyScene),
      canvas:Boolean(document.querySelector('#world canvas')),
      projects:Boolean(window.__journeyProjects),
    }));
    assert.deepEqual(gateState, {gateVisible:true, pending:true, scene:false, canvas:false, projects:false}, 'a delayed manifest must keep the first-paint gate visible without initializing the scene');
    releaseManifest();
    await delayedManifestPage.waitForFunction(() =>
      window.__journeyScene && window.__journeyProjects && document.activeElement?.id === 'projects'
      && !document.body.classList.contains('preflight-pending'));
    assert.ok(await delayedManifestPage.locator('#projects').isVisible(), 'successful preflight should honor the direct Projects hash');
    console.log('PASS delayed manifest keeps the direct Projects hash at the top of the index');
  } finally {
    await delayedManifestPage.close();
  }

  const page = await browser.newPage({viewport:{width:1280, height:900}});
  try {
    await page.route('**/projects.json', route => route.fulfill({json:manifest}));
    await page.goto(`${base}#about`);
    await page.waitForFunction(() => window.__journeyScene && window.__journeyProjects && document.body.classList.contains('has-journey'));
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#about')).opacity) > .99);

    const before = await page.evaluate(() => ({
      trackHeight:document.querySelector('#journey-track').offsetHeight,
      scrollY:window.scrollY,
      overflowY:getComputedStyle(document.querySelector('#about')).overflowY,
    }));
    await page.evaluate(() => {
      const copy = document.querySelector('#about .body-copy');
      const paragraphs = Array.from({length:56}, (_, index) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = `Long-form chapter paragraph ${index + 1}. ${'The main journey should reveal this copy as the reader scrolls through the scene. '.repeat(4)}`;
        return paragraph;
      });
      const finalParagraph = document.createElement('p');
      finalParagraph.id = 'journey-content-end';
      finalParagraph.textContent = 'End of long-form chapter content.';
      paragraphs.push(finalParagraph);
      copy.replaceChildren(...paragraphs);
      const finalButton = document.createElement('button');
      finalButton.id = 'journey-content-final-focus';
      finalButton.textContent = 'Final chapter control';
      copy.append(finalButton);
    });
    await page.waitForFunction(height => document.querySelector('#journey-track').offsetHeight > height + 1000, before.trackHeight);

    const longContent = await page.evaluate(() => {
      const panel = document.querySelector('#about');
      return {
        trackHeight:document.querySelector('#journey-track').offsetHeight,
        scrollY:window.scrollY,
        overflow:panel.scrollHeight - panel.clientHeight,
        scrollTop:panel.scrollTop,
        overflowY:getComputedStyle(panel).overflowY,
      };
    });
    assert.ok(longContent.trackHeight > before.trackHeight + 1000, 'long scene content must add root journey distance');
    assert.ok(longContent.overflow > 1000, 'the test scene must exceed its viewport');
    assert.equal(longContent.overflowY, 'hidden', 'scene content must not expose an inner vertical scrollbar');

    const panel = await page.locator('#about').boundingBox();
    await page.mouse.move(panel.x + 100, panel.y + 250);
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(before => {
      const scene = document.querySelector('#about');
      return window.scrollY > before.scrollY + 100 && scene.scrollTop > before.scrollTop + 100;
    }, {scrollY:longContent.scrollY, scrollTop:longContent.scrollTop});
    const afterWheel = await page.evaluate(() => ({scrollY:window.scrollY, scrollTop:document.querySelector('#about').scrollTop}));
    assert.ok(afterWheel.scrollY > longContent.scrollY, 'wheel input over a scene must advance the document journey');
    assert.ok(afterWheel.scrollTop > 0, 'the same root scroll must reveal the scene content');

    await page.evaluate(y => window.scrollTo({top:y, behavior:'instant'}), longContent.scrollY + longContent.overflow + 5);
    await page.waitForTimeout(200);
    const bottom = await page.evaluate(() => {
      const panel = document.querySelector('#about');
      const bounds = panel.getBoundingClientRect();
      const end = document.querySelector('#journey-content-end').getBoundingClientRect();
      return {scrollY:window.scrollY, scrollTop:panel.scrollTop, overflow:panel.scrollHeight - panel.clientHeight, progress:window.__journeyScene.getDebugState().targetProgress, panel:bounds.toJSON(), end:end.toJSON()};
    });
    assert.ok(bottom.progress < .48, 'the long scene must reach its final copy before the next scene takes over');
    assert.ok(bottom.end.top >= bottom.panel.top - 2 && bottom.end.bottom <= bottom.panel.bottom + 2, 'the final paragraph must be visible at the end of the scene scroll');

    await page.evaluate(y => window.scrollTo({top:y, behavior:'instant'}), longContent.scrollY);
    await page.waitForFunction(() => document.querySelector('#about').scrollTop <= 3);
    await page.locator('#journey-content-final-focus').focus();
    await page.waitForFunction(() => {
      const panel = document.querySelector('#about').getBoundingClientRect();
      const target = document.querySelector('#journey-content-final-focus').getBoundingClientRect();
      return target.top >= panel.top - 2 && target.bottom <= panel.bottom + 2;
    });
    assert.ok(await page.evaluate(start => window.scrollY > start + 100, longContent.scrollY), 'keyboard focus must reveal off-screen controls through the root scroll');

    await page.locator('.main-nav a[href="#projects"]').click();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#projects')).opacity) > .99);
    const projectList = await page.evaluate(() => {
      const panel = document.querySelector('#projects');
      const list = document.querySelector('.project-jump-list');
      return {
        overflow:panel.scrollHeight - panel.clientHeight,
        scrollTop:panel.scrollTop,
        panelOverflowY:getComputedStyle(panel).overflowY,
        listOverflowY:getComputedStyle(list).overflowY,
        listMaxHeight:getComputedStyle(list).maxHeight,
      };
    });
    assert.ok(projectList.overflow > 0, 'the long project index must overflow its scene');
    assert.equal(projectList.panelOverflowY, 'hidden');
    assert.equal(projectList.listOverflowY, 'visible');
    assert.equal(projectList.listMaxHeight, 'none');
    const listBox = await page.locator('.project-jump-list').boundingBox();
    await page.mouse.move(listBox.x + 40, listBox.y + 120);
    const beforeListWheel = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(() => document.querySelector('#projects').scrollTop > 0);
    assert.ok(await page.evaluate(() => window.scrollY) > beforeListWheel, 'the project index must follow the same root journey scroll');

    console.log(`PASS scene scroll: ${JSON.stringify({before, longContent, afterWheel, bottom, projectList})}`);
  } finally {
    await page.close();
  }

  const mobile = await browser.newPage({viewport:{width:390, height:390}, isMobile:true, hasTouch:true});
  try {
    await mobile.route('**/projects.json', route => route.fulfill({json:manifest}));
    await mobile.goto(`${base}#contact`);
    await mobile.waitForFunction(() => window.__journeyScene && window.__journeyProjects && document.body.classList.contains('has-journey'));
    await mobile.waitForFunction(() => Number(getComputedStyle(document.querySelector('#contact')).opacity) > .99);
    const before = await mobile.evaluate(() => document.querySelector('#journey-track').offsetHeight);
    await mobile.evaluate(() => {
      const copy = document.querySelector('#contact .contact-copy');
      for (let index = 0; index < 36; index++) {
        const paragraph = document.createElement('p');
        paragraph.textContent = `Contact detail ${index + 1}. ${'Long contact copy should travel with the main page scroll. '.repeat(5)}`;
        copy.append(paragraph);
      }
      const finalParagraph = document.createElement('p');
      finalParagraph.id = 'journey-contact-end';
      finalParagraph.textContent = 'End of contact content.';
      copy.append(finalParagraph);
    });
    await mobile.waitForFunction(height => document.querySelector('#journey-track').offsetHeight > height + 1000, before);
    const start = await mobile.evaluate(() => ({
      scrollY:window.scrollY,
      overflow:document.querySelector('#contact').scrollHeight - document.querySelector('#contact').clientHeight,
      overflowY:getComputedStyle(document.querySelector('#contact')).overflowY,
    }));
    assert.ok(start.overflow > 1000, 'short mobile viewport should expose the contact overflow');
    assert.equal(start.overflowY, 'hidden');
    const bounds = await mobile.locator('#contact').boundingBox();
    const touch = await mobile.context().newCDPSession(mobile);
    const touchX = Math.round(bounds.x + bounds.width / 2);
    const touchY = Math.round(bounds.y + Math.min(120, bounds.height / 2));
    await touch.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:touchX, y:touchY}]});
    await touch.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:touchX, y:touchY - 180}]});
    await touch.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    await mobile.waitForFunction(y => window.scrollY > y + 100 && document.querySelector('#contact').scrollTop > 100, start.scrollY);
    await touch.detach();
    await mobile.evaluate(() => window.scrollTo({top:document.documentElement.scrollHeight, behavior:'instant'}));
    await mobile.waitForFunction(() => {
      const panel = document.querySelector('#contact');
      return panel.scrollTop >= panel.scrollHeight - panel.clientHeight - 2;
    });
    const end = await mobile.evaluate(() => {
      const panel = document.querySelector('#contact').getBoundingClientRect();
      const content = document.querySelector('#journey-contact-end').getBoundingClientRect();
      return {panel:panel.toJSON(), content:content.toJSON()};
    });
    assert.ok(end.content.top >= end.panel.top - 2 && end.content.bottom <= end.panel.bottom + 2, 'short mobile viewport must reveal the final contact copy');
    console.log(`PASS short mobile scene scroll: ${JSON.stringify({start, end})}`);
  } finally {
    await mobile.close();
  }
} finally {
  await browser.close();
}
