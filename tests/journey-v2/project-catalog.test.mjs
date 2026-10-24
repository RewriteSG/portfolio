import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectPage, projectPageCount } from '../../assets/journey-v2/project-catalog.js';

for (const count of [0, 1, 4, 5, 13]) {
  test(`${count} projects paginate in ordered four-item pages`, () => {
    const projects = Array.from({length:count}, (_, index) => ({id:`Project_${index}`}));
    const pageCount = Math.ceil(count / 4);
    assert.equal(projectPageCount(count), pageCount);

    const first = getProjectPage(projects, 0);
    assert.equal(first.pageIndex, 0);
    assert.equal(first.pageCount, pageCount);
    assert.equal(first.startIndex, 0);
    assert.equal(first.endIndex, Math.min(4, count));
    assert.deepEqual(first.items, projects.slice(0, 4));

    const last = getProjectPage(projects, Math.max(0, pageCount - 1));
    const lastStart = Math.max(0, pageCount - 1) * 4;
    assert.equal(last.pageIndex, Math.max(0, pageCount - 1));
    assert.equal(last.startIndex, lastStart);
    assert.equal(last.endIndex, count);
    assert.deepEqual(last.items, projects.slice(lastStart, count));
    assert.ok(first.items.length <= 4);
    assert.ok(last.items.length <= 4);
  });
}

test('out-of-range page indices clamp to the nearest valid page', () => {
  const projects = Array.from({length:13}, (_, index) => ({id:`Project_${index}`}));
  assert.deepEqual(getProjectPage(projects, -7), getProjectPage(projects, 0));
  assert.deepEqual(getProjectPage(projects, 99), getProjectPage(projects, 3));
  assert.equal(getProjectPage([], 99).pageIndex, 0);
});

test('page size controls slicing and page count', () => {
  const projects = Array.from({length:5}, (_, index) => ({id:`Project_${index}`}));
  assert.equal(projectPageCount(projects.length, 2), 3);
  assert.deepEqual(getProjectPage(projects, 1, 2).items, projects.slice(2, 4));
});
