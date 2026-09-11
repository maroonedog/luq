// ===========================================================================
// L5  src/runtime/index.ts — re-exports only. The engine: one plan in, issues
// and (for parse) a copy-on-write output out. Nothing is defined in this file.
// ===========================================================================
export {
  ARRAY_ELEMENTS_ABORT_ON_EACH_FIELD,
  DEFAULT_ABORT_EARLY,
  DEFAULT_ABORT_EARLY_ON_EACH_FIELD,
  IssueSink,
  resolveAbortPolicy,
} from "./issue-sink";
export type { AbortPolicy } from "./issue-sink";
export { IndexStack, joinIssuePath } from "./index-stack";
export { createIssue, renderFallbackMessage } from "./create-issue";
export type { IssueRequest } from "./create-issue";
export { decidePresence } from "./decide-presence";
export { FIELD_VALUE_UNCHANGED, runField } from "./run-field";
export type {
  FieldRunContext,
  FieldRunOutcome,
  RecursionRunner,
} from "./run-field";

export {
  NO_WRITE_TARGETS,
  createArrayWriteTargets,
  createPlanWriteTargets,
  replaceElement,
  writeFieldValue,
} from "./output-writer";
export type { ArrayWriteTarget } from "./output-writer";
export { runArrayNodes } from "./run-array-node";
export { prefixIssuePaths, runPlan } from "./run-plan";
export { RECURSION_ABORT_POLICY, createRecursionRunner } from "./run-recursion";
export type { RecursionHost } from "./run-recursion";
export { BRANCH_ABORT_POLICY, createBranchExecutor } from "./run-branch";
export {
  ROOT_MISSING_CODE,
  createValidator,
  hasRejectingIssue,
} from "./create-validator";
export type { PlanValidator } from "./create-validator";
export { createFieldValidator } from "./create-field-validator";
export type { PlanFieldValidator } from "./create-field-validator";
