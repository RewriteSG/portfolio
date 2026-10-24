import assert from 'node:assert/strict';

// Optional browser regression: serve the repo, and provide Playwright through the
// normal package resolver or JOURNEY_PLAYWRIGHT_MODULE (an ESM module URL).
const {chromium} = await import(process.env.JOURNEY_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--disable-webgl']});
const base = process.env.JOURNEY_BASE_URL || 'http://127.0.0.1:8769/';
const manifest = {projects:[{
  id:'Media', name:'Media fixture',
  media:[{type:'video', src:'./synthetic.webm'}, {type:'embed', src:'https://www.youtube.com/embed/fixture'}],
}]};

try {
  for (const method of ['button', 'Escape', 'Back', 'syncFromLocation', 'destroy']) {
    const page = await browser.newPage();
    try {
      await page.route('**/projects.json', route => route.fulfill({json:manifest}));
      await page.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html', body:'<!doctype html><title>Embed fixture</title><p>Embedded content</p>'}));
      const direct = method === 'Escape' || method === 'syncFromLocation';
      await page.goto(`${base}${direct ? '#project=Media' : '#projects'}`);
      await page.waitForFunction(() => window.__journeyProjects);
      if (!direct) await page.evaluate(() => window.__journeyProjects.pages.open('Media'));
      await page.waitForFunction(() => document.querySelector('dialog')?.open);
      const playing = await page.evaluate(async () => {
        const video = document.querySelector('dialog video');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const context = canvas.getContext('2d');
        const stream = canvas.captureStream(10);
        const timer = setInterval(() => {
          context.fillStyle = `hsl(${performance.now() % 360} 70% 50%)`;
          context.fillRect(0, 0, 32, 32);
        }, 50);
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        window.__mediaCloseFixture = {video, frame:document.querySelector('dialog iframe'), stream, timer};
        return !video.paused;
      });
      assert.equal(playing, true, `${method}: the fixture must actively play before closing`);
      if (method === 'button') await page.locator('.study-close').click();
      else if (method === 'Escape') await page.keyboard.press('Escape');
      else if (method === 'Back') await page.goBack();
      else if (method === 'syncFromLocation') await page.evaluate(() => {
        history.replaceState(null, '', '#projects');
        window.__journeyProjects.pages.syncFromLocation();
      });
      else await page.evaluate(() => window.__journeyProjects.pages.destroy());
      await page.waitForFunction(() => !document.querySelector('dialog')?.open);
      const state = await page.evaluate(() => {
        const {video, frame} = window.__mediaCloseFixture;
        return {
          open:!!document.querySelector('dialog')?.open,
          paused:video.paused,
          hasMedia:!!document.querySelector('dialog video, dialog audio, dialog iframe'),
          frameConnected:frame.isConnected,
        };
      });
      console.log(`${method}: ${JSON.stringify(state)}`);
      assert.equal(state.paused, true, `${method}: native playback must stop`);
      assert.equal(state.hasMedia, false, `${method}: closed detail must release its gallery`);
      assert.equal(state.frameConnected, false, `${method}: embed must be unloaded`);
      if (method !== 'destroy') {
        await page.evaluate(() => window.__journeyProjects.pages.open('Media'));
        assert.equal(await page.locator('dialog video').count(), 1);
        assert.equal(await page.locator('dialog iframe').count(), 1);
        assert.equal(await page.evaluate(() => document.querySelector('dialog video') !== window.__mediaCloseFixture.video), true);
      }
      await page.evaluate(() => {
        const {stream, timer} = window.__mediaCloseFixture;
        stream.getTracks().forEach(track => track.stop());
        clearInterval(timer);
      });
      console.log(`PASS ${method}: active media stopped, frame removed${method === 'destroy' ? '' : ', gallery rebuilt on reopen'}`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
