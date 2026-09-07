// ===========================================================================
// L6  src/builder/global-config-store.ts
// RESIDUAL 4 / item 4, second half — the legacy process-wide accessors
// (globalConfig / setGlobalConfig / getGlobalConfig / resetGlobalConfig) are
// kept, but they are now a BUILD-TIME default source, not a runtime lookup.
// Builder.build() reads this store once; from then on the built validator holds
// its own frozen ResolvedGlobalConfig and later setGlobalConfig calls cannot
// change how it behaves. That is the only difference from 1.x, and it is what
// makes the config compatible with "pre-compute at build" (user decision 1).
//
// Lives at L6 rather than L0 so the vocabulary layer keeps its "zero mutable
// state" property; the public export map can still surface it from the root.
// ===========================================================================
import {
  DEFAULT_GLOBAL_CONFIG,
  resolveGlobalConfig,
  type GlobalConfig,
  type ResolvedGlobalConfig,
} from "../types/global-config";

let processConfig: ResolvedGlobalConfig = DEFAULT_GLOBAL_CONFIG;

export function setGlobalConfig(config: GlobalConfig): void {
  processConfig = resolveGlobalConfig(config, processConfig);
}

export function getGlobalConfig(): ResolvedGlobalConfig {
  return processConfig;
}

export function resetGlobalConfig(): void {
  processConfig = DEFAULT_GLOBAL_CONFIG;
}
