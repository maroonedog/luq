// ===========================================================================
// L9  src/async/index.ts — THE ./async SUBPATH. Re-exports only; nothing is
// defined in this file.
//
// The whole subpath is one await followed by the ordinary synchronous engine.
// It contains no rule, no plan, no loop over fields — deliberately, because a
// second execution path is exactly how 1.x's async story died: the real
// getAsyncContext-based branch existed but no call site reached it
// (docs/legacy-spec/plugin-catalog-relational.md:76).
//
// So this layer imports the compiler and the runtime NOWHERE. It resolves a
// promise map, hands the resolved bag to the validator it decorates through
// ValidateOptions.external, and gets out of the way.
// ===========================================================================
export {
  AsyncContextBuilder,
  createAsyncContext,
  readAsyncContext,
} from "./async-context";
export type {
  AsyncContext,
  AsyncContextFailure,
  AsyncContextOptions,
} from "./async-context";

export {
  ASYNC_CONTEXT_ISSUE_CODE,
  addAsyncSupport,
  withAsyncContext,
} from "./async-validator";
export type {
  AsyncAwareValidator,
  AsyncBoundValidator,
} from "./async-validator";
