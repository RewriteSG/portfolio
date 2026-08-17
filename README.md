# Portfolio

A GitHub Pages portfolio that discovers projects from the `projects/` folder
and renders them client-side. No frameworks, no build step — the only
"build" is a GitHub Action that regenerates `projects.json` whenever
`projects/**` changes on `main`.

## How it works

- Each project lives in its own folder under `projects/<Name>/`, with an
  `index.json` describing it and any local image files.
- On every push to `main` that touches `projects/**`, the workflow in
  `.github/workflows/update-manifest.yml` walks all `projects/*/index.json`
  files, merges them into a single `projects.json` at the repo root (adding
  the folder name as `id`), and commits it back.
- `index.html` and `project.html` fetch `./projects.json` once — no GitHub
  API calls, no per-project requests, no rate-limit exposure no matter how
  much traffic the site gets.

`projects.json` is generated — don't hand-edit it. Edits will be
overwritten the next time the Action runs.

## Adding a new project

1. Create a folder: `projects/YourProjectName/`
2. Add `index.json` inside it, following the schema below.
3. Add any image files in the same folder (thumbnail + screenshots).
   Keep videos external — see the note below.
4. Push to `main`. The Action rebuilds `projects.json` automatically and
   the live site picks it up on next load.

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `description` | string | yes | Short description |
| `thumbnail` | string | yes | Path to thumbnail image (relative to project folder) |
| `tags` | string[] | no | Categorization tags (also used for grid filtering) |
| `date` | string | no | Release / completion date (ISO 8601) |
| `status` | `"completed"` \| `"in-progress"` \| `"prototype"` | no | Badges WIP projects on the grid and detail page |
| `order` | number | no | Manual sort/pin override (higher = earlier); falls back to `date` if omitted |
| `media` | array | no | Images and videos shown in the project's gallery |
| `links` | object | no | External links (`demo`, `github`, `itch.io`, etc.) |

### Media entry

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"image"` or `"video"` | Media type |
| `src` | string | Images: path relative to the project folder. Videos: an **external embed URL** (YouTube/itch.io/Vimeo). |
| `caption` | string | Optional caption |

**Don't commit `.mp4` files.** Git keeps every version in history forever
and bloats repo size over time, with no streaming/transcoding benefit on
GitHub Pages. Host trailers externally (YouTube unlisted, itch.io, Vimeo)
and reference the embed URL in `src`. Images stay in-repo since they're
small and load directly.

## Local preview

No build step is required — just serve the folder statically, e.g.:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then open `index.html` in a browser. `projects.json` must exist locally for
the site to render (it's generated automatically on `main` by the Action;
for local testing you can run the same merge logic manually or just keep
the checked-in copy up to date).

## File structure

```
portfolio/
├── bundled-backup.html          # Original design (source of design/functionality reference)
├── index.html                   # Main page — project grid
├── project.html                 # Detail page (?id= query param)
├── projects.json                # Auto-generated manifest — do not edit by hand
├── assets/
│   ├── style.css                # Dark terminal theme, responsive layout
│   └── app.js                   # Fetch/render/filter/lightbox logic
├── projects/
│   └── Driftwake/
│       ├── index.json
│       ├── thumbnail.png
│       └── screenshot1.png
├── .github/workflows/update-manifest.yml
└── README.md
```

## Known tradeoff

Since content renders client-side via JS, individual project pages don't
get per-project Open Graph tags, so social-media link previews will be
generic rather than project-specific.
