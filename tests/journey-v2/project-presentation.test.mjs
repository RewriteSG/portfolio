import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectPresentation } from '../../assets/journey-v2/project-presentation.js';

for (const count of [0, 1, 3, 8, 64]) {
  test(`${count} projects keep chapters, controls, details, counters and jump targets aligned`, () => {
    const projects = Array.from({length:count}, (_, index) => ({id:`Project_${index}`, name:`Project ${index}`}));
    const model = buildProjectPresentation(projects);
    assert.equal(model.total, count);
    assert.deepEqual(model.chapters.map(item => item.id), projects.map(item => item.id));
    assert.deepEqual(model.controls, model.chapters);
    assert.deepEqual(model.details, model.chapters);
    assert.equal(new Set(model.chapters.map(item => item.targetId)).size, count);
    model.chapters.forEach((item, index) => {
      assert.equal(item.project, projects[index]);
      assert.equal(item.index, index);
      assert.equal(item.jumpTarget, `#${item.targetId}`);
      assert.equal(item.counter, `${String(index + 1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`);
      assert.equal(item.previousId, index > 0 ? projects[index - 1].id : null);
      assert.equal(item.nextId, index + 1 < count ? projects[index + 1].id : null);
      assert.equal(item.start, .565 + (index / count) * .252);
      assert.equal(item.end, .565 + ((index + 1) / count) * .252);
      assert.equal(item.progress, .565 + ((index + .5) / count) * .252);
      assert.ok(item.fade > 0 && item.fade <= (item.end - item.start) / 4);
      assert.ok(item.progress - item.start >= item.fade);
      assert.ok(item.end - item.progress >= item.fade);
    });
  });
}
