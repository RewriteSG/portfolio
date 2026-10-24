# Portfolio

A GitHub Pages portfolio whose production interface lives in
`assets/journey-v2/`. It discovers project data from `projects/` and renders
the Journey experience client-side. No frameworks or build step are required
for the app; a GitHub Action regenerates `projects.json` whenever
`projects/**` changes on `main`.

## How it works

- Each project lives in its own folder under `projects/<id>/`, with an
  `index.json` describing it and any local image files. The folder name
  becomes the project ID; IDs may contain only ASCII letters, digits,
  underscores (`_`), and hyphens (`-`).
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

## Customizing production copy — `assets/info.js`

Root `index.html` loads this file before the Journey V2 app. The production
app reads these `window.SITE_INFO` fields:

- `meta.title`, `meta.description`, and `name` set the browser metadata and
  identity.
- `home.title` and `home.lede` set the Hello and identity copy.
- `about.title`, `about.bio`, `about.skills.headers`, and
  `about.skills.rows` set the About heading, paragraphs, and skills groups.
  Each skill header pairs with the values at the same index in each row.
- Non-empty `about.education` and `about.timeline` strings appear as expandable
  background details.
- `contact.title`, `contact.lede`, `contact.email`, `contact.status`, and
  `contact.responseTime` set the Contact copy and direct email link.
- `socials` supplies `{ label, url }` links, and `footer` sets the small
  closing line.

Edit these values and reload; project content remains in
`projects/<id>/index.json`. Journey V2 validates the email and social URLs
before rendering them. The Contact section links to the configured email
address; messages are handled by the visitor's email client.

### Legacy settings retained in `assets/info.js`

The file also retains CRT-era settings that the production app does not read:
`nav`, `stats`, `work`, `home.prompt`, `home.ctaPrimary`, `home.ctaSecondary`,
`about.prompt`, `contact.prompt`, and `labels`. These fields and their inline
comments are legacy references; changing them has no effect on Journey V2.

## Design

The production site follows the Journey design: a full-page scene with Hello,
About, Projects, and Contact chapters, a restrained animated 3D backdrop, and
project previews and details generated from the manifest. The older CRT
portfolio and the source Journey files remain available as references; they
are not loaded by the production shell.

## Adding a new project

1. Create a folder: `projects/YourProjectName/`
2. Add `index.json` inside it, following the schema below.
3. Add image files in the same folder. Media may use local project files,
   direct video URLs, or an approved HTTPS embed — see the media notes below.
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
  "commits": "v1.0 shipped",
  "media": [
    { "type": "image", "src": "./screenshot1.png", "caption": "Track view", "alt": "Driftwake track at sunset" },
    { "type": "image", "src": "./screenshot2.png", "caption": "Garage menu" },
    { "type": "video", "src": "./storm-gameplay.mp4", "caption": "Storm gameplay" },
    { "type": "embed", "src": "https://www.youtube.com/embed/xxxxxxxx", "caption": "Launch trailer" }
  ],
  "links": {
    "demo": "https://play.example.com/driftwake",
    "github": "https://github.com/you/driftwake"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | Display name; defaults to the folder-derived project ID |
| `description` | string | no | Short project description; used when `subhead` is empty |
| `thumbnail` | string | no | Optional preview image path relative to the project folder |
| `tags` | string[] | no | Tags shown with the project and detail metadata |
| `date` | string | no | Release or completion date |
| `status` | string | no | Project status; defaults to `unspecified` |
| `order` | finite number | no | Sort order; higher values appear earlier, with date and source order as fallbacks |
| `subhead` | string | no | Project hook; falls back to `description` in the chapter and detail heading |
| `long` | string | no | Optional long-form detail copy, split into paragraphs; it does not fall back to `description` |
| `stack` | string[] | no | Technology labels shown with project tags and in detail metadata |
| `commits` | string or finite number | no | One optional value shown in a single `Commits` metadata field; arrays are not accepted |
| `media` | array | no | Optional image, direct-video, and approved-embed items for previews and the detail gallery |
| `links` | object | no | External project links; only safe HTTP(S) URLs are rendered |
| `code` | legacy field | no | Ignored and removed during normalization; it is not displayed by Journey V2 |

The `commits` field accepts one string or finite number. Older arrays of
commit-log lines are ignored; Journey V2 displays one `Commits` metadata
value and does not generate a commit log. `code` is a retained legacy key
from the prior app and has no effect on the production interface.

### Media entry

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"image"`, `"video"` or `"embed"` | Media type |
| `src` | string | A local path within the project folder or a safe HTTP(S) URL. Embeds require HTTPS and an approved provider host. |
| `caption` | string | Optional caption |
| `alt` | string | Optional image alternative text |
| `cardPreview` | boolean | Legacy hint retained by normalization but ignored by Journey V2; it does not choose a preview or enable playback. |

**Video and embed behavior.** Direct video files (`.mp4`, `.webm`, `.ogv`, `.ogg`, or `.mov`) render in native video controls with `preload="none"`; they do not autoplay. Journey V2 embeds only HTTPS URLs from these hosts: `youtube.com`, `www.youtube.com`, `youtube-nocookie.com`, `player.vimeo.com`, `itch.io`, and `html-classic.itch.zone`.

Project chapter previews use the first resolvable image media item, then
`thumbnail`; if neither resolves, a supported direct video can be used.
Otherwise the preview displays `Preview unavailable`. If the chosen preview
image fails to load, it also displays `Preview unavailable` rather than
trying another item. The detail gallery shows images, controlled direct
videos, or allowlisted embeds. It adds an `Open media in a new tab` link for
safe media URLs; failed gallery images show `Image unavailable.`
Non-allowlisted URLs are not embedded.

Large video files can make the repository history grow quickly. Journey V2
supports local direct videos, but consider hosting large files externally or
using an approved embed. Keep image assets small enough for GitHub Pages.

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
- The Contact section uses a direct `mailto:` link; the static site does not
  submit messages to a server.
