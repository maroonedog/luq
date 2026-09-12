// Reads the built HTML and refuses to ship three defects that every earlier
// check is blind to. `astro check` reported 0 errors while two of the three
// were live, so none of this is theoretical.
//
//  1. FOSTER-PARENTED CODE TAGS. A `{'literal'}` expression written inside a
//     <table> is hoisted out of the table by the HTML parser, leaving an empty
//     <code></code> where the text should be. It typechecks, it builds, and the
//     cell renders blank.
//
//  2. 1.x API INSIDE A CODE BLOCK. `result.isValid()` and friends belong on
//     this site only in prose that says they are gone. Inside a <pre> they are
//     an instruction to write code that does not compile — the exact failure
//     the 1.x site shipped in 31 places. The repository's check:docs compiles
//     the TypeScript blocks; this catches the same mistake in a block that is
//     not TypeScript, and needs no compiler to do it.
//
//  3. DEAD INTERNAL LINKS. Navigation is three hand-written arrays and the
//     pages link each other by hand. Nothing resolved those hrefs until now.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_SITE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(DOCS_SITE_ROOT, "dist");

const EMPTY_CODE_TAG = /<code[^>]*><\/code>/g;
const PRE_BLOCK = /<pre\b[^>]*>([\s\S]*?)<\/pre>/g;
const HREF = /\shref="([^"]*)"/g;

/** Written as entities in the HTML, so match what the browser will show. */
const LEGACY_IN_CODE = [
  "result.isValid(",
  "result.isError(",
  "result.errors",
  ".unwrapOr(",
  ".unwrapOrElse(",
  "Result.ok(",
  "LuqValidationException",
];

function collectHtmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

function decodeEntities(html) {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * A root-relative href resolves either to a page (`/docs/api/validator` ->
 * `dist/docs/api/validator/index.html`) or to an asset shipped as-is
 * (`/favicon.svg`, `/_astro/*.css`). Both count as resolved.
 */
function resolvesInDist(route) {
  const clean = route.replace(/[?#].*$/, "").replace(/\/$/, "");
  if (clean === "") return exists(join(DIST, "index.html"));
  return exists(join(DIST, `${clean}/index.html`)) || exists(join(DIST, clean));
}

function findEmptyCodeTags(file, html) {
  const found = html.match(EMPTY_CODE_TAG) ?? [];
  return found.length === 0
    ? []
    : [
        `${file}: ${String(found.length)} empty <code></code> tag(s) — a {'literal'} inside a <table> was foster-parented out of it`,
      ];
}

function findLegacyApiInCodeBlocks(file, html) {
  const problems = [];
  PRE_BLOCK.lastIndex = 0;
  let block = PRE_BLOCK.exec(html);
  while (block !== null) {
    const text = decodeEntities(block[1] ?? "");
    for (const token of LEGACY_IN_CODE) {
      if (text.includes(token)) {
        problems.push(
          `${file}: a code block contains the 1.x API "${token}" — write result.valid / result.issues, or move the mention into prose`
        );
      }
    }
    block = PRE_BLOCK.exec(html);
  }
  return problems;
}

/**
 * The app bar's menu button and the drawer it opens must ship together.
 *
 * Header renders the button on every page below the md breakpoint, but the
 * drawer used to be rendered per page and nine of sixteen never did it — every
 * docs page and the plugin catalogue. The button was visible and inert: no
 * listener, aria-expanded stuck at false, and a phone reader arriving from the
 * README's own links had no primary navigation and no way to ask for one.
 *
 * Nothing about that was visible in a desktop browser, which is why it lasted.
 * Pairing the two ids is what makes it visible to the build.
 */
function findUnpairedMobileMenu(file, html) {
  const button = html.includes('id="mobile-menu-toggle"');
  const drawer = html.includes('id="mobile-menu"');
  if (button === drawer) return [];
  return [
    button
      ? `${file}: renders the menu button but no #mobile-menu drawer, so the button does nothing`
      : `${file}: renders a #mobile-menu drawer with no button to open it`,
  ];
}

function findDeadInternalLinks(file, html, anchorsByRoute) {
  const problems = [];
  HREF.lastIndex = 0;
  let href = HREF.exec(html);
  while (href !== null) {
    const target = href[1] ?? "";
    href = HREF.exec(html);
    // A bare `#section` link is checked against the page it sits on. It used to
    // be skipped outright: `startsWith("/")` is false for it, so every
    // in-page table of contents on the site was unguarded, and an id renamed
    // out from under one would have shipped. Four such tables were added in one
    // sitting on the strength of a build that was not looking.
    if (target.startsWith("#")) {
      const here = anchorsByRoute.get(routeOf(file));
      if (here !== undefined && !here.has(target.slice(1))) {
        problems.push(
          `${file}: dead in-page link ${target} — this page has no id="${target.slice(1)}"`
        );
      }
      continue;
    }
    if (!target.startsWith("/") || target.startsWith("//")) continue;
    const [route, fragment] = target.split("#");
    if (route !== undefined && route !== "" && !resolvesInDist(route)) {
      problems.push(
        `${file}: dead link ${target} — no page is built at ${route}`
      );
      continue;
    }
    if (fragment === undefined || fragment === "") continue;
    const anchors = anchorsByRoute.get(route === "" ? "/" : route);
    if (anchors !== undefined && !anchors.has(fragment)) {
      problems.push(
        `${file}: dead link ${target} — that page has no id="${fragment}"`
      );
    }
  }
  return problems;
}

/**
 * The route a built file serves, from the name it is reported under.
 *
 * `findDeadInternalLinks` receives that name rather than the path, so an
 * in-page `#fragment` has to be turned back into the route whose anchors were
 * collected under it.
 */
function routeOf(file) {
  const route = `/${file.split("\\").join("/")}`.replace(/\/index\.html$/, "");
  return route === "" ? "/" : route;
}

function readAnchors(html) {
  const ids = new Set();
  for (const match of html.matchAll(/\sid="([^"]+)"/g)) ids.add(match[1]);
  return ids;
}

function run() {
  if (!exists(DIST)) {
    throw new Error(`no built output at ${DIST}. Run \`astro build\` first.`);
  }
  const files = collectHtmlFiles(DIST);
  const anchorsByRoute = new Map();
  const contents = new Map();
  for (const file of files) {
    const html = readFileSync(file, "utf8");
    contents.set(file, html);
    const route = `/${relative(DIST, file).split("\\").join("/")}`
      .replace(/\/index\.html$/, "")
      .replace(/^$/, "/");
    anchorsByRoute.set(route === "" ? "/" : route, readAnchors(html));
  }

  const problems = [];
  for (const [file, html] of contents) {
    const name = posix.join(...relative(DIST, file).split("\\"));
    problems.push(
      ...findEmptyCodeTags(name, html),
      ...findLegacyApiInCodeBlocks(name, html),
      ...findDeadInternalLinks(name, html, anchorsByRoute),
      ...findUnpairedMobileMenu(name, html)
    );
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`${String(problems.length)} problem(s) in the built pages.`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `${String(files.length)} built pages: no foster-parented code tags, no 1.x API inside a code block, no dead internal links, menu button and drawer paired.`
  );
}

run();
