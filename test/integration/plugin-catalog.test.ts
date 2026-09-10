// ===========================================================================
// The whole catalog, end to end.
//
// Plugins may not import one another, so no plugin can check whether its name
// collides with a sibling or whether its own published subpath resolves. This
// is the only vantage point for that, and it looks at the real thing rather
// than at declarations:
//
//   1. every plugin in the catalog goes into one Builder, and the method
//      surface of all nine slots is actually assembled. A method collision
//      raises PluginMethodCollisionError.
//   2. a validator is built from that and actually run.
//   3. all four generated artefacts agree with the directory structure on disk.
//   4. no subpath a previous release published has disappeared, the barrel
//      included — which used to be unresolvable.
//
// The .use() chain is written out in types. That a chain of this length does
// not break the type checker is itself one of the things being accepted here.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { Builder } from "../../src/index";
import type { AnyPlugin } from "../../src/plugin-kit/plugin-definition";
import { createBuilderSurface } from "../../src/builder/create-builder";
import { PLUGIN_MANIFEST } from "../../src/plugins/manifest.generated";
import * as catalogBarrel from "../../src/plugins/index.generated";

import { arrayContainsPlugin } from "../../src/plugins/array-contains";
import { arrayEachPlugin } from "../../src/plugins/array-each";
import { arrayIncludesPlugin } from "../../src/plugins/array-includes";
import { arrayMaxLengthPlugin } from "../../src/plugins/array-max-length";
import { arrayMinLengthPlugin } from "../../src/plugins/array-min-length";
import { arrayUniquePlugin } from "../../src/plugins/array-unique";
import { booleanFalsyPlugin } from "../../src/plugins/boolean-falsy";
import { booleanTruthyPlugin } from "../../src/plugins/boolean-truthy";
import { compareFieldPlugin } from "../../src/plugins/compare-field";
import { conditionalSchemaPlugin } from "../../src/plugins/conditional-schema";
import { customPlugin } from "../../src/plugins/custom";
import { fromContextPlugin } from "../../src/plugins/from-context";
import { literalPlugin } from "../../src/plugins/literal";
import { nullablePlugin } from "../../src/plugins/nullable";
import { numberFinitePlugin } from "../../src/plugins/number-finite";
import { numberIntegerPlugin } from "../../src/plugins/number-integer";
import { numberMaxPlugin } from "../../src/plugins/number-max";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { numberMultipleOfPlugin } from "../../src/plugins/number-multiple-of";
import { numberNegativePlugin } from "../../src/plugins/number-negative";
import { numberPositivePlugin } from "../../src/plugins/number-positive";
import { numberRangePlugin } from "../../src/plugins/number-range";
import { objectPlugin } from "../../src/plugins/object";
import {
  objectAdditionalPropertiesPlugin,
  objectAdditionalPropertiesSchemaPlugin,
} from "../../src/plugins/object-additional-properties";
import { objectDependentRequiredPlugin } from "../../src/plugins/object-dependent-required";
import { objectDependentSchemasPlugin } from "../../src/plugins/object-dependent-schemas";
import { objectMaxPropertiesPlugin } from "../../src/plugins/object-max-properties";
import { objectMinPropertiesPlugin } from "../../src/plugins/object-min-properties";
import { objectPatternPropertiesPlugin } from "../../src/plugins/object-pattern-properties";
import { objectPropertyNamesPlugin } from "../../src/plugins/object-property-names";
import { objectRecursivelyPlugin } from "../../src/plugins/object-recursively";
import { oneOfPlugin } from "../../src/plugins/one-of";
import { optionalPlugin } from "../../src/plugins/optional";
import { optionalIfPlugin } from "../../src/plugins/optional-if";
import { orFailPlugin } from "../../src/plugins/or-fail";
import { readOnlyPlugin } from "../../src/plugins/read-only";
import { requiredPlugin } from "../../src/plugins/required";
import { requiredIfPlugin } from "../../src/plugins/required-if";
import { skipPlugin } from "../../src/plugins/skip";
import { stitchPlugin } from "../../src/plugins/stitch";
import { stringAlphanumericPlugin } from "../../src/plugins/string-alphanumeric";
import { stringBase64Plugin } from "../../src/plugins/string-base64";
import { stringContentEncodingPlugin } from "../../src/plugins/string-content-encoding";
import { stringContentMediaTypePlugin } from "../../src/plugins/string-content-media-type";
import { stringDatePlugin } from "../../src/plugins/string-date";
import { stringDatetimePlugin } from "../../src/plugins/string-datetime";
import { stringDurationPlugin } from "../../src/plugins/string-duration";
import { stringEmailPlugin } from "../../src/plugins/string-email";
import { stringEndsWithPlugin } from "../../src/plugins/string-ends-with";
import { stringExactLengthPlugin } from "../../src/plugins/string-exact-length";
import { stringHostnamePlugin } from "../../src/plugins/string-hostname";
import { stringIpv4Plugin } from "../../src/plugins/string-ipv4";
import { stringIpv6Plugin } from "../../src/plugins/string-ipv6";
import { stringIriPlugin } from "../../src/plugins/string-iri";
import { stringIriReferencePlugin } from "../../src/plugins/string-iri-reference";
import { stringJsonPointerPlugin } from "../../src/plugins/string-json-pointer";
import { stringMaxPlugin } from "../../src/plugins/string-max";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringPatternPlugin } from "../../src/plugins/string-pattern";
import { stringRelativeJsonPointerPlugin } from "../../src/plugins/string-relative-json-pointer";
import { stringStartsWithPlugin } from "../../src/plugins/string-starts-with";
import { stringTimePlugin } from "../../src/plugins/string-time";
import { stringUriTemplatePlugin } from "../../src/plugins/string-uri-template";
import { stringUrlPlugin } from "../../src/plugins/string-url";
import { transformPlugin } from "../../src/plugins/transform";
import { tupleBuilderPlugin } from "../../src/plugins/tuple-builder";
import { unionGuardPlugin } from "../../src/plugins/union-guard";
import { uuidPlugin } from "../../src/plugins/uuid";
import { validateIfPlugin } from "../../src/plugins/validate-if";
import { writeOnlyPlugin } from "../../src/plugins/write-only";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");
const PLUGIN_ROOT = path.join(REPOSITORY_ROOT, "src", "plugins");

interface PackageJsonShape {
  readonly exports: Readonly<Record<string, unknown>>;
}

interface CatalogLockShape {
  readonly pluginCount: number;
  readonly plugins: readonly { readonly subpath: string }[];
  readonly exportKeys: readonly string[];
}

function readJson(relativePath: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8")
  );
}

const packageJson = readJson("package.json") as PackageJsonShape;
const catalogLock = readJson(
  "config/plugin-catalog.lock.json"
) as CatalogLockShape;

function isPlugin(value: unknown): value is AnyPlugin {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["name"] === "string" &&
    typeof candidate["method"] === "string" &&
    Array.isArray(candidate["slots"]) &&
    typeof candidate["build"] === "function"
  );
}

const catalogPlugins: readonly AnyPlugin[] = Object.values(
  catalogBarrel as Readonly<Record<string, unknown>>
).filter(isPlugin);

function collectPluginSources(directory: string = PLUGIN_ROOT): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectPluginSources(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("catalog: the barrel exports real plugins", () => {
  it("exports nothing that is not a plugin object", () => {
    const exported = Object.keys(catalogBarrel);
    expect(exported.length).toBeGreaterThan(0);
    expect(catalogPlugins).toHaveLength(exported.length);
  });

  it("names exactly the symbols the manifest read", () => {
    const fromManifest = PLUGIN_MANIFEST.flatMap(
      (entry) => entry.exportedSymbols
    ).sort();
    expect(Object.keys(catalogBarrel).sort()).toEqual(fromManifest);
  });

  it("has no duplicate plugin name", () => {
    const names = catalogPlugins.map((plugin) => plugin.name).sort();
    expect([...new Set(names)]).toEqual(names);
  });

  it("has no two plugins offering the same method on one slot", () => {
    const claimed = new Map<string, string>();
    for (const plugin of catalogPlugins) {
      for (const slot of plugin.slots) {
        const key = `${slot}.${plugin.method}`;
        expect(claimed.get(key)).toBeUndefined();
        claimed.set(key, plugin.name);
      }
    }
    expect(claimed.size).toBeGreaterThan(catalogPlugins.length);
  });

  it("has exactly one stitch", () => {
    // A previous release carried three implementations of it, and which one
    // was published depended on import order.
    const stitches = catalogPlugins.filter(
      (plugin) => plugin.name === "stitch"
    );
    expect(stitches).toHaveLength(1);
    expect(stitches[0]?.method).toBe("stitch");
    const declarations = collectPluginSources().filter((file) =>
      /name:\s*"stitch"/.test(fs.readFileSync(file, "utf8"))
    );
    expect(declarations).toHaveLength(1);
  });
});

describe("catalog: the method surface assembles for all nine slots", () => {
  // A slot surface is a lazy getter, so the methods are not attached until
  // each of the nine is touched. Touching one raises a collision on the spot.
  const everyPluginSurface = (): ReturnType<typeof createBuilderSurface> =>
    catalogPlugins.reduce(
      (builder, plugin) => builder.use(plugin),
      createBuilderSurface()
    );

  it("string / number / boolean / date / array / tuple / object / union / any", () => {
    everyPluginSurface()
      .for()
      .v("value", (slots) => {
        expect(slots.string).toBeDefined();
        expect(slots.number).toBeDefined();
        expect(slots.boolean).toBeDefined();
        expect(slots.date).toBeDefined();
        expect(slots.array).toBeDefined();
        expect(slots.tuple).toBeDefined();
        expect(slots.object).toBeDefined();
        expect(slots.union).toBeDefined();
        expect(slots.any).toBeDefined();
        return slots.any;
      });
  });

  it("gives the string slot every method declared for string", () => {
    everyPluginSurface()
      .for()
      .v("value", (slots) => {
        const chain: Readonly<Record<string, unknown>> = slots.string;
        for (const plugin of catalogPlugins) {
          if (!plugin.slots.includes("string")) continue;
          expect(typeof chain[plugin.method]).toBe("function");
        }
        return slots.string;
      });
  });
});

interface Account {
  readonly name: string;
  readonly confirmName: string;
  readonly email: string;
  readonly homepage: string;
  readonly age: number;
  readonly ratio: number;
  readonly active: boolean;
  readonly signedUp: Date;
  readonly kind: string;
  readonly tags: string[];
  readonly pair: readonly [string, number];
  readonly meta: Record<string, unknown>;
  readonly anything: unknown;
  readonly nickname?: string;
}

/** A Builder carrying every plugin in the catalog. That the types survive it is part of the test. */
const catalogBuilder = Builder()
  .use(arrayContainsPlugin)
  .use(arrayEachPlugin)
  .use(arrayIncludesPlugin)
  .use(arrayMaxLengthPlugin)
  .use(arrayMinLengthPlugin)
  .use(arrayUniquePlugin)
  .use(booleanFalsyPlugin)
  .use(booleanTruthyPlugin)
  .use(compareFieldPlugin)
  .use(conditionalSchemaPlugin)
  .use(customPlugin)
  .use(fromContextPlugin)
  .use(literalPlugin)
  .use(nullablePlugin)
  .use(numberFinitePlugin)
  .use(numberIntegerPlugin)
  .use(numberMaxPlugin)
  .use(numberMinPlugin)
  .use(numberMultipleOfPlugin)
  .use(numberNegativePlugin)
  .use(numberPositivePlugin)
  .use(numberRangePlugin)
  .use(objectPlugin)
  .use(objectAdditionalPropertiesPlugin)
  .use(objectAdditionalPropertiesSchemaPlugin)
  .use(objectDependentRequiredPlugin)
  .use(objectDependentSchemasPlugin)
  .use(objectMaxPropertiesPlugin)
  .use(objectMinPropertiesPlugin)
  .use(objectPatternPropertiesPlugin)
  .use(objectPropertyNamesPlugin)
  .use(objectRecursivelyPlugin)
  .use(oneOfPlugin)
  .use(optionalPlugin)
  .use(optionalIfPlugin)
  .use(orFailPlugin)
  .use(readOnlyPlugin)
  .use(requiredPlugin)
  .use(requiredIfPlugin)
  .use(skipPlugin)
  .use(stitchPlugin)
  .use(stringAlphanumericPlugin)
  .use(stringBase64Plugin)
  .use(stringContentEncodingPlugin)
  .use(stringContentMediaTypePlugin)
  .use(stringDatePlugin)
  .use(stringDatetimePlugin)
  .use(stringDurationPlugin)
  .use(stringEmailPlugin)
  .use(stringEndsWithPlugin)
  .use(stringExactLengthPlugin)
  .use(stringHostnamePlugin)
  .use(stringIpv4Plugin)
  .use(stringIpv6Plugin)
  .use(stringIriPlugin)
  .use(stringIriReferencePlugin)
  .use(stringJsonPointerPlugin)
  .use(stringMaxPlugin)
  .use(stringMinPlugin)
  .use(stringPatternPlugin)
  .use(stringRelativeJsonPointerPlugin)
  .use(stringStartsWithPlugin)
  .use(stringTimePlugin)
  .use(stringUriTemplatePlugin)
  .use(stringUrlPlugin)
  .use(transformPlugin)
  .use(tupleBuilderPlugin)
  .use(unionGuardPlugin)
  .use(uuidPlugin)
  .use(validateIfPlugin)
  .use(writeOnlyPlugin);

const accountValidator = catalogBuilder
  .for<Account>()
  .v("name", (b) => b.string.required().min(2).max(40))
  .v("confirmName", (b) => b.string.required().compareField("name"))
  .v("email", (b) => b.string.required().email())
  .v("homepage", (b) => b.string.required().url())
  .v("age", (b) => b.number.required().integer().min(18))
  .v("ratio", (b) => b.number.required().range(0, 1))
  .v("active", (b) => b.boolean.required().truthy())
  .v("signedUp", (b) => b.date.required())
  .v("kind", (b) => b.string.required().literal("person"))
  .v("tags", (b) =>
    b.array
      .required()
      .minLength(1)
      .unique()
      .each((eb) => eb.string.min(2))
  )
  .v("pair", (b) =>
    b.tuple
      .required()
      .builder([(eb) => eb.string.min(1), (eb) => eb.number.min(0)])
  )
  .v("meta", (b) => b.object.required().minProperties(1))
  .v("anything", (b) => b.any.required())
  .v("nickname", (b) => b.string.optional().transform((value) => value?.trim()))
  .build();

const validAccount: Account = {
  name: "Ada",
  confirmName: "Ada",
  email: "ada@example.com",
  homepage: "https://example.com/ada",
  age: 36,
  ratio: 0.5,
  active: true,
  signedUp: new Date("1843-01-01T00:00:00.000Z"),
  kind: "person",
  tags: ["math", "engine"],
  pair: ["left", 1],
  meta: { source: "seed" },
  anything: 0,
  nickname: "  Countess  ",
};

describe("catalog: it behaves the way a user would write it", () => {
  it("lets plugins from six categories cooperate in one declaration", () => {
    const outcome = accountValidator.validate(validAccount);
    expect(outcome.issues).toEqual([]);
    expect(outcome.valid).toBe(true);
  });

  it("reports a violation from each category at its own path", () => {
    const outcome = accountValidator.validate(
      {
        ...validAccount,
        name: "A",
        confirmName: "Grace",
        email: "nope",
        age: 17.5,
        ratio: 4,
        active: false,
        kind: "robot",
        tags: ["ok", "x"],
        meta: {},
      },
      { abortEarly: false }
    );
    expect(outcome.valid).toBe(false);
    if (outcome.valid) throw new Error("expected a rejection");
    expect(outcome.issues.map((issue) => issue.path).sort()).toEqual([
      "active",
      "age",
      "confirmName",
      "email",
      "kind",
      "meta",
      "name",
      "ratio",
      // .each() is a composite and reports once, under its own code and path.
      // Declaring "tags[*]" with .v() is what gives per-element issues.
      "tags",
    ]);
  });

  it("defaults a code to the plugin's name", () => {
    const outcome = accountValidator.validate(
      { ...validAccount, email: "nope", age: 1 },
      { abortEarly: false }
    );
    if (outcome.valid) throw new Error("expected a rejection");
    expect(outcome.issues.map((issue) => issue.code).sort()).toEqual([
      "numberMin",
      "stringEmail",
    ]);
  });

  it("applies a transform in parse() and nowhere else", () => {
    const validated = accountValidator.validate(validAccount);
    const parsed = accountValidator.parse(validAccount);
    expect(validated.valid && validated.data.nickname).toBe("  Countess  ");
    expect(parsed.valid && parsed.data.nickname).toBe("Countess");
  });

  it("catches a missing field with required", () => {
    const outcome = accountValidator.validate({}, { abortEarly: false });
    expect(outcome.valid).toBe(false);
    if (outcome.valid) throw new Error("expected a rejection");
    expect(outcome.issues.every((issue) => issue.code === "required")).toBe(
      true
    );
  });
});

describe("catalog: the generated artefacts agree with the directories", () => {
  it("has every manifest entry pointing at an index.ts that exists", () => {
    for (const entry of PLUGIN_MANIFEST) {
      expect(fs.existsSync(path.join(REPOSITORY_ROOT, entry.entryFile))).toBe(
        true
      );
    }
  });

  // The isolated tier only. The extensions live under the JSON Schema layer
  // and never appear directly under src/plugins.
  it("holds nothing under src/plugins but isolated plugins and generated files", () => {
    const children = fs.readdirSync(PLUGIN_ROOT, { withFileTypes: true });
    const directories = children
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const files = children
      .filter((entry) => !entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(directories).toEqual(
      PLUGIN_MANIFEST.filter((entry) => entry.tier === "isolated")
        .map((entry) => entry.directoryName)
        .sort()
    );
    expect(files).toEqual(["index.generated.ts", "manifest.generated.ts"]);
  });

  it("keeps the extension-tier plugins under the extensions directory alone", () => {
    const extensions = PLUGIN_MANIFEST.filter(
      (entry) => entry.tier === "extension"
    );
    expect(extensions.map((entry) => entry.subpathName).sort()).toEqual([
      "jsonSchema",
      "jsonSchemaFullFeature",
    ]);
    for (const entry of extensions) {
      expect(entry.entryFile.startsWith("src/json-schema/extensions/")).toBe(
        true
      );
    }
  });

  it("records the directory count and the export keys in the lock", () => {
    expect(catalogLock.pluginCount).toBe(PLUGIN_MANIFEST.length);
    expect(catalogLock.exportKeys).toEqual(Object.keys(packageJson.exports));
    expect(catalogLock.plugins.map((entry) => entry.subpath).sort()).toEqual(
      PLUGIN_MANIFEST.map((entry) => `./plugins/${entry.subpathName}`).sort()
    );
  });
});

describe("catalog: every published subpath resolves", () => {
  const exportKeys = Object.keys(packageJson.exports);

  it("publishes all seven fixed keys, the barrel included", () => {
    // The barrel was once missing from the exports map, so the import the
    // README's Quick Start recommended did not resolve. `./field-rule` was in
    // the same position: shipped in dist with no export key pointing at it.
    expect(exportKeys).toEqual(
      expect.arrayContaining([
        ".",
        "./package.json",
        "./result",
        "./plugin-kit",
        "./field-rule",
        "./async",
        "./plugins",
      ])
    );
  });

  it("resolves every plugin subpath to a directory or a compatibility alias", () => {
    const aliasDirectory = path.join(REPOSITORY_ROOT, "src", "subpath-aliases");
    const bySubpath = new Map(
      PLUGIN_MANIFEST.map((entry) => [`./plugins/${entry.subpathName}`, entry])
    );
    const aliasModules = fs
      .readdirSync(aliasDirectory)
      .map((file) => file.replace(/\.ts$/, ""));
    for (const key of exportKeys.filter((one) =>
      one.startsWith("./plugins/")
    )) {
      const entry = bySubpath.get(key);
      if (entry !== undefined) {
        expect(fs.existsSync(path.join(REPOSITORY_ROOT, entry.entryFile))).toBe(
          true
        );
        continue;
      }
      expect(key).toBe("./plugins/readOnlyWriteOnly");
      expect(aliasModules).toContain("read-only-write-only");
    }
  });

  it("exports both symbols from the compatibility subpath", () => {
    const alias: unknown = require("../../src/subpath-aliases/read-only-write-only");
    expect(Object.keys(alias as Record<string, unknown>).sort()).toEqual([
      "readOnlyPlugin",
      "writeOnlyPlugin",
    ]);
  });

  it("has lost no subpath a previous release published", () => {
    // The two JSON Schema subpaths belong to the extension tier, which has no
    // directory at this tier.
    const legacyDocument = fs.readFileSync(
      path.join(REPOSITORY_ROOT, "docs", "legacy-public-surface.md"),
      "utf8"
    );
    const legacySubpaths = [
      ...new Set(
        [...legacyDocument.matchAll(/^\|\s*`(\.[^`]*)`\s*\|/gm)].map(
          (match) => match[1] as string
        )
      ),
    ];
    expect(legacySubpaths).toHaveLength(58);
    const notYetOwned = [
      "./plugins/jsonSchema",
      "./plugins/jsonSchemaFullFeature",
    ];
    const missing = legacySubpaths.filter(
      (subpath) =>
        !notYetOwned.includes(subpath) && !exportKeys.includes(subpath)
    );
    expect(missing).toEqual([]);
  });
});
