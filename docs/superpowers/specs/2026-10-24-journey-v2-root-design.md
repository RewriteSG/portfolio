# Journey V2 Root Integration Design

## Intent

Replace the portfolio shown at the repository root with a new production version of the completed Journey experience. Preserve the original prototype at `overwrite-design/dist/journey/` unchanged, and keep the existing JSON-driven project publishing workflow.

The result should feel like the existing Journey—space, Earth, an orbital project chapter, a return through clouds, and a voxel-city Contact scene—but every portfolio project and project detail must come from the root repository's data rather than from Journey's three hard-coded studies.

## Versioning decision

- Treat `overwrite-design/dist/journey/` as an immutable visual reference.
- Create the production version under `assets/journey-v2/`.
- Make root `index.html` load Journey V2 CSS and JavaScript directly.
- Copy only the Journey files and local dependencies that V2 actually uses; do not make the root site depend on paths inside `overwrite-design/`.
- Leave the current root `assets/app.js` and `assets/style.css` in place but unreferenced during the migration so the previous implementation remains recoverable.

## Goals

- Make the root URL open Journey V2.
- Preserve the six-part visual journey and reversible scroll behavior.
- Preserve `.github/workflows/update-manifest.yml` as the reader that combines `projects/*/index.json` into root `projects.json`.
- Fetch `./projects.json` at runtime and create all project chapters, navigation stops, counters, media, links, and detail views from it.
- Populate identity, About, and Contact content from `assets/info.js` wherever that file has a corresponding value.
- Preserve the current root application's project-ID, URL, email, and media-path safety rules.
- Keep direct project links and `project.html?id=<id>` compatibility.
- Remain readable and operable without WebGL, with reduced motion, on mobile, and by keyboard.

## Non-goals

- Do not modify or delete `overwrite-design/dist/journey/` or its earlier drafts.
- Do not change the project JSON schema or the manifest-generation workflow.
- Do not carry Northstar, Lumen, Field Notes, or the prototype biography into the production site.
- Do not preserve the CRT visual language, boot sequence, accent selector, or terminal command animations from the current root design.
- Do not add a framework, build step, CDN dependency, backend, CMS, or analytics service.
- A tag-filter grid is not required in the Journey layout; project tags remain visible as project metadata.

## Data ownership and contract

### Project source

`projects/<id>/index.json` remains the authoring source. The existing GitHub Action adds the directory name as `id`, sorts entries, and writes root `projects.json`. Journey V2 reads only the generated manifest at runtime.

Supported project fields remain:

- `id`, `name`, `description`, `thumbnail`, `tags`, `date`, `status`, `order`
- `subhead`, `long`, `stack`, `commits`, `media`, `links`

Missing optional fields receive readable fallbacks. Invalid entries are skipped and reported through a non-blocking status message. Duplicate or unsafe IDs are rejected. Manifest ordering remains deterministic: explicit `order` descending, then `date` descending.

### Media and links

- Relative media resolves only within `projects/<encoded-id>/`.
- Absolute media and outbound links accept HTTP(S) only.
- Traversal, absolute local paths, backslashes, encoded separators, unsafe schemes, and malformed values are rejected.
- Image and direct-video media render in the project detail experience.
- Iframe embeds are limited to HTTPS YouTube (`youtube.com`, `www.youtube.com`, `youtube-nocookie.com`), Vimeo (`player.vimeo.com`), and itch.io (`itch.io`, `html-classic.itch.zone`) embed URLs. Other HTTP(S) media URLs render as external links rather than iframes.
- Allowed iframes use lazy loading, `referrerpolicy="strict-origin-when-cross-origin"`, a restrictive `sandbox` limited to the provider capabilities required for playback, and a narrow `allow` feature policy. Every embed has a readable fallback link.

### Site information

`assets/info.js` remains a non-module script loaded before Journey V2. Journey V2 reads `window.SITE_INFO` for the display name, role/intro copy, About content, Contact email/status, social links, and footer copy. The interface uses neutral fallbacks only when a value is missing.

## Experience

### Journey structure

1. Space/Hello introduces the portfolio identity.
2. Star descent moves toward Earth.
3. Earth/About presents current About content with the existing boat and landscape treatment.
4. Solar/Projects creates one readable project chapter per valid manifest project.
5. Clouds return toward Earth.
6. Voxel city/Contact presents the current contact information.

Scrolling upward retraces the same path. Navigation can jump to About, Projects, Contact, and individual projects without breaking the scene state.

### Dynamic projects

- Project chapter markup is generated after the manifest loads; no project names or count live in `index.html`.
- The orbital HTML navigation creates one stop per project.
- The 3D solar scene receives project IDs/count from the interface and creates/focuses markers without knowing project names. It renders at most 32 passive project markers; above 32 projects it uses a single moving focus marker for the selected project while the HTML navigation still exposes every project.
- The project portion of the document grows with the actual number of projects while the scene maps it into the existing solar chapter.
- Zero projects shows a calm solar scene and a clear empty state. One project shows one usable stop. More than three projects remain navigable without overlap or incorrect counters.
- Each project preview uses its thumbnail or first valid image, plus JSON-provided title, subhead/description, status, tags, and stack.

### Project details

- A single accessible full-screen detail layer replaces Journey's hard-coded study pages.
- It renders the selected project's JSON content, media gallery, links, metadata, and next-project navigation.
- Opening a project updates the URL to `#project=<encoded-id>` and moves focus to the detail heading.
- Closing restores the prior Journey position and focus.
- Browser Back/Forward synchronizes the detail layer without creating another history entry. Closing an in-page-opened detail returns through history; closing a direct-hash load replaces the URL with `#projects` and restores focus to the Projects heading.
- Unknown or malformed project hashes return to the Projects chapter with a readable message.

## Accessibility and resilience

- Keep semantic headings, landmarks, skip navigation, visible focus, Escape-to-close, focus containment/restoration, and named media controls.
- `prefers-reduced-motion` settles the 3D scene, disables smooth/scrubbed transitions, and exposes content immediately; runtime preference changes take effect.
- If WebGL or the scene module fails, all About, Projects, details, and Contact content remains readable as a normal page.
- If the manifest fails, About and Contact still render and Projects shows a retry-oriented error message.
- Pause nonessential rendering when the document is hidden and cap pixel ratio/rendering quality as in the Journey reference.
- Keep identity, About, Contact, and a projects-unavailable explanation as real static HTML so the no-JavaScript experience remains meaningful.

## Responsive behavior

- Retain Journey's editorial desktop composition and mobile stacking.
- Use `svh`/measured viewport behavior without scroll snap or assumptions about fixed mobile browser chrome.
- Project navigation must remain usable with long names and more than three items; use a scrollable/condensed control instead of overlapping stops when necessary.
- Touch targets remain at least approximately 44px and no content introduces horizontal page overflow.

## Constraints and implementation freedom

- Vanilla HTML, CSS, and ES modules only.
- Use the locally bundled Three.js version already present under `overwrite-design/dist/vendor/` by copying it into the Journey V2 production directory.
- Builders may tune scene timing, project chapter spacing, marker geometry, and typography only as necessary for dynamic content and responsive behavior; the Journey visual identity remains the source of truth.
- Context7 and Serena are unavailable in this session. Do not introduce or guess at new external APIs.

## Acceptance criteria

- The root site visibly matches the final Journey design and loads code from `assets/journey-v2/`.
- `overwrite-design/dist/journey/` remains byte-for-byte unchanged.
- Reference preservation is checked against a committed hash fixture covering every source file used by Journey V2; production imports and CSS URLs resolve only inside `assets/journey-v2/` or to root data/media paths.
- Regenerating `projects.json` after adding/editing a project updates the root site without editing HTML or JavaScript.
- Zero, one, three, and more-than-three project fixtures render usable navigation and details.
- A 64-project fixture keeps all HTML project controls/details available while using the bounded scene-marker behavior.
- Driftwake renders from the current manifest, including its local images, metadata, and GitHub link.
- Unsafe IDs, paths, schemes, duplicate IDs, malformed entries, and a failed manifest do not create executable content or break the rest of the page.
- Direct project hashes and `project.html?id=<id>` open the matching dynamic project.
- Browser Back/Forward and detail close restore the expected URL, Journey scroll position, and focus target for both in-page and direct-hash entry.
- Desktop, mobile, keyboard, reduced-motion, WebGL-failure, forward-scroll, and reverse-scroll checks pass.
