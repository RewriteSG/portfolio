# Portfolio GitHub Pages — Project Plan

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

## Steps

### Step 1 — Backup existing file
- Rename `index.html` → `bundled-backup.html`

### Step 2 — Create project folder + sample schema
- Create `projects/Driftwake/index.json` with the schema above
- Add placeholder image files (thumbnail.png, screenshot1.png) or leave for user to add
- Reference video via an external embed URL, not a committed file

### Step 3 — Create `assets/style.css`
- Dark theme (background: `#0a0a0f`, accent: `#33ff99`)
- Responsive CSS Grid for project cards
- Project detail page styling (media gallery, lightbox for images with Esc-to-close and arrow-key navigation)
- Tag-filter pill row on the main grid (click a tag to filter)
- Status badge styling (e.g. "in-progress" ribbon)
- Mobile-friendly breakpoints

### Step 4 — Create `.github/workflows/update-manifest.yml`
- Triggers on push to `main` when `projects/**` changes
- Script (Node or a shell + `jq` step) walks `projects/*/index.json`, merges into `projects.json` with each folder name added as `id`
- Commits the updated `projects.json` back to `main`

### Step 5 — Create `index.html` (main page)
- On load, fetch `./projects.json` (same-origin, no API, no auth, no rate limit)
- Sort by `order` (if present) then `date`
- Render responsive card grid:
  - Thumbnail image, loaded directly from its repo path (or `raw.githubusercontent.com` if not served via Pages)
  - Project name
  - Description (truncated)
  - Tags as clickable filter pills
  - Status badge if `status` is `"in-progress"` or `"prototype"`
  - Click → navigates to `project.html?id={id}`
- Loading state while fetching
- Error state if `projects.json` is missing/malformed
- Dark terminal-style aesthetic (monospace font, green accent)

### Step 6 — Create `project.html` (detail page)
- Read `?id=` from URL params
- Fetch `./projects.json`, find the matching entry client-side (still just one request)
- Render:
  - Back button → `index.html`
  - Project name (large heading)
  - Description
  - Tags, status badge
  - Media gallery:
    - Images: displayed inline, click to expand (lightbox)
    - Videos: embedded player (iframe for YouTube/itch.io, or HTML5 `<video>` if a direct URL)
  - External links (demo, github, etc.)
- 404 state if project id not found

### Step 7 — Create `README.md`
- How to add a new project:
  1. Create folder `projects/YourGame/`
  2. Add `index.json` following the schema
  3. Add image files in the same folder; host any video externally and link it
  4. Push to `main` — the Action rebuilds `projects.json` automatically, site picks it up on next load
- Schema reference
- Note that `projects.json` is generated — don't hand-edit it, edits will be overwritten on next push

## Design Notes
- **Font**: JetBrains Mono (monospace, loaded from Google Fonts)
- **Color palette**: `#0a0a0f` bg, `#111` cards, `#33ff99` accent, `#ccc` text
- **No frameworks**: Vanilla HTML/CSS/JS only
- **No client-side build step**: everything the browser does is static-file fetch + render; the only "build" is the GitHub Action regenerating `projects.json`, which is free (unlimited Actions minutes on public repos) and removes all GitHub API rate-limit risk from the live site
- **Known tradeoff accepted**: since content renders client-side via JS, individual project pages won't have per-project Open Graph tags, so social-media link previews will be generic rather than project-specific. Not fixed in this plan.
