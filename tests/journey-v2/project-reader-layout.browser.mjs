import assert from 'node:assert/strict';
// Keep focus modality, reader framing, and the scene's continued visibility in one browser regression.
const {chromium} = await import(process.env.JOURNEY_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JOURNEY_BASE_URL || 'http://127.0.0.1:8769/';
const fixture = {projects:[
  {id:'Reader_One',name:'Reader One',description:'A detailed reader layout fixture.',subhead:'A concise project premise.',long:'Long form project copy for verifying the reader column.',media:[{type:'image',src:'reader-preview.svg',alt:'Reader layout preview'}]},
  {id:'Reader_Two',name:'Reader Two',description:'A second project.',long:'Second project copy.'},
]};
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function prepare(page) {
  await page.route('**/projects.json', route => route.fulfill({json:fixture}));
  await page.route('**/assets/journey-v2/settings.json', route => route.fulfill({json:{orbitCount:2}}));
  await page.route('**/projects/**', route => route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#173040"/></svg>'}));
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
  await pointer.waitForFunction(() => {
    const node = document.querySelector('#journey-project-Reader_One');
    return Number(getComputedStyle(node).opacity) < .006 && node.inert && node.getAttribute('aria-hidden') === 'true';
  });
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

  for (const viewport of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844},{width:844,height:390}]) {
    const page = await browser.newPage({viewport});
    await prepare(page);
    await page.goto(`${base}#project=Reader_One`);
    await ready(page);
    await page.waitForFunction(() => {
      const dialog=document.querySelector('dialog');
      return dialog?.open && dialog.classList.contains('is-visible') && Math.abs(new DOMMatrixReadOnly(getComputedStyle(dialog).transform).m41) < 1;
    });
    await page.evaluate(() => {
      const scene=window.__journeyScene;
      scene.setPaused(false);
      scene.setReducedMotion(true);
      scene.setProjectFocus('Reader_One');
      scene.frame(performance.now());
    });
    const layout = await page.locator('.study-page-content').evaluate(node => {
      const rect=node.getBoundingClientRect();
      const page=document.querySelector('.study-page');
      const header=document.querySelector('.study-page-header');
      const media=document.querySelector('.study-media');
      const dialog=document.querySelector('.project-pages');
      const world=document.querySelector('#world');
      const intro=document.querySelector('.study-intro');
      const longCopy=document.querySelector('.study-long-copy');
      const expectedGutter=parseFloat(getComputedStyle(document.querySelector('.masthead')).paddingLeft);
      return {
        x:rect.x,width:rect.width,right:rect.right,
        headerWidth:header.getBoundingClientRect().width,
        mediaWidth:media.getBoundingClientRect().width,
        maxWidth:parseFloat(getComputedStyle(node).maxWidth),
        headerMaxWidth:parseFloat(getComputedStyle(header).maxWidth),
        mediaMaxWidth:parseFloat(getComputedStyle(media).maxWidth),
        rightPadding:parseFloat(getComputedStyle(page).paddingRight),
        expectedGutter,
        leftPadding:parseFloat(getComputedStyle(page).paddingLeft),
        introGap:parseFloat(getComputedStyle(intro).columnGap),
        introDisplay:getComputedStyle(intro).display,
        longCopyMaxWidth:parseFloat(getComputedStyle(longCopy).maxWidth),
        backing:getComputedStyle(node).backgroundImage,
        dialogBackground:getComputedStyle(dialog).backgroundColor,
        backdrop:getComputedStyle(dialog,'::backdrop').backgroundColor,
        pageOverflow:document.documentElement.scrollWidth-innerWidth,
        dialogOverflow:dialog.scrollWidth-dialog.clientWidth,
        worldDisplay:getComputedStyle(world).display,
        worldVisibility:getComputedStyle(world).visibility,
        worldOpacity:Number(getComputedStyle(world).opacity),
      };
    });
    assert.equal(layout.worldDisplay,'block','the scene container stays rendered behind the reader');
    assert.equal(layout.worldVisibility,'visible');
    assert.ok(layout.worldOpacity > 0);
    assert.ok(layout.backing.includes('gradient'),'reader text/media has localized backing');
    assert.equal(layout.mediaMaxWidth,900,JSON.stringify(layout));
    assert.equal(layout.longCopyMaxWidth,750,JSON.stringify(layout));
    assert.ok(Math.abs(layout.rightPadding-layout.expectedGutter)<1,JSON.stringify(layout));
    assert.ok(layout.pageOverflow<=1 && layout.dialogOverflow<=1,JSON.stringify(layout));
    if (viewport.width > 760) {
      assert.equal(layout.maxWidth,900,JSON.stringify(layout));
      assert.equal(layout.headerMaxWidth,900,JSON.stringify(layout));
      assert.ok(Math.abs(layout.x-viewport.width*.48)<1,JSON.stringify(layout));
      assert.ok(Math.abs(layout.leftPadding-viewport.width*.48)<1,JSON.stringify(layout));
      assert.ok(layout.width <= 900 && layout.right <= viewport.width-layout.expectedGutter+1,JSON.stringify(layout));
      assert.ok(Math.abs(layout.introGap-viewport.width*.06)<1,JSON.stringify(layout));
      assert.ok(!layout.dialogBackground.endsWith(', 1)'),JSON.stringify(layout));
      assert.equal(layout.backdrop,'rgba(8, 14, 30, 0.16)');
    } else {
      assert.ok(Math.abs(layout.x-layout.expectedGutter)<1,JSON.stringify(layout));
      assert.ok(Math.abs(layout.leftPadding-layout.expectedGutter)<1,JSON.stringify(layout));
      assert.ok(layout.width >= viewport.width*.8 && layout.width<=900 && layout.headerWidth<=900 && layout.mediaWidth<=900 && layout.right <= viewport.width-layout.expectedGutter+1,JSON.stringify(layout));
      assert.equal(layout.introDisplay,'block');
      assert.equal(layout.backdrop,'rgba(8, 14, 30, 0.48)');
    }
    const planet = await page.evaluate(() => {
      const scene=window.__journeyScene;
      const index=scene.projectLayout.ids.indexOf('Reader_One');
      const sphere=scene.markerForIndex(index).planet;
      const Vector3=scene.camera.position.constructor;
      const bounds=() => {
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
        return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
      };
      const actual=bounds();
      const center=sphere.getWorldPosition(new Vector3());
      const radius=sphere.geometry.parameters.radius*sphere.getWorldScale(new Vector3()).x;
      const angle25=25*Math.PI/180;
      const cameraDistance=scene.camera.position.distanceTo(center);
      const apparentRadius=Math.asin(radius/cameraDistance);
      return {bounds:actual,apparentRatio:Math.tan(apparentRadius)/Math.tan(angle25)};
    });
    assert.ok(Math.abs(planet.bounds.right-viewport.width*.42)<Math.max(4,viewport.width*.005),`${viewport.width}px focused planet right limb sits near 42vw: ${JSON.stringify(planet)}`);
    assert.ok(planet.bounds.left<0,`${viewport.width}px focused planet keeps the intended left crop: ${JSON.stringify(planet)}`);
    assert.ok(planet.apparentRatio>=1.08 && planet.apparentRatio<=1.12,`${viewport.width}px focused planet apparent size is 1.10x the old 25-degree framing: ${JSON.stringify(planet)}`);
    if (viewport.width > 760) {
      const subjectGap=layout.x-planet.bounds.right;
      assert.ok(subjectGap>=viewport.width*.06-2,`${viewport.width}px focused planet keeps the 6vw reader-copy gap: ${JSON.stringify({subjectGap,planet,layout})}`);
    }
    console.log(`PASS project reader ${viewport.width}x${viewport.height}: ${JSON.stringify({layout,planet})}`);
    await page.close();
  }
} finally {
  await browser.close();
}
