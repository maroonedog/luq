import {
  findIssueCodeDrift,
  type IssueCodeDrift,
} from "../../../scripts/check-issue-code-lock";
import { generateIssueCodeLock } from "../../../scripts/generate-issue-code-catalog";
import { ISSUE_CODE_LOCK_OUTPUT } from "../../../scripts/issue-codes/issue-code.types";
import type { SeedFileTree } from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import { EMPTY_PLUGIN_TREE } from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import {
  readSeedFile,
  withSeedTree,
  writeSeedFile,
} from "../../type/fixtures/seed-plugins/write-seed-tree";

/** Two library codes and one gate code, none of them needing an import. */
const SOURCE: SeedFileTree = {
  ...EMPTY_PLUGIN_TREE,
  "src/runtime/create-validator.ts":
    'export const issue = { code: "required" };\n',
  "src/chain/slot-type-guard.ts":
    'export const rule = check({ code: "stringType" });\n',
  "src/plugins-free/skip.ts": 'export const g = gate("skip", () => true);\n',
};

function kindsOf(drift: readonly IssueCodeDrift[]): readonly string[] {
  return drift.map((one) => one.kind);
}

function withLockedSource<T>(
  edits: SeedFileTree,
  run: (drift: readonly IssueCodeDrift[]) => T
): T {
  return withSeedTree(SOURCE, (root) => {
    generateIssueCodeLock(root);
    for (const [file, contents] of Object.entries(edits)) {
      writeSeedFile(root, file, contents);
    }
    return run(findIssueCodeDrift(root));
  });
}

describe("a lock that matches", () => {
  it("reports nothing straight after generating", () => {
    expect(withLockedSource({}, (drift) => drift)).toEqual([]);
  });

  it("reports nothing for a source with no codes at all", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      generateIssueCodeLock(root);
      expect(findIssueCodeDrift(root)).toEqual([]);
    });
  });
});

describe("a lock that is missing or broken", () => {
  it("fails when the lock is absent", () => {
    withSeedTree(SOURCE, (root) => {
      expect(kindsOf(findIssueCodeDrift(root))).toEqual(["absent"]);
    });
  });

  it("fails when the lock's shape is broken", () => {
    withSeedTree(SOURCE, (root) => {
      writeSeedFile(root, ISSUE_CODE_LOCK_OUTPUT, '{ "codeCount": 2 }\n');
      expect(kindsOf(findIssueCodeDrift(root))).toEqual(["absent"]);
    });
  });

  it("fails when the count is edited away from the list", () => {
    withSeedTree(SOURCE, (root) => {
      generateIssueCodeLock(root);
      const tampered = readSeedFile(root, ISSUE_CODE_LOCK_OUTPUT).replace(
        '"codeCount": 2',
        '"codeCount": 7'
      );
      writeSeedFile(root, ISSUE_CODE_LOCK_OUTPUT, tampered);
      expect(kindsOf(findIssueCodeDrift(root))).toEqual(["count"]);
    });
  });
});

describe("adding and removing are different events", () => {
  it("calls a new code additive", () => {
    const drift = withLockedSource(
      { "src/runtime/extra.ts": 'export const x = { code: "numberType" };\n' },
      (found) => found
    );
    expect(kindsOf(drift)).toEqual(["added"]);
    expect(drift[0]?.detail).toContain("numberType");
    expect(drift[0]?.detail).toContain("Additive");
  });

  it("calls a withdrawn code breaking", () => {
    const drift = withLockedSource(
      { "src/chain/slot-type-guard.ts": "export const rule = null;\n" },
      (found) => found
    );
    expect(kindsOf(drift)).toEqual(["removed"]);
    expect(drift[0]?.detail).toContain("stringType");
    expect(drift[0]?.detail).toContain("BREAKING");
  });

  /**
   * A rename is the case the lock exists for: it reads as a removal and an
   * addition together, so the breaking half cannot be missed in review.
   */
  it("reads a rename as both", () => {
    const drift = withLockedSource(
      {
        "src/chain/slot-type-guard.ts":
          'export const rule = check({ code: "stringKind" });\n',
      },
      (found) => found
    );
    expect([...kindsOf(drift)].sort()).toEqual(["added", "removed"]);
  });

  it("separates a gate code from a reportable one", () => {
    const drift = withLockedSource(
      { "src/plugins-free/skip.ts": "export const g = null;\n" },
      (found) => found
    );
    expect(kindsOf(drift)).toEqual(["gate-removed"]);
  });
});

describe("a code kept but reported from somewhere new", () => {
  it("reports the owner change without calling the code added", () => {
    const drift = withLockedSource(
      { "src/runtime/second.ts": 'export const x = { code: "required" };\n' },
      (found) => found
    );
    expect(kindsOf(drift)).toEqual(["owners"]);
    expect(drift[0]?.detail).toContain("src/runtime/second.ts");
  });
});

describe("a site whose code cannot be read", () => {
  it("is reported, so a hidden code cannot enter unreviewed", () => {
    const drift = withLockedSource(
      {
        "src/chain/interpolated.ts":
          "export const rule = check({ code: `${slot}Type` });\n",
      },
      (found) => found
    );
    expect(kindsOf(drift)).toEqual(["unresolved"]);
    expect(drift[0]?.detail).toContain("src/chain/interpolated.ts");
  });
});
