import * as fs from "fs";
import * as path from "path";
import { toPosixPath } from "./dist-layout";
import { readRelativeSpecifiers } from "./module-specifiers";
import {
  extensionOf,
  resolveEmittedSpecifier,
} from "./resolve-emitted-specifier";

export interface UnresolvedSpecifier {
  readonly file: string;
  readonly specifier: string;
}

/**
 * Every module reachable from `entryFile` by following relative specifiers,
 * as dist-relative posix paths, including the entry itself.
 *
 * This is what answers "did a plugin bundle inline the core": a plugin entry
 * whose reachable set never leaves dist/plugins/ has no shared core to import.
 */
export function readModuleGraph(
  distRoot: string,
  entryFile: string
): readonly string[] {
  const reached = new Set<string>();
  const pending = [path.join(distRoot, entryFile)];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    const relative = toPosixPath(path.relative(distRoot, current));
    if (reached.has(relative)) continue;
    reached.add(relative);
    for (const next of readResolvedImports(current)) pending.push(next);
  }
  return [...reached].sort();
}

function readResolvedImports(absoluteFile: string): readonly string[] {
  if (!fs.existsSync(absoluteFile)) return [];
  const extension = extensionOf(absoluteFile);
  const text = fs.readFileSync(absoluteFile, "utf8");
  return readRelativeSpecifiers(text)
    .map((specifier) =>
      resolveEmittedSpecifier(absoluteFile, specifier, extension)
    )
    .filter((resolved): resolved is string => resolved !== undefined);
}

/**
 * Relative specifiers in `files` that name nothing on disk.
 *
 * 1.x shipped `dist/plugins/jsonSchemaFullFeature.d.ts` importing
 * `../core/plugin/jsonSchema/jsonSchema/types`, a doubled segment produced by
 * a regex rewrite; the directory never existed. Nothing checked, so the
 * flagship plugin shipped with broken types.
 */
export function findUnresolvedSpecifiers(
  distRoot: string,
  files: readonly string[]
): readonly UnresolvedSpecifier[] {
  return files.flatMap((file) => {
    const absolute = path.join(distRoot, file);
    const extension = extensionOf(absolute);
    return readRelativeSpecifiers(fs.readFileSync(absolute, "utf8"))
      .filter(
        (specifier) =>
          resolveEmittedSpecifier(absolute, specifier, extension) === undefined
      )
      .map((specifier) => ({ file, specifier }));
  });
}
