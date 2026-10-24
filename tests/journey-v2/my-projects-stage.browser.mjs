import assert from 'node:assert/strict';

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
  page.on('pageerror', error => errors.push(error.message));
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

try {
  {
    const {page, errors} = await openScenario({count:0, orbitCount:0});
    assert.equal(await page.locator('#project-catalog-pager').evaluate(node => node.hidden), true, 'empty catalog hides the pager');
    assert.equal(await page.locator('#project-catalog-grid .project-card').count(), 0);
    assert.equal(await page.locator('#project-catalog-page-status').innerText(), 'No projects to show yet.');
    assert.deepEqual(await page.evaluate(() => ({orbit:window.__journeyProjects.presentation.orbitCount, chapters:window.__journeyProjects.presentation.chapters.length, details:window.__journeyProjects.presentation.details.length})), {orbit:0, chapters:0, details:0});
    assert.deepEqual(errors, []);
    console.log('PASS empty catalog hides pagination and keeps the zero-project orbit usable');
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
    assert.equal(await page.locator('#project-catalog-grid img').getAttribute('alt'), 'Catalog Project 0 project preview');
    assert.deepEqual(errors, []);
    console.log('PASS single-project catalog shows 01 / 01 with native disabled arrows and no orbit markers');
    await page.close();
  }

  {
    const {page, errors} = await openScenario({count:13, orbitCount:1});
    assert.deepEqual(await page.evaluate(() => ({orbit:window.__journeyProjects.presentation.orbitCount, chapters:window.__journeyProjects.presentation.chapters.length, controls:window.__journeyProjects.presentation.controls.length, details:window.__journeyProjects.presentation.details.length})), {orbit:1, chapters:1, controls:1, details:13});
    assert.deepEqual(await projectIds(page), ['Catalog_0', 'Catalog_1', 'Catalog_2', 'Catalog_3']);

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

  for (const viewport of [{width:1024, height:768}, {width:390, height:844}]) {
    const {page, errors} = await openScenario({count:5, orbitCount:0, viewport});
    const layout = await page.evaluate(() => ({
      columns:getComputedStyle(document.querySelector('#project-catalog-grid')).gridTemplateColumns.split(' ').length,
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth,
    }));
    assert.equal(layout.columns, 1, `${viewport.width}px layout uses one column`);
    assert.ok(layout.scrollWidth <= layout.innerWidth, `${viewport.width}px layout has no horizontal overflow`);
    await page.close();
    assert.deepEqual(errors, []);
    console.log(`PASS catalog responsive layout ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`);
  }
} finally {
  await browser.close();
}
