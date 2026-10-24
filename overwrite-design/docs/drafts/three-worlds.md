# Three worlds for Hazwan's portfolio

User request: preserve the 2015 replica exactly; create three full web presentation designs that replace the abstract mask and objects with mountains, a miniature voxel level, or a boat on the ocean. Merge portfolio content with the presentation rather than putting it in a separate About panel.

All new application files live under `dist/drafts/`. The existing `dist/index.html`, scripts, styles, assets, renderer and local vendor libraries are read-only for this work. Original file SHA-256 values are recorded in `output/drafts/original-hashes.json` and checked at handoff. No hosted project is changed.

## Content

Use the earlier Hazwan portfolio already present in Git history: product design and creative development; Singapore/GMT+8; Northstar (research and customer signal), Lumen (studio identity), Field Notes (workspace for curious teams); a process of finding the real question, shaping the signal, and making the next step obvious; hello@hazwan.design. No new employment, client, quantitative, or availability claims. Projects are presented as portfolio studies.

## Three complete directions

1. **Ridgeline** (`mountains/`): near-black alpine landscape, stone and snow surfaces, atmospheric grey, silver contours, large crisp typography. A camera journey turns the introduction, work, process, and contact into a continuous expedition.
2. **Small Worlds** (`voxel/`): a crafted isometric miniature with stepped terrain, trees, architecture, paths, and water. Ivory and charcoal typography with moss, coral, and periwinkle geometry. Chapters explore different parts of the miniature.
3. **Open Water** (`ocean/`): a modeled sailboat on moving blue water, open horizon, white editorial type, restrained nautical navigation. Portfolio chapters use wide, close, overhead, and horizon camera viewpoints.

Each is an independently runnable website with six or seven substantive chapters, actual work descriptions, working chapter navigation, wheel/keys/touch, mobile layout, reduced motion, focus visibility, and a readable fallback. The concept index is a navigation aid; it links into the complete presentations.

## Implementation and checks

- Buildless HTML/CSS/ES modules; reuse only the locally bundled Three.js and typeface.
- Three parallel implementers own independent draft directories; the primary agent owns the concept index and verification.
- Test all chapters, navigation, links, mobile sizing, reduced motion, and browser errors. Inspect representative screenshots.
- Recheck all original checksums before delivery and document material limitations.
