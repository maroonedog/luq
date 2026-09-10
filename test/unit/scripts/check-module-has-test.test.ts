// ===========================================================================
// test/unit/scripts/check-module-has-test.test.ts
//
// The gate changed at the release stage: it used to ask "does a file named
// test/unit/<mirror>.test.ts exist", which an EMPTY FILE satisfies and which
// the repository's grouped test layout does not follow (88 modules were
// reported untested while being tested). It now asks "does a runtime test
// actually pull this module in".
//
// Every case below is written against that question, and the last two are the
// mutation sites: a module nothing imports must fail, and a mirror-named but
// empty test must NOT rescue it.
// ===========================================================================
import {
  findModulesWithoutTest,
  isTestExemptModule,
  toSiblingTestPath,
} from "../../../scripts/check-module-has-test";
import type { SeedFileTree } from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import { withSeedTree } from "../../type/fixtures/seed-plugins/write-seed-tree";

const IMPORT_PARSE_FIELD_PATH =
  'import { parseFieldPath } from "../../../src/path/parse-field-path";\n' +
  "it('parses', () => expect(parseFieldPath).toBeDefined());\n";

const MODULE_TREE: SeedFileTree = {
  "src/path/parse-field-path.ts": "export const parseFieldPath = () => null;\n",
  "src/path/field-path.types.ts": "export type FieldPath = string;\n",
  "src/path/index.ts": 'export * from "./parse-field-path";\n',
  "src/plugins/manifest.generated.ts": "export const PLUGIN_MANIFEST = [];\n",
  "test/unit/path/parse-field-path.test.ts": IMPORT_PARSE_FIELD_PATH,
};

describe("isTestExemptModule", () => {
  it("exempts index, .types and .generated files and nothing else", () => {
    expect(isTestExemptModule("index.ts")).toBe(true);
    expect(isTestExemptModule("field-path.types.ts")).toBe(true);
    expect(isTestExemptModule("manifest.generated.ts")).toBe(true);
    expect(isTestExemptModule("parse-field-path.ts")).toBe(false);
    expect(isTestExemptModule("branch-executor.port.ts")).toBe(false);
  });
});

describe("toSiblingTestPath", () => {
  it("derives the suggested test location from the module's own", () => {
    expect(toSiblingTestPath("src/path/parse-field-path.ts")).toBe(
      "test/unit/path/parse-field-path.test.ts"
    );
    expect(toSiblingTestPath("src/plugins/uuid/uuid.ts")).toBe(
      "test/unit/plugins/uuid/uuid.test.ts"
    );
  });
});

describe("findModulesWithoutTest", () => {
  it("does not report a module some test imports", () => {
    withSeedTree(MODULE_TREE, (root) => {
      expect(findModulesWithoutTest(root)).toEqual([]);
    });
  });

  it("reports nothing when src is missing", () => {
    withSeedTree({ "package.json": "{}\n" }, (root) => {
      expect(findModulesWithoutTest(root)).toEqual([]);
    });
  });

  it("counts an import through a barrel as reaching, an index being re-exports only", () => {
    const throughBarrel: SeedFileTree = {
      ...MODULE_TREE,
      "test/unit/path/parse-field-path.test.ts":
        'import * as pathModule from "../../../src/path";\n' +
        "it('x', () => expect(pathModule).toBeDefined());\n",
    };
    withSeedTree(throughBarrel, (root) => {
      expect(findModulesWithoutTest(root)).toEqual([]);
    });
  });

  it("counts a private neighbour as reached when its parent module is", () => {
    const withHelper: SeedFileTree = {
      ...MODULE_TREE,
      "src/path/parse-field-path.ts":
        'import { splitSegments } from "./split-segments";\n' +
        "export const parseFieldPath = () => splitSegments();\n",
      "src/path/split-segments.ts": "export const splitSegments = () => [];\n",
    };
    withSeedTree(withHelper, (root) => {
      expect(findModulesWithoutTest(root)).toEqual([]);
    });
  });

  it("does not call a module in another directory a private neighbour, imported or not", () => {
    const acrossDirectories: SeedFileTree = {
      ...MODULE_TREE,
      "src/path/parse-field-path.ts":
        'import { readGlobalConfig } from "../types/read-global-config";\n' +
        "export const parseFieldPath = () => readGlobalConfig();\n",
      "src/types/read-global-config.ts":
        "export const readGlobalConfig = () => null;\n",
    };
    withSeedTree(acrossDirectories, (root) => {
      expect(findModulesWithoutTest(root).map((one) => one.module)).toEqual([
        "src/types/read-global-config.ts",
      ]);
    });
  });

  it("does not seed from a type test, which never runs", () => {
    const typeTestOnly: SeedFileTree = {
      "src/path/parse-field-path.ts": "export const a = 1;\n",
      "test/type/path/parse-field-path.type-test.ts":
        'import { a } from "../../../src/path/parse-field-path";\nexport type A = typeof a;\n',
    };
    withSeedTree(typeTestOnly, (root) => {
      expect(findModulesWithoutTest(root).map((one) => one.module)).toEqual([
        "src/path/parse-field-path.ts",
      ]);
    });
  });

  it("names and fails a module no test imports", () => {
    const withoutTest: SeedFileTree = {
      ...MODULE_TREE,
      "src/runtime/run-plan.ts": "export const runPlan = () => null;\n",
    };
    withSeedTree(withoutTest, (root) => {
      expect(findModulesWithoutTest(root)).toEqual([
        {
          module: "src/runtime/run-plan.ts",
          suggestedTest: "test/unit/runtime/run-plan.test.ts",
        },
      ]);
    });
  });

  it("does not pass on an empty test that merely has the right name", () => {
    const emptyStub: SeedFileTree = {
      "src/runtime/run-plan.ts": "export const runPlan = () => null;\n",
      "test/unit/runtime/run-plan.test.ts": "it.todo('run-plan');\n",
    };
    withSeedTree(emptyStub, (root) => {
      expect(findModulesWithoutTest(root).map((one) => one.module)).toEqual([
        "src/runtime/run-plan.ts",
      ]);
    });
  });
});
