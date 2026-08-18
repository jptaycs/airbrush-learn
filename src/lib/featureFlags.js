// Site-wide feature flags. Keep this list small — it's for pausing a whole
// feature's public entry points without deleting the feature's code.

// Gallery feature (community art gallery + submission form) — paused
// 2026-08-19 per Artem: out of scope for the blog-automation deliverable he
// asked for. The pages (src/pages/gallery/*), data (src/data/gallery.json),
// admin "Gallery Submissions" tab, and Netlify functions (gallery-*.js) are
// all left in place and working — only the public entry points (header nav
// link, homepage "Community Gallery" section) are hidden. Flip this back to
// true to restore them if he changes his mind; no other code changes needed.
export const SHOW_GALLERY = false;
