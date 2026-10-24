import { projectHash } from './routes.js';
import { buildProjectLayout } from './project-layout.js';

/** Input is the validated, ordered manifest. Every renderer consumes these descriptors. */
export function buildProjectPresentation(projects) {
  const total = projects.length;
  const layout = buildProjectLayout(projects.map(project => project.id));
  const items = Object.freeze(projects.map((project, index) => {
    const targetId = `journey-project-${project.id}`;
    return Object.freeze({
      project, id:project.id, index, total, targetId,
      ...layout.intervals[index],
      jumpTarget:`#${targetId}`, hash:projectHash(project.id),
      counter:`${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
      previousId:index > 0 ? projects[index - 1].id : null,
      nextId:index + 1 < total ? projects[index + 1].id : null,
    });
  }));
  return Object.freeze({chapters:items, controls:items, details:items, total});
}
