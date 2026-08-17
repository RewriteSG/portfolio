# Portfolio GitHub Pages — Project Plan

> **Update:** the site was rebuilt for full design fidelity against
> `bundled-backup.html` — see the "Design fidelity rebuild" section at the
> bottom. The original plan below is kept for historical context; the
> file-structure and step list have since diverged (single-page app
> instead of separate `index.html`/`project.html` pages — `project.html`
> is now just a legacy redirect).

## Overview
Build a GitHub Pages site that discovers and displays projects from a `projects/` folder structure. Project data is compiled into a single `projects.json` manifest by a GitHub Action on every push, so the live site never calls the GitHub API and has no rate-limit exposure. Focused on showcasing games and interactive apps.

## File Structure

```
portfolio/
├── bundled-backup.html          # Original index.html (renamed)
├── index.html                   # Main page — project grid
├── project.html                 # Detail page (?id= query param)
├── projects.json                # Auto-generated manifest (built by Action, do not edit by hand)
├── assets/
│   └── style.css                # Dark theme, responsive layout
├── projects/
│   ├── Driftwake/
│   │   ├── index.json           # Project metadata + media refs
│   │   ├── thumbnail.png        # (placeholder — user adds real files)
│   │   └── screenshot1.png
│   └── (future projects go here)
├── .github/
│   └── workflows/
│       └── update-manifest.yml  # Rebuilds projects.json on push to main
└── README.md                    # Instructions for adding projects
```

## Schema — `projects/<Name>/index.json`

```json
{
  "name": "Driftwake",
  "description": "An atmospheric drift racing game with a synthwave aesthetic.",
  "thumbnail": "./thumbnail.png",
  "tags": ["game", "unity", "3d", "racing"],
  "date": "2024-01-15",
  "status": "completed",
  "order": 10,
  "media": [
    { "type": "image", "src": "./screenshot1.png", "caption": "Track view" },
    { "type": "image", "src": "./screenshot2.png", "caption": "Garage menu" },
    { "type": "video", "src": "https://www.youtube.com/embed/xxxxxxxx", "caption": "Launch trailer" }
  ],
  "links": {
    "demo": "https://play.example.com/driftwake",
    "github": "https://github.com/you/driftwake"
  }
}
```

### Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `description` | string | yes | Short description |
| `thumbnail` | string | yes | Path to thumbnail image (relative to project folder) |
| `tags` | string[] | no | Categorization tags (also used for grid filtering) |
| `date` | string | no | Release / completion date (ISO 8601) |
| `status` | `"completed"` \| `"in-progress"` \| `"prototype"` | no | Lets the UI badge WIP projects |
| `order` | number | no | Manual sort/pin override (higher = earlier); falls back to `date` if omitted |
| `media` | array | no | Images and videos (see below) |
| `links` | object | no | External links (`demo`, `github`, `itch.io`, etc.) |

### Media Entry
| Field | Type | Description |
|-------|------|-------------|
| `type` | `"image"` or `"video"` | Media type |
| `src` | string | For images: path relative to project folder. For videos: an **external URL** (YouTube/itch.io/CDN embed) — see note below. |
| `caption` | string | Optional caption |

**Note on video:** don't commit `.mp4` files into the repo — Git keeps every version in history forever and bloats repo size over time, with no real benefit on GitHub Pages (no streaming/transcoding). Host trailers externally (YouTube unlisted, itch.io, Vimeo) and reference the embed URL in `src`. Images stay in-repo since they're small and load directly.

## `projects.json` (generated, not hand-written)

```json
{
  "generated": "2026-08-18T12:00:00Z",
  "projects": [
    { "id": "Driftwake", "...index.json contents merged in..." }
  ]
}
```

Produced by `.github/workflows/update-manifest.yml`, which triggers on every push to `main` that touches `projects/**`, walks each `projects/<Name>/index.json`, merges them (adding the folder name as `id`) into one array, and commits `projects.json` back to the repo root. The live site fetches this single file — no GitHub API calls, no per-project requests, no rate limit exposure regardless of traffic.

## Steps (original)

### Step 1 — Backup existing file
- Rename `index.html` → `bundled-backup.html`

### Step 2 — Create project folder + sample schema
- Create `projects/Driftwake/index.json` with the schema above
- Add placeholder image files (thumbnail.png, screenshot1.png) or leave for user to add
- Reference video via an external embed URL, not a committed file

### Step 3 — Create `assets/style.css`
- Dark theme, responsive CSS Grid, lightbox, tag filters, status badges, mobile breakpoints

### Step 4 — Create `.github/workflows/update-manifest.yml`
- Triggers on push to `main` when `projects/**` changes, merges `projects/*/index.json` into `projects.json`

### Step 5 — Create `index.html` (main page)
### Step 6 — Create `project.html` (detail page)
### Step 7 — Create `README.md`

## Design Notes (original, superseded — see below)
- **Font**: JetBrains Mono
- **Color palette (original draft)**: `#0a0a0f` bg, `#111` cards, `#33ff99` accent, `#ccc` text — this was later corrected to match `bundled-backup.html`'s actual near-black `#050705` bg and softer green text
- **No frameworks, no build step**

---

## Design fidelity rebuild

`bundled-backup.html` is the actual visual/functional reference — a single-page
CRT-terminal-themed app (WebGL shader background, animated boot-log intro,
typed headings/prompts, accent color toggle, hover-zoom lightbox, a real
contact form, and a dedicated About page) — and the first implementation of
this site diverged from it significantly (different palette, separate
`index.html`/`project.html` pages instead of an SPA, no intro, no About
page, no accent toggle, no commit-log section).

The rebuild:

- Extracted the true design spec from `bundled-backup.html`'s bundled
  template/style (colors, component classes, page states, animations).
- Rewrote `assets/style.css` around the near-black (`#050705`) background,
  soft-green (`#9fd9b8`) body text, glowing accent (`#33ff99`, toggleable
  to amber/cyan), and the `term-btn`/`term-tag`/`term-card`/`term-tabs`/
  `term-input` component classes from the reference.
- Rewrote `index.html` as a single-page shell containing all four sections
  (home/work/about/contact) plus the project-detail view and lightbox,
  driven entirely by `projects.json` — the real project data pipeline
  from the original plan, not the reference's hardcoded demo projects.
- Rewrote `assets/app.js`: hash-based router (`#/`, `#/work`, `#/about`,
  `#/contact`, `#/project/<id>`), a WebGL background shader, a
  procedurally-generated boot log (using the real project list) for the
  intro sequence, typing animations for prompts/headings, an accent-color
  toggle persisted to `localStorage`, hover-zoom + lightbox on project
  images, and a `commit_log/` section on the detail page derived from real
  project fields (status/tags/date) rather than fabricated commit
  messages.
- `project.html` is now a thin redirect (`?id=X` → `index.html#/project/X`)
  so old links keep working.
- Extended the `index.json` schema with optional `subhead`, `long`,
  `stack`, `code`, and `commits` fields for richer detail pages — all
  optional, with sensible fallbacks to the existing required fields so
  older project folders keep working unchanged.

Verified locally with a static file server + Playwright screenshots across
the intro, all four main pages, the amber/cyan accent toggle, the
lightbox, and the `project.html` legacy redirect.
