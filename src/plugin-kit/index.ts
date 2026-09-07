// ===========================================================================
// src/plugin-kit/index.ts — THE ./plugin-kit SUBPATH.
//
// Everything a plugin author may import, and nothing else. A plugin under
// src/plugins/** imports these modules by relative path; a plugin published
// OUTSIDE this repository imports this subpath. The two must name the same
// set, so this barrel re-exports exactly the modules the isolation gate
// permits an isolated-tier plugin to reach: plugin-kit itself, the L0
// vocabulary, and the L1 path vocabulary.
//
// Re-exports only; nothing is defined here.
// ===========================================================================
export * from "./compiled-rule";
export * from "./create-conditional-presence";
export * from "./create-rule";
export * from "./external-context";
export * from "./is-json-value-equal";
export * from "./marker.types";
export * from "./plugin-definition";
export * from "./rule-build-context";
export * from "./runtime-args.types";

// ---- the vocabulary a rule reads its value and its context with -----------
export * from "../types";
export type {
  FieldPath,
  LeafPath,
  MissingLeafPaths,
  PickPaths,
  ValueAtPath,
} from "../path/index";
