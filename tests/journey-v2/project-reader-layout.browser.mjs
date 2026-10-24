import assert from 'node:assert/strict';
// Keep focus modality, reader framing, and the scene's continued visibility in one browser regression.
const {chromium} = await import(process.env.JOURNEY_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JOURNEY_BASE_URL || 'http://127.0.0.1:8769/';
const fixture = {projects:[
  {id:'Reader_One',name:'Reader One',description:'A detailed reader layout fixture.',subhead:'A concise project premise.',long:'Long form project copy for verifying the reader column.'},
  {id:'Reader_Two',name:'Reader Two',description:'A second project.',long:'Second project copy.'},
]};
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function prepare(page) {
  await page.route('**/projects.json', route => route.fulfill({json:fixture}));
  await page.route('**/assets/journey-v2/settings.json', route => route.fulfill({json:{orbitCount:2}}));
}
const ready = page => page.waitForFunction(() => window.__journeyScene && window.__journeyProjects);
try {
  const pointer = await browser.newPage({viewport:{width:1440,height:900}});
  await prepare(pointer);
  await pointer.goto(`${base}#journey-project-Reader_One`);
  await ready(pointer);
  await pointer.waitForFunction(() => Number(getComputedStyle(document.querySelector('#journey-project-Reader_One')).opacity) > .8);
  const action = pointer.locator('#journey-project-Reader_One .project-view-more');
  await action.click();
  await pointer.waitForFunction(() => document.querySelector('dialog')?.open);
  await pointer.locator('.study-close').click();
  await pointer.waitForFunction(() => !document.querySelector('dialog')?.open && document.activeElement?.matches('.project-view-more'));
  const pointerFocus = await action.evaluate(node => node.matches(':focus-visible'));
  assert.equal(pointerFocus,false,'a pointer click must not create keyboard-visible focus');
  await pointer.evaluate(() => window.scrollTo(0,document.documentElement.scrollHeight));
  await pointer.waitForTimeout(250);
  const faded = await pointer.locator('#journey-project-Reader_One').evaluate(node => ({
    opacity:getComputedStyle(node).opacity,inert:node.inert,hidden:node.getAttribute('aria-hidden')
  }));
  assert.deepEqual(faded,{opacity:'0',inert:true,hidden:'true'},'pointer focus must not pin a scene after root scrolling past it');

  const keyboard = await browser.newPage({viewport:{width:1440,height:900}});
  await prepare(keyboard);
  await keyboard.goto(`${base}#journey-project-Reader_One`);
  await ready(keyboard);
  const keyboardTarget = keyboard.locator('#journey-project-Reader_One .project-view-more');
  let reached = false;
  for (let step=0;step<60 && !reached;step++) {
    await keyboard.keyboard.press('Tab');
    reached = await keyboardTarget.evaluate(node => document.activeElement === node).catch(() => false);
  }
  assert.equal(reached,true,'Tab navigation must reach the project action');
  assert.equal(await keyboardTarget.evaluate(node => node.matches(':focus-visible')),true,'keyboard navigation must make the target focus-visible');
  await keyboard.evaluate(() => {window.__journeyScene.setProgress(1,true);window.__journeyScene.frame(performance.now());});
  const pinned = await keyboard.locator('#journey-project-Reader_One').evaluate(node => ({
    opacity:getComputedStyle(node).opacity,inert:node.inert,hidden:node.getAttribute('aria-hidden')
  }));
  assert.deepEqual(pinned,{opacity:'1',inert:false,hidden:'false'},'keyboard-visible content stays exposed when its scene is outside the timeline');
  await keyboard.locator('#contact').focus();
  await keyboard.waitForFunction(() => {
    const node=document.querySelector('#journey-project-Reader_One');
    return !node.contains(document.activeElement) && Number(getComputedStyle(node).opacity) < .006;
  });
  await pointer.close();
  await keyboard.close();

  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    const page = await browser.newPage({viewport});
    await prepare(page);
    await page.goto(`${base}#project=Reader_One`);
    await ready(page);
    await page.waitForFunction(() => {
      const dialog=document.querySelector('dialog');
      return dialog?.open && dialog.classList.contains('is-visible') && Math.abs(new DOMMatrixReadOnly(getComputedStyle(dialog).transform).m41) < 1;
    });
    const layout = await page.locator('.study-page-content').evaluate(node => {
      const rect=node.getBoundingClientRect();
      const dialog=document.querySelector('.project-pages');
      const world=document.querySelector('#world');
      const intro=document.querySelector('.study-intro');
      return {
        x:rect.x,width:rect.width,right:rect.right,
        maxWidth:parseFloat(getComputedStyle(node).maxWidth),
        introDisplay:getComputedStyle(intro).display,
        backing:getComputedStyle(node).backgroundImage,
        dialogBackground:getComputedStyle(dialog).backgroundColor,
        backdrop:getComputedStyle(dialog,'::backdrop').backgroundColor,
        worldDisplay:getComputedStyle(world).display,
        worldVisibility:getComputedStyle(world).visibility,
        worldOpacity:Number(getComputedStyle(world).opacity),
      };
    });
    assert.equal(layout.worldDisplay,'block','the scene container stays rendered behind the reader');
    assert.equal(layout.worldVisibility,'visible');
    assert.ok(layout.worldOpacity > 0);
    assert.ok(layout.backing.includes('gradient'),'reader text/media has localized backing');
    if (viewport.width > 760) {
      assert.ok(layout.x >= viewport.width*.50 && layout.x <= viewport.width*.55,JSON.stringify(layout));
      assert.ok(layout.maxWidth >= 760 && layout.maxWidth <= 820,JSON.stringify(layout));
      assert.ok(layout.width <= 820 && layout.right <= viewport.width+1,JSON.stringify(layout));
      assert.ok(!layout.dialogBackground.endsWith(', 1)'),JSON.stringify(layout));
      assert.equal(layout.backdrop,'rgba(8, 14, 30, 0.16)');
    } else {
      assert.ok(layout.x >= 0 && layout.x <= viewport.width*.08,JSON.stringify(layout));
      assert.ok(layout.width >= viewport.width*.8 && layout.right <= viewport.width+1,JSON.stringify(layout));
      assert.equal(layout.introDisplay,'block');
      assert.equal(layout.backdrop,'rgba(8, 14, 30, 0.48)');
    }
    console.log(`PASS project reader ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
