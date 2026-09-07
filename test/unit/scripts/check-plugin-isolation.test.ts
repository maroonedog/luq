import { findIsolationViolations } from "../../../scripts/check-plugin-isolation";
import {
  EXTENSION_ONLY_IMPORTS,
  ISOLATION_PROBE_TREE,
  LEAKY_PLUGIN_DIRECTORIES,
} from "../../type/fixtures/seed-plugins/isolation-probe-tree";
import {
  EMPTY_PLUGIN_TREE,
  SEED_PLUGIN_TREE,
} from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import {
  withSeedTree,
  writeSeedFile,
} from "../../type/fixtures/seed-plugins/write-seed-tree";

function violatingDirectories(repositoryRoot: string): readonly string[] {
  return [
    ...new Set(
      findIsolationViolations(repositoryRoot).map((violation) =>
        violation.file.split("/").slice(0, -1).join("/")
      )
    ),
  ].sort();
}

describe("findIsolationViolations", () => {
  it("健全なツリーには違反が無い", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(findIsolationViolations(root)).toEqual([]);
    });
  });

  it("プラグイン0件でも落ちない", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      expect(findIsolationViolations(root)).toEqual([]);
    });
  });

  it("仕込んだ違反をすべて検出する", () => {
    withSeedTree(ISOLATION_PROBE_TREE, (root) => {
      expect(violatingDirectories(root)).toEqual(LEAKY_PLUGIN_DIRECTORIES);
    });
  });

  it("違反ごとに領域名を報告する", () => {
    withSeedTree(ISOLATION_PROBE_TREE, (root) => {
      const areaByDirectory = new Map(
        findIsolationViolations(root).map((violation) => [
          violation.file,
          violation.area,
        ])
      );
      expect(areaByDirectory.get("src/plugins/leaks-to-sibling/index.ts")).toBe(
        "plugin-entry"
      );
      expect(areaByDirectory.get("src/plugins/leaks-to-chain/index.ts")).toBe(
        "chain"
      );
      expect(
        areaByDirectory.get("src/plugins/leaks-to-json-schema/index.ts")
      ).toBe("json-schema");
      expect(areaByDirectory.get("src/plugins/leaks-to-runtime/index.ts")).toBe(
        "runtime"
      );
      expect(
        areaByDirectory.get("src/plugins/leaks-to-external/index.ts")
      ).toBe("external");
      expect(areaByDirectory.get("src/plugins/leaks-to-nowhere/index.ts")).toBe(
        "unresolved"
      );
    });
  });

  it("自パッケージ名で迂回しても検出する", () => {
    withSeedTree(ISOLATION_PROBE_TREE, (root) => {
      const violation = findIsolationViolations(root).find(
        (candidate) =>
          candidate.file === "src/plugins/leaks-to-package/index.ts"
      );
      expect(violation?.area).toBe("json-schema");
      expect(violation?.tier).toBe("isolated");
    });
  });

  it("型 import でも違反になる", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      writeSeedFile(
        root,
        "src/plugins/type-only-leak/index.ts",
        [
          'import type { FieldChain } from "../../chain/field-chain.types";',
          "export const typeOnlyLeakPlugin = { a: null as FieldChain | null };",
          "",
        ].join("\n")
      );
      expect(findIsolationViolations(root)).toHaveLength(1);
    });
  });

  it("動的 import で隠しても違反になる", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      writeSeedFile(
        root,
        "src/plugins/dynamic-leak/index.ts",
        [
          "export const dynamicLeakPlugin = {",
          '  load: () => import("../../runtime/run-plan"),',
          "};",
          "",
        ].join("\n")
      );
      expect(findIsolationViolations(root)[0]?.area).toBe("runtime");
    });
  });

  it("同じ import が extension 段では通り、isolated 段では落ちる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(findIsolationViolations(root)).toEqual([]);
      writeSeedFile(
        root,
        "src/plugins/mirrors-extension/index.ts",
        [
          'import { KEYWORD_MAP } from "../../json-schema/keyword-map";',
          'import { uuidPlugin } from "../uuid";',
          "export const mirrorsExtensionPlugin = { KEYWORD_MAP, uuidPlugin };",
          "",
        ].join("\n")
      );
      const violations = findIsolationViolations(root);
      expect(violations).toHaveLength(EXTENSION_ONLY_IMPORTS.length);
      expect(
        violations.every((violation) => violation.tier === "isolated")
      ).toBe(true);
    });
  });

  it("src/json-schema/** のうち extensions/ の外はプラグイン扱いされない", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      writeSeedFile(
        root,
        "src/json-schema/keyword-map-object.ts",
        [
          'import { runPlan } from "../runtime/run-plan";',
          'import { FieldChain } from "../chain/field-chain.types";',
          "export const KEYWORD_MAP_OBJECT = { runPlan, FieldChain };",
          "",
        ].join("\n")
      );
      // json-schema 層は隔離の対象ではないので、この import は検査されない。
      expect(findIsolationViolations(root)).toEqual([]);
    });
  });
});
