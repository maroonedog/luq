/**
 * The vocabulary of the size budget. Types only.
 *
 * A budget is a measurement plus headroom, never a target. How the measurement
 * is taken — which entry, bundled with which options — is prose in the config
 * file itself; only the numbers the gate reads are typed here.
 */

/** "all" means every catalog entry; an array lists published subpath names. */
export type PluginSelection = readonly string[] | "all";

export interface BundleBudget {
  /** The budget's id, e.g. "core-only". */
  readonly id: string;
  /** Prose saying what is measured. Printed verbatim in the report. */
  readonly description: string;
  readonly plugins: PluginSelection;
  /** Exceed this and the gate fails. */
  readonly gzipCeilingBytes: number;
  /** What was measured when the ceiling was set: evidence, never judged against. */
  readonly recordedGzipBytes: number;
  /** The corresponding figure from the previous major. */
  readonly legacyGzipBytes?: number;
}

export interface TreeShakingBudget {
  /** Budget ids in ascending plugin count. Increments are read in this order. */
  readonly orderedByPluginCount: readonly string[];
  /**
   * "Adding a plugin adds its weight", as a number.
   *
   * Requiring monotonic growth is too weak. Even with the plugin already
   * reachable from the core, a few bytes of re-export make the gzipped size
   * grow and the check passes — measured: a change that made a plugin
   * core-reachable still grew by a handful of bytes and slipped through. This
   * demands a minimum growth per plugin added.
   */
  readonly minGzipBytesPerAddedPlugin: number;
  /** "You only ship what you used", as a number: the upper bound on core / full. */
  readonly maxCoreShareOfFullPercent: number;
}

export interface BarrelEquivalenceBudget {
  /** The plugins compared through the barrel against through their own subpath. */
  readonly plugins: readonly string[];
  readonly maxDivergencePercent: number;
}

export interface SizeBudget {
  readonly budgets: readonly BundleBudget[];
  readonly treeShaking: TreeShakingBudget;
  readonly barrelEquivalence: BarrelEquivalenceBudget;
}

export interface BundleMeasurement {
  readonly id: string;
  /** How many plugins this budget actually included, after resolving "all". */
  readonly pluginCount: number;
  readonly rawBytes: number;
  readonly gzipBytes: number;
}
