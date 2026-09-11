// ===========================================================================
// L3  src/chain/index.ts — re-exports only.
// ===========================================================================
export {
  attachSlotMethods,
  CHAIN_BUILT_IN_OWNER,
  PluginMethodCollisionError,
} from "./attach-slot-methods";
export {
  createChainNode,
  readChainRules,
  EMPTY_RULES,
  type ChainBuildContext,
  type ChainNodeWiring,
} from "./create-chain-node";
export type { DeclaredCall } from "./declared-call.types";
export type { DeclarationRecorder } from "./declaration-recorder.port";
export {
  collectBranchRules,
  resolvePluginArguments,
  SubChainResultError,
  type SlotSurfaceFactory,
  type SubChainArgumentDeclaration,
  type SubChainDefine,
} from "./collect-branch-rules";
export { buildSlotSurface, createFieldSlots } from "./create-field-slots";
export {
  collectFieldRules,
  FieldChainResultError,
  type FieldChainOutcome,
} from "./collect-field-rules";

export type { PluginBag, BagEntry, SlotPlugins } from "./plugin-bag.types";
export type {
  AllowNull,
  ChainState,
  CoverWith,
  ExcludeMissing,
  ExcludeNull,
  ExcludeUndefined,
  OpenState,
  UncoveredMembers,
  UnionGuardCoverageError,
} from "./chain-state.types";
export type { ChainMethod } from "./chain-method.types";
export type { PluginNotImported } from "./plugin-not-imported.types";
export type { SlotCatalog } from "./slot-catalog.generated";
export type {
  AnyChain,
  ChainMarks,
  ChainOutput,
  ChainStateOf,
  FieldChain,
} from "./field-chain.types";
export type { FieldSlots } from "./field-slots.types";
export type { ResolveArg, ResolveArgs, ResolveOut } from "./resolve-args.types";
export type {
  SlotAccepts,
  SlotTypeMismatch,
  SlotValue,
} from "./slot-value.types";
export {
  REFINE_METHOD_SLOTS,
  type RefineMethodName,
  type RefineMethods,
} from "./refine-methods.types";
