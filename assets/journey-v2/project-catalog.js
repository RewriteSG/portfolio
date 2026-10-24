import { projectHash } from './routes.js';

const DEFAULT_PAGE_SIZE = 4;

function pageSizeValue(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_PAGE_SIZE;
}

function projectCountValue(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/** Number of catalog pages for an ordered project count and page size. */
export function projectPageCount(projectCount, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.ceil(projectCountValue(projectCount) / pageSizeValue(pageSize));
}

/** Return a clamped, zero-based page descriptor without changing the input list. */
export function getProjectPage(projects, pageIndex, pageSize = DEFAULT_PAGE_SIZE) {
  const items = Array.isArray(projects) ? projects : [];
  const size = pageSizeValue(pageSize);
  const pageCount = projectPageCount(items.length, size);
  const requestedIndex = Number(pageIndex);
  const index = pageCount
    ? Math.min(pageCount - 1, Math.max(0, Number.isNaN(requestedIndex) ? 0 : Math.floor(requestedIndex)))
    : 0;
  const startIndex = index * size;
  const endIndex = Math.min(items.length, startIndex + size);
  return Object.freeze({pageIndex:index, pageCount, startIndex, endIndex, items:items.slice(startIndex, endIndex)});
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function projectCard(project, resolveMedia) {
  const card = element('article', 'project-card');
  card.id = `project-card-${project.id}`;
  card.dataset.projectId = project.id;

  const media = element('div', 'project-card-media');
  const thumbnail = project.thumbnail && resolveMedia(project, project.thumbnail);
  if (thumbnail) {
    const image = element('img');
    image.src = thumbnail;
    image.alt = `${project.name} project preview`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.replaceWith(element('span', 'project-card-image-fallback', 'Preview unavailable'));
    }, {once:true});
    media.append(image);
  } else {
    media.append(element('span', 'project-card-image-fallback', 'Preview unavailable'));
  }

  const content = element('div', 'project-card-content');
  content.append(
    element('h3', '', project.name),
    element('p', 'project-card-summary', project.subhead || project.description || 'Explore this project.'),
  );
  const action = element('a', 'project-card-action', 'View project');
  action.href = projectHash(project.id);
  action.dataset.projectCatalogOpen = project.id;
  action.setAttribute('aria-label', `View ${project.name} details`);
  content.append(action);
  card.append(media, content);
  return card;
}

/** Render a paged catalog while keeping its controls outside the replaced grid. */
export function createProjectCatalog({root, projects, resolveMedia, onOpen = () => {}, onPageChange = () => {}, pageSize = DEFAULT_PAGE_SIZE}) {
  const grid = root?.querySelector('#project-catalog-grid');
  const pager = root?.querySelector('#project-catalog-pager');
  const previous = root?.querySelector('#project-catalog-previous');
  const next = root?.querySelector('#project-catalog-next');
  const pageNumber = root?.querySelector('#project-catalog-page-number');
  const status = root?.querySelector('#project-catalog-page-status');
  if (!grid || !pager || !previous || !next || !pageNumber || !status) {
    throw new TypeError('Project catalog requires its grid, pager controls, page number, and page status.');
  }

  const orderedProjects = Array.isArray(projects) ? projects.slice() : [];
  const byId = new Map(orderedProjects.map(project => [project.id, project]));
  const size = pageSizeValue(pageSize);
  let page = getProjectPage(orderedProjects, 0, size);
  let destroyed = false;

  function render(nextPage) {
    page = nextPage;
    grid.replaceChildren(...page.items.map(project => projectCard(project, resolveMedia)));
    pager.hidden = page.pageCount === 0;
    if (page.pageCount === 1) {
      previous.disabled = true;
      next.disabled = true;
      previous.removeAttribute('aria-disabled');
      next.removeAttribute('aria-disabled');
    } else if (page.pageCount > 1) {
      previous.disabled = false;
      next.disabled = false;
      previous.setAttribute('aria-disabled', String(page.pageIndex === 0));
      next.setAttribute('aria-disabled', String(page.pageIndex === page.pageCount - 1));
    }
    pageNumber.textContent = page.pageCount
      ? `${String(page.pageIndex + 1).padStart(2, '0')} / ${String(page.pageCount).padStart(2, '0')}`
      : '00 / 00';
    pageNumber.setAttribute('role', 'group');
    pageNumber.setAttribute('aria-label', page.pageCount
      ? `Page ${page.pageIndex + 1} of ${page.pageCount}`
      : 'No project pages');
    status.textContent = page.pageCount
      ? `Page ${page.pageIndex + 1} of ${page.pageCount}; projects ${page.startIndex + 1} through ${page.endIndex} of ${orderedProjects.length}`
      : 'No projects to show yet.';
  }

  function setPage(pageIndex) {
    if (destroyed) return page;
    const accepted = getProjectPage(orderedProjects, pageIndex, size);
    if (accepted.pageIndex === page.pageIndex) return page;

    const active = root.ownerDocument.activeElement;
    const focusWasInPager = pager.contains(active);
    const focusWasInGrid = grid.contains(active);
    render(accepted);
    if (focusWasInPager && active.isConnected) active.focus({preventScroll:true});
    else if (focusWasInGrid) grid.querySelector('.project-card-action')?.focus({preventScroll:true});
    onPageChange(accepted);
    return page;
  }

  function movePage(direction) {
    if (destroyed || page.pageCount < 2) return;
    if (direction < 0 && previous.getAttribute('aria-disabled') === 'true') return;
    if (direction > 0 && next.getAttribute('aria-disabled') === 'true') return;
    setPage(page.pageIndex + direction);
  }

  function openProject(event) {
    const action = event.target.closest('[data-project-catalog-open]');
    if (!action || !root.contains(action) || event.defaultPrevented || event.button > 0
      || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const project = byId.get(action.dataset.projectCatalogOpen);
    if (!project) return;
    event.preventDefault();
    onOpen(project, action);
  }

  const previousClick = () => movePage(-1);
  const nextClick = () => movePage(1);
  previous.addEventListener('click', previousClick);
  next.addEventListener('click', nextClick);
  root.addEventListener('click', openProject);
  render(page);

  return {
    setPage,
    getPage:() => page,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      previous.removeEventListener('click', previousClick);
      next.removeEventListener('click', nextClick);
      root.removeEventListener('click', openProject);
    },
  };
}
