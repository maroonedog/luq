// Writes src/data/plugins.ts from the repository, so /plugins cannot disagree
// with the package about what exists.
//
// The 1.x generator this replaces read a flat `src/core/plugin/*.ts` that no
// longer exists and parsed `@luq-plugin` JSDoc tags that appear nowhere in the
// rewrite. Its output listed 69 of 77 plugin objects, named 13 chain methods
// that were wrong, and gave 8 plugins the wrong slots.
//
//   Mechanical facts  -> read-plugin-catalog.mjs (three repository files)
//   Prose + examples  -> plugin-copy.mjs (hand-written, completeness-checked)
//   Examples compile  -> verify-plugin-examples.mjs (tsc against src/)

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EVERY_SLOT, readPluginCatalog } from "./read-plugin-catalog.mjs";
import { PLUGIN_COPY } from "./plugin-copy.mjs";

const SCRIPTS_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DOCS_SITE_ROOT = dirname(SCRIPTS_DIRECTORY);
const REPOSITORY_ROOT = dirname(DOCS_SITE_ROOT);
const OUTPUT_FILE = join(DOCS_SITE_ROOT, "src/data/plugins.ts");

const HEADER = `// GENERATED FILE — do not edit by hand.
// Written by: npm run generate-plugin-data (docs-site/scripts/generate-plugin-data.mjs)
//
// Subpath, symbol, chain method, slots and tier are read from
// docs/guide/plugin-reference.md (itself generated from the built package and
// gated by \`npm run check:docs\`), cross-checked against
// config/plugin-catalog.lock.json. The declared argument tuple is read off the
// plugin's own source. Descriptions and examples come from
// docs-site/scripts/plugin-copy.mjs, and every example in this file is
// typechecked against src/ by docs-site/scripts/verify-plugin-examples.mjs.

export interface PluginParameter {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
}

export interface PluginExample {
  /** Lines of the example TypeScript type, verbatim. */
  readonly declarations: readonly string[];
  /** The path passed to \`.v()\`. */
  readonly field: string;
  /** Other plugin symbols the chain calls a method of. */
  readonly uses: readonly string[];
  /** Everything after \`b.\` inside \`.v()\`. */
  readonly chain: string;
  /** Import lines the chain needs beyond the plugin itself. */
  readonly imports: readonly string[];
  /** Top-level declarations the chain needs. */
  readonly prelude: readonly string[];
}

export interface PluginInfo {
  /** camelCase subpath name, e.g. "stringMin". */
  readonly name: string;
  /** Exported symbol, e.g. "stringMinPlugin". */
  readonly symbol: string;
  /** Full import specifier. */
  readonly subpath: string;
  /** Chain method the plugin adds, without parentheses. */
  readonly method: string;
  /** Field types the method may be called on. */
  readonly slots: readonly string[];
  readonly tier: "isolated" | "extension";
  readonly parameters: readonly PluginParameter[];
  readonly description: string;
  readonly example: PluginExample;
}
`;

function checkCopyCoverage(catalog) {
  const catalogued = new Set(catalog.map((plugin) => plugin.symbol));
  const missing = [...catalogued].filter((symbol) => !(symbol in PLUGIN_COPY));
  const extra = Object.keys(PLUGIN_COPY).filter(
    (symbol) => !catalogued.has(symbol)
  );
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      [
        missing.length > 0
          ? `plugin-copy.mjs is missing: ${missing.join(", ")}`
          : "",
        extra.length > 0
          ? `plugin-copy.mjs has stale entries: ${extra.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}

function toRecord(plugin) {
  const copy = PLUGIN_COPY[plugin.symbol];
  return {
    name: plugin.name,
    symbol: plugin.symbol,
    subpath: `@maroonedog/luq/plugins/${plugin.name}`,
    method: plugin.method,
    slots: plugin.slots,
    tier: plugin.tier,
    parameters: plugin.parameters,
    description: copy.description,
    example: {
      declarations: copy.example.declarations,
      field: copy.example.field,
      uses: copy.example.uses,
      chain: copy.example.chain,
      imports: copy.example.imports ?? [],
      prelude: copy.example.prelude ?? [],
    },
  };
}

function run() {
  const catalog = readPluginCatalog(REPOSITORY_ROOT);
  checkCopyCoverage(catalog);

  const records = catalog
    .map(toRecord)
    .sort((left, right) => left.name.localeCompare(right.name));
  const subpathCount = new Set(records.map((record) => record.name)).size;

  const body = [
    HEADER,
    `/** Every field type a plugin may be offered on. */`,
    `export const PLUGIN_SLOTS = ${JSON.stringify(EVERY_SLOT)} as const;`,
    "",
    `/** ${records.length} plugin objects across ${subpathCount} subpaths. */`,
    `export const plugins: readonly PluginInfo[] = ${JSON.stringify(records, null, 2)};`,
    "",
    `export const pluginObjectCount = ${records.length};`,
    `export const pluginSubpathCount = ${subpathCount};`,
    "",
  ].join("\n");

  writeFileSync(OUTPUT_FILE, body, "utf8");
  console.log(
    `src/data/plugins.ts: ${records.length} plugin objects, ${subpathCount} subpaths.`
  );
}

run();
