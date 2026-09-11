import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import type { PluginCatalog } from "./catalog/plugin-catalog.types";
import {
  PACKAGE_NAME,
  REPOSITORY_ROOT,
  SLOT_CATALOG_OUTPUT,
} from "./catalog/plugin-source-roots";
import { readPluginSurfaces } from "./catalog/read-plugin-surface";
import type { PluginSurface } from "./catalog/read-plugin-surface";
import {
  GENERATED_BANNER,
  writeGeneratedFile,
} from "./catalog/write-generated-file";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

const HEADER = [
  "/**",
  " * Which plugin offers which chain method, on which slot.",
  " *",
  " * This exists so that calling a method whose plugin was never imported is a",
  " * NAMED compile error instead of `Property 'min' does not exist on type",
  " * 'FieldChain<...>'`. That message states a fact and leaves the reader to",
  " * work out whether they mistyped, picked a method for the wrong type, or",
  " * simply forgot the import — three different fixes.",
  " *",
  " * Literal strings only. Nothing here imports a plugin, so the chain layer",
  " * gains no dependency on the plugin layer; what it gains is the plugin",
  " * layer's NAMES, which is what an error message has to say out loud.",
  " */",
];

interface SlotMethod {
  readonly method: string;
  readonly symbol: string;
  readonly subpath: string;
}

/**
 * A (slot, method) pair that two plugins both claim. The generated map could
 * not name one import for it, so the generator refuses rather than pick.
 */
export class AmbiguousSlotMethodError extends Error {
  constructor(slot: string, method: string, claimants: readonly string[]) {
    super(
      `the method ${method} on the ${slot} slot is claimed by ` +
        `${claimants.join(" and ")}; a chain method must have one owner`
    );
    this.name = "AmbiguousSlotMethodError";
  }
}

export function collectSlotMethods(
  catalog: PluginCatalog,
  surfacesOf: (
    entry: PluginCatalog["entries"][number]
  ) => readonly PluginSurface[],
  subpathOf: (entry: PluginCatalog["entries"][number]) => string
): ReadonlyMap<string, readonly SlotMethod[]> {
  const bySlot = new Map<string, SlotMethod[]>();
  for (const entry of catalog.entries) {
    const symbols = entry.exportedSymbols;
    surfacesOf(entry).forEach((surface, index) => {
      for (const slot of surface.slots) {
        const list = bySlot.get(slot) ?? [];
        const claimed = list.find((m) => m.method === surface.method);
        if (claimed !== undefined) {
          throw new AmbiguousSlotMethodError(slot, surface.method, [
            claimed.symbol,
            symbols[index] ?? surface.name,
          ]);
        }
        list.push({
          method: surface.method,
          symbol: symbols[index] ?? surface.name,
          subpath: subpathOf(entry),
        });
        bySlot.set(slot, list);
      }
    });
  }
  for (const [slot, list] of bySlot) {
    bySlot.set(
      slot,
      [...list].sort((l, r) => l.method.localeCompare(r.method))
    );
  }
  return new Map([...bySlot].sort((l, r) => l[0].localeCompare(r[0])));
}

/**
 * One member per line-broken type argument.
 *
 * The formatter is a gate here, not a preference: a single-line member is
 * longer than the print width for every plugin, so a generator that emitted
 * one would leave `npm run generate` and `format:check` disagreeing forever.
 */
function renderSlot(slot: string, methods: readonly SlotMethod[]): string[] {
  return [
    `  readonly ${slot}: {`,
    ...methods.flatMap((m) => [
      `    readonly ${m.method}: PluginNotImported<`,
      `      ${JSON.stringify(m.method)},`,
      `      ${JSON.stringify(m.symbol)},`,
      `      ${JSON.stringify(m.subpath)}`,
      "    >;",
    ]),
    "  };",
  ];
}

export function renderSlotCatalog(
  bySlot: ReadonlyMap<string, readonly SlotMethod[]>
): string {
  return [
    GENERATED_BANNER,
    "",
    'import type { PluginNotImported } from "./plugin-not-imported.types";',
    "",
    ...HEADER,
    "export interface SlotCatalog {",
    ...[...bySlot].flatMap(([slot, methods]) => renderSlot(slot, methods)),
    "}",
    "",
  ].join("\n");
}

export function generateSlotCatalog(repositoryRoot: string): boolean {
  const catalog = buildPluginCatalog(repositoryRoot);
  const bySlot = collectSlotMethods(
    catalog,
    (entry) => readPluginSurfaces(repositoryRoot, entry),
    (entry) => `${PACKAGE_NAME}/plugins/${entry.subpathName}`
  );
  return writeGeneratedFile(
    repositoryRoot,
    SLOT_CATALOG_OUTPUT,
    renderSlotCatalog(bySlot)
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const changed = generateSlotCatalog(REPOSITORY_ROOT);
    console.error(
      `${SLOT_CATALOG_OUTPUT}: ${changed ? "updated" : "unchanged"}`
    );
    return 0;
  });
}
