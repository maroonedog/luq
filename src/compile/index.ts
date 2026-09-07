// ===========================================================================
// L4  src/compile/index.ts — re-exports only. Compilation is the whole of the
// performance design: everything decidable is decided here, once, so that L5
// walks assembled arrays and closures and never asks what a rule is.
// Nothing is defined in this file.
// ===========================================================================
export type {
  ArrayNode,
  CompiledCheck,
  CompiledField,
  FieldDeclaration,
  PlanRef,
  PresencePolicy,
  RecursionPolicy,
  ValidationPlan,
} from "./validation-plan.types";
export type { BranchExecutor } from "./branch-executor.port";

export { ROOT_PATH, indexDeclaredChildKeys } from "./declared-child-keys";
export type { DeclaredChildKeysReader } from "./declared-child-keys";
export {
  OPEN_PRESENCE,
  OPEN_PRESENCE_CODE,
  resolvePresence,
} from "./resolve-presence";
export { UnknownRuleKindError, splitRulesByKind } from "./split-rules-by-kind";
export type { RulesByKind } from "./split-rules-by-kind";
export {
  ConflictingRecursionError,
  resolveRecursion,
} from "./resolve-recursion";
export {
  APPLIES_DEFAULT_TO_NULL_BY_DEFAULT,
  compileField,
  compileFieldDeclaration,
} from "./compile-field";
export type { CompositeEraser, FieldCompileRequest } from "./compile-field";

export { groupArrayFields } from "./group-array-fields";
export type {
  ArrayFieldGroup,
  GroupedFields,
  RelativeDeclaration,
} from "./group-array-fields";
export {
  compileArrayNode,
  compileRelativeDeclaration,
} from "./compile-array-node";
export type { NodeCompileContext } from "./compile-array-node";
export { compileComposite } from "./compile-composite";
export type {
  BranchPlanCompiler,
  CompositeCompileContext,
} from "./compile-composite";
export { UnresolvedPlanError, compileSchema } from "./compile-schema";
