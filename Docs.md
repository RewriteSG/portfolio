# Portfolio

A GitHub Pages portfolio whose production interface lives in
`assets/journey-v2/`. It discovers project data from `projects/` and renders
the Journey experience client-side. No frameworks or build step are required
for the app; a GitHub Action regenerates `projects.json` whenever
`projects/**` changes on `main`.

## How it works

- Each project lives in its own folder under `projects/<id>/`, with an
  `index.json` describing it and any local image files. The folder name
  becomes the project ID; IDs may contain letters, numbers, underscores, and
  hyphens.
- On every push to `main` that touches `projects/**`, the workflow in
  `.github/workflows/update-manifest.yml` walks all `projects/*/index.json`
  files, merges them into a single `projects.json` at the repo root (adding
  the folder name as `id`), and commits it back.
- Root `index.html` loads the Journey V2 production modules and fetches
  `./projects.json`. The Journey contains Hello, About, Projects, and Contact
  sections; project detail links use `#project=<id>` and the project index
  uses `#projects`.
- `project.html?id=<id>` remains a compatibility redirect. Safe IDs redirect
  to `./index.html#project=<id>`; missing or invalid IDs go to
  `./index.html#projects`.
- The original Journey under `overwrite-design/dist/journey/` and the
  pre-V2 root files `assets/app.js`, `assets/style.css`, and
  `bundled-backup.html` are preserved as references. The production page
  loads Journey V2 from `assets/journey-v2/`.

`projects.json` is generated — don't hand-edit it. Edits will be
overwritten the next time the Action runs.

## Customizing your text — `assets/info.js`

Everything on the site that isn't project data lives in one file:
`assets/info.js`. It exports a single `window.SITE_INFO` object that
`app.js` reads at boot to fill in the page. Edit the values in that file —
your name/logo, the nav tab labels, the home/work/about/contact prompts,
headings and lede paragraphs, the about-page bio paragraphs and skills
table, the education/timeline ASCII blocks, your contact email, socials
list, availability status, and the footer line. The file is heavily
commented inline with notes on formatting (e.g. the skills table needs
exactly 3 columns per row).

No HTML or JS editing is required — just change the string/array values
inside `SITE_INFO` and reload. This also drives the browser tab title, the
`<meta name="description">` tag, and the contact form's `mailto:` target.

The small terminal-style section labels scattered around the site (`bio/`,
`skills/`, `education/`, `timeline/`, `stack/`, `commit_log/`, `links/`,
`direct/`, `selected_work/`) are also editable — they live under
`SITE_INFO.labels` in `info.js`. Keep or drop the trailing `/` as you like;
it's just part of the filesystem-style look, not required.

## Design

The production site follows the Journey design: a full-page scene with Hello,
About, Projects, and Contact chapters, a restrained animated 3D backdrop, and
project previews and details generated from the manifest. The older CRT
portfolio and the source Journey files remain available as references; they
are not loaded by the production shell.

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
  "subhead": "A one-line hook shown large on the detail page",
  "long": "A longer paragraph shown next to the media gallery on the detail page.",
  "stack": ["Unity", "C#", "FMOD"],
  "code": "C#",
  "commits": ["shipped v1.0", "fixed the storm shader"],
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
| `description` | string | yes | Short description — used as the card blurb, and as a fallback for `subhead`/`long` |
| `thumbnail` | string | yes | Path to thumbnail image (relative to project folder) |
| `tags` | string[] | no | Categorization tags (also used for grid filtering); the first tag is shown as the card's pill label |
| `date` | string | no | Release / completion date (ISO 8601) |
| `status` | `"completed"` \| `"in-progress"` \| `"prototype"` | no | Badges WIP projects on the grid and detail page |
| `order` | number | no | Manual sort/pin override (higher = earlier); falls back to `date` if omitted |
| `subhead` | string | no | Large hook shown at the top of the detail page's description column; falls back to `name` |
| `long` | string | no | Longer body text on the detail page; falls back to `description` |
| `stack` | string[] | no | Tech-stack pills on the detail page; falls back to `tags` |
| `code` | string | no | Short language/tech label shown on the card (e.g. `"C++"`); falls back to the second tag |
| `commits` | string[] | no | Lines shown in the detail page's `commit_log/` terminal box; if omitted, generated from `status`/`tags`/`date` |
| `media` | array | no | Images and videos shown in the project's gallery |
| `links` | object | no | External links (`demo`, `github`, `itch.io`, etc.) |

### Media entry

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"image"` or `"video"` | Media type |
| `src` | string | Images: path relative to the project folder. Videos: either a direct video file URL (`.mp4`/`.webm`/`.ogg`/`.mov`, hosted externally) or an **embed URL** (YouTube/Vimeo/itch.io). |
| `caption` | string | Optional caption |
| `cardPreview` | boolean | Video entries only. Marks this clip as the one to autoplay on the project's grid card (home/work) instead of the static `thumbnail` image. See below. |

**Video playback.** A direct video file (`src` ending in `.mp4`/`.webm`/etc.) renders as an HTML5 `<video>` and always autoplays muted/looped on the project's detail page. A YouTube or Vimeo embed URL renders as an `<iframe>` and also autoplays muted on the detail page (autoplay params are appended automatically — just use the plain embed URL). Muted autoplay is a browser requirement, not a choice; visitors can unmute via the native video controls.

**Card grid autoplay.** Only a *direct video file* can autoplay as a card preview (home/work grids) — either the first `media` entry if it's a direct video, or whichever entry has `"cardPreview": true`. YouTube/Vimeo embeds are intentionally excluded from card previews: autoplaying several embedded players at once across a grid is heavy and often silently blocked by the browser, so those still show the static `thumbnail` image on cards and only autoplay once you're on the single-item detail page.

```json
"media": [
  { "type": "video", "src": "https://cdn.example.com/driftwake/clip.mp4", "caption": "Storm gameplay", "cardPreview": true },
  { "type": "video", "src": "https://www.youtube.com/embed/xxxxxxxx", "caption": "Full trailer" }
]
```

**Don't commit `.mp4` files.** Git keeps every version in history forever
and bloats repo size over time, with no streaming/transcoding benefit on
GitHub Pages. Host trailers externally (YouTube unlisted, itch.io, Vimeo,
or a CDN for a direct file) and reference the URL in `src`. Images stay
in-repo since they're small and load directly.

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
├── bundled-backup.html          # Legacy design reference
├── index.html                   # Journey V2 production shell
├── project.html                 # Compatibility redirect: ?id=X → index.html#project=X
├── projects.json                # Auto-generated manifest — do not edit by hand
├── assets/
│   ├── info.js                  # Editable identity, About, Contact, and social content
│   ├── journey-v2/              # Production interface, styles, and scene modules
│   ├── style.css                # Legacy CRT stylesheet reference
│   └── app.js                   # Legacy app reference
├── overwrite-design/dist/journey/ # Original Journey source reference
├── projects/
│   └── Driftwake/
│       ├── index.json
│       ├── thumbnail.png
│       └── screenshot1.png
├── .github/workflows/update-manifest.yml
└── README.md
```

## Known tradeoffs

- Since content renders client-side via JS, individual project pages don't
  get per-project Open Graph tags, so social-media link previews will be
  generic rather than project-specific.
- The animated CRT boot intro plays once per browser session
  (`sessionStorage`) and can be replayed anytime via the `./intro.sh`
  button in the header.
- The contact form has no backend (this is a static site) — submitting it
  opens the visitor's email client via a pre-filled `mailto:` link.
