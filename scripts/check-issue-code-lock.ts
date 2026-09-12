// ===========================================================================
// scripts/check-issue-code-lock.ts — THE ISSUE-CODE GATE.
//
// `issue.code` is the machine-readable half of a ValidationIssue: a consumer
// switches on it, maps it to a translated message, or routes it to a form
// field. That only works if the set of codes moves deliberately, and until
// this gate existed nothing anywhere listed the set, so a plugin could rename
// its code and every test in the repository would still pass.
//
// ADDED AND REMOVED ARE NOT THE SAME EVENT, so they are reported apart.
// Adding a code is additive: a `switch` with a `default` keeps working. REMOVING
// one — renaming included, which is a removal and an addition together — breaks
// every consumer that named it, and the message says so. Neither is refused
// here: the gate's job is to make the change visible in config/issue-code.lock
// .json and force it through review, not to decide the semver for it.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { buildIssueCodeLock } from "./generate-issue-code-catalog";
import { ISSUE_CODE_LOCK_OUTPUT } from "./issue-codes/issue-code.types";
import type {
  IssueCodeEntry,
  IssueCodeLock,
} from "./issue-codes/issue-code.types";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

export type IssueCodeDriftKind =
  | "absent"
  | "count"
  | "added"
  | "removed"
  | "owners"
  | "gate-added"
  | "gate-removed"
  | "unresolved";

export interface IssueCodeDrift {
  readonly kind: IssueCodeDriftKind;
  readonly detail: string;
}

function isIssueCodeLock(value: unknown): value is IssueCodeLock {
  if (typeof value !== "object" || value === null) return false;
  const candidate: Record<string, unknown> = { ...value };
  return (
    typeof candidate["codeCount"] === "number" &&
    Array.isArray(candidate["codes"]) &&
    Array.isArray(candidate["gateOnlyCodes"]) &&
    Array.isArray(candidate["unresolvedSites"])
  );
}

function codesOf(entries: readonly IssueCodeEntry[]): readonly string[] {
  return entries.map((entry) => entry.code);
}

function missingFrom(
  left: readonly string[],
  right: readonly string[]
): readonly string[] {
  return left.filter((code) => !right.includes(code));
}

function compareVocabulary(
  locked: readonly IssueCodeEntry[],
  live: readonly IssueCodeEntry[],
  addedKind: IssueCodeDriftKind,
  removedKind: IssueCodeDriftKind
): readonly IssueCodeDrift[] {
  const added = missingFrom(codesOf(live), codesOf(locked));
  const removed = missingFrom(codesOf(locked), codesOf(live));
  return [
    ...added.map((code) => ({
      kind: addedKind,
      detail: `${code} is emitted but not locked. Additive: run npm run generate:issue-codes.`,
    })),
    ...removed.map((code) => ({
      kind: removedKind,
      detail: `${code} is locked but no longer emitted. BREAKING for any consumer switching on it — rename it back, or record the removal deliberately.`,
    })),
  ];
}

/** A code kept but reported from somewhere new, or no longer from somewhere. */
function compareOwners(
  locked: readonly IssueCodeEntry[],
  live: readonly IssueCodeEntry[]
): readonly IssueCodeDrift[] {
  return live.flatMap((entry) => {
    const before = locked.find((one) => one.code === entry.code);
    if (before === undefined) return [];
    const lockedOwners = JSON.stringify(before.owners);
    const liveOwners = JSON.stringify(entry.owners);
    if (lockedOwners === liveOwners) return [];
    return [
      {
        kind: "owners" as const,
        detail: `${entry.code}: locked owners ${lockedOwners}, actual ${liveOwners}`,
      },
    ];
  });
}

function compareUnresolved(
  locked: IssueCodeLock,
  live: IssueCodeLock
): readonly IssueCodeDrift[] {
  const lockedText = JSON.stringify(locked.unresolvedSites);
  const liveText = JSON.stringify(live.unresolvedSites);
  if (lockedText === liveText) return [];
  return [
    {
      kind: "unresolved",
      detail: `sites whose code could not be read: locked ${lockedText}, actual ${liveText}`,
    },
  ];
}

export function findIssueCodeDrift(
  repositoryRoot: string
): readonly IssueCodeDrift[] {
  const lockPath = path.join(repositoryRoot, ISSUE_CODE_LOCK_OUTPUT);
  if (!fs.existsSync(lockPath)) {
    return [{ kind: "absent", detail: `${ISSUE_CODE_LOCK_OUTPUT} is missing` }];
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  if (!isIssueCodeLock(parsed)) {
    return [
      {
        kind: "absent",
        detail: `${ISSUE_CODE_LOCK_OUTPUT} has an invalid shape`,
      },
    ];
  }
  const live = buildIssueCodeLock(repositoryRoot);
  return [
    ...compareCount(parsed),
    ...compareVocabulary(parsed.codes, live.codes, "added", "removed"),
    ...compareOwners(parsed.codes, live.codes),
    ...compareVocabulary(
      parsed.gateOnlyCodes,
      live.gateOnlyCodes,
      "gate-added",
      "gate-removed"
    ),
    ...compareUnresolved(parsed, live),
  ];
}

/**
 * `codeCount` against the lock's OWN list, not against the source.
 *
 * Against the source it would only restate whatever `added` and `removed`
 * already said, once per code. Against its own list it catches the one thing
 * nothing else can see: the number being edited by hand, which is how a
 * published figure goes stale.
 */
function compareCount(locked: IssueCodeLock): readonly IssueCodeDrift[] {
  if (locked.codeCount === locked.codes.length) return [];
  return [
    {
      kind: "count",
      detail: `codeCount says ${String(locked.codeCount)} but the lock lists ${String(locked.codes.length)} codes`,
    },
  ];
}

if (require.main === module) {
  runCheckAndExit(() => {
    const drift = findIssueCodeDrift(REPOSITORY_ROOT);
    if (drift.length === 0) {
      console.error("Issue-code lock: matches");
      return 0;
    }
    console.error(`Issue-code lock: ${String(drift.length)} differences:`);
    for (const one of drift) console.error(`  [${one.kind}] ${one.detail}`);
    return 1;
  });
}
