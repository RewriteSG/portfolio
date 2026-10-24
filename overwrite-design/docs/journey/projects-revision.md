# Unified project orbit — 24 October 2026

User feedback: make the solar-system models and scroll wheel one object. The unified orbit is the projects hero on the left. Show the selected project's preview above its description on the right. Add View all inside the orbit and View more on each project, opening a detailed page that slides in from the left.

## Boundaries

Only edit the new `dist/journey/` version. Preserve the original, the three drafts, Earth/About and Contact. Keep existing portfolio studies and avoid inventing client work, metrics, employment or delivery claims.

## Implementation

- The Three.js solar model becomes a front-facing interactive orrery on the left as the camera pulls back. Its outer orbit is the scroll progress arc; the three project markers are actual planet meshes on that orbit. Native HTML hit targets and labels project from those same mesh positions. Remove the separate SVG ring and compact duplicate control.
- View all sits inside the orrery, below its sun. It opens a complete index of the three studies.
- Project overviews use a single right column: artwork, title/description and View more. Expanded study content belongs to the detailed page.
- Native dialog pages slide in from the left, have shareable hash routes (`#work`, `#work/northstar`, `#work/lumen`, `#work/field-notes`), browser Back, close/Escape, focus restoration, local scrolling and reduced motion. The journey stays at its previous scroll position underneath.
- Mobile stacks the orbit above the selected project; short viewports retain scrolling. Reading mode and WebGL fallback retain content and the new project pages.

## Ownership and checks

Root owns `scene.js` and `app.js` integration. Interface worker owns `index.html`, `styles.css`, `project-pages.js`, `project-pages.css`. Fresh review plus browser checks cover model/label alignment, progress and project jumps, preview-before-description order, View all, all three detail routes, keyboard/Back/Escape, reduced motion, fallback and mobile overflow.
