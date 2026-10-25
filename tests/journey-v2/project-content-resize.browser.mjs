import assert from 'node:assert/strict';

const {chromium} = await import(process.env.JOURNEY_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base = process.env.JOURNEY_BASE_URL || 'http://127.0.0.1:8769/';
const manifest = {projects:Array.from({length:8}, (_, i) => ({id:`Content_${i}`, name:`Content ${i}`, description:'Initial short copy', order:8-i}))};
const failures = [];

try {
  for (const kind of ['text', 'video-metadata']) {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    try {
      await page.route('**/projects.json', route => route.fulfill({json:manifest}));
      await page.route('**/assets/journey-v2/settings.json', route => route.fulfill({json:{orbitCount:8}}));
      await page.goto(`${base}#journey-project-Content_4`);
      await page.waitForFunction(() => window.__journeyScene && window.__journeyProjects && Number(document.querySelector('#journey-project-Content_4')?.style.opacity) === 1);
      await page.waitForTimeout(250);
      const before = await page.evaluate(() => {
        window.__contentResizeEvents = 0;
        addEventListener('resize', () => window.__contentResizeEvents++);
        return {height:document.querySelector('#journey-track').offsetHeight, progress:window.__journeyScene.getDebugState().targetProgress, panelHeight:document.querySelector('#journey-project-Content_4').clientHeight};
      });
      await page.evaluate(async kind => {
        const copy = document.querySelector('#journey-project-Content_4 .body-copy');
        if (kind === 'text') {
          copy.textContent = 'Additional project content that increases the intrinsic reading height. '.repeat(1600);
          return;
        }
        const video = document.createElement('video');
        video.style.cssText = 'display:block;width:100%;height:auto';
        video.muted = true;
        copy.append(video);
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 2000;
        const context = canvas.getContext('2d');
        const stream = canvas.captureStream(10);
        const timer = setInterval(() => {
          context.fillStyle = '#487663';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }, 50);
        window.__contentVideo = {stream, timer};
        const metadata = new Promise(resolve => video.addEventListener('loadedmetadata', resolve, {once:true}));
        video.srcObject = stream;
        await metadata;
        window.__contentVideo.metadataLoaded = video.videoHeight === 2000;
      },kind);
      await page.waitForFunction(height => document.querySelector('#journey-track').offsetHeight > height + 1000, before.height, {timeout:3000}).catch(() => {});
      const after = await page.evaluate(() => ({
        height:document.querySelector('#journey-track').offsetHeight,
        progress:window.__journeyScene.getDebugState().targetProgress,
        panelHeight:document.querySelector('#journey-project-Content_4').clientHeight,
        contentHeight:document.querySelector('#journey-project-Content_4').scrollHeight,
        resizeEvents:window.__contentResizeEvents,
        metadataLoaded:window.__contentVideo?.metadataLoaded,
      }));
      console.log(`${kind}: ${JSON.stringify({before,after})}`);
      try {
        assert.equal(after.panelHeight,before.panelHeight,'the visual panel must retain its fixed dimensions');
        assert.equal(after.resizeEvents,0,'content invalidation must not require viewport resize');
        assert.ok(after.height > before.height + 1000,'track height must update when internal content grows');
        assert.ok(Math.abs(after.progress-before.progress)<.0002,'remeasurement must preserve normalized journey progress');
        if (kind === 'video-metadata') assert.equal(after.metadataLoaded,true,'exercise real intrinsic video metadata');
        console.log(`PASS ${kind}: intrinsic content changes pacing without viewport resize and preserves progress`);
      } catch (error) { failures.push(`${kind}: ${error.message}`); }
      await page.evaluate(() => {
        if (!window.__contentVideo) return;
        window.__contentVideo.stream.getTracks().forEach(track => track.stop());
        clearInterval(window.__contentVideo.timer);
      });
    } finally {await page.close();}
  }
  assert.deepEqual(failures,[]);
} finally {await browser.close();}
