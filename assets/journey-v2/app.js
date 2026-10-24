import { loadProjectManifest, resolveProjectMedia, safeEmail, safeHttpUrl } from './project-data.js';
import { buildProjectPresentation } from './project-presentation.js';
import { buildProjectLayout, projectAtProgress, buildScrollMetrics, progressAtScroll, scrollAtProgress } from './project-layout.js';
import { createProjectPages, renderProjectChapters } from './project-pages.js';

const body = document.body;
let panels = [...document.querySelectorAll('.scene-panel')];
const track = document.querySelector('#journey-track');
const ring = document.querySelector('#orbit-control');
let ringStops = [...document.querySelectorAll('.orbit-stop')];
const progressFill = document.querySelector('#page-progress-fill');
const sceneLabel = document.querySelector('#scene-label');
const scrollCue = document.querySelector('#scroll-cue');
const scrollCueText = document.querySelector('#scroll-cue-text');
const menu = document.querySelector('#more-menu');
const menuButton = document.querySelector('#menu-toggle');
const readingButton = document.querySelector('#reading-toggle');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const anchors = {hello:0, about:.30, projects:.59, contact:1};
const projectIds = ['projects'];
let scene;
let previousProgress = -1;
let projectLayout = buildProjectLayout([]);
let scrollMetrics = buildScrollMetrics(projectLayout, innerHeight);
let scrollFrame = 0;
let needsMeasure = false;
let preserveOnMeasure = false;
let isReading = false;
let failed = false;
let pendingFocus;
let lastSceneLabel = '';
let lastActive = '';
let projectPages;
let focusedProjectId = null;
let restoredProjectHash = null;
let projectPresentation = buildProjectPresentation([]);

function textElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function bindSiteInfo(info = {}) {
  const text = (selector, value) => {
    if (typeof value === 'string' && value.trim()) document.querySelector(selector).textContent = value;
  };
  if (typeof info.meta?.title === 'string') document.title = info.meta.title;
  if (typeof info.meta?.description === 'string') document.querySelector('meta[name="description"]').content = info.meta.description;
  const name = typeof info.name === 'string' && info.name.trim() ? info.name : 'Portfolio';
  const wordmark = document.querySelector('.wordmark');
  const identity = wordmark.querySelector(':scope > span');
  identity.replaceChildren(document.createTextNode(name), textElement('span', 'identity-caption', info.home?.title || 'Projects and experiments'));
  wordmark.setAttribute('aria-label', `${name}, back to the beginning`);
  text('.intro-name', `A little perspective, by ${name}`);
  text('.hello-line', info.home?.lede);
  text('.hello-footnote p', info.home?.title);
  text('#about-heading', info.about?.title);
  text('.standfirst', info.home?.title);
  if (Array.isArray(info.about?.bio)) {
    const copy = document.querySelector('.about-copy > .body-copy');
    copy.replaceChildren(...info.about.bio.filter(value => typeof value === 'string').map(value => textElement('p', '', value)));
  }
  const skills = info.about?.skills;
  if (Array.isArray(skills?.headers) && Array.isArray(skills?.rows)) {
    const list = document.querySelector('.disciplines');
    list.replaceChildren();
    skills.headers.forEach((header, index) => {
      if (typeof header !== 'string') return;
      const item = document.createElement('li');
      item.append(textElement('strong', '', header));
      skills.rows.forEach(row => {
        if (typeof row?.[index] === 'string' && row[index]) item.append(textElement('span', '', row[index]));
      });
      list.append(item);
    });
  }
  for (const field of ['education', 'timeline']) {
    if (typeof info.about?.[field] !== 'string' || !info.about[field]) continue;
    const disclosure = textElement('details', 'about-background', '');
    disclosure.append(textElement('summary', '', field === 'education' ? 'Education' : 'Experience'), textElement('pre', '', info.about[field]));
    document.querySelector('.about-copy').append(disclosure);
  }
  text('#contact-heading', info.contact?.title);
  text('.contact-intro', info.contact?.lede);
  text('.contact-signoff', [info.contact?.status, info.contact?.responseTime].filter(value => typeof value === 'string' && value).join(' · '));
  const address = safeEmail(info.contact?.email);
  const emailLink = document.querySelector('.contact-email');
  if (address) { emailLink.href = `mailto:${address}`; emailLink.textContent = address; }
  else { emailLink.removeAttribute('href'); emailLink.textContent = 'Contact address unavailable'; }
  const socials = textElement('nav', 'contact-socials', '');
  socials.setAttribute('aria-label', 'Social links');
  if (Array.isArray(info.socials)) info.socials.forEach(social => {
    const url = safeHttpUrl(social?.url, document.baseURI);
    if (!url || typeof social?.label !== 'string') return;
    const link = textElement('a', '', social.label);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    socials.append(link);
  });
  emailLink.after(socials);
  if (typeof info.footer === 'string') document.querySelector('.contact-copy').append(textElement('p', 'footer-credit', info.footer));
}

bindSiteInfo(window.SITE_INFO);

const projectSection = document.querySelector('#projects');
const projectMount = document.querySelector('#project-mount');
projectMount.className = 'project-mount';
projectMount.removeAttribute('aria-live');
projectSection.after(projectMount);
projectSection.querySelector('.project-preview').remove();
projectSection.classList.remove('project-panel');
projectSection.classList.add('project-index');
const projectsHeading = document.querySelector('#projects-heading');
projectsHeading.tabIndex = -1;
const projectStatus = projectSection.querySelector('.body-copy');
projectStatus.setAttribute('role', 'status');
projectStatus.id = 'projects-status';
const projectJumpList = textElement('nav', 'project-jump-list', '');
projectJumpList.setAttribute('aria-label', 'Browse projects');
projectStatus.after(projectJumpList);

function showProjectStatus(message, retry = false) {
  projectStatus.textContent = message;
  document.querySelector('#projects-retry')?.remove();
  if (retry) {
    const button = textElement('button', 'project-view-more', 'Retry loading projects');
    button.id = 'projects-retry';
    button.type = 'button';
    button.addEventListener('click', loadProjects);
    projectStatus.after(button);
  }
}

async function loadProjects() {
  showProjectStatus('Loading projects…');
  try {
    const {projects, rejected} = await loadProjectManifest();
    projectPages?.destroy();
    projectPresentation = buildProjectPresentation(projects);
    renderProjectChapters({presentation:projectPresentation, mount:projectMount, controls:document.querySelector('#orbit-stops'), indexControls:projectJumpList, resolveMedia:resolveProjectMedia});
    projectIds.splice(1, projectIds.length, ...projectPresentation.chapters.map(item => item.targetId));
    projectPresentation.chapters.forEach(item => { anchors[item.targetId] = item.progress; });
    anchors.projects = projects.length ? .55 : .59;
    projectSection.dataset.end = projects.length ? '.577' : '.83';
    projectSection.dataset.start = projects.length ? '.49' : '.565';
    panels = [...document.querySelectorAll('.scene-panel')];
    ringStops = [...document.querySelectorAll('.orbit-stop')];
    body.classList.toggle('has-many-projects', projects.length > 32);
    const summary = projects.length ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} to explore.` : 'No projects to show yet.';
    showProjectStatus(`${summary}${rejected ? ` ${rejected} invalid ${rejected === 1 ? 'entry was' : 'entries were'} skipped.` : ''}`);
    projectPages = createProjectPages({projects, presentation:projectPresentation, resolveMedia:resolveProjectMedia,
      onOpen:item => {
        focusedProjectId = item.id;
        scene?.setProjectFocus(item.id);
        document.dispatchEvent(new CustomEvent('journey:project-open', {detail:item}));
      },
      onClose:({direct}) => {
        focusedProjectId = null;
        scene?.setProjectFocus(null);
        // popstate precedes hashchange: preserve the controller's exact scroll restore.
        restoredProjectHash = location.hash;
        if (direct) goTo('projects', {instant:true, updateHash:false});
      },
    });
    window.__journeyProjects = {presentation:projectPresentation, pages:projectPages};
    document.dispatchEvent(new CustomEvent('journey:projects-ready', {detail:{presentation:projectPresentation, projects}}));
    measure();
    projectPages.syncFromLocation();
  } catch (error) {
    console.warn('Projects could not be loaded.', error);
    showProjectStatus('Projects could not be loaded. Please try again.', true);
  }
}

document.addEventListener('journey:project-route-error', () => showProjectStatus('That project link is unavailable. Choose a project below.'));

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const prefersReducedMotion = () => motionPreference.matches;

function setMenu(open) {
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close options' : 'More options');
}

function measure(preservePosition = false) {
  const progress = progressAtScroll(scrollMetrics, scrollY);
  const contentHeight = panels.reduce((height, panel) => panel.dataset.projectId ? Math.max(height, panel.scrollHeight) : height, 0);
  scrollMetrics = buildScrollMetrics(projectLayout, innerHeight, contentHeight);
  track.style.height = `${scrollMetrics.total + innerHeight}px`;
  previousProgress = -1;
  if (body.classList.contains('has-journey')) {
    if (preservePosition) scrollTo({top:scrollAtProgress(scrollMetrics, progress), behavior:'instant'});
    const p = progressAtScroll(scrollMetrics, scrollY);
    scene?.setProgress(p);
    updatePresentation(p);
  }
}

// Scroll handlers only schedule; document geometry is read on explicit invalidation.
function scheduleScrollUpdate({measure:refresh = false, preserve = false} = {}) {
  needsMeasure ||= refresh;
  preserveOnMeasure ||= preserve;
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    if (needsMeasure) {
      needsMeasure = false;
      const restore = preserveOnMeasure;
      preserveOnMeasure = false;
      measure(restore);
    }
    if (body.classList.contains('has-journey')) scene?.setProgress(progressAtScroll(scrollMetrics, scrollY));
  });
}

const observedSizes = new WeakMap();
const contentObserver = new ResizeObserver(entries => {
  let changed = false;
  entries.forEach(entry => {
    const size = `${entry.contentRect.width},${entry.contentRect.height}`;
    const previous = observedSizes.get(entry.target);
    observedSizes.set(entry.target, size);
    if (previous !== undefined && previous !== size) changed = true;
  });
  if (changed) scheduleScrollUpdate({measure:true, preserve:true});
});
function observePanelContent() {
  panels.forEach(panel => {
    contentObserver.observe(panel);
    // The panel's fixed visual box does not grow with its scrollable contents.
    // Its intrinsic copy/preview children do, including text and media changes.
    [...panel.children].forEach(content => contentObserver.observe(content));
  });
}
observePanelContent();
function refreshMediaLayout(event) {
  if ((event.target instanceof HTMLImageElement || event.target instanceof HTMLMediaElement) && event.target.closest('#portfolio')) {
    scheduleScrollUpdate({measure:true, preserve:true});
  }
}
document.addEventListener('load', refreshMediaLayout, true);
document.addEventListener('loadedmetadata', refreshMediaLayout, true);
document.addEventListener('journey:projects-ready', event => {
  projectLayout = buildProjectLayout(event.detail.presentation.chapters.map(item => item.id));
  scene?.setProjectIds(projectLayout.ids);
  contentObserver.disconnect();
  observePanelContent();
  measure(true);
  sizeProjectPreviews();
  const requested = location.hash.slice(1);
  if (event.detail.presentation.chapters.some(item => item.targetId === requested)) {
    goTo(requested, {instant:true, updateHash:false});
  }
});

function goTo(id, {focus = false, updateHash = true, instant = false} = {}) {
  if (!(id in anchors)) return;
  setMenu(false);
  const target = document.getElementById(id);
  if (body.classList.contains('has-journey')) {
    if (focus) pendingFocus = id;
    scrollTo({top:scrollAtProgress(scrollMetrics, anchors[id]), behavior: instant || prefersReducedMotion() ? 'instant' : 'smooth'});
    if (instant) {
      scene?.setProgress(anchors[id], true);
      updatePresentation(anchors[id]);
    }
  } else {
    target.scrollIntoView({behavior: instant || prefersReducedMotion() ? 'instant' : 'smooth', block:'start'});
    if (focus) target.focus({preventScroll:true});
  }
  if (updateHash) history.pushState(null, '', `#${id}`);
}

function makeReadable({error = false} = {}) {
  const id = lastActive in anchors ? lastActive : 'hello';
  body.classList.remove('has-journey', 'is-projects', 'is-contact');
  body.classList.toggle('is-fallback', error);
  body.classList.toggle('is-reading', !error);
  panels.forEach(panel => {
    panel.inert = false;
    panel.removeAttribute('aria-hidden');
    panel.style.removeProperty('opacity');
    panel.style.removeProperty('transform');
    panel.classList.remove('is-active');
  });
  document.querySelectorAll('.solar-intro,.return-message').forEach(panel => panel.setAttribute('aria-hidden','true'));
  ring.hidden = true;
  ring.inert = true;
  isReading = !error;
  if (error) {
    failed = true;
    document.querySelector('#render-note').hidden = false;
    scene?.dispose?.();
    readingButton.hidden = true;
  } else {
    readingButton.textContent = 'Return to the visual journey';
  }
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({behavior:'instant', block:'start'});
    measure();
  });
}

function handleError(error) {
  console.warn('The visual journey is unavailable.', error);
  makeReadable({error:true});
  requestAnimationFrame(() => {
    const requested = location.hash.slice(1);
    if (requested in anchors) goTo(requested, { instant: true, updateHash: false });
  });
}

function updateOrbit(p) {
  const opacity = smooth((p - .478) / .035) * (1 - smooth((p - .817) / .025));
  if (!scene || !ringStops.length || opacity < .005 || isReading || failed) { ring.hidden = true; return; }
  const layout = scene.getOrbitLayout();
  ring.hidden = false;
  ring.style.opacity = opacity.toFixed(4);
  const interactive = p >= .565 && opacity > .7;
  ring.inert = !interactive;
  ring.setAttribute('aria-hidden', String(!interactive));
  const label = ring.querySelector('.orbit-label');
  label.style.left = `${layout.label.x.toFixed(2)}px`;
  label.style.top = `${layout.label.y.toFixed(2)}px`;
  label.style.opacity = String(smooth((p - .54) / .03));
  const useList = ringStops.length > 32 || layout.stops.length < ringStops.length;
  const stops = ring.querySelector('#orbit-stops');
  // Orbital positions are viewport coordinates; only the condensed list belongs
  // inside the transformed label. Otherwise its offset displaces every control.
  const stopsParent = useList ? label : ring;
  if (stops.parentElement !== stopsParent) stopsParent.append(stops);
  ring.classList.toggle('is-list', useList);
  ringStops.forEach((link, index) => {
    const stop = layout.stops[index];
    if (!stop) return;
    link.style.left = `${stop.x.toFixed(2)}px`;
    link.style.top = `${stop.y.toFixed(2)}px`;
  });
  const projectIndex = projectAtProgress(projectLayout, p);
  const selected = projectPresentation.controls[projectIndex];
  const [number, total] = selected.counter.split(' / ');
  document.querySelector('#project-number').textContent = number;
  document.querySelector('#project-count').textContent = ` / ${total}`;
  ring.setAttribute('aria-label', `Project navigation, ${selected.project.name}, ${selected.counter}`);
  ringStops.forEach((link, index) => {
    if (index === projectIndex) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
}

function updatePresentation(progress) {
  if (isReading || failed) return;
  const p = clamp(progress);
  updateOrbit(p);
  if (Math.abs(p - previousProgress) < .000015) return;
  previousProgress = p;

  let active = '';
  let highestOpacity = 0;
  panels.forEach(panel => {
    const start = Number(panel.dataset.start);
    const end = Number(panel.dataset.end);
    const fade = Number(panel.dataset.fade) || (panel.id === 'about' ? .025 : panel.id === 'contact' ? .027 : .012);
    const entry = start === 0 ? 1 : smooth((p - start) / fade);
    const exit = end === 1 ? 1 : 1 - smooth((p - (end - fade)) / fade);
    const opacity = entry * exit;
    const visible = opacity > .006;
    panel.classList.toggle('is-active', visible);
    panel.style.opacity = opacity.toFixed(4);
    panel.style.transform = prefersReducedMotion() ? 'none' : `translateY(${((1 - opacity) * (p < start + fade ? 10 : -8)).toFixed(2)}px)`;
    panel.inert = opacity < .35;
    panel.setAttribute('aria-hidden', String(opacity < .35 || !panel.id));
    if (panel.id && opacity > highestOpacity) { active = panel.id; highestOpacity = opacity; }
  });

  if (active && active !== lastActive) {
    lastActive = active;
    document.querySelectorAll('.main-nav>a').forEach(link => {
      const current = link.hash === '#about' ? active === 'about' : link.hash === '#contact' ? active === 'contact' : link.hash === '#projects' && projectIds.includes(active);
      if (current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  if (pendingFocus && active === pendingFocus && Math.abs(p - anchors[pendingFocus]) < .012) {
    document.getElementById(pendingFocus).focus({preventScroll:true});
    pendingFocus = undefined;
  }

  progressFill.style.transform = `scaleX(${p.toFixed(5)})`;
  const inProjects = p >= .48 && p < .84;
  body.classList.toggle('is-projects', inProjects);
  body.classList.toggle('is-contact', p >= .94);
  const shade = p < .15 ? .08 : p < .48 ? .65 : p < .84 ? .08 : p < .94 ? .25 : 0;
  body.style.setProperty('--shade', shade);

  const phaseLabel = p < .10 ? 'A little perspective' : p < .22 ? 'A change in perspective' : p < .48 ? 'The human in the system' : p < .83 ? 'Selected studies' : p < .94 ? 'Back to earth' : 'A new conversation';
  if (phaseLabel !== lastSceneLabel) {
    lastSceneLabel = phaseLabel;
    sceneLabel.textContent = phaseLabel;
  }
  const nextId = p < .22 ? 'about' : p < .48 ? 'projects' : p < .94 ? 'contact' : 'hello';
  scrollCue.href = `#${nextId}`;
  scrollCueText.textContent = p < .10 ? 'Scroll to explore' : p >= .94 ? 'Back to the beginning' : 'Continue the journey';
  scrollCue.querySelector('svg').style.transform = p >= .94 ? 'rotate(180deg)' : '';

}

function sizeProjectPreviews() {
  document.querySelectorAll('.project-panel .project-art').forEach(art => {
    art.style.setProperty('--preview-scale', (art.clientWidth / 700).toFixed(4));
  });
}
addEventListener('resize', sizeProjectPreviews, { passive: true });
sizeProjectPreviews();

menuButton.addEventListener('click', () => setMenu(menu.hidden));
document.addEventListener('click', event => {
  if (!event.target.closest('.masthead')) setMenu(false);
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.hash.slice(1);
  if (!(id in anchors)) return;
  event.preventDefault();
  goTo(id, {focus:event.detail === 0});
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !menu.hidden) {
    setMenu(false);
    menuButton.focus();
  }
});
readingButton.addEventListener('click', () => {
  setMenu(false);
  if (!isReading) { makeReadable(); return; }
  isReading = false;
  body.classList.remove('is-reading');
  body.classList.add('has-journey');
  readingButton.textContent = 'Read as a page';
  measure();
  goTo(location.hash.slice(1) in anchors ? location.hash.slice(1) : lastActive || 'hello', {instant:true, updateHash:false});
});
addEventListener('scroll', () => scheduleScrollUpdate(), {passive:true});
addEventListener('resize', () => scheduleScrollUpdate({measure:true, preserve:true}), {passive:true});
addEventListener('hashchange', () => {
  const restored = restoredProjectHash === location.hash;
  restoredProjectHash = null;
  if (!restored) goTo(location.hash.slice(1), {updateHash:false});
});
addEventListener('pagehide', event => {
  if (event.persisted) return;
  cancelAnimationFrame(scrollFrame);
  contentObserver.disconnect();
  scene?.dispose?.();
});

loadProjects();
body.classList.add('has-journey');
updatePresentation(0);
measure();
import('./scene.js').then(({JourneyScene}) => {
  try {
    scene = new JourneyScene(document.querySelector('#world'), {
      reducedMotion:prefersReducedMotion(),
      projectIds:projectLayout.ids,
      onProgress:updatePresentation,
      onError:handleError
    });
    if (failed) { scene.dispose?.(); return; }
    window.__journeyScene = scene;
    scene.setProjectFocus(focusedProjectId);
    measure();
    const requested = location.hash.slice(1);
    if (requested in anchors) { goTo(requested, {instant:true, updateHash:false}); scene.setProgress(anchors[requested], true); }
    else { scrollTo({top:0, behavior:'instant'}); scene.setProgress(0); }
    scene.frame(performance.now());
    document.fonts.ready.then(() => { measure(); sizeProjectPreviews(); });
  } catch (error) { handleError(error); }
}).catch(handleError);
