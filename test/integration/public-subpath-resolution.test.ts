// ===========================================================================
// test/integration/public-subpath-resolution.test.ts — DOES EVERY PUBLISHED
// SUBPATH RESOLVE?
//
// 1.x published 58 subpaths and its own README told people to import two that
// were in NO exports map at all (`@maroonedog/luq/plugins` and
// `@maroonedog/luq/core/builder/plugins/plugin-creator`); under Node's exports
// restriction both fail to resolve. docs/legacy-public-surface.md records that
// as defect #1 and asks for a CI check. This is it.
//
// The type-level half — "no 1.x subpath was lost" — is
// test/type/public-surface/json-schema.type-test.ts. This file answers the
// other half, which no type can: the thing a subpath points at EXISTS, LOADS,
// and exports what the catalog says it does.
//
// The source tree is what is checked, not dist/: the build script is step 28's
// and dist/ does not exist on this branch. Every mapping below is the one
// scripts/catalog/package-export-map.ts uses to name the dist file.
// ===========================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLUGIN_MANIFEST } from "../../src/plugins/manifest.generated";

const REPOSITORY_ROOT = join(__dirname, "..", "..");

interface PackageManifest {
  readonly exports: Readonly<Record<string, unknown>>;
}

function readPackageManifest(): PackageManifest {
  const raw: unknown = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, "package.json"), "utf8")
  );
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("exports" in raw) ||
    typeof raw.exports !== "object" ||
    raw.exports === null
  ) {
    throw new Error("package.json has no exports object");
  }
  return { exports: raw.exports as Readonly<Record<string, unknown>> };
}

/** The 1.x table, read from the ground-truth document rather than retyped. */
function readLegacySubpaths(): readonly string[] {
  const document = readFileSync(
    join(REPOSITORY_ROOT, "docs", "legacy-public-surface.md"),
    "utf8"
  );
  return [...document.matchAll(/^\| `([^`]+)` \| \.\/dist\//gm)].map(
    (match) => match[1] ?? ""
  );
}

/** Non-plugin keys whose source entry module already exists. */
const FIXED_KEY_SOURCE: Readonly<Record<string, string>> = {
  ".": "src/index.ts",
  "./result": "src/result/index.ts",
  "./plugin-kit": "src/plugin-kit/index.ts",
  "./field-rule": "src/field-rule/index.ts",
  "./async": "src/async/index.ts",
  "./standard-schema": "src/standard-schema/index.ts",
  "./presets": "src/presets/index.ts",
  "./plugins": "src/plugins/index.generated.ts",
  "./schema-tooling": "src/schema-tooling/index.ts",
  "./package.json": "package.json",
};

/**
 * Published with NO source entry module. It used to hold `./result` and
 * `./plugin-kit`, whose barrels step 28 wrote when it authored the build; the
 * list is empty now and the assertion below is what keeps it empty.
 *
 * This list is an ASSERTION, not an excuse: the test below checks that it is
 * exactly the set of unresolvable keys, so a new unresolvable subpath fails.
 */
const KNOWN_UNRESOLVABLE: readonly string[] = [];

const packageManifest = readPackageManifest();
const publishedSubpaths = Object.keys(packageManifest.exports);
const pluginSubpaths = publishedSubpaths.filter(
  (subpath) => subpath.startsWith("./plugins/") && subpath !== "./plugins"
);

interface PluginShape {
  readonly name: string;
  readonly method: string;
  readonly slots: readonly string[];
}

function isPluginShape(value: unknown): value is PluginShape {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["name"] === "string" &&
    typeof candidate["method"] === "string" &&
    Array.isArray(candidate["slots"])
  );
}

/** The source module a published subpath resolves to, or undefined. */
function findSourceEntry(subpath: string): string | undefined {
  const fixed = FIXED_KEY_SOURCE[subpath];
  if (fixed !== undefined) return fixed;
  const subpathName = subpath.slice("./plugins/".length);
  const entry = PLUGIN_MANIFEST.find(
    (candidate) => candidate.subpathName === subpathName
  );
  if (entry !== undefined) return entry.entryFile;
  const alias = join(
    "src",
    "subpath-aliases",
    `${toKebabCase(subpathName)}.ts`
  );
  return existsSync(join(REPOSITORY_ROOT, alias)) ? alias : undefined;
}

/** `readOnlyWriteOnly` -> `read-only-write-only`, the alias module's name. */
function toKebabCase(subpathName: string): string {
  return subpathName.replace(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`);
}

describe("the 1.x public surface", () => {
  it("reads 58 subpaths out of the ground-truth document", () => {
    expect(readLegacySubpaths()).toHaveLength(58);
  });

  it("publishes every one of them", () => {
    const published = new Set(publishedSubpaths);
    const lost = readLegacySubpaths().filter(
      (subpath) => !published.has(subpath)
    );
    expect(lost).toEqual([]);
  });

  it("publishes the two JSON Schema subpaths build-order step 27 names", () => {
    expect(publishedSubpaths).toContain("./plugins/jsonSchema");
    expect(publishedSubpaths).toContain("./plugins/jsonSchemaFullFeature");
  });
});

describe("every published subpath resolves", () => {
  it("maps each one to a source module, or to the known-gap list", () => {
    const unresolvable = publishedSubpaths.filter(
      (subpath) => findSourceEntry(subpath) === undefined
    );
    expect(unresolvable.sort()).toEqual([...KNOWN_UNRESOLVABLE].sort());
  });

  it.each(
    publishedSubpaths.filter((subpath) => !KNOWN_UNRESOLVABLE.includes(subpath))
  )("%s points at a file that exists", (subpath) => {
    const entry = findSourceEntry(subpath);
    expect(entry).toBeDefined();
    expect(existsSync(join(REPOSITORY_ROOT, entry ?? ""))).toBe(true);
  });

  it.each(pluginSubpaths)("%s loads and exports a plugin", (subpath) => {
    const entry = findSourceEntry(subpath);
    if (entry === undefined) throw new Error(`${subpath}: no source entry`);
    const loaded: unknown = require(join(REPOSITORY_ROOT, entry));
    expect(typeof loaded).toBe("object");
    const exported = Object.values(loaded as Record<string, unknown>);
    expect(exported.some(isPluginShape)).toBe(true);
  });

  // The manifest records the PLUGIN symbols of an entry, not every export: the
  // two extension-tier entries are barrels that also re-export the JSON Schema
  // layer's errors and readers. What must hold is that every name the manifest
  // records is really there AND is really a plugin — a manifest entry naming a
  // symbol the module does not export is a subpath that resolves to nothing.
  it("exports every symbol the manifest records, as a plugin object", () => {
    for (const entry of PLUGIN_MANIFEST) {
      const loaded = require(join(REPOSITORY_ROOT, entry.entryFile)) as Record<
        string,
        unknown
      >;
      for (const symbol of entry.exportedSymbols) {
        expect([
          entry.subpathName,
          symbol,
          isPluginShape(loaded[symbol]),
        ]).toEqual([entry.subpathName, symbol, true]);
      }
    }
  });

  it("resolves the root subpath to a module that exports Builder", () => {
    const loaded: unknown = require(join(REPOSITORY_ROOT, "src", "index.ts"));
    const root = loaded as Record<string, unknown>;
    expect(typeof root["Builder"]).toBe("function");
  });

  it("resolves ./plugins to the generated barrel", () => {
    const barrel: unknown = require(
      join(REPOSITORY_ROOT, "src", "plugins", "index.generated.ts")
    );
    const names = Object.keys(barrel as Record<string, unknown>);
    const manifestSymbols = PLUGIN_MANIFEST.flatMap(
      (entry) => entry.exportedSymbols
    );
    for (const symbol of manifestSymbols) expect(names).toContain(symbol);
  });
});
