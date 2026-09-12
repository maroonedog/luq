import { buildIssueCodeCatalog } from "../../../../scripts/issue-codes/build-issue-code-catalog";
import type { PluginCatalogEntry } from "../../../../scripts/catalog/plugin-catalog.types";
import type { SeedFileTree } from "../../../type/fixtures/seed-plugins/seed-plugin-tree";
import { EMPTY_PLUGIN_TREE } from "../../../type/fixtures/seed-plugins/seed-plugin-tree";
import { withSeedTree } from "../../../type/fixtures/seed-plugins/write-seed-tree";

/**
 * A seed tree holds plugin-shaped TEXT, not importable modules, so the names a
 * directory publishes are supplied here instead of being read off an import.
 * The rule under test is what the catalogue does WITH the names.
 */
const namesFromDirectory = (
  _root: string,
  entry: PluginCatalogEntry
): readonly string[] => [entry.subpathName];

function entry(source: string): string {
  return source;
}

/** One isolated plugin whose rule reports under `ctx.code`. */
const EMITTING_PLUGIN: SeedFileTree = {
  "src/plugins/string-min/index.ts": entry(
    'export const stringMinPlugin = { name: "stringMin" };\n' +
      "export const rule = check({ code: ctx.code });\n"
  ),
};

/** A plugin whose only rule is a gate: the code is accepted, never reported. */
const GATE_PLUGIN: SeedFileTree = {
  "src/plugins/skip/index.ts": entry(
    'export const skipPlugin = { name: "skip" };\n' +
      "export const rule = gate(ctx.code, () => true);\n"
  ),
};

/** A plugin that builds a rule carrying no code at all. */
const CODELESS_PLUGIN: SeedFileTree = {
  "src/plugins/transform/index.ts": entry(
    'export const transformPlugin = { name: "transform" };\n' +
      "export const rule = transform((value) => value);\n"
  ),
};

const LIBRARY_LITERAL: SeedFileTree = {
  "src/runtime/create-validator.ts":
    'const ROOT_MISSING_CODE = "required";\n' +
    "export const issue = { code: ROOT_MISSING_CODE };\n",
};

function catalogOf(tree: SeedFileTree) {
  return withSeedTree({ ...EMPTY_PLUGIN_TREE, ...tree }, (root) =>
    buildIssueCodeCatalog(root, namesFromDirectory)
  );
}

describe("a plugin's name is its code", () => {
  it("records the plugin directory as the owner", () => {
    expect(catalogOf(EMITTING_PLUGIN).codes).toContainEqual({
      code: "stringMin",
      owners: ["src/plugins/string-min"],
    });
  });

  it("leaves out a plugin whose rule carries no code", () => {
    const catalog = catalogOf(CODELESS_PLUGIN);
    expect(catalog.codes).toEqual([]);
    expect(catalog.gateOnlyCodes).toEqual([]);
  });

  it("records a gate's code apart from the reportable vocabulary", () => {
    const catalog = catalogOf(GATE_PLUGIN);
    expect(catalog.codes).toEqual([]);
    expect(catalog.gateOnlyCodes).toEqual([
      { code: "skip", owners: ["src/plugins/skip"] },
    ]);
  });
});

describe("a literal outside any plugin is a library code", () => {
  it("records the file that spells it as the owner", () => {
    expect(catalogOf(LIBRARY_LITERAL).codes).toEqual([
      { code: "required", owners: ["src/runtime/create-validator.ts"] },
    ]);
  });

  /**
   * `required` is reported by the required PLUGIN and by the missing-root
   * rejection, deliberately spelled the same so a caller switching on the code
   * handles both. One entry, two owners, is how that stays visible.
   */
  it("gathers a deliberately shared code under one entry", () => {
    const catalog = catalogOf({
      ...LIBRARY_LITERAL,
      "src/plugins/required/index.ts":
        'export const requiredPlugin = { name: "required" };\n' +
        "export const rule = presence({ code: ctx.code });\n",
    });
    expect(catalog.codes).toEqual([
      {
        code: "required",
        owners: ["src/plugins/required", "src/runtime/create-validator.ts"],
      },
    ]);
  });
});

describe("a code that is spelled but can never be reported", () => {
  it("leaves out the open presence policy's code", () => {
    const catalog = catalogOf({
      "src/compile/resolve-presence.ts":
        'const OPEN_PRESENCE_CODE = "presence";\n' +
        "export const policy = { code: OPEN_PRESENCE_CODE };\n",
    });
    expect(catalog.codes).toEqual([]);
  });

  it("still records the same spelling from any other file", () => {
    // The exception is pinned to the ONE file that cannot report it, so a
    // second site spelling "presence" would enter the vocabulary normally.
    const catalog = catalogOf({
      "src/runtime/elsewhere.ts": 'export const x = { code: "presence" };\n',
    });
    expect(catalog.codes).toEqual([
      { code: "presence", owners: ["src/runtime/elsewhere.ts"] },
    ]);
  });
});

describe("a site nothing could be made of", () => {
  it("is listed verbatim rather than silently dropping a code", () => {
    const catalog = catalogOf({
      "src/chain/slot-type-guard.ts":
        "export const rule = check({ code: `${slot}Type` });\n",
    });
    expect(catalog.codes).toEqual([]);
    expect(catalog.unresolvedSites).toEqual([
      "src/chain/slot-type-guard.ts:1 — `${slot}Type`",
    ]);
  });
});

describe("an empty tree", () => {
  it("builds an empty vocabulary, so the gate is live from the start", () => {
    const catalog = catalogOf({});
    expect(catalog.codes).toEqual([]);
    expect(catalog.gateOnlyCodes).toEqual([]);
    expect(catalog.unresolvedSites).toEqual([]);
  });
});
