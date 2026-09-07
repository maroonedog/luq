// ===========================================================================
// test/dist/read-built-package.ts — the few readers every dist test shares.
// Nothing here asserts; it only locates and loads what the build produced.
// ===========================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const REPOSITORY_ROOT = join(__dirname, "..", "..");
export const DIST_ROOT = join(REPOSITORY_ROOT, "dist");

interface ExportConditions {
  readonly types: string;
  readonly import: string;
  readonly require: string;
}

type ExportTarget = string | ExportConditions;

export function readExportMap(
  repositoryRoot: string
): Readonly<Record<string, ExportTarget>> {
  const manifest: unknown = JSON.parse(
    readFileSync(join(repositoryRoot, "package.json"), "utf8")
  );
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("exports" in manifest) ||
    typeof manifest.exports !== "object" ||
    manifest.exports === null
  ) {
    throw new Error("package.json has no exports object");
  }
  return manifest.exports as Readonly<Record<string, ExportTarget>>;
}

export function readPluginSubpaths(repositoryRoot: string): readonly string[] {
  return Object.keys(readExportMap(repositoryRoot)).filter(
    (subpath) => subpath.startsWith("./plugins/") && subpath !== "./plugins"
  );
}

/** "./plugins/stringMin" -> "plugins/stringMin.js", dist-relative. */
export function readRequireTarget(
  repositoryRoot: string,
  subpath: string
): string {
  const target = readExportMap(repositoryRoot)[subpath];
  if (target === undefined || typeof target === "string") {
    throw new Error(`${subpath}: no require condition`);
  }
  return target.require.replace(/^\.\/dist\//, "");
}

/** Loads one built CommonJS module by its dist-relative path. */
export function loadDistModule(
  distRelativePath: string
): Readonly<Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded: unknown = require(join(DIST_ROOT, distRelativePath));
  if (typeof loaded !== "object" || loaded === null) {
    throw new Error(`${distRelativePath} did not load as a module object`);
  }
  return loaded as Readonly<Record<string, unknown>>;
}
