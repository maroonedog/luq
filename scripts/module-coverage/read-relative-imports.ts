// ===========================================================================
// scripts/module-coverage/read-relative-imports.ts — which source files does
// this file pull in?
//
// Only RELATIVE specifiers are followed: a package import leaves the repository
// and is not a module of ours. A directory specifier resolves to its index.ts,
// which is how `import { x } from "../../src/plugins/string-url"` reaches the
// implementation file behind the barrel.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";

const SPECIFIER_PATTERN =
  /(?:from\s*|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g;

/** The .ts file a relative specifier names, or undefined when it names none. */
export function resolveRelativeSpecifier(
  fromFile: string,
  specifier: string
): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const target = path.resolve(path.dirname(fromFile), specifier);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    const barrel = path.join(target, "index.ts");
    return fs.existsSync(barrel) ? barrel : undefined;
  }
  return fs.existsSync(`${target}.ts`) ? `${target}.ts` : undefined;
}

/** Absolute paths of the .ts files this file imports, deduplicated. */
export function readRelativeImports(absoluteFile: string): readonly string[] {
  const text = fs.readFileSync(absoluteFile, "utf8");
  const resolved = new Set<string>();
  for (const match of text.matchAll(SPECIFIER_PATTERN)) {
    const specifier = match[1];
    if (specifier === undefined) continue;
    const target = resolveRelativeSpecifier(absoluteFile, specifier);
    if (target !== undefined) resolved.add(target);
  }
  return [...resolved];
}
