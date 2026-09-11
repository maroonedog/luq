import * as fs from "fs";
import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { readPublishedFiles } from "./catalog/read-package-json";

/**
 * Every link and image in README.md must resolve for someone who only has the
 * PACKAGE.
 *
 * npm ships README.md, LICENSE and package.json alongside whatever `files`
 * names, and `files` names dist. A relative link therefore points at nothing
 * once installed: `./public/img/library_image.png` renders as a broken image on
 * the npm page, and `CONTRIBUTING.md` is a dead link in node_modules. In the
 * repository the very same text works, which is why this went unnoticed — the
 * file is read in two places and only one of them has the neighbours.
 *
 * The rule is therefore about the published copy: a target that is not shipped
 * must be an absolute URL.
 */
const README = "README.md";
const LINK = /!?\[[^\]]*\]\(([^)\s]+)/g;
const IMG_SRC = /<img[^>]*\ssrc="([^"]+)"/g;

export interface BrokenLink {
  readonly target: string;
  readonly reason: string;
}

/** What npm puts in the tarball besides `files`. */
function shippedRoots(files: readonly string[]): readonly string[] {
  return [...files, "README.md", "LICENSE", "package.json"];
}

function isAbsolute(target: string): boolean {
  return (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("#")
  );
}

export function findBrokenLinks(
  contents: string,
  files: readonly string[]
): readonly BrokenLink[] {
  const shipped = shippedRoots(files);
  const broken: BrokenLink[] = [];
  for (const pattern of [LINK, IMG_SRC]) {
    pattern.lastIndex = 0;
    for (const match of contents.matchAll(pattern)) {
      const target = match[1];
      if (target === undefined || isAbsolute(target)) continue;
      const normalized = target.replace(/^\.\//, "").split(/[#?]/)[0] ?? "";
      const reachable = shipped.some(
        (root) => normalized === root || normalized.startsWith(`${root}/`)
      );
      if (!reachable) {
        broken.push({
          target,
          reason: `not in the published files (${shipped.join(", ")})`,
        });
      }
    }
  }
  return broken;
}

function main(): number {
  const contents = fs.readFileSync(path.join(REPOSITORY_ROOT, README), "utf8");
  const broken = findBrokenLinks(contents, readPublishedFiles(REPOSITORY_ROOT));
  if (broken.length === 0) {
    console.error("README links: every target is in the published package");
    return 0;
  }
  console.error(
    `README links: ${broken.length} target(s) a consumer cannot reach.\n` +
      broken.map((entry) => `  ${entry.target} — ${entry.reason}`).join("\n") +
      "\nUse an absolute URL: README.md is read from npm and from " +
      "node_modules, where its neighbours are not there."
  );
  return 1;
}

if (require.main === module) {
  process.exit(main());
}
