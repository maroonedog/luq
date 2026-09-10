// ===========================================================================
// scripts/check-contract-arity.ts — THE CONTRACT GATE (build-order step 7).
//
// config/contract-arity.lock.json records the shape of the plugin-author
// surface. This script re-reads that shape from src/ and fails on any drift.
// Everything downstream — 77 plugins, the JSON Schema layer, every doc example
// — is written against it, so a change here is a change to every one of them
// and must be a reviewed edit of the lock file, never a side effect.
//
// The lock records MEASURED values. Where they differ from the prose in
// docs/design/build-order.md the measurement wins and the difference is stated
// in the lock's own `driftFromDesign` field; a design document is not evidence.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import {
  readContractFacts,
  type ContractFacts,
} from "./contract-arity/read-contract-facts";

export const CONTRACT_LOCK_PATH = "config/contract-arity.lock.json";

export interface ContractLock {
  readonly contract: ContractFacts;
}

export interface ContractDrift {
  readonly fact: string;
  readonly locked: string;
  readonly actual: string;
}

export function readContractLock(repositoryRoot: string): ContractLock {
  const text = fs.readFileSync(
    path.join(repositoryRoot, CONTRACT_LOCK_PATH),
    "utf8"
  );
  return JSON.parse(text) as ContractLock;
}

/** JSON round-trip comparison: order matters, because a reordered registry is
 *  a reviewable change to a closed vocabulary. */
function describe(value: unknown): string {
  return JSON.stringify(value);
}

export function findContractDrift(
  locked: ContractFacts,
  actual: ContractFacts
): readonly ContractDrift[] {
  const facts = Object.keys(locked) as (keyof ContractFacts)[];
  const drift: ContractDrift[] = [];
  for (const fact of facts) {
    const lockedValue = describe(locked[fact]);
    const actualValue = describe(actual[fact]);
    if (lockedValue !== actualValue) {
      drift.push({ fact, locked: lockedValue, actual: actualValue });
    }
  }
  const unlocked = Object.keys(actual).filter((fact) => !(fact in locked));
  for (const fact of unlocked) {
    drift.push({
      fact,
      locked: "(not recorded)",
      actual: describe(actual[fact as keyof ContractFacts]),
    });
  }
  return drift;
}

if (require.main === module) {
  runCheckAndExit(() => {
    const actual = readContractFacts(REPOSITORY_ROOT);
    const drift = findContractDrift(
      readContractLock(REPOSITORY_ROOT).contract,
      actual
    );
    if (drift.length === 0) {
      console.error(
        `Plugin author contract: matches ` +
          `(argument markers ${actual.argumentMarkerKinds.length} / ` +
          `output markers ${actual.outputMarkerKinds.length} entries, ` +
          `${actual.outputMarkerTypeNames.length} types / ` +
          `ResolveArg parameters ${actual.resolveArgTypeParameterCount} / ` +
          `ChainState ${actual.chainStateMembers.length} / ` +
          `RuleBuildContext ${actual.ruleBuildContextMembers.length})`
      );
      return 0;
    }
    console.error(`Plugin author contract: ${drift.length} drifts:`);
    for (const one of drift) {
      console.error(`  ${one.fact}`);
      console.error(`    locked:   ${one.locked}`);
      console.error(`    measured: ${one.actual}`);
    }
    console.error(
      `Changing the contract means updating ${CONTRACT_LOCK_PATH} in the same ` +
        "commit. Every plugin and every documented example depends on this surface."
    );
    return 1;
  });
}
