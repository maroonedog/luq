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
  it("reports nothing for a healthy tree", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(findIsolationViolations(root)).toEqual([]);
    });
  });

  it("does not fail with no plugins at all", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      expect(findIsolationViolations(root)).toEqual([]);
    });
  });

  it("detects every planted violation", () => {
    withSeedTree(ISOLATION_PROBE_TREE, (root) => {
      expect(violatingDirectories(root)).toEqual(LEAKY_PLUGIN_DIRECTORIES);
    });
  });

  it("names the area for each violation", () => {
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

  it("detects a detour through the package's own name", () => {
    withSeedTree(ISOLATION_PROBE_TREE, (root) => {
      const violation = findIsolationViolations(root).find(
        (candidate) =>
          candidate.file === "src/plugins/leaks-to-package/index.ts"
      );
      expect(violation?.area).toBe("json-schema");
      expect(violation?.tier).toBe("isolated");
    });
  });

  it("makes a type import a violation too", () => {
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

  it("makes a dynamic import a violation too", () => {
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

  it("lets one import pass at the extension tier and fail at the isolated one", () => {
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

  it("does not treat anything outside the extensions directory as a plugin", () => {
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
      // The JSON Schema layer is not subject to isolation, so this import is
      // not checked at all.
      expect(findIsolationViolations(root)).toEqual([]);
    });
  });
});
