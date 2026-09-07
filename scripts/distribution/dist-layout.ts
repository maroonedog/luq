import * as fs from "fs";
import * as path from "path";

/** The published output directory, relative to the repository root. */
export const DIST_DIRECTORY = "dist";

/** Scratch directory for the two tsc emits. Removed at the end of a build. */
export const BUILD_TEMP_DIRECTORY = ".build";

export const ESM_EXTENSION = ".mjs";
export const CJS_EXTENSION = ".js";
export const DECLARATION_EXTENSION = ".d.ts";

/** Absolute path -> posix-separated path, so every comparison is stable. */
export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

/**
 * Every file under `directory`, as posix paths relative to it.
 * Returns [] when the directory does not exist, so a caller can report
 * "dist is missing" itself instead of crashing on a stat.
 */
export function listFilesRecursively(directory: string): readonly string[] {
  if (!fs.existsSync(directory)) return [];
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      found.push(toPosixPath(path.relative(directory, absolute)));
    }
  };
  walk(directory);
  return found.sort();
}

export function listFilesWithExtension(
  directory: string,
  extension: string
): readonly string[] {
  return listFilesRecursively(directory).filter((file) => {
    if (extension !== CJS_EXTENSION) return file.endsWith(extension);
    return (
      file.endsWith(CJS_EXTENSION) && !file.endsWith(DECLARATION_EXTENSION)
    );
  });
}

export function writeFileCreatingDirectories(
  absolutePath: string,
  contents: string
): void {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, "utf8");
}

export function removeDirectory(absolutePath: string): void {
  fs.rmSync(absolutePath, { recursive: true, force: true });
}
