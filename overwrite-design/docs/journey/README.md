# A little perspective

The approved six-scene portfolio is available at [the local journey](http://127.0.0.1:4173/journey/).

1. Hello in deep space with glowing cube stars.
2. Downward star streaks reveal Earth, without smoke.
3. About on a curved ocean planet with faceted mountains and an ivory boat. The boat sails as the camera pulls back; there is no separate boat chapter.
4. Solar-system orbits become the project progress ring. Northstar, Lumen, and Field Notes each have a complete study presentation.
5. The camera returns to Earth through clouds.
6. A detailed voxel neighbourhood becomes Contact.

Scroll naturally in either direction. Navigation and the project ring jump to reading stops. Arrow keys on the ring move between projects. The options menu offers a conventional reading view and links to the earlier designs. Reduced motion uses static camera views. If WebGL is unavailable, all portfolio content remains readable.

The solar system is also the project navigation: the outer orbit fills with scroll progress and its three project planets are selectable. View all projects sits inside the model. The selected study shows its preview above a concise description; View more opens a full page sliding in from the left. These pages have shareable `#work` and `#work/<project>` routes and support browser Back, Escape, and returning to the same place in the journey.

Product files live exclusively in `dist/journey/`: `scene.js` orchestrates the camera and worlds, `earth.js` builds the curved planet and sailing boat, `city.js` builds the voxel city, and `app.js` connects native scrolling to the content and ring. No new dependencies are required.

To restart the preview, run the existing `npm run dev` from the repository root, then open `/journey/`. The original at `/` and drafts at `/drafts/` are unchanged. No hosted project was updated.
