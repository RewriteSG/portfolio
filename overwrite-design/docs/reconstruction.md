# 2015 experience reconstruction

Reference: https://vaalentin.github.io/2015/ by Valentin Marmonier.

Rebuild the 14-scene monochrome WebGL presentation with a modern, local Three.js module. Keep the sparse original composition: #0a0a0a background, white and grey graphics, drifting particles, smoke, thin tracked lettering, hamburger at upper left, vertical dot navigation at right, and bottom chevron opening the white About panel. Reuse the reference's visual and audio assets with source attribution. Write the application and interaction code anew.

Implementation:
- [x] Local renderer: 14 separated scene groups, smooth vertical camera movement, pointer parallax, sprite smoke and opening title, procedural geometry and the reference face/rock/city models.
- [x] Interface: keyboard, wheel, touch and dots; sound and quality controls; modal Help; sliding About panel with original copy and links.
- [x] Verification: desktop and mobile browser screenshots, all scene navigation, panel switching, reduced motion, fallback, console/network checks.

The scene module exposes `createExperience(container, options)` returning `goTo`, `resize`, `setQuality`, `setPaused`, and `dispose`. All runtime files and assets live under `dist/` and require only a static server. Preserve the existing hosting identity.

Verified at 1280×720 and 390×844 using Chromium. All 14 scene buttons selected their correct states. Keyboard, wheel, and a browser-dispatched touch swipe advanced scenes. Help slides and Escape focus return, audio playback, quality switching, About/back, and mobile overflow checks passed. Reduced-motion screenshots stayed byte-identical over time. Blocking the renderer module produced a usable fallback with working navigation and About. Normal rendering reported no browser errors before the deliberate failure test. JavaScript syntax and whitespace checks passed. An independent review identified a browser back/forward cache lifecycle issue, which was fixed by preserving the renderer on persisted pagehide.

The procedural beam, terrain, flow, wave, rocks, and gravity animation is an approximation; this is not the original application bundle. Original reference assets are attributed in `dist/assets/README.md`.

Publication was not performed: automatic approval review rejected credential-backed source preparation because publishing to the existing private project requires explicit user authorization. The existing hosted site was not changed.
