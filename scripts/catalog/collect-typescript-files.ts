import * as fs from "fs";
import * as path from "path";

/** Recursively collects .ts files as absolute paths. A missing directory gives []. */
export function collectTypeScriptFiles(absoluteDirectory: string): string[] {
  if (!fs.existsSync(absoluteDirectory)) return [];
  const entries = fs
    .readdirSync(absoluteDirectory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  return entries.flatMap((entry) => {
    const fullPath = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(fullPath);
    return entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

/** A path relative to the root, with separators normalised to posix. */
export function toRepositoryRelativePosix(
  repositoryRoot: string,
  absolutePath: string
): string {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}
