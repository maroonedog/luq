import {
  findModulesWithoutTest,
  isTestExemptModule,
  toSiblingTestPath,
} from "../../../scripts/check-module-has-test";
import type { SeedFileTree } from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import { withSeedTree } from "../../type/fixtures/seed-plugins/write-seed-tree";

const MODULE_TREE: SeedFileTree = {
  "src/path/parse-field-path.ts": "export const parseFieldPath = () => null;\n",
  "src/path/field-path.types.ts": "export type FieldPath = string;\n",
  "src/path/index.ts": 'export * from "./parse-field-path";\n',
  "src/plugins/manifest.generated.ts": "export const PLUGIN_MANIFEST = [];\n",
  "test/unit/path/parse-field-path.test.ts": "it.todo('parses');\n",
};

describe("isTestExemptModule", () => {
  it("index.ts と *.types.ts と *.generated.ts だけを免除する", () => {
    expect(isTestExemptModule("index.ts")).toBe(true);
    expect(isTestExemptModule("field-path.types.ts")).toBe(true);
    expect(isTestExemptModule("manifest.generated.ts")).toBe(true);
    expect(isTestExemptModule("parse-field-path.ts")).toBe(false);
    expect(isTestExemptModule("branch-executor.port.ts")).toBe(false);
  });
});

describe("toSiblingTestPath", () => {
  it("src の相対位置と kebab 名をそのまま test/unit に写す", () => {
    expect(toSiblingTestPath("src/path/parse-field-path.ts")).toBe(
      "test/unit/path/parse-field-path.test.ts"
    );
    expect(toSiblingTestPath("src/plugins/uuid/uuid.ts")).toBe(
      "test/unit/plugins/uuid/uuid.test.ts"
    );
  });
});

describe("findModulesWithoutTest", () => {
  it("兄弟テストが揃っていれば違反なし", () => {
    withSeedTree(MODULE_TREE, (root) => {
      expect(findModulesWithoutTest(root)).toEqual([]);
    });
  });

  it("src が無ければ違反なし", () => {
    withSeedTree({ "package.json": "{}\n" }, (root) => {
      expect(findModulesWithoutTest(root)).toEqual([]);
    });
  });

  it("兄弟テストの無いモジュールを名指しで落とす", () => {
    const withoutTest: SeedFileTree = {
      ...MODULE_TREE,
      "src/runtime/run-plan.ts": "export const runPlan = () => null;\n",
    };
    withSeedTree(withoutTest, (root) => {
      expect(findModulesWithoutTest(root)).toEqual([
        {
          module: "src/runtime/run-plan.ts",
          expectedTest: "test/unit/runtime/run-plan.test.ts",
        },
      ]);
    });
  });

  it("テストを消すと落ちる (安全機構が効いていることの証拠)", () => {
    const withoutSiblingTest: SeedFileTree = {
      "src/path/parse-field-path.ts": "export const a = 1;\n",
    };
    withSeedTree(withoutSiblingTest, (root) => {
      expect(findModulesWithoutTest(root)).toHaveLength(1);
    });
  });

  it("名前がずれたテストは兄弟とみなさない", () => {
    const misnamed: SeedFileTree = {
      "src/path/parse-field-path.ts": "export const a = 1;\n",
      "test/unit/path/parse-field-path.spec.ts": "it.todo('x');\n",
      "test/unit/parse-field-path.test.ts": "it.todo('x');\n",
    };
    withSeedTree(misnamed, (root) => {
      expect(findModulesWithoutTest(root)).toHaveLength(1);
    });
  });
});
