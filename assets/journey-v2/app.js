const body = document.body;
const panels = [...document.querySelectorAll('.scene-panel')];
const track = document.querySelector('#journey-track');
const ring = document.querySelector('#orbit-control');
const ringStops = [...document.querySelectorAll('.orbit-stop')];
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
let renderedProgress = 0;
let previousProgress = -1;
let maxScroll = 1;
let isReading = false;
let failed = false;
let pendingFocus;
let lastSceneLabel = '';
let lastActive = '';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const prefersReducedMotion = () => motionPreference.matches;

function setMenu(open) {
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close options' : 'More options');
}

function measure(preservePosition = false) {
  maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  previousProgress = -1;
  if (body.classList.contains('has-journey')) {
    if (preservePosition) scrollTo({ top: renderedProgress * maxScroll, behavior: 'instant' });
    scene?.setProgress(clamp(scrollY / maxScroll));
    updatePresentation(renderedProgress);
  }
}

function goTo(id, {focus = false, updateHash = true, instant = false} = {}) {
  if (!(id in anchors)) return;
  setMenu(false);
  const target = document.getElementById(id);
  if (body.classList.contains('has-journey')) {
    if (focus) pendingFocus = id;
    scrollTo({top: anchors[id] * maxScroll, behavior: instant || prefersReducedMotion() ? 'instant' : 'smooth'});
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
  ringStops.forEach((link, index) => {
    link.style.left = `${layout.stops[index].x.toFixed(2)}px`;
    link.style.top = `${layout.stops[index].y.toFixed(2)}px`;
  });
  const projectIndex = p < .645 ? 0 : p < .745 ? 1 : 2;
  document.querySelector('#project-number').textContent = String(projectIndex + 1).padStart(2, '0');
  ring.setAttribute('aria-label', `Solar system project navigation, project ${projectIndex + 1} of 3`);
  ringStops.forEach((link, index) => {
    if (index === projectIndex) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
}

function updatePresentation(progress) {
  if (isReading || failed) return;
  const p = clamp(progress);
  renderedProgress = p;
  updateOrbit(p);
  if (Math.abs(p - previousProgress) < .000015) return;
  previousProgress = p;

  let active = '';
  let highestOpacity = 0;
  panels.forEach(panel => {
    const start = Number(panel.dataset.start);
    const end = Number(panel.dataset.end);
    const fade = panel.id === 'about' ? .025 : panel.id === 'contact' ? .027 : .012;
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
addEventListener('scroll', () => {
  if (body.classList.contains('has-journey')) scene?.setProgress(clamp(scrollY / maxScroll));
}, {passive:true});
addEventListener('resize', () => measure(true), {passive:true});
addEventListener('hashchange', () => goTo(location.hash.slice(1), {updateHash:false}));
addEventListener('pagehide', event => { if (!event.persisted) scene?.dispose?.(); });

body.classList.add('has-journey');
updatePresentation(0);
measure();
import('./scene.js').then(({JourneyScene}) => {
  try {
    scene = new JourneyScene(document.querySelector('#world'), {
      reducedMotion:prefersReducedMotion(),
      onProgress:updatePresentation,
      onError:handleError
    });
    if (failed) { scene.dispose?.(); return; }
    window.__journeyScene = scene;
    measure();
    const requested = location.hash.slice(1);
    if (requested in anchors) { goTo(requested, {instant:true, updateHash:false}); scene.setProgress(anchors[requested], true); }
    else { scrollTo({top:0, behavior:'instant'}); scene.setProgress(0); }
    scene.frame(performance.now());
    document.fonts.ready.then(() => { measure(); sizeProjectPreviews(); });
  } catch (error) { handleError(error); }
}).catch(handleError);
