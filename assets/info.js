/* ============================================================
   info.js — all the non-project text on this site, in one place.
   Edit the values below; nothing else in this file needs to change.
   Loaded before app.js, which reads window.SITE_INFO to populate
   the page. Project content itself (name, description, media, etc.)
   still lives in projects/<Name>/index.json — see README.md.
   ============================================================ */

window.SITE_INFO = {

  // Browser tab title and search-engine description.
  meta: {
    title: 'RewriteSG — Portfolio',
    description: 'Programmer building across games, software and apps.'
  },

  // Your name/handle — used for the logo (top-left) and in page titles
  // like "Work — A.Voss".
  name: 'Hazwan',

  // Nav bar tab labels, and a few recurring button labels. The .sh /
  // ./ styling is just the terminal theme — keep or change to taste.
  nav: {
    home: 'home.sh',
    work: 'work.sh',
    about: 'about.sh',
    contact: 'contact.sh',
    introReplay: './intro.sh',
    introEnter: './home.sh --enter',
    contactCta: 'get_in_touch()'
  },

  // ---------------- home page ----------------
  home: {
    prompt: '> run Hazwan.sh --whoami',
    title: 'Programmer, building across games, software, apps & the web.',
    lede: 'A working record of shipped projects — from indie game prototypes to production software, native apps and the odd stubborn website.',
    ctaPrimary: 'view_work --all',
    ctaSecondary: 'about.sh'
  },

  // Labels under the four numbers on the home page stats row. The
  // numbers themselves (years/projects/disciplines/wip) are computed
  // automatically from projects.json — only the labels are editable here.
  stats: {
    years: 'years_shipping',
    projects: 'projects_shipped',
    disciplines: 'disciplines',
    wip: 'unfinished_builds'
  },

  // ---------------- work page ----------------
  work: {
    prompt: '> ls work/',
    title: 'All works'
  },

  // ---------------- about page ----------------
  about: {
    prompt: '> run about.sh',
    title: 'Ten years turning ideas into working software.',

    // One paragraph per array entry.
    bio: [
      "I've spent the last eight years moving between disciplines that don't usually share a desk — game engines, backend services, native apps, and the occasional client website. I like the parts of programming that feel like carpentry: cutting a problem down until only the necessary joints are left. Currently based remote, shipping solo and in small teams.",
      "Outside of client work I keep a running log of side projects — most don't ship, a few do. Driftwake, on the work tab, is the one I'm proudest of.",
      "I work best on small teams with short feedback loops — a spec on a napkin beats a spec in a doc most days. If a project needs a second set of hands, I've got a short list of collaborators for design, audio and QA."
    ],

    // 3-column skills grid. `headers` must have exactly 3 entries;
    // each row in `rows` must also have exactly 3 entries (use '' for
    // an empty cell). Add/remove rows freely.
    skills: {
      headers: ['LANGUAGES', 'FRAMEWORKS', 'INFRA'],
      rows: [
        ['C++ / Rust', 'Godot / Unity', 'Docker'],
        ['TypeScript', 'React / Next.js', 'GitHub Actions'],
        ['Swift', 'SwiftUI', 'CloudKit'],
        ['Python', 'SQLite / Postgres', 'Vercel']
      ]
    },

    // Free-form ASCII art blocks — edit the text but keep it roughly
    // aligned (monospace font) if you want the connecting lines to
    // line up. Use \n for line breaks.
    education: '  2014 ─┬─ High School Diploma\n' +
      '        │   Lincoln Academy\n' +
      '        │\n' +
      '  2018 ─┼─ B.S. Computer Science\n' +
      '        │   State University\n' +
      '        │\n' +
      '  2020 ─┴─ M.S. Computer Graphics, Real-Time Rendering\n' +
      '            State University',

    timeline: '  2023 ─┬─ now\n' +
      '        │   Independent — contract software & game dev\n' +
      '        │\n' +
      '  2020 ─┼─ 2023\n' +
      '        │   Senior engineer — backend systems, mid-size startup\n' +
      '        │\n' +
      '  2018 ─┴─ 2020\n' +
      '            App developer — iOS team, agency work'
  },

  // ---------------- contact page ----------------
  contact: {
    prompt: '> ./contact.sh --init',
    title: "Let's build something.",
    lede: 'Open to freelance work and interesting collaborations. Fill in the fields below or reach out directly.',

    // The contact form's "./send.sh" button opens the visitor's email
    // client with a message addressed here (this is a static site,
    // there's no backend to actually send anything).
    email: 'hi@example.dev',

    status: 'available for freelance, Q4 2026',
    responseTime: 'usually within 24h, GMT+8'
  },

  // Shown as "$ open <label>" links on the contact page, under
  // "direct/". Add as many as you like — github, twitter, itch.io,
  // linkedin, a personal site, etc. Your email above is always shown
  // first automatically; you don't need to repeat it here.
  socials: [
    { label: 'github.com/RewriteSG', url: 'https://github.com/RewriteSG' }
  ],

  footer: 'built with vanilla html/css/js · projects.json manifest generated by github actions',

  // ---------------- section labels ----------------
  // These are the small terminal-style headers scattered around the site
  // (e.g. "bio/", "skills/"). Purely cosmetic filesystem-style chrome —
  // change the text or leave as-is. Keep the trailing "/" if you want to
  // keep the folder look, or drop it, up to you.
  labels: {
    selectedWork: 'selected_work/',   // home page, above the project grid
    bio: 'bio/',                      // about page
    skills: 'skills/',                // about page
    education: 'education/',          // about page
    timeline: 'timeline/',            // about page
    stack: 'stack/',                  // project detail page
    commitLog: 'commit_log/',         // project detail page
    links: 'links/',                  // project detail page
    direct: 'direct/'                 // contact page
  }
};
