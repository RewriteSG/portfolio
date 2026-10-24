import { normalizeManifest } from './project-data.js';

export const projectHash = id => `#project=${encodeURIComponent(id)}`;

export function readProjectHash(hash, validIds) {
  if (typeof hash !== 'string' || !hash.startsWith('#project=')) return null;
  try {
    const id = decodeURIComponent(hash.slice(9));
    return id && new Set(validIds).has(id) ? id : null;
  } catch { return null; }
}

export function legacyProjectDestination(search) {
  const id = new URLSearchParams(search).get('id');
  const { projects } = normalizeManifest({projects:[{id}]});
  return projects.length ? `./${projectHash(projects[0].id)}` : './#projects';
}

export function nextLocationAction(currentState, requestedAction) {
  const { type, id } = requestedAction;
  if (type === 'sync') return {method:'none', id:id || null};
  if (type === 'open') return {method:currentState.id ? 'replace' : 'push', hash:projectHash(id), id};
  if (type === 'close' && currentState.appOpened) return {method:'back', id:null};
  return {method:'replace', hash:'#projects', id:null};
}
