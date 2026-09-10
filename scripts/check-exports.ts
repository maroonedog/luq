import { buildRepositoryExportMap } from "./catalog/build-repository-export-map";
import type {
  ExportTarget,
  PackageExportMap,
} from "./catalog/plugin-catalog.types";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { readPublishedExportMap } from "./catalog/read-package-json";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

/**
 * superset: the generated map contains the published one. This tolerates a
 *   branch that added a plugin without regenerating package.json, but fails if
 *   a published subpath disappears or starts pointing somewhere else.
 * exact: the two match completely. This is what the gate uses.
 */
export type ExportCheckMode = "superset" | "exact";

export interface ExportMismatch {
  readonly kind: "missing" | "different" | "unpublished";
  readonly subpath: string;
  readonly detail: string;
}

export function findExportMismatches(
  repositoryRoot: string,
  mode: ExportCheckMode
): readonly ExportMismatch[] {
  const generated = buildRepositoryExportMap(repositoryRoot);
  const published = readPublishedExportMap(repositoryRoot);
  const mismatches = Object.entries(published).flatMap(([subpath, target]) =>
    comparePublishedEntry(generated, subpath, target)
  );
  if (mode === "superset") return mismatches;
  const unpublished = Object.keys(generated)
    .filter((subpath) => published[subpath] === undefined)
    .map((subpath) => ({
      kind: "unpublished" as const,
      subpath,
      detail: "generated but absent from package.json#/exports",
    }));
  return [...mismatches, ...unpublished];
}

function comparePublishedEntry(
  generated: PackageExportMap,
  subpath: string,
  target: ExportTarget
): ExportMismatch[] {
  const expected = generated[subpath];
  if (expected === undefined) {
    return [
      {
        kind: "missing",
        subpath,
        detail: "published but not generated from the catalog",
      },
    ];
  }
  if (JSON.stringify(expected) !== JSON.stringify(target)) {
    return [
      {
        kind: "different",
        subpath,
        detail: `expected ${JSON.stringify(expected)}, got ${JSON.stringify(target)}`,
      },
    ];
  }
  return [];
}

export function parseExportCheckMode(argv: readonly string[]): ExportCheckMode {
  const flag = argv.find((argument) => argument.startsWith("--mode="));
  const mode = flag === undefined ? "superset" : flag.slice("--mode=".length);
  if (mode !== "superset" && mode !== "exact") {
    throw new Error(`--mode must be superset or exact (received: ${mode})`);
  }
  return mode;
}

if (require.main === module) {
  runCheckAndExit(() => {
    const mode = parseExportCheckMode(process.argv.slice(2));
    const mismatches = findExportMismatches(REPOSITORY_ROOT, mode);
    if (mismatches.length === 0) {
      console.error(`Exports check (--mode=${mode}): no violations`);
      return 0;
    }
    console.error(
      `Exports check (--mode=${mode}): ${mismatches.length} violations:`
    );
    for (const mismatch of mismatches) {
      console.error(`  ${mismatch.subpath}: ${mismatch.detail}`);
    }
    return 1;
  });
}
