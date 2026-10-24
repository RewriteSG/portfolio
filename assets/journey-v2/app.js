import { loadProjectManifest, resolveProjectMedia, safeEmail, safeHttpUrl } from './project-data.js';
import { buildProjectPresentation } from './project-presentation.js';
import { createProjectCatalog } from './project-catalog.js';
import { buildProjectLayout, projectAtProgress, buildScrollMetrics, progressAtScroll, scrollAtProgress, sceneScrollRange } from './project-layout.js';
import { createProjectPages, renderProjectChapters } from './project-pages.js';
import { JourneySettingsError, validateJourneySettings } from './settings.js';

const body = document.body;
const startupGate = document.querySelector('#journey-startup-gate');
const startupStatus = document.querySelector('#startup-status');
const startupError = document.querySelector('#startup-error');
const startupRetry = document.querySelector('#startup-retry');
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
const anchors = {hello:0, about:.245, projects:.535, contact:.955};
const projectIds = ['projects'];
let scene;
let previousProgress = -1;
let projectLayout = buildProjectLayout([]);
let scrollMetrics = buildScrollMetrics(projectLayout, innerHeight);
let scrollFrame = 0;
let needsMeasure = false;
let preserveOnMeasure = false;
let journeyReady = false;
let isReading = false;
let requestedReading = false;
let failed = false;
let pendingFocus;
let lastSceneLabel = '';
let lastActive = '';
let projectPages;
let projectCatalog;
let focusedProjectId = null;
let restoredProjectHash = null;
let restoringFocusPanel = null;
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
  document.querySelector('.contact-socials')?.remove();
  emailLink.after(socials);
  if (typeof info.footer === 'string') document.querySelector('.contact-copy').append(textElement('p', 'footer-credit', info.footer));
}

bindSiteInfo(window.SITE_INFO);

const projectSection = document.querySelector('#projects');
const projectMount = document.querySelector('#project-mount');
projectMount.className = 'project-mount';
projectMount.removeAttribute('aria-live');
projectSection.querySelector('.project-preview')?.remove();
projectSection.classList.remove('project-panel');
projectSection.classList.add('project-index');
const projectsHeading = document.querySelector('#projects-heading');
projectsHeading.tabIndex = -1;
const projectStatus = projectSection.querySelector('.body-copy');
projectStatus.setAttribute('role', 'status');
projectStatus.id = 'projects-status';
const projectJumpList = textElement('nav', 'project-jump-list', '');
projectJumpList.setAttribute('aria-label', 'Browse featured project chapters');
projectSection.querySelector('#project-catalog').after(projectJumpList);

function showProjectStatus(message) {
  projectStatus.textContent = message;
  document.querySelector('#projects-retry')?.remove();
}

function loadProjects({projects, rejected}, orbitCount) {
  const requestedHash = location.hash.slice(1);
  const wasAtProjectsAnchor = requestedHash === 'projects'
    && Math.abs((scene?.targetProgress ?? progressAtScroll(scrollMetrics, scrollY)) - anchors.projects) < .012;
  projectPages?.destroy();
  projectCatalog?.destroy();
  projectPresentation = buildProjectPresentation(projects, orbitCount);
  projectLayout = buildProjectLayout(projectPresentation.chapters.map(item => item.id));
  renderProjectChapters({presentation:projectPresentation, mount:projectMount, controls:document.querySelector('#orbit-stops'), indexControls:projectJumpList, resolveMedia:resolveProjectMedia});
  projectIds.splice(1, projectIds.length, ...projectPresentation.chapters.map(item => item.targetId));
  projectSection.dataset.start = String(projectLayout.projectsStageStart);
  projectSection.dataset.end = String(projectLayout.projectsStageEnd);
  panels = [...document.querySelectorAll('.scene-panel')];
  refreshStaticSectionAnchors();
  anchors.projects = projectLayout.projectsStageStart;
  projectPresentation.chapters.forEach(item => {
    const panel = panels.find(candidate => candidate.id === item.targetId);
    anchors[item.targetId] = panel ? panelContentRange(panel).start : item.progress;
  });
  ringStops = [...document.querySelectorAll('.orbit-stop')];
  body.classList.toggle('has-many-projects', projectPresentation.orbitCount > 32);
  const summary = projects.length ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} to explore.` : 'No projects to show yet.';
  showProjectStatus(`${summary}${rejected ? ` ${rejected} invalid ${rejected === 1 ? 'entry was' : 'entries were'} skipped.` : ''}`);
  projectPages = createProjectPages({projects, presentation:projectPresentation, resolveMedia:resolveProjectMedia,
    onOpen:item => {
      focusedProjectId = item.id;
      scene?.setProjectFocus(item.id);
      document.dispatchEvent(new CustomEvent('journey:project-open', {detail:item}));
    },
    onClose:({direct, restore}) => {
      focusedProjectId = null;
      scene?.setProjectFocus(null);
      // A modal temporarily moves focus away from its invoking chapter.
      // Re-enable that chapter before the controller restores keyboard focus.
      restoringFocusPanel = restore?.focus?.closest('.scene-panel') || null;
      if (restoringFocusPanel) {
        restoringFocusPanel.inert = false;
        restoringFocusPanel.classList.add('is-active');
        restoringFocusPanel.style.opacity = '1';
        restoringFocusPanel.setAttribute('aria-hidden', 'false');
      }
      // popstate precedes hashchange: preserve the controller's exact scroll restore.
      restoredProjectHash = location.hash;
      if (direct) goTo('projects', {instant:true, updateHash:false});
    },
  });
  projectCatalog = createProjectCatalog({root:projectSection, projects, resolveMedia:resolveProjectMedia,
    onOpen:(project, invoker) => projectPages.open(project.id, {invoker}),
    onPageChange:() => scheduleScrollUpdate({measure:true, preserve:true}),
  });
  window.__journeyProjects = {presentation:projectPresentation, pages:projectPages, catalog:projectCatalog};
  document.dispatchEvent(new CustomEvent('journey:projects-ready', {detail:{presentation:projectPresentation, projects, wasAtProjectsAnchor}}));
  measure();
  projectPages.syncFromLocation();
}

document.addEventListener('journey:project-route-error', () => showProjectStatus('That project link is unavailable. Choose a project below.'));

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const prefersReducedMotion = () => motionPreference.matches;

function panelFade(panel) {
  const start = Number(panel.dataset.start);
  const end = Number(panel.dataset.end);
  const configured = Number(panel.dataset.fade) || (panel.id === 'about' ? .025 : panel.id === 'contact' ? .027 : .012);
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? Math.min(configured, (end - start) / 4)
    : configured;
}

function panelContentRange(panel) {
  return sceneScrollRange(Number(panel.dataset.start), Number(panel.dataset.end), panelFade(panel));
}

function preserveStageLocalProgress(progress) {
  const start = projectLayout.projectsStageStart;
  const end = projectLayout.projectsStageEnd;
  if (progress < start || progress > end) return progress;
  const localProgress = clamp((progress - start) / (end - start));
  return start + localProgress * (end - start);
}

function refreshStaticSectionAnchors() {
  ['about', 'contact'].forEach(id => {
    const panel = panels.find(candidate => candidate.id === id);
    if (panel) anchors[id] = panelContentRange(panel).start;
  });
}
refreshStaticSectionAnchors();

function syncSceneContent(scrollPosition = scrollY) {
  if (!body.classList.contains('has-journey')) return;
  panels.forEach(panel => {
    const overflow = Math.max(0, panel.scrollHeight - panel.clientHeight);
    if (!overflow) {
      if (panel.scrollTop) panel.scrollTop = 0;
      return;
    }
    const range = panelContentRange(panel);
    const from = scrollAtProgress(scrollMetrics, range.start);
    const to = scrollAtProgress(scrollMetrics, range.end);
    const amount = to > from ? clamp((scrollPosition - from) / (to - from)) * overflow : 0;
    if (Math.abs(panel.scrollTop - amount) > .5) panel.scrollTop = amount;
  });
}

function hasKeyboardFocusWithin(container) {
  return container.matches(':focus-visible') || Boolean(container.querySelector(':focus-visible'));
}

function revealFocusedContent(event) {
  if (!body.classList.contains('has-journey') || !(event.target instanceof Element)) return;
  const panel = event.target.closest('.scene-panel');
  if (!panel || panel.inert || event.target === panel) return;
  const overflow = Math.max(0, panel.scrollHeight - panel.clientHeight);
  if (!overflow) return;
  const panelBounds = panel.getBoundingClientRect();
  const targetBounds = event.target.getBoundingClientRect();
  const margin = 12;
  let contentOffset = panel.scrollTop;
  if (targetBounds.top < panelBounds.top + margin) contentOffset -= panelBounds.top + margin - targetBounds.top;
  if (targetBounds.bottom > panelBounds.bottom - margin) contentOffset += targetBounds.bottom - panelBounds.bottom + margin;
  contentOffset = clamp(contentOffset / overflow) * overflow;
  const range = panelContentRange(panel);
  const from = scrollAtProgress(scrollMetrics, range.start);
  const to = scrollAtProgress(scrollMetrics, range.end);
  const targetScroll = from + (contentOffset / overflow) * (to - from);
  if (Math.abs(scrollY - targetScroll) > 1) {
    scrollTo({top:targetScroll, behavior:'instant'});
    syncSceneContent(targetScroll);
  }
}
document.addEventListener('focusin', revealFocusedContent);

function setMenu(open) {
  const restoreFocus = !open && menu.contains(document.activeElement);
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close options' : 'More options');
  if (restoreFocus) menuButton.focus({preventScroll:true});
}

function measure(preservePosition = false) {
  let progress = preservePosition && scene ? scene.targetProgress : progressAtScroll(scrollMetrics, scrollY);
  if (preservePosition) progress = preserveStageLocalProgress(progress);
  const panelMetrics = panels.map(panel => ({
    start:Number(panel.dataset.start),
    end:Number(panel.dataset.end),
    fade:panelFade(panel),
    overflow:Math.max(0, panel.scrollHeight - panel.clientHeight),
    minimumDuration:panel.dataset.projectId ? Math.max(640, innerHeight * .9) : 0,
  }));
  scrollMetrics = buildScrollMetrics(projectLayout, innerHeight, panelMetrics);
  track.style.height = `${scrollMetrics.total + innerHeight}px`;
  previousProgress = -1;
  if (body.classList.contains('has-journey')) {
    if (preservePosition) scrollTo({top:scrollAtProgress(scrollMetrics, progress), behavior:'instant'});
    const p = progressAtScroll(scrollMetrics, scrollY);
    scene?.setProgress(p);
    updatePresentation(p);
    syncSceneContent(scrollY);
  }
}

// Scroll handlers only schedule; document geometry is read on explicit invalidation.
function scheduleScrollUpdate({measure:refresh = false, preserve = false} = {}) {
  needsMeasure ||= refresh;
  preserveOnMeasure ||= preserve;
  if (scrollFrame || document.hidden) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    if (needsMeasure) {
      needsMeasure = false;
      const restore = preserveOnMeasure;
      preserveOnMeasure = false;
      measure(restore);
    }
    if (body.classList.contains('has-journey')) {
      scene?.setProgress(progressAtScroll(scrollMetrics, scrollY));
      syncSceneContent(scrollY);
    }
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
  if (!journeyReady) return;
  const requested = location.hash.slice(1);
  if (event.detail.wasAtProjectsAnchor && requested === 'projects') {
    goTo('projects', {instant:true, updateHash:false, focus:true});
  } else if (event.detail.presentation.chapters.some(item => item.targetId === requested)) {
    goTo(requested, {instant:true, updateHash:false, focus:true});
  }
});

function goTo(id, {focus = false, updateHash = true, instant = false} = {}) {
  if (!(id in anchors)) return;
  setMenu(false);
  previousProgress = -1;
  const target = document.getElementById(id);
  if (body.classList.contains('has-journey')) {
    if (focus) pendingFocus = id;
    scrollTo({top:scrollAtProgress(scrollMetrics, anchors[id]), behavior: instant || prefersReducedMotion() ? 'instant' : 'smooth'});
    if (instant) {
      scene?.setProgress(anchors[id], true);
      updatePresentation(anchors[id]);
      syncSceneContent(scrollY);
    } else updatePresentation(scene?.progress ?? progressAtScroll(scrollMetrics, scrollY));
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
    panel.setAttribute('aria-hidden', 'false');
    panel.style.removeProperty('opacity');
    panel.style.removeProperty('transform');
    panel.classList.remove('is-active');
  });
  document.querySelectorAll('.solar-intro,.return-message').forEach(panel => panel.setAttribute('aria-hidden','true'));
  ring.hidden = true;
  ring.inert = true;
  isReading = !error;
  scene?.setPaused(true);
  if (error) {
    failed = true;
    document.querySelector('#render-note').hidden = false;
    scene?.dispose?.();
    readingButton.hidden = true;
  } else {
    readingButton.textContent = prefersReducedMotion() ? 'Reduced motion: reading as a page' : 'Return to the visual journey';
    readingButton.disabled = prefersReducedMotion();
  }
  if (!body.classList.contains('preflight-pending')) {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({behavior:'instant', block:'start'});
      measure();
    });
  }
}

function handleError(error) {
  console.warn('The visual journey is unavailable.', error);
  makeReadable({error:true});
  requestAnimationFrame(() => {
    const requested = location.hash.slice(1);
    if (requested in anchors) goTo(requested, { instant: true, updateHash: false, focus:true });
  });
}

function updateOrbit(p) {
  const opacity = smooth((p - .478) / .035) * (1 - smooth((p - .805) / .025));
  const focused = hasKeyboardFocusWithin(ring);
  if (!scene || !ringStops.length || (!focused && opacity < .005) || isReading || failed) { ring.hidden = true; return; }
  const layout = scene.getOrbitLayout();
  ring.hidden = false;
  ring.style.opacity = focused ? '1' : opacity.toFixed(4);
  const interactive = focused || (p >= .565 && opacity > .7);
  ring.inert = !interactive;
  ring.setAttribute('aria-hidden', String(!interactive));
  const label = ring.querySelector('.orbit-label');
  label.style.left = `${layout.label.x.toFixed(2)}px`;
  label.style.top = `${layout.label.y.toFixed(2)}px`;
  label.style.opacity = String(focused ? 1 : smooth((p - .54) / .03));
  const useList = ringStops.length > 32 || layout.stops.length < ringStops.length || (innerWidth <= 760 && ringStops.length > 3);
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
    const fade = panelFade(panel);
    const entry = panel.id === 'projects' ? (p >= start - .00002 ? 1 : 0) : start === 0 ? 1 : smooth((p - start) / fade);
    const exit = panel.id === 'projects'
      ? 1 - smooth((p - projectLayout.returnStart) / (projectLayout.returnEnd - projectLayout.returnStart))
      : end === 1 ? 1 : 1 - smooth((p - (end - fade)) / fade);
    const opacity = entry * exit;
    const keyboardFocused = hasKeyboardFocusWithin(panel);
    const focused = keyboardFocused || panel === restoringFocusPanel;
    const visible = opacity > .006 || focused;
    panel.classList.toggle('is-active', visible);
    panel.style.opacity = focused ? '1' : opacity.toFixed(4);
    panel.style.transform = focused || prefersReducedMotion() ? 'none' : `translateY(${((1 - opacity) * (p < start + fade ? 10 : -8)).toFixed(2)}px)`;
    panel.inert = !focused && opacity < .35;
    panel.setAttribute('aria-hidden', String((!focused && opacity < .35) || !panel.id));
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
  if (pendingFocus && active === pendingFocus && highestOpacity >= .35 && Math.abs(p - anchors[pendingFocus]) < .012) {
    document.getElementById(pendingFocus).focus({preventScroll:true});
    pendingFocus = undefined;
  }

  progressFill.style.transform = `scaleX(${p.toFixed(5)})`;
  const inProjects = p >= .48 && p < .90;
  body.classList.toggle('is-projects', inProjects);
  body.classList.toggle('is-contact', p >= .94);
  const shade = p < .15 ? .08 : p < .48 ? .65 : p < .90 ? .08 : p < .94 ? .25 : 0;
  body.style.setProperty('--shade', shade);

  const phaseLabel = p < .10 ? 'A little perspective' : p < .22 ? 'A change in perspective' : p < .48 ? 'The human in the system' : p < .90 ? 'Selected studies' : p < .94 ? 'Back to earth' : 'A new conversation';
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
  if (!isReading) { requestedReading = true; makeReadable(); return; }
  requestedReading = false;
  enableJourney();
});
function enableJourney() {
  if (failed || prefersReducedMotion()) return;
  isReading = false;
  body.classList.remove('is-reading');
  body.classList.add('has-journey');
  readingButton.textContent = 'Read as a page';
  readingButton.disabled = false;
  scene?.setPaused(false);
  measure();
  goTo(location.hash.slice(1) in anchors ? location.hash.slice(1) : lastActive || 'hello', {instant:true, updateHash:false});
}
motionPreference.addEventListener('change', () => {
  scene?.setReducedMotion(prefersReducedMotion());
  if (!journeyReady || failed) return;
  if (prefersReducedMotion()) makeReadable();
  else if (!requestedReading) enableJourney();
  else { readingButton.disabled = false; readingButton.textContent = 'Return to the visual journey'; }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(scrollFrame); scrollFrame = 0; }
  else scheduleScrollUpdate({measure:true});
});
document.addEventListener('focusin', event => {
  if (restoringFocusPanel?.contains(document.activeElement)) restoringFocusPanel = null;
  if (ring.classList.contains('is-list') && event.target.closest('.orbit-stop')) {
    event.target.scrollIntoView({behavior:'instant', block:'nearest', inline:'nearest'});
  }
  if (!body.classList.contains('has-journey')) return;
  previousProgress = -1;
  updatePresentation(scene?.progress ?? progressAtScroll(scrollMetrics, scrollY));
});
addEventListener('scroll', () => scheduleScrollUpdate(), {passive:true});
addEventListener('resize', () => scheduleScrollUpdate({measure:true, preserve:true}), {passive:true});
addEventListener('hashchange', () => {
  if (!journeyReady) return;
  const restored = restoredProjectHash === location.hash;
  restoredProjectHash = null;
  if (!restored) goTo(location.hash.slice(1), {updateHash:false, focus:true});
});
addEventListener('pagehide', event => {
  if (event.persisted) return;
  cancelAnimationFrame(scrollFrame);
  contentObserver.disconnect();
  scene?.dispose?.();
});

function setStartupChecking() {
  startupGate.hidden = false;
  startupGate.focus({preventScroll:true});
  startupGate.setAttribute('aria-busy', 'true');
  startupStatus.hidden = false;
  startupStatus.textContent = 'Checking portfolio settings and projects…';
  startupError.hidden = true;
  startupRetry.hidden = true;
}

function revealStartupContent() {
  body.classList.remove('preflight-pending');
  startupGate.hidden = true;
  journeyReady = true;
  const requested = location.hash.slice(1);
  const targetId = requested in anchors ? requested : 'hello';
  goTo(targetId, {instant:true, updateHash:false, focus:true});
  const target = document.getElementById(targetId);
  if (target && !target.inert && target.checkVisibility() && Number(getComputedStyle(target).opacity) > .35) {
    target.focus({preventScroll:true});
    pendingFocus = undefined;
  }
}

function reportStartupFailure(error) {
  startupGate.setAttribute('aria-busy', 'false');
  startupStatus.hidden = true;
  startupError.hidden = false;
  if (error instanceof JourneySettingsError) {
    startupError.textContent = `${error.message} Correct settings.json and reload the page.`;
    startupRetry.hidden = true;
    return;
  }
  console.warn('Journey startup data could not be loaded.', error);
  startupError.textContent = 'The portfolio could not load its startup data. Check your connection and retry.';
  startupRetry.hidden = false;
}

async function fetchStartupData() {
  const [settingsResponse, manifest] = await Promise.all([
    fetch('./assets/journey-v2/settings.json'),
    loadProjectManifest(),
  ]);
  if (!settingsResponse.ok) throw new Error(`Settings request failed with HTTP ${settingsResponse.status}.`);
  let settingsInput;
  try {
    settingsInput = await settingsResponse.json();
  } catch {
    throw new JourneySettingsError('<invalid JSON>', manifest.projects.length);
  }
  return {manifest, settings:validateJourneySettings(settingsInput, manifest.projects.length)};
}

async function bootJourney() {
  setStartupChecking();
  try {
    const {manifest, settings} = await fetchStartupData();
    loadProjects(manifest, settings.orbitCount);
    if (prefersReducedMotion()) makeReadable();
    else { body.classList.add('has-journey'); updatePresentation(0); }
    measure();
  } catch (error) {
    reportStartupFailure(error);
    return;
  }

  try {
    const {JourneyScene} = await import('./scene.js');
    scene = new JourneyScene(document.querySelector('#world'), {
      reducedMotion:prefersReducedMotion(),
      projectIds:projectLayout.ids,
      onProgress:updatePresentation,
      onError:handleError
    });
    if (failed) {
      scene.dispose?.();
      scene = undefined;
    } else {
      window.__journeyScene = scene;
      scene.setPaused(isReading);
      scene.setProjectFocus(focusedProjectId);
      measure();
      const requested = location.hash.slice(1);
      scene.setProgress(requested in anchors ? anchors[requested] : 0, true);
      scene.frame(performance.now());
      // Intrinsic font-driven size changes already invalidate the observed copy.
      // Avoid a second unconditional measurement resetting an explicit scene jump.
      document.fonts.ready.then(sizeProjectPreviews);
    }
  } catch (error) {
    handleError(error);
  }
  revealStartupContent();
}

startupRetry.addEventListener('click', bootJourney);
bootJourney();
