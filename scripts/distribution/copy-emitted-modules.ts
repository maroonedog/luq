import * as fs from "fs";
import * as path from "path";
import {
  CJS_EXTENSION,
  DECLARATION_EXTENSION,
  ESM_EXTENSION,
  listFilesWithExtension,
  writeFileCreatingDirectories,
} from "./dist-layout";
import { rewriteRelativeSpecifiers } from "./module-specifiers";
import { resolveEmittedSpecifier } from "./resolve-emitted-specifier";

export class DistributionBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DistributionBuildError";
  }
}

/**
 * The CommonJS emit and the declarations move across unchanged: the output
 * layout mirrors the source layout, so every relative specifier tsc wrote is
 * already correct. 1.x rewrote .d.ts specifiers with seven regex pairs and
 * shipped a doubled path; nothing here rewrites a declaration.
 */
export function copyCommonJsEmit(emitRoot: string, distRoot: string): number {
  const files = [
    ...listFilesWithExtension(emitRoot, CJS_EXTENSION),
    ...listFilesWithExtension(emitRoot, DECLARATION_EXTENSION),
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(distRoot, file)), { recursive: true });
    fs.copyFileSync(path.join(emitRoot, file), path.join(distRoot, file));
  }
  return files.length;
}

/**
 * The ESM emit needs one change and only one: Node's ESM resolver has no
 * extension search, so `./required` must become `./required/index.mjs`.
 * The target is resolved against the EMITTED tree, so a specifier that names
 * nothing fails the build here rather than at a consumer's import.
 */
export function copyEsmEmit(emitRoot: string, distRoot: string): number {
  const files = listFilesWithExtension(emitRoot, CJS_EXTENSION);
  for (const file of files) {
    const source = path.join(emitRoot, file);
    const text = fs.readFileSync(source, "utf8");
    const rewritten = rewriteRelativeSpecifiers(text, (specifier) =>
      toExplicitEsmSpecifier(source, specifier)
    );
    const target = path.join(distRoot, file.replace(/\.js$/, ESM_EXTENSION));
    writeFileCreatingDirectories(target, rewritten);
  }
  return files.length;
}

function toExplicitEsmSpecifier(fromFile: string, specifier: string): string {
  const resolved = resolveEmittedSpecifier(fromFile, specifier, CJS_EXTENSION);
  if (resolved === undefined) {
    throw new DistributionBuildError(
      `${fromFile}: the relative specifier "${specifier}" does not resolve.`
    );
  }
  const relative = path
    .relative(path.dirname(fromFile), resolved)
    .split(path.sep)
    .join("/")
    .replace(/\.js$/, ESM_EXTENSION);
  return relative.startsWith(".") ? relative : `./${relative}`;
}
