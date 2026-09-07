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
  it("公開サブパスだけを使う例は通る", () => {
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

  it("未公開サブパスの例を名指しで落とす", () => {
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

  it("内部パスを直接指す例を落とす", () => {
    const tree = treeWithDoc(
      markdown('import { runPlan } from "@maroonedog/luq/runtime/run-plan";')
    );
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      expect(findDocImportViolations(root)).toHaveLength(1);
    });
  });

  it("他パッケージの import は対象外", () => {
    const tree = treeWithDoc(
      markdown('import { z } from "zod";', 'import * as fs from "fs";')
    );
    withSeedTree(tree, (root) => {
      generatePackageExports(root);
      expect(findDocImportViolations(root)).toEqual([]);
    });
  });

  it("TypeScript 以外のフェンスは読まない", () => {
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

  it("入れ子のディレクトリも README も見る", () => {
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

  it("プラグインを足すと、それまで落ちていた例が通る", () => {
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
