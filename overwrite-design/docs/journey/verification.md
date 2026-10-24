# Journey verification

Completed 24 October 2026, Singapore time.

- All six scenes and three project presentations checked in Chromium, including fast jumps and the reverse path. The 23-state initial pass reported no page errors, failed resource requests, or horizontal overflow.
- Screenshots inspected at desktop 1440×900, mobile 390×844, compact 320×667 and landscape 844×390. Refined the boat's sailing route for a readable sail profile, strengthened About contrast, and placed the mobile contact copy above the city.
- Project ring mouse navigation and arrow-key navigation passed. Menu navigation, reading mode, return to the visual journey and browser Back passed.
- Reduced-motion mode produced identical successive idle screenshots.
- Deliberately disabled WebGL: all six substantive content sections remained readable, non-inert and free of horizontal overflow; navigation and the email link remained usable.
- Earth and city geometry returned finite bounds; every new JavaScript module passed syntax checks. Typical desktop About view: 30 draw calls / about 52k triangles. Final city: 9 draw calls / about 27k triangles.
- Fresh static review found atmosphere transforms, browser-cache restoration and Contact contrast issues; all were fixed and the scoped review passed with no remaining material findings.
- SHA-256 comparison confirmed all 45 pre-existing files under `dist/` match their values before implementation. The original, all three drafts, their assets and vendor library are unchanged. The hosting manifest is unchanged; nothing was deployed.

Browser scripts and screenshots are retained in ignored `output/playwright/`. Preservation hashes and preview logs are in ignored `output/journey/`.

## Unified orbit and project pages revision

Verified 24 October 2026.

- Removed the separate SVG progress ring. The model's outer orbit is the progress arc; the three project controls project directly from actual planet mesh positions, with hit-target alignment checked within one screen pixel.
- Desktop overview has the model on the left and preview above description on the right. Mobile stacks the orbit and preview. Checked desktop 1440×900, mobile 390×844, and compact landscape 640×360 without horizontal overflow. Resizing preserves the selected chapter, including while a project page is open.
- View all index contains all three studies. View more, all three full study pages, browser Back, Close, Escape, focus return, fresh direct routes and scroll restoration passed. Planet selection and keyboard project navigation passed.
- Measured the page's opening transition at a negative X translation, settling at zero; reduced motion disables that transition and successive idle world screenshots match.
- WebGL deliberately unavailable: fresh direct Lumen route opened and closed to its readable overview at the expected scroll margin; View more remained functional.
- Fresh review identified direct-route initialization and compact-layout alignment issues. Both were fixed, including the fallback route, and scoped re-review found no remaining material defects.
- All new/updated modules pass syntax checks; all 45 preserved original/draft files still match their hashes. No hosted version changed.

## Immersive detail revision

Verified 24 October 2026. The earlier left-entering page treatment is replaced by a right-entering transparent layer and a camera approach to the same selected orbit planet. Its curved limb occupies the left 10% of the viewport; content retains the existing space palette, typography and artwork.

- Positive X entry, transparent background, identical planet mesh identity and a measured 10% right limb passed in the browser. Closing reverses the camera. View all and Back restore the wider solar view.
- Desktop 1440×900, mobile 390×844 and narrow 320×740 layouts have no horizontal clipping. Resizing while focused preserves framing and the return chapter.
- Index, detail routes, fresh direct links, Back, Escape, focus/scroll restoration and immediate reduced-motion camera/slide behavior passed with no page errors.
- WebGL-unavailable direct Lumen route remained readable and closed to the correct chapter. All modified JavaScript passed syntax checks; all 45 preservation hashes still match.
