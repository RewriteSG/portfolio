import { projectHash } from './routes.js';
import { buildProjectLayout } from './project-layout.js';

function descriptors(projects, count) {
  const layout = buildProjectLayout(projects.map(project => project.id));
  return Object.freeze(projects.map((project, index) => {
    const targetId = `journey-project-${project.id}`;
    return Object.freeze({
      project, id:project.id, index, total:count, targetId,
      ...layout.intervals[index],
      jumpTarget:`#${targetId}`, hash:projectHash(project.id),
      counter:`${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`,
      previousId:index > 0 ? projects[index - 1].id : null,
      nextId:index + 1 < count ? projects[index + 1].id : null,
    });
  }));
}

/** Input is the validated, ordered manifest. Orbit chapters and details use distinct counts. */
export function buildProjectPresentation(projects, orbitCount = projects.length) {
  const total = projects.length;
  const featuredCount = Number.isSafeInteger(orbitCount)
    ? Math.max(0, Math.min(total, orbitCount))
    : total;
  const chapters = descriptors(projects.slice(0, featuredCount), featuredCount);
  const details = descriptors(projects, total);
  return Object.freeze({chapters, controls:chapters, details, total, orbitCount:featuredCount});
}
