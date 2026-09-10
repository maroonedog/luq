import * as fs from "fs";
import * as path from "path";
import { toRepositoryRelativePosix } from "../catalog/collect-typescript-files";
import type { DocExampleViolation } from "./doc-example.types";
import { collectMarkdownFiles } from "./read-doc-examples";

/** The target of `[text](target)`. An image's `![...]` matches the same way. */
const LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function isExternal(target: string): boolean {
  return (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("#")
  );
}

/** Drops the anchor and query, looking only at whether the file exists. */
function toFilePart(target: string): string {
  const withoutAnchor = target.split("#")[0] ?? "";
  return withoutAnchor.split("?")[0] ?? "";
}

/**
 * Whether the links between documents point at files that exist.
 *
 * A broken link always surfaces as a reader unable to go on, so it fails the
 * same gate the code examples do. External URLs are not checked: nothing here
 * touches the network.
 */
export function findBrokenLinks(
  repositoryRoot: string,
  docRoots: readonly string[]
): readonly DocExampleViolation[] {
  return docRoots
    .flatMap((docRoot) =>
      collectMarkdownFiles(path.join(repositoryRoot, docRoot))
    )
    .flatMap((absoluteFile) => {
      const file = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
      const lines = fs.readFileSync(absoluteFile, "utf8").split(/\r?\n/);
      return lines.flatMap((line, index) =>
        [...line.matchAll(LINK)]
          .map((match) => match[1] ?? "")
          .filter((target) => target.length > 0 && !isExternal(target))
          .map(toFilePart)
          .filter((filePart) => filePart.length > 0)
          .filter(
            (filePart) =>
              !fs.existsSync(path.resolve(path.dirname(absoluteFile), filePart))
          )
          .map((filePart) => ({
            file,
            startLine: index + 1,
            kind: "brokenLink" as const,
            detail: `the link target does not exist: "${filePart}"`,
          }))
      );
    });
}
