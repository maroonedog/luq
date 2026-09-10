import * as fs from "fs";
import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { readPublishedExportMap } from "./catalog/read-package-json";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { resolveDistRoot } from "./distribution/find-dynamic-code";
import type { LayoutViolation } from "./distribution/find-layout-violations";
import {
  findBrokenSpecifiers,
  findFilesFieldViolations,
  findInlinedCores,
  findMissingExportTargets,
  findPrivateArtifacts,
} from "./distribution/find-layout-violations";

/**
 * scripts/check-dist-layout.ts — does the built package hold together?
 *
 * Five questions, each naming a defect 1.x actually shipped:
 *   1. does every published subpath point at files that exist?
 *   2. does every relative specifier inside a shipped file resolve?
 *   3. does each plugin reach the shared core instead of inlining it?
 *   4. is anything test-shaped or benchmark-shaped in the tarball?
 *   5. is `files` still exactly ["dist"]?
 */
export function findDistLayoutViolations(
  repositoryRoot: string
): readonly LayoutViolation[] {
  const distRoot = resolveDistRoot(repositoryRoot);
  const pluginSubpaths = Object.keys(
    readPublishedExportMap(repositoryRoot)
  ).filter(
    (subpath) => subpath.startsWith("./plugins/") && subpath !== "./plugins"
  );
  return [
    ...findMissingExportTargets(repositoryRoot),
    ...findBrokenSpecifiers(distRoot),
    ...findInlinedCores(distRoot, pluginSubpaths),
    ...findPrivateArtifacts(distRoot),
    ...findFilesFieldViolations(repositoryRoot),
  ];
}

export function checkDistLayout(repositoryRoot: string): number {
  const distRoot = resolveDistRoot(repositoryRoot);
  if (!fs.existsSync(distRoot)) {
    console.error(`${distRoot} is missing. Run npm run build first.`);
    return 1;
  }
  const violations = findDistLayoutViolations(repositoryRoot);
  if (violations.length === 0) {
    console.error("dist layout: no violations");
    return 0;
  }
  console.error(`dist layout: ${violations.length} violations:`);
  for (const violation of violations) {
    console.error(
      `  [${violation.rule}] ${violation.subject}: ${violation.detail}`
    );
  }
  return 1;
}

/**
 * The package to read, as a directory relative to the repository root. Given
 * none, the package at the root itself.
 *
 * Taking the root as an argument is what lets one gate judge every package
 * that ships a dist, instead of each growing its own copy that has to be kept
 * agreeing with this one.
 */
function resolveCheckedRoot(argument: string | undefined): string {
  return argument === undefined
    ? REPOSITORY_ROOT
    : path.resolve(REPOSITORY_ROOT, argument);
}

if (require.main === module) {
  runCheckAndExit(() => checkDistLayout(resolveCheckedRoot(process.argv[2])));
}
