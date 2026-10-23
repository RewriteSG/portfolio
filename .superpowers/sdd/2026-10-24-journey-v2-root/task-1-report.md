# Task 1 Report — Immutable Journey V2 Production Shell

## Status

Implemented the Journey V2 production shell and committed the task work.

## Implementation

- Copied the reference `app.js`, `styles.css`, `project-pages.css`, `scene.js`, `earth.js`, and `city.js` into `assets/journey-v2/`, with local Three.js and Raleway assets under `vendor/` and `fonts/`.
- Updated Three.js imports and the font URL to resolve within `assets/journey-v2/`.
- Replaced root `index.html` with the reference Hello/About/Contact content, a project scene mount, orbit-control mount, project-detail mount, readable fallback status, and a no-JavaScript projects note. The root loads `assets/info.js` before the Journey V2 module.
- Removed the prototype project-pages import, its initialization and interaction wiring, and the unused hard-coded sample planet names. The reference `project-pages.js` and its hard-coded project records are not copied.
- Added a versioning test and SHA-256 fixture covering every file under `overwrite-design/dist/journey/`, plus the referenced Three.js and font sources.
- The immutable `overwrite-design` source and the legacy root `assets/app.js` and `assets/style.css` were not changed.

## TDD Evidence

RED — the first focused run returned `tests 5`, `pass 0`, `fail 5`, with missing V2 production assets/root references. That run also caught a Windows path-separator mismatch in the source-coverage assertion; the test normalizes paths before comparing them.

GREEN — final focused test output:

```text
✔ reference fixture covers every immutable Journey and shared source file
✔ root HTML loads only the Journey V2 production shell in the required order
✔ Journey V2 includes all required copied assets
✔ module imports and CSS URLs resolve within the Journey V2 production boundary
✔ static Journey shell has identity, About, Contact, mounts, and no prototype project studies
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 104.8142
```

## Exact Checks

- `node --test tests/journey-v2/versioning.test.mjs` — passed, 5 tests, 0 failures. This also recomputed and matched the reference hashes.
- `node --check assets/journey-v2/app.js` — passed.
- `node --check assets/journey-v2/scene.js` — passed.
- `node --check assets/journey-v2/earth.js` — passed.
- `node --check assets/journey-v2/city.js` — passed.
- `git -c safe.directory=C:/Users/Hazwan/.codex/worktrees/journey-v2/portfolio diff --check` — passed; Git printed only its expected LF-to-CRLF working-copy notice for `index.html`.

## Files Changed

- `index.html`
- `assets/journey-v2/app.js`
- `assets/journey-v2/styles.css`
- `assets/journey-v2/project-pages.css`
- `assets/journey-v2/scene.js`
- `assets/journey-v2/earth.js`
- `assets/journey-v2/city.js`
- `assets/journey-v2/vendor/three.module.js`
- `assets/journey-v2/fonts/raleway.woff2`
- `tests/journey-v2/versioning.test.mjs`
- `tests/journey-v2/fixtures/journey-reference-hashes.json`
- `WORKFLOW_STATE.md`
- `.superpowers/sdd/2026-10-24-journey-v2-root/task-1-report.md`

## Self-Review and Concerns

- Root HTML contains no Northstar, Lumen, or Field Notes study markup, prototype-only links, or references to `overwrite-design/`.
- Module imports and CSS asset URLs resolve inside the versioned production directory. The V2 app no longer imports a module that was not copied into production.
- Project rendering, orbit stops, and project-detail behavior are intentionally not active in this shell. The empty `#project-mount`, `#orbit-stops`, and `#project-detail` mounts are reserved for the following dynamic-project implementation task.
- No browser runtime check was requested or run; the focused boundary test and module syntax checks pass.
- Context7 and Serena MCP tools were not available in the session.

## Fix Round 1

### Files Changed

- `assets/journey-v2/scene.js` — removed the three hard-coded project markers and sample project identities. Project focus now accepts numeric marker indexes, and the progress arc uses the project chapter's timeline span.
- `assets/journey-v2/app.js` — changed the orbit announcement and count to derive from mounted project stops instead of a fixed count of three.
- `tests/journey-v2/versioning.test.mjs` — defaults reference lookup to the current repository, documents the `JOURNEY_REFERENCE_ROOT` override in its error, and checks import/CSS path containment while rejecting remote runtime dependencies. Added a regression test for prototype names and fixed project counts.
- `WORKFLOW_STATE.md` — appended the fix-round handoff.
- `.superpowers/sdd/2026-10-24-journey-v2-root/task-1-report.md` — appended this fix-round report.

### Commands and Exact Output

Configured reference verification:

```powershell
$env:JOURNEY_REFERENCE_ROOT = 'D:\Github\GitHub\Github\portfolio'; node --test tests/journey-v2/versioning.test.mjs
```

```text
✔ reference fixture covers every immutable Journey and shared source file
✔ root HTML loads only the Journey V2 production shell in the required order
✔ Journey V2 includes all required copied assets
✔ module imports and CSS URLs resolve within the Journey V2 production boundary
✔ production scene contains no prototype project identities or fixed project count
✔ static Journey shell has identity, About, Contact, mounts, and no prototype project studies
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Portable-default error-path check:

```powershell
node --test tests/journey-v2/versioning.test.mjs
```

```text
ℹ tests 6
ℹ pass 5
ℹ fail 1
AssertionError [ERR_ASSERTION]: Journey reference files are unavailable under C:\Users\Hazwan\.codex\worktrees\journey-v2\portfolio; set JOURNEY_REFERENCE_ROOT to the repository containing overwrite-design/dist.
```

This is expected in the managed worktree because the immutable reference directory is not copied into it. Setting the documented override verifies that the fixture matches the external reference.

Syntax checks:

```powershell
node --check assets/journey-v2/app.js
node --check assets/journey-v2/scene.js
```

Both exited 0 with no output.

### Review Notes

- `app.js` and `scene.js` contain no Northstar/Lumen/Field Notes identities or fixed “of 3” navigation count; the scene creates no fixed project markers before dynamic integration.
- Local import and CSS URL targets are resolved and checked to remain within `assets/journey-v2/`. HTTP(S), protocol-relative, and other scheme CSS URLs fail the boundary test; data and fragment URLs are allowed.
- The reference hash test uses the current repository by default and requires `JOURNEY_REFERENCE_ROOT` only when that checkout lacks `overwrite-design/dist/`.
