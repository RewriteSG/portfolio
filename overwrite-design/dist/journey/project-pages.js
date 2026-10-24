const PROJECTS = [
  {
    id: 'northstar', name: 'Northstar', type: 'Product system study',
    premise: 'Less searching. More understanding.',
    intro: 'A shared place for research and customer signals. This study explores how scattered observations can become a direction a team understands.',
    question: 'How can a team see the signal without losing the story behind it?',
    direction: 'Search around an intention. Keep evidence close to the insight. Make the next conversation easier.',
    disciplines: ['Research experience', 'Information design', 'Product strategy'],
    sections: [
      ['Begin with a question', 'The workspace starts with “What are we learning?” A question gives the research a point of entry, whether someone is looking for an observation, a source, or a thread worth following.'],
      ['Keep the evidence close', 'An emerging theme is presented alongside linked observations and context. The idea and the reason behind it stay together, so a useful summary does not replace the story that led to it.'],
      ['Leave a thread to follow', 'Collections, questions, and a research library give the workspace different ways in. Threads such as “Finding a way in” and “The missing context” make room for the next conversation.']
    ]
  },
  {
    id: 'lumen', name: 'Lumen', type: 'Identity system study',
    premise: 'A small identity. A world of possibility.',
    intro: 'A portable identity study for a studio making thoughtful tools for teams. An open, recognisable mark gives the system a character that can move.',
    question: 'How can an identity keep its character as its surroundings change?',
    direction: 'One simple form, many expressions. A visual language that connects product, print, and motion.',
    disciplines: ['Visual identity', 'Art direction', 'Motion language'],
    sections: [
      ['One open form', 'Overlapping petals form a single, open symbol. Its repeated curves give the identity a recognisable shape without closing down the possibilities around it.'],
      ['A character that carries', 'The violet poster places the symbol beside a generous serif wordmark. The stationery carries that same character into a smaller format, with pale yellow and paper tones giving the system room to breathe.'],
      ['Room for expression', 'The study connects a poster, a business card, and a compact mark through the same visual language. Their scale and composition can change while the identity remains familiar.']
    ]
  },
  {
    id: 'field-notes', name: 'Field Notes', type: 'Workspace study',
    premise: 'Give a good question somewhere to grow.',
    intro: 'A flexible workspace study for teams who want to stay curious. Questions, observations, and half-formed ideas sit together, ready for the next conversation.',
    question: 'What happens when a workspace makes room for the unfinished?',
    direction: 'Capture lightly. Connect related thoughts. Return when an idea is ready to take shape.',
    disciplines: ['Interaction design', 'Prototyping', 'Workspace systems'],
    sections: [
      ['Start before it is finished', 'A question, an observation, a sketch, and a small possibility share the canvas. Each is useful in its current form; a thought can be captured before it becomes a polished answer.'],
      ['Connect the context', 'Light connecting lines make relationships visible without forcing every thought into a rigid sequence. Related notes can sit near one another, keeping the surrounding context in view.'],
      ['Return to a possibility', 'The workspace leaves room to revisit a thought. A shared canvas and the invitation to “Share a thought” keep the next conversation close to the material that started it.']
    ]
  }
];

const STATE_KEY = 'journeyProjectPages';
const routeFor = id => id === 'all' ? '#work' : `#work/${id}`;
function readRoute() {
  const match = location.hash.match(/^#work(?:\/([a-z-]+))?\/?$/);
  if (!match) return null;
  return PROJECTS.some(project => project.id === match[1]) ? match[1] : 'all';
}

function makeArt(id) {
  const source = document.querySelector(`#${id} .project-art`);
  if (!source) return document.createElement('div');
  const frame = document.createElement('div');
  frame.className = `study-art study-art-${id}`;
  const stage = document.createElement('div');
  stage.className = 'study-art-stage';
  const clone = source.cloneNode(true);
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  clone.removeAttribute('id');
  clone.removeAttribute('style');
  stage.append(clone);
  frame.append(stage);
  return frame;
}

/** Project index and full studies, presented over the preserved journey. */
export function createProjectPages({onOpen, onDismiss, onClose, onSelect} = {}) {
  const session = `projects-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'project-pages';
  dialog.setAttribute('aria-labelledby', 'study-page-heading');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = '<div class="study-page"><header class="study-page-header"><a class="study-home" href="#work" data-project-open="all">Hazwan <span>Selected studies</span></a><button class="study-close" type="button" aria-label="Close projects and return to the journey">Back to the journey <span aria-hidden="true">×</span></button></header><main class="study-page-content"></main></div>';
  document.body.append(dialog);
  const content = dialog.querySelector('.study-page-content');
  let current = null;
  const initialRoute = readRoute();
  let initialRoutePending = Boolean(initialRoute);
  let returnHash = initialRoute ? `#${initialRoute === 'all' ? 'northstar' : initialRoute}` : location.hash || '#hello';
  let restoreFocus = null;
  let savedScroll = [0, 0];
  let savedJourneyProgress = null;
  let savedBodyOverflow = '';
  let savedRootOverflow = '';
  let artObserver;
  let closeTimer;
  let isClosing = false;

  function sizeArt() {
    dialog.querySelectorAll('.study-art').forEach(frame => {
      const stage = frame.firstElementChild;
      const scale = frame.clientWidth / 700;
      stage.style.transform = `scale(${scale})`;
      frame.style.height = `${stage.offsetHeight * scale}px`;
    });
  }

  function render(id) {
    artObserver?.disconnect();
    dialog.dataset.study = id;
    if (id === 'all') {
      content.innerHTML = '<div class="study-index-intro"><p class="study-kicker">A few ideas. A wider orbit.</p><h1 id="study-page-heading" tabindex="-1">Selected studies<span>Three explorations in making things clearer.</span></h1></div><div class="study-index"></div><p class="study-index-footnote">Product systems, visual identity, and spaces for ideas.</p>';
      const grid = content.querySelector('.study-index');
      PROJECTS.forEach(project => {
        const item = document.createElement('article');
        item.className = 'study-index-item';
        const preview = document.createElement('a');
        preview.className = 'study-index-preview';
        preview.href = routeFor(project.id);
        preview.dataset.projectOpen = project.id;
        preview.setAttribute('aria-label', `Read the ${project.name} study`);
        preview.append(makeArt(project.id));
        item.append(preview);
        const description = document.createElement('div');
        description.className = 'study-index-description';
        description.innerHTML = `<p class="study-kicker">${project.type}</p><h2><a href="${routeFor(project.id)}" data-project-open="${project.id}">${project.name}</a></h2><p>${project.premise}</p><button class="study-text-button" type="button" data-project-open="${project.id}">View study <span aria-hidden="true">↗</span></button>`;
        item.append(description);
        grid.append(item);
      });
    } else {
      const project = PROJECTS.find(project => project.id === id);
      const next = PROJECTS[(PROJECTS.indexOf(project) + 1) % PROJECTS.length];
      content.innerHTML = `<article class="full-study"><div class="study-intro"><a class="study-back" href="#work" data-project-open="all"><span aria-hidden="true">←</span> All projects</a><p class="study-kicker">${project.type}</p><h1 id="study-page-heading" tabindex="-1">${project.name}</h1><p class="study-premise">${project.premise}</p><p class="study-introduction">${project.intro}</p><ul class="study-disciplines">${project.disciplines.map(item => `<li>${item}</li>`).join('')}</ul></div><div class="study-hero-art"></div><div class="study-question"><p class="study-kicker">The design question</p><h2>${project.question}</h2><div><p class="study-kicker">The direction</p><p>${project.direction}</p></div></div><div class="study-sections">${project.sections.map(([heading, description]) => `<section><h2>${heading}</h2><p>${description}</p></section>`).join('')}</div><footer class="study-next"><button class="study-text-button" type="button" data-project-open="all">All projects <span aria-hidden="true">↗</span></button><a href="${routeFor(next.id)}" data-project-open="${next.id}"><span>Next study</span><strong>${next.name}</strong><span aria-hidden="true">↗</span></a></footer></article>`;
      content.querySelector('.study-hero-art').append(makeArt(id));
    }
    dialog.scrollTop = 0;
    requestAnimationFrame(() => {
      sizeArt();
      content.querySelector('#study-page-heading')?.focus({preventScroll:true});
    });
    if (typeof ResizeObserver !== 'undefined') {
      artObserver = new ResizeObserver(sizeArt);
      dialog.querySelectorAll('.study-art').forEach(frame => artObserver.observe(frame));
    }
    onSelect?.(id);
  }

  function finishClose() {
    clearTimeout(closeTimer);
    if (!dialog.open) return;
    dialog.close();
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedRootOverflow;
    document.body.classList.remove('has-project-page');
    const restoredTop = savedJourneyProgress === null ? savedScroll[1] : savedJourneyProgress * Math.max(1, document.documentElement.scrollHeight - innerHeight);
    scrollTo({left:savedScroll[0], top:restoredTop, behavior:'instant'});
    artObserver?.disconnect();
    current = null;
    isClosing = false;
    onClose?.();
    // A project may no longer be the selected chapter after a direct link.
    // Restore its actual trigger only while that trigger remains available.
    if (restoreFocus?.isConnected && restoreFocus.matches('a,button,input,textarea,select,[tabindex]') && !restoreFocus.closest('[inert]')) restoreFocus.focus({preventScroll:true});
    else document.querySelector('#orbit-control:not([hidden]) #view-all-projects')?.focus({preventScroll:true});
    restoreFocus = null;
  }

  function hide() {
    if (!dialog.open || isClosing) return;
    isClosing = true;
    onDismiss?.();
    dialog.classList.remove('is-visible');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishClose();
    else closeTimer = setTimeout(finishClose, 740);
  }

  function syncRoute() {
    const id = readRoute();
    if (!id) { hide(); return; }
    if (isClosing) { clearTimeout(closeTimer); isClosing = false; }
    if (current === id && dialog.open) { dialog.classList.add('is-visible'); onSelect?.(id); return; }
    const firstOpen = !dialog.open;
    if (firstOpen) {
      // The initial study route can arrive before a readable fallback has
      // positioned its chapter. Preview sizing has already run at this point.
      if (initialRoutePending) {
        initialRoutePending = false;
        onSelect?.(id === 'all' ? 'northstar' : id);
      }
      restoreFocus = document.activeElement;
      savedScroll = [scrollX, scrollY];
      savedJourneyProgress = document.body.classList.contains('has-journey') ? scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight) : null;
      savedBodyOverflow = document.body.style.overflow;
      savedRootOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('has-project-page');
      dialog.showModal();
      onOpen?.(id);
    }
    current = id;
    render(id);
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-visible')));
  }

  function open(id = 'all') {
    if (id !== 'all' && !PROJECTS.some(project => project.id === id)) return;
    if (readRoute() === id) { syncRoute(); return; }
    const previousState = history.state?.[STATE_KEY];
    const ownsHistory = previousState?.session === session;
    const hasBase = current ? Boolean(ownsHistory && previousState.hasBase) : true;
    if (!current) {
      const activeProject = document.querySelector('.project-panel.is-active');
      returnHash = activeProject ? `#${activeProject.id}` : location.hash || '#northstar';
      // Native scrolling can leave an older chapter in the URL. Give Back a
      // truthful project destination without moving the journey underneath.
      if (location.hash !== returnHash) history.replaceState(history.state, '', returnHash);
    }
    const depth = current && ownsHistory ? previousState.depth + 1 : 1;
    history.pushState({...history.state, [STATE_KEY]:{session, depth, hasBase, returnHash}}, '', routeFor(id));
    syncRoute();
  }

  function close() {
    if (!dialog.open || isClosing) return;
    const state = history.state?.[STATE_KEY];
    if (state?.session === session && state.hasBase && state.depth > 0) history.go(-state.depth);
    else {
      const nextState = {...history.state};
      delete nextState[STATE_KEY];
      history.replaceState(nextState, '', returnHash);
      syncRoute();
    }
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-project-open]');
    if (!target || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(target.dataset.projectOpen);
  });
  dialog.querySelector('.study-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  addEventListener('popstate', syncRoute);
  addEventListener('hashchange', syncRoute);
  addEventListener('resize', sizeArt, {passive:true});
  document.fonts?.ready.then(sizeArt);

  // The overview uses the same complete artwork at a scale that preserves its layout.
  const previews = [...document.querySelectorAll('.project-panel .project-preview')];
  function sizePreviews() {
    previews.forEach(frame => {
      const stage = frame.firstElementChild;
      const reading = !document.body.classList.contains('has-journey');
      const mobile = innerWidth <= 760;
      const maxHeight = reading ? Infinity : innerHeight * (mobile ? .20 : .35);
      const scale = Math.min(Math.max(1, frame.clientWidth - 24) / 700, Math.max(1, maxHeight - 24) / stage.offsetHeight);
      stage.style.transform = `scale(${scale})`;
      stage.style.left = `${(frame.clientWidth - 700 * scale) / 2}px`;
      stage.style.top = '12px';
      frame.style.height = `${stage.offsetHeight * scale + 24}px`;
    });
  }
  if (typeof ResizeObserver !== 'undefined') {
    const previewObserver = new ResizeObserver(sizePreviews);
    previews.forEach(frame => previewObserver.observe(frame));
  }
  new MutationObserver(sizePreviews).observe(document.body, {attributes:true, attributeFilter:['class']});
  addEventListener('resize', sizePreviews, {passive:true});
  document.fonts?.ready.then(sizePreviews);
  sizePreviews();
  syncRoute();
  return {open, close, isOpen:() => dialog.open};
}
