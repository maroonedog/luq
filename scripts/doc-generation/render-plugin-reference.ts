import type { PluginSurfaceEntry } from "./read-plugin-surface";

/** Every TypeName there is. A plugin covering all of them is written as "every slot". */
const ALL_SLOTS: readonly string[] = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
];

function describeSlots(slots: readonly string[]): string {
  const present = new Set(slots);
  if (ALL_SLOTS.every((slot) => present.has(slot)) && slots.length === 9) {
    return "every slot";
  }
  return slots.map((slot) => `\`${slot}\``).join(" ");
}

function countTier(
  entries: readonly PluginSurfaceEntry[],
  tier: string
): number {
  return entries.filter((entry) => entry.tier === tier).length;
}

const HEADER: readonly string[] = [
  "<!-- GENERATED FILE — do not edit by hand.",
  "     Written by: npm run generate-docs (scripts/generate-docs.ts)",
  "     Source of truth: the plugin directory layout, plus the values",
  "     dist/plugins/*.js actually exports. `npm run check:docs` fails if this",
  "     file and the built package disagree. -->",
  "",
  "# Plugin reference (generated)",
  "",
  "Every row was produced by loading the built module and reading",
  "`plugin.method` and `plugin.slots` off the exported object. No part of this",
  "table is typed by hand, so it cannot drift away from the implementation.",
  "",
  '- **Subpath** — `import { <symbol> } from "@maroonedog/luq<subpath without the leading dot>"`.',
  "- **Method** — the name you call inside a `.v()` chain. It is often not the",
  "  plugin's name: `stringMin` gives `.min()`, `unionGuard` gives `.guard()`,",
  "  `tupleBuilder` gives `.builder()`.",
  "- **Slots** — which `b.<slot>` the method appears on. Choosing a slot the",
  "  field's type cannot be is a **compile** error, not a runtime one.",
  "",
];

function toRow(entry: PluginSurfaceEntry): string {
  return (
    `| \`${entry.subpath}\` | \`${entry.symbol}\` | \`.${entry.method}()\` | ` +
    `${describeSlots(entry.slots)} | ${entry.tier} |`
  );
}

/** The table plus its totals. Rows are ordered by subpath name, so generation is deterministic. */
export function renderPluginReference(
  entries: readonly PluginSurfaceEntry[]
): string {
  const own = entries.filter((entry) => !entry.isAlias);
  const aliases = entries.filter((entry) => entry.isAlias);
  const lines = [
    ...HEADER,
    `**${String(own.length)} plugin objects** ` +
      `(isolated ${String(countTier(own, "isolated"))}, ` +
      `extension ${String(countTier(own, "extension"))}).`,
    "",
    "| Subpath | Symbol | Method | Slots | Tier |",
    "|---|---|---|---|---|",
    ...own.map(toRow),
    "",
    "## Deprecated alias subpaths",
    "",
    "Not new plugins — a second door kept open so a 1.x import specifier still",
    "resolves. The symbols behind it are the same objects listed above.",
    "",
    "| Subpath | Symbol | Method | Slots | Tier |",
    "|---|---|---|---|---|",
    ...aliases.map(toRow),
    "",
    "## What the tiers mean",
    "",
    "- **isolated** — imports nothing but `plugin-kit`, `types`, `path` and its",
    "  own directory. Adding one to your build pulls in none of the other 76.",
    "- **extension** — may additionally import the JSON Schema layer and other",
    "  plugins' **entry files**. `jsonSchemaFullFeature` bundles 49 plugins",
    "  because it sits in this tier; that is also why it is the largest entry",
    "  in the size table in the README.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}
