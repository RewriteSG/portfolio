# 2015 — an experience reconstruction

A modern reconstruction of [Valentin Marmonier's 2015 WebGL experiment](https://vaalentin.github.io/2015/). The application code is newly written using locally bundled Three.js. Reference imagery, models, typeface, and audio are credited in `dist/assets/README.md`. Original biography text is retained to reproduce the reference.

Run `npm run dev`, then open http://127.0.0.1:4173. No installation or build is necessary. `dist/` is the complete static website.

Scroll, swipe, or use arrow keys to move through 14 scenes. The right-hand dots jump to a scene. Open the top-left menu for sound, help, contact, and rendering quality; the bottom chevron opens About. Home/End jump to the first/last scene. Escape closes overlays. Sound begins only after selecting Unmute.

The reconstruction retains the original visual direction and sequence, with modern input handling, reduced-motion support, accessible controls, and a readable fallback if WebGL is unavailable. Procedural scenes approximate the original animation rather than reusing its 2015 application bundle.
