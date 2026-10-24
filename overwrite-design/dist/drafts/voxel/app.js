import { createWorld } from './scene.js';

const sections = [...document.querySelectorAll('.story')];
const names = ['Introduction', 'About', 'Northstar', 'Lumen', 'Field Notes', 'Approach', 'Contact'];
const places = ['The whole picture', 'A curious outlook', 'The signal house', 'A place to belong', 'The thinking garden', 'One step at a time', 'An open invitation'];
const coordinates = ['Island overview / 00', 'Lookout / 01', 'Pavilion / 02', 'Atelier / 03', 'Waterside / 04', 'The crossing / 05', 'Common ground / 06'];
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let active = 0;
let lastAdvance = 0;
let wheelTotal = 0;
let world;

function go(index, updateHash = true) {
  const target = Math.max(0, Math.min(sections.length - 1, index));
  if (target === active && document.body.dataset.chapter !== undefined) return;
  active = target;
  sections.forEach((section, i) => {
    section.hidden = i !== active;
    section.classList.toggle('active', i === active);
  });
  document.querySelectorAll('.chapter-nav [data-go]').forEach(button => {
    if (Number(button.dataset.go) === active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  document.body.dataset.chapter = String(active);
  document.querySelector('#current-number').textContent = String(active + 1).padStart(2, '0');
  document.querySelector('#chapter-status').textContent = `Chapter ${active + 1} of 7: ${names[active]}`;
  document.querySelector('#place-name').textContent = places[active];
  document.querySelector('#place-coordinate').textContent = coordinates[active];
  document.querySelector('.next-prompt span:first-child').textContent = active === 6 ? 'Use ↑ to revisit the island' : 'Scroll to explore';
  document.querySelector('.next-prompt span:last-child').textContent = active === 6 ? '↑' : '↓';
  previous.disabled = active === 0;
  next.disabled = active === sections.length - 1;
  sections[active].scrollTop = 0;
  if (updateHash) history.replaceState(null, '', `#${sections[active].id}`);
  world?.setChapter(active);
  lastAdvance = performance.now();
  wheelTotal = 0;
}

document.querySelectorAll('[data-go]').forEach(button => {
  button.addEventListener('click', () => go(Number(button.dataset.go)));
});
document.querySelector('.identity').addEventListener('click', event => { event.preventDefault(); go(0); });
previous.addEventListener('click', () => go(active - 1));
next.addEventListener('click', () => go(active + 1));
window.addEventListener('hashchange', () => {
  const index = sections.findIndex(section => `#${section.id}` === location.hash);
  if (index >= 0) go(index, false);
});
function scrollStory(delta) {
  const section = sections[active];
  const bottom = section.scrollHeight - section.clientHeight;
  if (bottom <= 2) return false;
  if ((delta > 0 && section.scrollTop < bottom - 2) || (delta < 0 && section.scrollTop > 2)) {
    section.scrollTop += delta;
    return true;
  }
  return false;
}
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === ' ' && event.target.closest('button, a')) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
    event.preventDefault();
    if (event.key !== 'ArrowRight' && scrollStory(event.key === 'ArrowDown' ? 50 : sections[active].clientHeight * .8)) return;
    go(active + 1);
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    if (event.key !== 'ArrowLeft' && scrollStory(event.key === 'ArrowUp' ? -50 : -sections[active].clientHeight * .8)) return;
    go(active - 1);
  } else if (event.key === 'Home') { event.preventDefault(); go(0); }
  else if (event.key === 'End') { event.preventDefault(); go(6); }
});
window.addEventListener('wheel', event => {
  if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  if (scrollStory(event.deltaY)) { wheelTotal = 0; return; }
  if (performance.now() - lastAdvance < (reduced.matches ? 300 : 900)) return;
  wheelTotal += event.deltaY;
  if (Math.abs(wheelTotal) > 55) go(active + Math.sign(wheelTotal));
}, { passive: false });
let touchStart;
window.addEventListener('touchstart', event => {
  if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, scrollTop: sections[active].scrollTop, section: event.target.closest('.story') };
}, { passive: true });
window.addEventListener('touchend', event => {
  if (!touchStart || !event.changedTouches.length) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  if (touchStart.section && Math.abs(sections[active].scrollTop - touchStart.scrollTop) > 2) { touchStart = undefined; return; }
  const movement = Math.abs(dy) >= Math.abs(dx) ? -dy : -dx;
  if (Math.abs(movement) > 50) go(active + Math.sign(movement));
  touchStart = undefined;
}, { passive: true });

const initial = sections.findIndex(section => `#${section.id}` === location.hash);
go(initial < 0 ? 0 : initial, false);
try {
  world = createWorld(document.querySelector('#world-canvas'), document.querySelector('#world'), reduced);
  world.setChapter(active, true);
} catch (error) {
  document.querySelector('#world-canvas').hidden = true;
  document.querySelector('#fallback').hidden = false;
  document.querySelectorAll('.world-pin').forEach(pin => { pin.hidden = true; });
  console.warn('The island could not be displayed; the complete presentation is still available.', error);
}
