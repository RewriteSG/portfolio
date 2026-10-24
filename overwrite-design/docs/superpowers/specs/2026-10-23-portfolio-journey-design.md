# Hazwan: one continuous journey

Approved by the user on 2026-10-23 after reviewing the six-scene interactive storyboard. Build a new local version at `/journey/`; preserve the original and all three earlier drafts. The original request and revision authorize implementation, without another design approval gate.

## Six scenes

1. Hello in deep space, surrounded by glowing three-dimensional cube stars.
2. Scrolling makes the stars streak downward toward Earth. No smoke.
3. About on a visibly spherical Earth: a luminous atmosphere, ocean, mountains, and the sailing boat. Use Open Water's muted ocean colours and editorial typography. The boat sails gently while the camera zooms out; there is no standalone boat chapter or close-up detour.
4. Pull back to a solar system. An orbital ring becomes the project progress control, with a readable presentation of each existing portfolio study.
5. Return to the same Earth through its clouds.
6. Settle above a voxel city in the Small Worlds style; Contact is integrated into this final scene.

Scrolling upward retraces the journey. Navigation can jump to About, projects, and Contact. Native scrolling, keyboard and touch remain usable. Provide reading space for About, each project, and Contact. Respect reduced motion and provide readable content if WebGL cannot run.

## Content and constraints

Use the established portfolio identity and content from the prior drafts: Hazwan, product design and creative development, Singapore, the three portfolio studies Northstar, Lumen and Field Notes, and hello@hazwan.design. Do not invent clients, employment, outcomes or statistics. The three projects remain identified as studies.

New files live under `dist/journey/` and documentation under `docs/superpowers/` and `docs/journey/`. Existing originals, drafts, assets, vendor code, package scripts, and hosting identity remain unchanged. This is local work in the existing preview; do not replace the hosted original. Use the locally bundled Three.js and font, without runtime network dependencies.

## Implementation decisions

Use one WebGL renderer and a continuous reversible camera path, with an ocean sphere and assets attached to its curvature. Use procedural geometry for mountain coastlines, boat, planetary orbits, cube stars, clouds and voxel city. Native document scroll drives a normalized timeline. Responsive HTML overlays supply real content, accessible controls and the orbit progress control. Builders may tune camera positions, timing, typography and geometry to achieve the approved composition.
