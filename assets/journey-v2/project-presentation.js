import { projectHash } from './routes.js';

/** Input is the validated, ordered manifest. Every renderer consumes these descriptors. */
export function buildProjectPresentation(projects) {
  const total = projects.length;
  const items = Object.freeze(projects.map((project, index) => {
    const targetId = `journey-project-${project.id}`;
    const start = .565 + (index / total) * .252;
    const end = .565 + ((index + 1) / total) * .252;
    return Object.freeze({
      project, id:project.id, index, total, targetId,
      start, end, progress:.565 + ((index + .5) / total) * .252,
      fade:Math.min(.012, (end - start) / 4),
      jumpTarget:`#${targetId}`, hash:projectHash(project.id),
      counter:`${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
      previousId:index > 0 ? projects[index - 1].id : null,
      nextId:index + 1 < total ? projects[index + 1].id : null,
    });
  }));
  return Object.freeze({chapters:items, controls:items, details:items, total});
}
