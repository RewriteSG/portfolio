const scenes = [
  ['hello', "Hello. I'm V.", 'HELLO'],
  ['beams', 'Beams', 'BEAMS'],
  ['drop', 'From an idea', 'FROM\nAN IDEA'],
  ['ball', 'Give shape', 'GIVE\nSHAPE'],
  ['flow', 'Flow', 'FLOW'],
  ['neons', 'Neons', 'NEONS'],
  ['height', 'Let it morph', 'LET IT\nMORPH'],
  ['wave', 'Wave', 'WAVE'],
  ['face', 'Keep trying', 'KEEP\nTRYING'],
  ['rocks', 'Keep learning', 'KEEP\nLEARNING'],
  ['galaxy', 'Work as a team', 'WORK\nAS A TEAM'],
  ['gravity', 'Gravity', 'GRAVITY'],
  ['city', 'City', 'CITY'],
  ['end', 'Thanks for watching', 'THANKS FOR\nWATCHING'],
];
const $ = (selector) => document.querySelector(selector);
const presentation = $('#presentation');
const stage = $('#stage');
const about = $('#about');
const help = $('#help');
const menu = $('#menu');
const menuItems = $('#menu-items');
const audio = $('#ambient-audio');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let experience;
let activeScene = 0;
let quality = 1;
let navigatingUntil = 0;
let aboutOpen = false;
let helpOpen = false;
let helpSlide = 0;
let menuOpen = false;
let soundOn = false;
let aboutTimer;
let previousHelpFocus;

function announce(text) { $('#announcement').textContent = text; }
function syncPaused() { experience?.setPaused(aboutOpen || helpOpen || document.hidden); }
function closeMenu() { setMenu(false); }
function setMenu(open) {
  menuOpen = open;
  menu.classList.toggle('is-open', open);
  menuItems.hidden = !open;
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
function showFallback(error) {
  $('#fallback').hidden = false;
  $('#fallback-title').textContent = scenes[activeScene][2];
  stage.hidden = true;
  console.warn('The presentation could not start.', error);
}
function updateScene() {
  document.querySelectorAll('.scene-dot').forEach((button, index) => {
    if (index === activeScene) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  stage.setAttribute('aria-label', `${scenes[activeScene][1]} — scene ${activeScene + 1} of ${scenes.length}. An animated monochrome WebGL experiment.`);
  $('#fallback-title').textContent = scenes[activeScene][2];
  announce(`${scenes[activeScene][1]}. Scene ${activeScene + 1} of ${scenes.length}.`);
}
function goTo(index, direct = false) {
  if (aboutOpen || helpOpen) return;
  if (!direct && performance.now() < navigatingUntil) return;
  if (index >= scenes.length) { openAbout(); return; }
  index = Math.max(0, Math.min(scenes.length - 1, index));
  if (index === activeScene) return;
  activeScene = index;
  navigatingUntil = performance.now() + (reducedMotion ? 350 : 1550);
  try { experience?.goTo(index); } catch (error) { showFallback(error); }
  updateScene();
}
function openAbout() {
  if (aboutOpen || helpOpen) return;
  closeMenu();
  clearTimeout(aboutTimer);
  aboutOpen = true;
  about.hidden = false;
  about.inert = false;
  presentation.inert = true;
  requestAnimationFrame(() => document.body.classList.add('about-open'));
  $('#back-to-presentation').focus({ preventScroll: true });
  syncPaused();
  announce('About me. Use the button at the top to return to the presentation.');
}
function closeAbout() {
  if (!aboutOpen) return;
  aboutOpen = false;
  document.body.classList.remove('about-open');
  presentation.inert = false;
  about.inert = true;
  $('#about-trigger').focus({ preventScroll: true });
  aboutTimer = setTimeout(() => { if (!aboutOpen) about.hidden = true; }, reducedMotion ? 0 : 900);
  syncPaused();
  announce(`Presentation. ${scenes[activeScene][1]}.`);
}
function setHelpSlide(index) {
  helpSlide = (index + 2) % 2;
  for (let i = 0; i < 2; i++) $(`#help-slide-${i}`).hidden = i !== helpSlide;
  document.querySelectorAll('[data-help-slide]').forEach((button, index) => {
    if (index === helpSlide) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}
function openHelp() {
  previousHelpFocus = document.activeElement;
  closeMenu();
  helpOpen = true;
  help.hidden = false;
  presentation.inert = true;
  setHelpSlide(0);
  $('#help-close').focus();
  syncPaused();
}
function closeHelp() {
  if (!helpOpen) return;
  helpOpen = false;
  help.hidden = true;
  presentation.inert = false;
  // The Help button lives in the closed menu; return to its menu trigger.
  const focusTarget = previousHelpFocus?.closest('#menu-items') ? $('#menu-toggle') : previousHelpFocus;
  (focusTarget || $('#menu-toggle')).focus({ preventScroll: true });
  syncPaused();
}

scenes.forEach(([name, label], index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'scene-dot';
  button.dataset.scene = name;
  button.dataset.label = label.toUpperCase();
  button.title = label;
  button.setAttribute('aria-label', `${index + 1}. ${label}`);
  button.addEventListener('click', () => goTo(index, true));
  $('#scene-map').append(button);
});
updateScene();
$('#menu-toggle').addEventListener('click', () => setMenu(!menuOpen));
$('#about-trigger').addEventListener('click', openAbout);
$('#back-to-presentation').addEventListener('click', closeAbout);
$('#help-toggle').addEventListener('click', openHelp);
$('#help-close').addEventListener('click', closeHelp);
document.querySelectorAll('[data-help-slide]').forEach((button) => button.addEventListener('click', () => setHelpSlide(Number(button.dataset.helpSlide))));
document.addEventListener('click', (event) => { if (menuOpen && !menu.contains(event.target)) closeMenu(); });
$('#quality-toggle').addEventListener('click', () => {
  quality = quality === 1 ? 0.5 : 1;
  $('#quality-toggle').textContent = `QUALITY ${quality}`;
  experience?.setQuality(quality);
  announce(`Rendering quality ${quality}.`);
});
$('#sound-toggle').addEventListener('click', async () => {
  const button = $('#sound-toggle');
  if (soundOn) {
    audio.pause();
    soundOn = false;
  } else {
    try { audio.volume = 0.5; await audio.play(); soundOn = true; }
    catch { announce('Sound could not start. Select Unmute to try again.'); }
  }
  button.textContent = soundOn ? 'MUTE' : 'UNMUTE';
  button.setAttribute('aria-pressed', String(soundOn));
  button.title = soundOn ? 'Turn sound off' : 'Turn sound on';
});
window.addEventListener('wheel', (event) => {
  if (aboutOpen || helpOpen || event.ctrlKey || Math.abs(event.deltaY) < 8) return;
  event.preventDefault();
  goTo(activeScene + Math.sign(event.deltaY));
}, { passive: false });
window.addEventListener('keydown', (event) => {
  if (helpOpen) {
    if (event.key === 'Escape') { event.preventDefault(); closeHelp(); return; }
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key)) { event.preventDefault(); setHelpSlide(helpSlide + 1); return; }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); setHelpSlide(helpSlide - 1); return; }
    if (event.key === 'Tab') {
      const focusable = [...help.querySelectorAll('button')].filter((el) => !el.hidden);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (event.key === 'Escape') {
    if (aboutOpen) closeAbout();
    else { closeMenu(); $('#menu-toggle').focus(); }
    return;
  }
  if (aboutOpen || event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
  if ([' ', 'Enter'].includes(event.key) && event.target.closest('button,a')) return;
  const next = ['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(event.key);
  const previous = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key);
  if (next || previous) { event.preventDefault(); goTo(activeScene + (next ? 1 : -1)); }
  if (event.key === 'Home') { event.preventDefault(); goTo(0, true); }
  if (event.key === 'End') { event.preventDefault(); goTo(scenes.length - 1, true); }
});
let touchStart;
presentation.addEventListener('touchstart', (event) => {
  if (event.touches.length !== 1 || event.target.closest('button,a')) { touchStart = null; return; }
  touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
presentation.addEventListener('touchend', (event) => {
  if (!touchStart || !event.changedTouches.length) return;
  const dx = touchStart.x - event.changedTouches[0].clientX;
  const dy = touchStart.y - event.changedTouches[0].clientY;
  touchStart = null;
  if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)) goTo(activeScene + Math.sign(dy));
}, { passive: true });
window.addEventListener('resize', () => experience?.resize());
document.addEventListener('visibilitychange', () => {
  syncPaused();
  if (document.hidden) audio.pause();
  else if (soundOn) audio.play().catch(() => {});
});
window.addEventListener('pagehide', (event) => {
  audio.pause();
  if (event.persisted) experience?.setPaused(true);
  else experience?.dispose();
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  syncPaused();
  if (soundOn) audio.play().catch(() => {});
});

try {
  const { createExperience } = await import('./scene.js');
  experience = await createExperience(stage, { reducedMotion });
  experience.setQuality(quality);
  if (activeScene) experience.goTo(activeScene);
  stage.querySelectorAll('canvas').forEach((canvas) => canvas.setAttribute('aria-hidden', 'true'));
  syncPaused();
} catch (error) { showFallback(error); }
finally {
  $('#loader').classList.add('is-loaded');
  setTimeout(() => { $('#loader').hidden = true; }, reducedMotion ? 0 : 550);
}
