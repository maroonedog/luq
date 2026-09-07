// ===========================================================================
// scripts/module-coverage/find-exercised-modules.ts — which src modules does
// the runtime test tree actually pull in?
//
// WHY THIS IS NOT "a file with the right name exists". The rule this replaces
// asked for test/unit/<mirror>/<name>.test.ts and nothing else, which an EMPTY
// FILE satisfies. It also assumed one test layout while the repository grew
// another (test/unit/plugins/string/string-url.test.ts covers
// src/plugins/string-url/string-url.ts), so it reported 88 modules as untested
// that are tested, and would have reported an empty stub as tested.
//
// Two ways a module counts as exercised:
//   1. SEED — a runtime test file imports it. Barrels are TRANSPARENT: an
//      index.ts is re-export only and needs no test of its own, so reaching one
//      reaches what it re-exports. NOTHING ELSE is walked, so importing the
//      root entry does not mark the whole library as tested — measured: a tree
//      containing only test/integration/public-api-smoke.test.ts covers 24 of
//      177 modules, not 177.
//   2. PRIVATE HELPER — a file imported by an exercised module in the SAME
//      DIRECTORY. A directory is the unit of publication (the plugin catalog)
//      and of isolation (check-plugin-isolation); a file that only its own
//      directory's exercised module reaches is that module's private half
//      (src/plugins/string-ipv6/ipv6-address.ts is the shape). The expansion
//      needs a seed INSIDE the directory, so a directory no test touches stays
//      uncovered.
//
// Type tests are not seeds. They do not run, so a module reached only by a type
// test has no runtime test.
// ===========================================================================
import * as path from "path";
import { collectTypeScriptFiles } from "../catalog/collect-typescript-files";
import { readRelativeImports } from "./read-relative-imports";

export function isBarrelModule(absoluteFile: string): boolean {
  return path.basename(absoluteFile) === "index.ts";
}

/** Test-tree files that may seed coverage: everything except type tests. */
export function collectSeedFiles(testRoot: string): readonly string[] {
  return collectTypeScriptFiles(testRoot).filter(
    (file) => !file.endsWith(".type-test.ts")
  );
}

function expandThroughBarrels(seeds: readonly string[]): Set<string> {
  const reached = new Set<string>();
  const pending = [...seeds];
  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined || reached.has(file)) continue;
    reached.add(file);
    if (isBarrelModule(file)) pending.push(...readRelativeImports(file));
  }
  return reached;
}

function expandWithinDirectories(
  exercised: Set<string>,
  sourceFiles: readonly string[]
): void {
  const known = new Set(sourceFiles);
  let grew = true;
  while (grew) {
    grew = false;
    for (const file of [...exercised]) {
      if (!known.has(file)) continue;
      for (const target of readRelativeImports(file)) {
        if (
          known.has(target) &&
          !exercised.has(target) &&
          path.dirname(target) === path.dirname(file)
        ) {
          exercised.add(target);
          grew = true;
        }
      }
    }
  }
}

/** Absolute paths of every src module the runtime test tree exercises. */
export function findExercisedModules(
  repositoryRoot: string,
  seedFiles?: readonly string[]
): ReadonlySet<string> {
  const sourceFiles = collectTypeScriptFiles(path.join(repositoryRoot, "src"));
  const seeds =
    seedFiles ?? collectSeedFiles(path.join(repositoryRoot, "test"));
  const exercised = expandThroughBarrels(
    seeds.flatMap((file) => readRelativeImports(file))
  );
  expandWithinDirectories(exercised, sourceFiles);
  return exercised;
}
