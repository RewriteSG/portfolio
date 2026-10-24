# Journey V2 Root Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the root portfolio with a versioned Journey V2 experience that renders all projects from the existing JSON manifest pipeline.

**Architecture:** Root `index.html` loads a self-contained production implementation from `assets/journey-v2/`. A pure data adapter validates and normalizes `projects.json`; the Journey interface and Three.js scene consume project IDs/count without hard-coded studies. The original Journey prototype and current root assets remain unchanged for reference and rollback.

**Tech Stack:** Static HTML, CSS, JavaScript ES modules, locally bundled Three.js, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-24-journey-v2-root-design.md`

## Global Constraints

- Do not modify anything under `overwrite-design/dist/journey/`.
- Create production files under `assets/journey-v2/`; root `index.html` must load this version directly.
- Preserve `projects/*/index.json`, `projects.json`, `.github/workflows/update-manifest.yml`, and the `assets/info.js` schema.
- No framework, bundler, CDN, backend, analytics service, or runtime network dependency.
- Project names/count must never be hard-coded in production markup or scene logic.
- Retain HTTP(S)-only outbound URLs, project-scoped media resolution, safe IDs, and safe email handling.
- Preserve Journey's reversible scroll, responsive behavior, reduced motion, keyboard access, and readable WebGL fallback.
- Context7 and Serena are unavailable; use existing local code and browser/Node APIs only.

## Review Focus

- Empty, single-project, and more-than-three-project manifests must produce coherent scroll ranges, controls, and scene markers; Task 4 exercises these counts.
- A 64-project manifest must keep every HTML control/detail available while bounding the 3D scene to 32 passive markers plus one active focus marker; Tasks 3–4 exercise this contract.
- A malicious manifest entry must not escape its project media directory or emit an unsafe link/embed; Task 2 pins the validators.
- A manifest or WebGL failure must leave About, Contact, and project-error content usable; Tasks 3 and 5 verify the fallback states.
- Direct `#project=<id>`, Back/Forward, detail close, and legacy `project.html?id=<id>` navigation must keep URL, Journey scroll position, and focus synchronized; Task 3 owns these checks.
- Mobile/reduced-motion users must not be trapped in fixed-height scenes or invisible overlays; Tasks 5 and 6 include viewport, focus, and runtime preference checks.
- Remote iframe media must match the provider allowlist and restrictive iframe policy; Task 2 pins URL classification and Task 3 owns DOM attributes/fallback links.

---

### Task 1: Create the immutable Journey V2 production shell

**Files:**
- Create: `assets/journey-v2/app.js`
- Create: `assets/journey-v2/styles.css`
- Create: `assets/journey-v2/project-pages.css`
- Create: `assets/journey-v2/scene.js`
- Create: `assets/journey-v2/earth.js`
- Create: `assets/journey-v2/city.js`
- Create: `assets/journey-v2/vendor/three.module.js`
- Create: `assets/journey-v2/fonts/raleway.woff2`
- Modify: `index.html`
- Test: `tests/journey-v2/versioning.test.mjs`
- Create: `tests/journey-v2/fixtures/journey-reference-hashes.json`

**Interfaces:**
- Consumes: visual/reference files from `overwrite-design/dist/journey/`, `overwrite-design/dist/vendor/three.module.js`, and `overwrite-design/dist/assets/raleway.woff2`.
- Produces: root HTML loading `./assets/info.js`, `./assets/journey-v2/styles.css`, `./assets/journey-v2/project-pages.css`, and `./assets/journey-v2/app.js`.

- [ ] **Step 1: Record reference hashes and write the versioning test**

Create `tests/journey-v2/fixtures/journey-reference-hashes.json` with SHA-256 values for every file under `overwrite-design/dist/journey/` plus the copied Three.js/font sources. Create `tests/journey-v2/versioning.test.mjs` to assert the fixture still matches, root `index.html` references only Journey V2 production assets, Journey V2 contains every required copied asset, all module imports/CSS URLs resolve inside `assets/journey-v2/` or approved root data/media paths, and production HTML does not reference `overwrite-design/`.

- [ ] **Step 2: Run the versioning test and verify it fails**

Run: `node --test tests/journey-v2/versioning.test.mjs`

Expected: FAIL because `assets/journey-v2/` and its root references do not exist.

- [ ] **Step 3: Copy the Journey reference into the versioned production boundary**

Copy the six Journey modules/styles plus local Three.js and Raleway files into the paths above. Change relative imports/font URLs to stay inside `assets/journey-v2/`. Do not edit the source prototype.

- [ ] **Step 4: Replace root markup with the Journey semantic shell**

Adapt the Journey `index.html` to root paths. Keep Hello, About, Projects mount point, Contact, navigation, orbit-control mount point, readable fallback status, project-detail mount point, and no-script behavior; remove all hard-coded study markup and prototype-only links.

- [ ] **Step 5: Run the versioning test and compare reference hashes**

Run: `node --test tests/journey-v2/versioning.test.mjs`

Expected: PASS. Recompute hashes for `overwrite-design/dist/journey/` and confirm they match Step 1.

- [ ] **Step 6: Commit the version boundary**

```bash
git add index.html assets/journey-v2 tests/journey-v2/versioning.test.mjs
git commit -m "feat(portfolio): create journey v2 production shell"
```

### Task 2: Build and test the JSON project adapter

**Files:**
- Create: `assets/journey-v2/project-data.js`
- Create: `tests/journey-v2/project-data.test.mjs`

**Interfaces:**
- Consumes: root `projects.json` shape `{ generated?: string, projects: unknown[] }`.
- Produces: `loadProjectManifest(url = './projects.json'): Promise<{projects: Project[], rejected: number}>`, `normalizeManifest(input): {projects: Project[], rejected: number}`, `resolveProjectMedia(project, src, baseUrl): string | null`, `classifyRemoteMedia(value, baseUrl): {kind: 'direct-video'|'embed'|'link', url: string, provider?: string} | null`, `safeHttpUrl(value, baseUrl): string | null`, and `safeEmail(value): string | null`.

- [ ] **Step 1: Write failing normalization tests**

Cover deterministic `order`/`date` sorting, default values for optional fields, duplicate IDs, unsafe IDs, non-array manifests, malformed project values, and preservation of Driftwake's supported fields.

- [ ] **Step 2: Write failing URL and media tests**

Assert HTTP(S) acceptance; rejection of `javascript:`, `data:`, traversal, absolute local paths, backslashes, empty/dot segments, and encoded separators; correct encoding under `./projects/<id>/`; embed classification only for HTTPS YouTube, Vimeo Player, and itch.io hosts; and external-link classification for other safe remote URLs.

- [ ] **Step 3: Run the project-data tests and verify they fail**

Run: `node --test tests/journey-v2/project-data.test.mjs`

Expected: FAIL because `project-data.js` does not exist.

- [ ] **Step 4: Implement the pure validators and normalizer**

Keep normalization DOM-free so Node can test it. Preserve the root application's current validation semantics and return frozen/copy-safe arrays where practical.

- [ ] **Step 5: Implement `loadProjectManifest`**

Fetch with `{cache: 'no-store'}`, reject non-OK responses, parse JSON once, and pass it through `normalizeManifest`.

- [ ] **Step 6: Run the data tests**

Run: `node --test tests/journey-v2/project-data.test.mjs`

Expected: PASS for valid, empty, malformed, duplicate, and hostile fixtures.

- [ ] **Step 7: Commit the data boundary**

```bash
git add assets/journey-v2/project-data.js tests/journey-v2/project-data.test.mjs
git commit -m "feat(portfolio): add validated project manifest adapter"
```

### Task 3: Render dynamic Journey content and project details

**Files:**
- Modify: `assets/journey-v2/app.js`
- Modify: `assets/journey-v2/styles.css`
- Modify: `assets/journey-v2/project-pages.css`
- Create: `assets/journey-v2/project-pages.js`
- Create: `assets/journey-v2/routes.js`
- Create: `assets/journey-v2/project-presentation.js`
- Create: `tests/journey-v2/routes.test.mjs`
- Create: `tests/journey-v2/project-presentation.test.mjs`

**Interfaces:**
- Consumes: normalized projects from Task 2 and `window.SITE_INFO` from `assets/info.js`.
- Produces: `buildProjectPresentation(projects): {chapters: ChapterModel[], controls: ControlModel[], details: DetailModel[], total: number}`; `createProjectPages({projects, resolveMedia, onOpen, onClose}): ProjectPageController`; controller methods `open(id, options?)`, `close(options?)`, `syncFromLocation()`, and `destroy()`; route helpers `projectHash(id)`, `readProjectHash(hash, validIds)`, `legacyProjectDestination(search)`, and `nextLocationAction(currentState, requestedAction)`.

- [ ] **Step 1: Write failing route tests**

Test mixed-case valid IDs, URL encoding/decoding, malformed escapes, unknown IDs, empty IDs, legacy `?id=` conversion, Back/Forward synchronization without new entries, in-page close via history, and direct-hash close via `replaceState('#projects')`.

- [ ] **Step 2: Run route tests and verify they fail**

Run: `node --test tests/journey-v2/routes.test.mjs`

Expected: FAIL because `routes.js` does not exist.

- [ ] **Step 3: Implement the route helpers**

Keep them DOM-free. Canonical project URLs use `#project=<encodeURIComponent(id)>`; malformed and unknown values return `null`.

- [ ] **Step 4: Replace prototype copy with `SITE_INFO` bindings**

Populate identity, hero role, About paragraphs/skills, Contact email/status/social links, and footer from the current schema. Use text nodes for data, not unsanitized HTML. Preserve meaningful identity/About/Contact text in root HTML for no-JavaScript use.

- [ ] **Step 5: Write and implement the project-presentation contract**

Test and implement `buildProjectPresentation` so 0, 1, 3, 8, and 64 projects create matching ordered chapter/control/detail descriptor arrays, consistent counters, unique IDs, and valid jump targets. The DOM renderer must consume this one descriptor model rather than rebuilding project ordering independently.

- [ ] **Step 6: Generate project chapters and orbit controls**

Create one semantic `.project-panel` and one named control per project. Use the first valid image/thumbnail for the preview, render readable fallbacks, and expose status/tags/stack without assuming three items.

- [ ] **Step 7: Implement the dynamic detail controller**

Render JSON-provided heading, subhead/description, long copy, tags/stack, commits, media gallery, safe links, previous/next navigation, close behavior, Escape, focus trap, heading focus, and focus restoration. Allowed embeds receive the restrictive sandbox/allow/referrer/loading attributes from the spec and a fallback link; other remote media is a normal external link. Do not inject manifest strings through `innerHTML`.

- [ ] **Step 8: Add manifest loading/error/empty states**

Initialize About/Contact independently. Show a project loading state, a calm empty state for zero projects, and a retry-oriented message when `loadProjectManifest` rejects.

- [ ] **Step 9: Run route, presentation, and data tests**

Run: `node --test tests/journey-v2/*.test.mjs`

Expected: PASS.

- [ ] **Step 10: Commit the dynamic interface**

```bash
git add assets/journey-v2/app.js assets/journey-v2/styles.css assets/journey-v2/project-pages.css assets/journey-v2/project-pages.js assets/journey-v2/routes.js assets/journey-v2/project-presentation.js tests/journey-v2/routes.test.mjs tests/journey-v2/project-presentation.test.mjs
git commit -m "feat(portfolio): render journey projects from json"
```

### Task 4: Generalize the scroll timeline and Three.js project scene

**Files:**
- Create: `assets/journey-v2/project-layout.js`
- Modify: `assets/journey-v2/app.js`
- Modify: `assets/journey-v2/scene.js`
- Create: `tests/journey-v2/project-layout.test.mjs`

**Interfaces:**
- Consumes: ordered project IDs from Task 2.
- Produces: `buildProjectLayout(projectIds): {ids: string[], stops: number[], chapterStart: number, chapterEnd: number}`, `projectAtProgress(layout, progress): number | null`; `new JourneyScene(container, {reducedMotion, onProgress, projectIds})`; scene methods `setProgress(progress)`, `setProjectFocus(idOrNull)`, and `dispose()`.

- [ ] **Step 1: Write failing project-layout tests**

Assert zero-project empty output, one-project centered stop, three-project stable order, eight-project monotonic evenly spaced stops, clamped progress lookup, duplicate-free IDs, and the 64-project bounded-marker contract.

- [ ] **Step 2: Run the layout tests and verify they fail**

Run: `node --test tests/journey-v2/project-layout.test.mjs`

Expected: FAIL because `project-layout.js` does not exist.

- [ ] **Step 3: Implement the pure project layout model**

Map any valid count across Journey's solar chapter without changing the pre-solar or post-solar scene sequence. Avoid division by zero for counts below two.

- [ ] **Step 4: Make document measurements project-count aware**

Allocate one readable panel interval per project, measure after manifest rendering and on resize/content changes, and keep jump navigation aligned with the same model. Use passive scroll plus one RAF update path.

- [ ] **Step 5: Generalize scene markers and focus**

Replace hard-coded project names and three-marker creation with `projectIds`. Space up to 32 passive markers around the orbit, derive colors deterministically, and focus by ID/index; above 32 projects use one active focus marker for the selected project's computed orbit position. Zero projects keeps a neutral orbit; one project keeps a stable camera.

- [ ] **Step 6: Run layout and full Node tests**

Run: `node --test tests/journey-v2/*.test.mjs`

Expected: PASS for 0, 1, 3, and 8 project layouts.

- [ ] **Step 7: Commit dynamic scene integration**

```bash
git add assets/journey-v2/app.js assets/journey-v2/scene.js assets/journey-v2/project-layout.js tests/journey-v2/project-layout.test.mjs
git commit -m "feat(portfolio): scale journey scene to project count"
```

### Task 5: Complete responsive, accessible, and fallback states

**Files:**
- Modify: `assets/journey-v2/styles.css`
- Modify: `assets/journey-v2/project-pages.css`
- Modify: `assets/journey-v2/app.js`
- Modify: `assets/journey-v2/scene.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: the generated panels, controls, detail dialog, and scene controller from Tasks 3–4.
- Produces: equivalent readable content in enhanced, reduced-motion, no-WebGL, and no-JavaScript states.

- [ ] **Step 1: Apply the designer's implementation-ready guidance**

Use Journey's existing palette, Raleway typography, editorial hierarchy, Earth composition, and city ending. Adapt only project preview/media treatments and controls needed for dynamic data; record final tokens and breakpoints in `WORKFLOW_STATE.md`.

- [ ] **Step 2: Finish keyboard and dialog behavior**

Verify visible `:focus-visible`, named controls, logical tab order, Escape close, focus containment/restoration, skip link, direct-hash focus, Back/Forward behavior, and keyboard traversal of many project controls. Never hide a focused control through scene opacity.

- [ ] **Step 3: Finish reduced-motion and visibility behavior**

Settle the scene, expose content immediately, disable smooth scrolling and nonessential transitions, react to preference changes, and pause RAF work while the document is hidden.

- [ ] **Step 4: Finish WebGL/manifest/no-script fallbacks**

Scene import/context failure switches to readable-page mode without removing content. Manifest failure does not block About or Contact. `<noscript>` exposes all static identity/About/Contact content and a projects-unavailable note.

- [ ] **Step 5: Finish responsive layouts**

Validate 1440×900, 1024×768, 390×844, 360×800, and short landscape viewports. Keep controls at approximately 44px, prevent page overflow, and switch crowded orbit controls to a scrollable/condensed form.

- [ ] **Step 6: Run static tests and syntax checks**

Run: `node --test tests/journey-v2/*.test.mjs`

Run: `node --check assets/journey-v2/app.js`

Run: `node --check assets/journey-v2/scene.js`

Expected: all PASS with no syntax errors.

Also assert in `tests/journey-v2/versioning.test.mjs` that root HTML contains static identity/About/Contact fallback content, skip navigation, and a no-JavaScript projects explanation.

- [ ] **Step 7: Commit resilience and accessibility**

```bash
git add index.html assets/journey-v2
git commit -m "fix(portfolio): harden journey accessibility and fallbacks"
```

### Task 6: Preserve compatibility and complete verification

**Files:**
- Modify: `project.html`
- Modify: `README.md`
- Modify: `Docs.md`
- Modify: `WORKFLOW_STATE.md`
- Test: `tests/journey-v2/versioning.test.mjs`

**Interfaces:**
- Consumes: `legacyProjectDestination(search)` from Task 3 and the final Journey V2 behavior.
- Produces: legacy navigation into the root dynamic detail route and current contributor documentation.

- [ ] **Step 1: Update the legacy redirect**

Keep `project.html?id=<id>` redirecting to `./index.html#project=<encoded-id>` and no-ID requests to `./index.html#projects`. Use the same ID constraints as Journey V2.

- [ ] **Step 2: Update project documentation**

Document `assets/journey-v2/` as the production interface, retain the `projects/<id>/index.json` authoring instructions, and explain that the original Journey and legacy root assets are preserved references.

- [ ] **Step 3: Run the full static suite**

Run: `node --test tests/journey-v2/*.test.mjs`

Run: `node --check assets/journey-v2/app.js`

Run: `node --check assets/journey-v2/project-data.js`

Run: `node --check assets/journey-v2/project-pages.js`

Run: `node --check assets/journey-v2/scene.js`

Run: `git diff --check`

Expected: all tests/checks PASS and no whitespace errors.

- [ ] **Step 4: Run browser scenarios**

Serve the repository root locally. Verify loading and deep links with current Driftwake data; synthetic 0/1/3/8/64-project manifests; failed/malformed manifest; unsafe media/links and allowed/disallowed iframe providers; forward and reverse scroll; direct About/Projects/Contact jumps; detail open/close/next; Back/Forward from both in-page and direct-hash entry; URL/scroll/focus restoration; keyboard-only traversal of many controls; no-JavaScript static fallback; reduced-motion runtime toggle; simulated WebGL failure; and the target desktop/mobile viewports.

- [ ] **Step 5: Verify source preservation**

Compare the final hashes of `overwrite-design/dist/journey/` with Task 1's baseline. Expected: no changes. Confirm `.github/workflows/update-manifest.yml`, project source JSON, `assets/app.js`, and `assets/style.css` were not modified.

- [ ] **Step 6: Complete workflow gates**

Record debater, designer, implementor, reviewer, tester, security-reviewer, linter, and commit-message outcomes in `WORKFLOW_STATE.md`, including exact commands/results and remaining browser-only limitations.

- [ ] **Step 7: Commit compatibility and documentation**

```bash
git add project.html README.md Docs.md WORKFLOW_STATE.md tests/journey-v2
git commit -m "docs(portfolio): document journey v2 project workflow"
```
