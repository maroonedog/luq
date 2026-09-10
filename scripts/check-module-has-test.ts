import * as path from "path";
import {
  collectTypeScriptFiles,
  toRepositoryRelativePosix,
} from "./catalog/collect-typescript-files";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { findExercisedModules } from "./module-coverage/find-exercised-modules";

/**
 * An index re-exports, a .types file is types only, a .generated file is
 * derived. None has run-time behaviour of its own, so none needs its own test.
 */
export function isTestExemptModule(fileName: string): boolean {
  return (
    fileName === "index.ts" ||
    fileName.endsWith(".types.ts") ||
    fileName.endsWith(".generated.ts")
  );
}

/** src/a/b.ts -> test/unit/a/b.test.ts, suggested when reporting a violation. */
export function toSiblingTestPath(sourceRelativePath: string): string {
  const withoutSourceRoot = sourceRelativePath.replace(/^src\//, "");
  return `test/unit/${withoutSourceRoot.replace(/\.ts$/, ".test.ts")}`;
}

export interface ModuleWithoutTest {
  readonly module: string;
  readonly suggestedTest: string;
}

/**
 * Structure instead of a coverage percentage. It fails only when NO test
 * touches a module at all.
 *
 * What is checked is whether a run-time test reaches the module, not whether a
 * file with a particular name exists. An empty stub therefore does not pass,
 * and nothing constrains where tests live.
 */
export function findModulesWithoutTest(
  repositoryRoot: string,
  seedFiles?: readonly string[]
): readonly ModuleWithoutTest[] {
  const sourceRoot = path.join(repositoryRoot, "src");
  const exercised = findExercisedModules(repositoryRoot, seedFiles);
  return collectTypeScriptFiles(sourceRoot)
    .filter((absoluteFile) => !isTestExemptModule(path.basename(absoluteFile)))
    .filter((absoluteFile) => !exercised.has(absoluteFile))
    .map((absoluteFile) => {
      const module = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
      return { module, suggestedTest: toSiblingTestPath(module) };
    });
}

if (require.main === module) {
  runCheckAndExit(() => {
    const missing = findModulesWithoutTest(REPOSITORY_ROOT);
    if (missing.length === 0) {
      console.error("Module reachability: no violations");
      return 0;
    }
    console.error(`${missing.length} modules no run-time test reaches:`);
    for (const entry of missing) {
      console.error(
        `  ${entry.module} — write ${entry.suggestedTest}, for instance`
      );
    }
    return 1;
  });
}
