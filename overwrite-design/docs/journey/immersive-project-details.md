# Immersive project detail — 24 October 2026

Replace the detached full-page presentation with a continuous space view. View more enters from the right while the camera zooms toward the selected project's actual planet. Its curved edge occupies roughly the left 10% of the viewport; the remaining space carries the project content. Keep the existing space palette, type, artwork and content. Close reverses the camera movement and returns to the same overview.

The project index remains available through View all. Detail and index routes, Back, Escape, focus restoration, responsive content, reduced motion and readable WebGL fallback must continue working.

Root owns the Three.js focus camera and app callbacks. Interface worker owns the transparent project-page styling and transition callbacks. Preserve the original site, earlier drafts and other journey scenes.

## Implementation and validation

- Project details enter from the right over a transparent reading layer. The existing star field, type, colors and artwork remain; the overview controls fade out of the reading layer.
- The camera approaches the selected project's actual orbit mesh. Its right limb is framed at 10% of the viewport width, including after a resize. Perspective-aware easing spreads the zoom across the 720 ms movement. Closing reverses it; View all returns to a faint wider solar view.
- Native study routes, index, browser Back, Escape, focus restoration and normalized journey position remain. Reduced motion selects the final camera position immediately and disables the slide.
- Browser checks passed at 1440×900, 390×844 and 320×740. Verified the same mesh is used before/after zoom, measured its right limb at 10%, confirmed positive X entry and a transparent dialog, and exercised direct links, resizing, index/detail navigation, close and reduced motion without page errors. WebGL-unavailable fallback stays readable and returns to the requested chapter.
- All three changed JavaScript modules pass syntax checks. All 45 original/draft files match their preservation hashes.
