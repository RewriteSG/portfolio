import { classifyRemoteMedia, safeHttpUrl } from './project-data.js';
import { buildProjectPresentation } from './project-presentation.js';
import { nextLocationAction, readProjectHash } from './routes.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function externalLink(label, url) {
  const safe = safeHttpUrl(url, document.baseURI);
  if (!safe) return null;
  const link = element('a', 'study-text-button', label);
  link.href = safe;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function tags(project) {
  const list = element('ul', 'project-metadata');
  list.setAttribute('aria-label', 'Tags and technology');
  [...new Set([...project.tags, ...project.stack])].forEach(value => list.append(element('li', '', value)));
  return list;
}

function preview(project, resolveMedia) {
  const figure = element('figure', 'project-preview project-real-preview');
  const image = project.media.find(item => item.type === 'image' && resolveMedia(project, item.src));
  const imageUrl = image ? resolveMedia(project, image.src) : resolveMedia(project, project.thumbnail);
  const video = project.media.find(item => {
    const url = resolveMedia(project, item.src);
    return item.type === 'video' && url && (!/^https?:/i.test(url) || classifyRemoteMedia(url)?.kind === 'direct-video');
  });
  const unavailable = () => {
    figure.replaceChildren(element('p', 'preview-project-name', project.name), element('p', 'preview-unavailable', 'Preview unavailable'));
  };
  if (imageUrl) {
    const img = element('img');
    img.src = imageUrl;
    img.alt = image?.alt || image?.caption || project.name;
    img.loading = 'lazy';
    img.addEventListener('error', unavailable, {once:true});
    figure.append(img);
    if (image?.caption) figure.append(element('figcaption', '', image.caption));
  } else if (video) {
    const player = element('video');
    player.src = resolveMedia(project, video.src);
    player.controls = true;
    player.preload = 'none';
    player.setAttribute('aria-label', `${project.name} preview`);
    figure.append(player);
    if (video.caption) figure.append(element('figcaption', '', video.caption));
  } else unavailable();
  return figure;
}

export function renderProjectChapters({presentation, mount, controls, indexControls, resolveMedia}) {
  mount.replaceChildren();
  controls.replaceChildren();
  indexControls?.replaceChildren();
  presentation.chapters.forEach(item => {
    const {project} = item;
    const panel = element('article', 'scene-panel project-panel');
    panel.id = item.targetId;
    panel.tabIndex = -1;
    panel.dataset.projectId = item.id;
    panel.dataset.projectIndex = String(item.index);
    panel.dataset.start = String(item.start);
    panel.dataset.end = String(item.end);
    panel.dataset.fade = String(item.fade);
    const copy = element('div', 'project-copy');
    const heading = element('h2', '', project.name);
    heading.id = `${item.targetId}-heading`;
    panel.setAttribute('aria-labelledby', heading.id);
    copy.append(element('p', 'section-label', `Project ${item.counter}`), heading,
      element('p', 'body-copy', project.subhead || project.description || 'Explore this project.'),
      element('p', 'project-status', project.status), tags(project));
    const link = element('a', 'project-view-more', 'View project');
    link.href = item.hash;
    link.dataset.projectOpen = item.id;
    link.setAttribute('aria-label', `View ${project.name}`);
    copy.append(link);
    panel.append(preview(project, resolveMedia), copy);
    mount.append(panel);
  });
  presentation.controls.forEach(item => {
    const link = element('a', 'orbit-stop');
    link.href = item.jumpTarget;
    link.dataset.projectIndex = String(item.index);
    link.dataset.projectId = item.id;
    link.setAttribute('aria-label', `${item.project.name}, project ${item.counter}`);
    link.append(element('span', 'orbit-tooltip', item.project.name));
    controls.append(link);
    if (indexControls) {
      const jump = element('a', '', item.project.name);
      jump.href = item.jumpTarget;
      indexControls.append(jump);
    }
  });
}

function gallery(project, resolveMedia) {
  const container = element('div', 'study-gallery');
  project.media.forEach((media, index) => {
    const url = resolveMedia(project, media.src);
    if (!url) return;
    const figure = element('figure', 'study-media');
    const remote = classifyRemoteMedia(url);
    if (media.type === 'image') {
      const img = element('img');
      img.src = url;
      img.alt = media.alt || media.caption || `${project.name}, image ${index + 1}`;
      img.loading = 'lazy';
      img.addEventListener('error', () => img.replaceWith(element('p', '', 'Image unavailable.')), {once:true});
      figure.append(img);
    } else if (media.type === 'video' && (!remote || remote.kind === 'direct-video')) {
      const video = element('video');
      video.src = url;
      video.controls = true;
      video.preload = 'none';
      video.setAttribute('aria-label', media.caption || `${project.name}, video ${index + 1}`);
      figure.append(video);
    } else if (remote?.kind === 'embed') {
      const frame = element('iframe');
      frame.src = remote.url;
      frame.title = media.caption || `${project.name}, ${remote.provider} media`;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frame.allow = remote.provider === 'itch.io' ? 'fullscreen; gamepad' : 'fullscreen; picture-in-picture';
      figure.append(frame);
    }
    if (media.caption) figure.append(element('figcaption', '', media.caption));
    const fallback = externalLink('Open media in a new tab', url);
    if (fallback) figure.append(fallback);
    if (figure.childNodes.length) container.append(figure);
  });
  return container;
}

export function createProjectPages({projects, resolveMedia, onOpen = () => {}, onClose = () => {}, presentation = buildProjectPresentation(projects)}) {
  const mount = document.querySelector('#project-detail');
  const dialog = element('dialog', 'project-pages');
  dialog.setAttribute('aria-labelledby', 'project-detail-heading');
  mount.append(dialog);
  const byId = new Map(presentation.details.map(item => [item.id, item]));
  const session = `${Date.now()}-${Math.random()}`;
  let currentId = null;
  let restore = null;
  let closing = false;
  let destroyed = false;
  let priorOverflow = '';
  let fallbackInert = [];
  const appOpened = () => history.state?.journeyDetail?.session === session;

  function render(item) {
    const {project} = item;
    const page = element('div', 'study-page');
    const header = element('header', 'study-page-header');
    header.append(element('span', 'study-kicker', `Project ${item.counter}`));
    const closeButton = element('button', 'study-close', 'Close project ×');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => close());
    header.append(closeButton);
    const content = element('div', 'study-page-content');
    const intro = element('div', 'study-intro');
    const heading = element('h1', '', project.name);
    heading.id = 'project-detail-heading';
    heading.tabIndex = -1;
    intro.append(element('p', 'study-kicker', project.status), heading,
      element('p', 'study-premise', project.subhead || project.description), tags(project));
    if (project.description && project.description !== project.subhead) intro.append(element('p', 'study-introduction', project.description));
    const prose = element('div', 'study-long-copy');
    project.long.split(/\n\s*\n/).filter(Boolean).forEach(paragraph => prose.append(element('p', '', paragraph)));
    const metadata = element('dl', 'study-metadata');
    for (const [label, value] of [['Date', project.date], ['Commits', project.commits], ['Stack', project.stack.join(', ')]]) {
      if (value !== undefined && value !== '') metadata.append(element('dt', '', label), element('dd', '', String(value)));
    }
    const links = element('nav', 'study-links');
    links.setAttribute('aria-label', 'Project links');
    Object.entries(project.links).forEach(([label, url]) => {
      const link = externalLink(label, url);
      if (link) links.append(link);
    });
    const next = element('nav', 'study-next');
    next.setAttribute('aria-label', 'Other projects');
    for (const [label, id] of [['Previous project', item.previousId], ['Next project', item.nextId]]) {
      if (!id) continue;
      const target = byId.get(id);
      const link = element('a', 'study-text-button', `${label}: ${target.project.name}`);
      link.href = target.hash;
      link.dataset.projectOpen = id;
      next.append(link);
    }
    content.append(intro, prose, metadata, gallery(project, resolveMedia), links, next);
    page.append(header, content);
    dialog.replaceChildren(page);
    dialog.scrollTop = 0;
    heading.focus({preventScroll:true});
  }

  function inertFallbackBackground() {
    let branch = mount;
    while (branch?.parentElement) {
      const parent = branch.parentElement;
      [...parent.children].forEach(sibling => {
        if (sibling === branch || sibling.inert) return;
        fallbackInert.push(sibling);
        sibling.inert = true;
      });
      if (parent === document.body) break;
      branch = parent;
    }
  }

  function show(id) {
    const item = byId.get(id);
    if (!item || destroyed) return false;
    const firstOpen = !currentId;
    currentId = id;
    closing = false;
    mount.hidden = false;
    if (firstOpen) {
      priorOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-project-page');
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else {
        dialog.setAttribute('open', '');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('role', 'dialog');
        inertFallbackBackground();
      }
      dialog.classList.add('is-visible');
    }
    render(item);
    onOpen(item);
    return true;
  }

  function hide({restorePosition = true} = {}) {
    if (!currentId) return;
    const saved = restore;
    currentId = null;
    closing = false;
    dialog.querySelectorAll('video,audio').forEach(media => media.pause());
    // Removing the gallery unloads embedded frames; render() rebuilds it on open.
    dialog.replaceChildren();
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    mount.hidden = true;
    dialog.classList.remove('is-visible');
    document.body.classList.remove('has-project-page');
    document.body.style.overflow = priorOverflow;
    fallbackInert.forEach(node => { node.inert = false; });
    fallbackInert = [];
    onClose({restore:saved, direct:!saved});
    if (restorePosition) requestAnimationFrame(() => {
      if (currentId || destroyed) return;
      if (saved) {
        window.scrollTo({left:saved.x, top:saved.y, behavior:'instant'});
        const target = saved.focus?.isConnected ? saved.focus : document.querySelector('#projects-heading');
        target?.focus({preventScroll:true});
      } else {
        const heading = document.querySelector('#projects-heading');
        heading?.focus({preventScroll:true});
      }
    });
  }

  function open(id, options = {}) {
    if (!byId.has(id) || destroyed) return false;
    if (options.sync) return show(id);
    const action = nextLocationAction({id:currentId, appOpened:appOpened()}, {type:'open', id});
    if (!currentId) restore = {x:window.scrollX, y:window.scrollY, focus:options.invoker || document.activeElement};
    const state = currentId && !appOpened() ? history.state : {...history.state, journeyDetail:{session}};
    history[action.method === 'push' ? 'pushState' : 'replaceState'](state, '', action.hash);
    return show(id);
  }

  function close() {
    if (!currentId || closing) return;
    const action = nextLocationAction({id:currentId, appOpened:appOpened()}, {type:'close'});
    if (action.method === 'back') { closing = true; history.back(); }
    else {
      history.replaceState(null, '', action.hash);
      restore = null;
      hide();
    }
  }

  function syncFromLocation() {
    const id = readProjectHash(location.hash, byId.keys());
    if (id) {
      if (!appOpened()) restore = null;
      if (currentId !== id) show(id);
      return;
    }
    if (location.hash.startsWith('#project=')) {
      history.replaceState(null, '', '#projects');
      restore = null;
      document.dispatchEvent(new CustomEvent('journey:project-route-error'));
      if (!currentId) onClose({restore:null, direct:true});
    }
    hide();
  }

  function click(event) {
    const link = event.target.closest('[data-project-open]');
    if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    open(link.dataset.projectOpen, {invoker:link});
  }
  function keydown(event) {
    if (!currentId) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const nodes = [...dialog.querySelectorAll('a[href],button,video[controls],iframe,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
    const first = nodes[0];
    const last = nodes.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  const cancel = event => { event.preventDefault(); close(); };
  document.addEventListener('click', click);
  document.addEventListener('keydown', keydown);
  dialog.addEventListener('cancel', cancel);
  window.addEventListener('popstate', syncFromLocation);
  window.addEventListener('hashchange', syncFromLocation);
  return {open, close, syncFromLocation, destroy() {
    hide({restorePosition:false});
    destroyed = true;
    dialog.remove();
    document.removeEventListener('click', click);
    document.removeEventListener('keydown', keydown);
    dialog.removeEventListener('cancel', cancel);
    window.removeEventListener('popstate', syncFromLocation);
    window.removeEventListener('hashchange', syncFromLocation);
  }};
}
