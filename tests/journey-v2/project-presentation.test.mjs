import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectPresentation } from '../../assets/journey-v2/project-presentation.js';

function projects(count) {
  return Array.from({length:count}, (_, index) => ({id:`Project_${index}`, name:`Project ${index}`}));
}

for (const [projectCount, orbitCount] of [[0, 0], [5, 2], [3, 3], [64, 33]]) {
  test(`${projectCount} projects with orbitCount ${orbitCount} split featured chapters from full details`, () => {
    const ordered = projects(projectCount);
    const model = buildProjectPresentation(ordered, orbitCount);
    const featured = ordered.slice(0, orbitCount);

    assert.equal(model.total, projectCount);
    assert.equal(model.orbitCount, orbitCount);
    assert.deepEqual(model.chapters.map(item => item.id), featured.map(project => project.id));
    assert.deepEqual(model.controls.map(item => item.id), featured.map(project => project.id));
    assert.deepEqual(model.details.map(item => item.id), ordered.map(project => project.id));
    assert.equal(new Set(model.chapters.map(item => item.targetId)).size, orbitCount);

    model.chapters.forEach((item, index) => {
      assert.equal(item.project, featured[index]);
      assert.equal(item.index, index);
      assert.equal(item.jumpTarget, `#${item.targetId}`);
      assert.equal(item.counter, `${String(index + 1).padStart(2,'0')} / ${String(orbitCount).padStart(2,'0')}`);
      assert.equal(item.previousId, index > 0 ? featured[index - 1].id : null);
      assert.equal(item.nextId, index + 1 < orbitCount ? featured[index + 1].id : null);
      assert.equal(item.start, .565 + (index / orbitCount) * .265);
      assert.equal(item.end, .565 + ((index + 1) / orbitCount) * .265);
      assert.equal(item.progress, .565 + ((index + .5) / orbitCount) * .265);
      assert.ok(item.fade > 0 && item.fade <= (item.end - item.start) / 4);
      assert.ok(item.progress - item.start >= item.fade);
      assert.ok(item.end - item.progress >= item.fade);
    });

    model.details.forEach((item, index) => {
      assert.equal(item.project, ordered[index]);
      assert.equal(item.index, index);
      assert.equal(item.counter, `${String(index + 1).padStart(2,'0')} / ${String(projectCount).padStart(2,'0')}`);
      assert.equal(item.previousId, index > 0 ? ordered[index - 1].id : null);
      assert.equal(item.nextId, index + 1 < projectCount ? ordered[index + 1].id : null);
    });
  });
}

test('omitted orbitCount keeps the complete manifest featured by default', () => {
  const ordered = projects(3);
  const model = buildProjectPresentation(ordered);
  assert.equal(model.orbitCount, ordered.length);
  assert.deepEqual(model.chapters.map(item => item.id), ordered.map(project => project.id));
  assert.deepEqual(model.controls, model.chapters);
});
