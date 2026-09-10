import { findDocImportViolations } from "../../../scripts/check-doc-imports";
import { generatePackageExports } from "../../../scripts/generate-package-exports";
import {
  SEED_PLUGIN_TREE,
  type SeedFileTree,
} from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import { withSeedTree } from "../../type/fixtures/seed-plugins/write-seed-tree";

const FENCE = "```";

function markdown(...codeLines: readonly string[]): string {
  return ["# doc", "", `${FENCE}ts`, ...codeLines, FENCE, ""].join("\n");
}

function treeWithDoc(documentBody: string): SeedFileTree {
  return { ...SEED_PLUGIN_TREE, "docs/guide.md": documentBody };
}

describe("findDocImportViolations", () => {
  it("passes an example using published subpaths only", () => {
    const tree = treeWithDoc(
      markdown(
        'import { Builder } from "@maroonedog/luq";',
        'import { uuidPlugin } from "@maroonedog/luq/plugins/uuid";',
        'import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";',
        'import { ok } from "@maroonedog/luq/result";'
      )
    );
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      expect(findDocImportViolations(root)).toEqual([]);
    });
  });

  it("names and fails an example using an unpublished subpath", () => {
    const tree = treeWithDoc(
      markdown('import { x } from "@maroonedog/luq/plugins/doesNotExist";')
    );
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      const violations = findDocImportViolations(root);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.file).toBe("docs/guide.md");
      expect(violations[0]?.specifier).toBe(
        "@maroonedog/luq/plugins/doesNotExist"
      );
      expect(violations[0]?.startLine).toBe(3);
    });
  });

  it("fails an example pointing straight at an internal path", () => {
    const tree = treeWithDoc(
      markdown('import { runPlan } from "@maroonedog/luq/runtime/run-plan";')
    );
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      expect(findDocImportViolations(root)).toHaveLength(1);
    });
  });

  it("leaves imports of other packages out of scope", () => {
    const tree = treeWithDoc(
      markdown('import { z } from "zod";', 'import * as fs from "fs";')
    );
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      expect(findDocImportViolations(root)).toEqual([]);
    });
  });

  it("reads no fence that is not TypeScript", () => {
    const tree: SeedFileTree = {
      ...SEED_PLUGIN_TREE,
      "docs/guide.md": [
        `${FENCE}bash`,
        'import { x } from "@maroonedog/luq/plugins/doesNotExist";',
        FENCE,
        "",
      ].join("\n"),
    };
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      expect(findDocImportViolations(root)).toEqual([]);
    });
  });

  it("looks at nested directories and at the README", () => {
    const tree: SeedFileTree = {
      ...SEED_PLUGIN_TREE,
      "docs/migration/core.md": markdown(
        'import { x } from "@maroonedog/luq/plugins/gone";'
      ),
      "README.md": markdown('import { y } from "@maroonedog/luq/legacy";'),
    };
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      expect(
        findDocImportViolations(root)
          .map((violation) => violation.file)
          .sort()
      ).toEqual(["README.md", "docs/migration/core.md"]);
    });
  });

  it("lets an example that was failing pass once its plugin is added", () => {
    const tree: SeedFileTree = {
      ...SEED_PLUGIN_TREE,
      "docs/guide.md": markdown(
        'import { requiredPlugin } from "@maroonedog/luq/plugins/required";'
      ),
      "src/plugins/required/index.ts": "export const requiredPlugin = {};\n",
    };
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      expect(findDocImportViolations(root)).toEqual([]);
    });
  });
});
