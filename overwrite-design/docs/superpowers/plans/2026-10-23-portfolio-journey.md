# Portfolio Journey Implementation Plan

> **For agentic workers:** Implement the approved design in focused tasks. Track completion below; use independent asset and interface workers, with root integration and a fresh final review.

**Goal:** A complete six-scene portfolio journey at `/journey/`, preserving the original and drafts.

**Architecture:** One Three.js renderer with Earth and city asset groups, a reversible scroll camera timeline, and accessible HTML content. Asset builders return scene groups; the interface drives `JourneyScene.setProgress` and receives smoothed progress.

**Tech Stack:** Buildless HTML, CSS, JavaScript ES modules, existing local Three.js.

**Spec:** `docs/superpowers/specs/2026-10-23-portfolio-journey-design.md`

## Global constraints

- Six scenes in the approved order. Boat belongs to Earth/About and sails while zooming out. No smoke.
- Preserve all existing product files. New product files only under `dist/journey/`.
- No new client, employment, availability or metric claims. Existing projects are portfolio studies.
- Native scrolling, reversible transitions, mobile, keyboard, reduced motion, WebGL fallback.
- No publication or hosting changes in this local implementation.

## Review focus

- Fast scrolling or jumping must leave camera, content and ring in the same scene.
- Short/mobile viewports must not clip readable content or controls.
- Project ring must represent actual project progress and allow keyboard-accessible jumps.
- WebGL failure must leave all substantive content and contact usable.
- Returning through clouds must reveal the city and Contact without a permanent blocking layer.

### Task 1: Earth and boat assets

Files: create `dist/journey/earth.js`.

Interface: `createEarth()` returns `{group, update(time, sailing, reducedMotion), dispose()}`. Radius 20, sphere centred at origin, positive Z faces camera. Curved ocean with mountains on the front-left upper hemisphere; boat on front-right ocean, aligned to the local surface. A luminous atmosphere frames the arc. Root owns lighting, rendering and camera. No renderer or global listeners in this module.

- [x] Build spherical ocean, mountain/coastal land, detailed boat and atmosphere.
- [x] Check module syntax, return contract, geometry bounds and transforms.

### Task 2: Voxel city asset

Files: create `dist/journey/city.js`.

Interface: `createCity()` returns `{group, update(time, reducedMotion), dispose()}`. City centred at origin, Y-up, horizontal bounds approximately 26 units. A detailed miniature with buildings, roads, water, trees and small human-scale details. Root owns lighting, camera and transitions. No renderer or global listeners.

- [x] Build the city in the Small Worlds palette and craft.
- [x] Check module syntax, return contract and rendering bounds.

### Task 3: Interface and scroll controller

Files: create `dist/journey/index.html`, `styles.css`, `app.js`.

Interface: import `JourneyScene` from `./scene.js`; construct with `(container, {reducedMotion, onProgress})`, call `.setProgress(progress)`; onProgress receives rendered normalized progress. Scene owns its render loop. Progress anchors: Hello 0, descent .15, About .30, solar projects .59/.69/.79, return .88, Contact 1. Exact scene boundaries: Hello .00-.10, descent .10-.22, About .22-.48 (zoom out starts .38), solar .48-.83, return .83-.94, Contact .94-1. Earth camera pullback completes at .55. Ring morph .48-.57; project holds around .59/.69/.79.

- [x] Build substantial About, three project studies with visual presentations, and Contact.
- [x] Native scrolling drives progress; menu, anchors, project ring and end return work.
- [x] Provide responsive layout, keyboard controls, focus, reduced motion and readable fallback.

### Task 4: Continuous scene and integration

Files: create `dist/journey/scene.js`; root may adjust new files for integration.

- [x] Build cube stars and downward streaks, Earth reveal, boat pullback, solar orbits, return clouds and city reveal.
- [x] Integrate assets and interface; cap rendering cost and handle context failure.
- [x] Verify syntax, browser runtime, each content chapter, ring/menu jumps, reverse path and responsive layouts.
- [x] Verify reduced motion and fallback; compare original/draft hashes.
- [x] Fresh review, resolve material findings, document verification and open `/journey/` for user review.
