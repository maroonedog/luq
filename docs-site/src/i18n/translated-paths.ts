// ===========================================================================
// docs-site/src/i18n/translated-paths.ts
//
// Which routes exist in Japanese.
//
// Held as data because the language switch has to know: Astro's i18n routing
// will point at /ja/anything whether or not a page serves it, and a switch that
// lands a reader on a 404 is worse than one that is not offered. When a page is
// not translated the switch goes to the Japanese home instead, and says so in
// its title.
//
// One line per page, added when the page is added, and every entry is also
// recorded in ./translated-from.ts — which is what makes it stale-checkable.
// check-built-pages.mjs resolves every internal link on the built site, so an
// entry naming a route nothing serves fails the build rather than the reader.
// ===========================================================================

export const TRANSLATED_PATHS: readonly string[] = Object.freeze(["/ja"]);
