// ===========================================================================
// L9  src/async/async-validator.ts
// RESIDUAL 4 / item 1, second half. The documented call shape
//   await validator.withAsyncContext(ctx).validate(data)
// (docs/legacy-spec/documented-promises.md:226, plugin-catalog-relational.md:75)
// is restored EXACTLY, without adding a fourth method to the core Validator:
// addAsyncSupport() decorates a built validator, the decorated object carries
// withAsyncContext, and the bound object hands the resolved bag to the ordinary
// synchronous validate() through ValidateOptions.external.
//
// The 1.x defect this closes: `performContextValidation` — the real
// getAsyncContext-based path — existed but was reachable from no execution
// path, so `required: true` on fromContext always failed
// (plugin-catalog-relational.md:76). Here there is exactly one path.
// ===========================================================================
import type { FieldPath } from "../path/field-path.types";
import type {
  ValidateOptions,
  ValidationResult,
} from "../types/validation-result.types";
import type { ValidationIssue } from "../types";
import type { Validator } from "../builder/validator.types";
import type { AsyncContext } from "./async-context";

export const ASYNC_CONTEXT_ISSUE_CODE = "asyncContextUnavailable";

function describeFailures<C extends object>(
  context: AsyncContext<C>
): readonly ValidationIssue[] {
  return context.failures.map((failure) => ({
    path: failure.key,
    code: ASYNC_CONTEXT_ISSUE_CODE,
    message: `Async context entry "${failure.key}" did not resolve.`,
    severity: "error",
  }));
}

function mergeExternal<C extends object>(
  context: AsyncContext<C>,
  options: ValidateOptions | undefined
): ValidateOptions {
  return { ...options, external: { ...options?.external, ...context.values } };
}

/**
 * What `withAsyncContext(ctx)` returns. `context` replaces 1.x's
 * `getContextType()`, which existed only to recover the context type: here the
 * context itself is on the object, so the type is reachable without a call.
 */
export interface AsyncBoundValidator<T extends object, C extends object> {
  readonly context: AsyncContext<C>;
  validate(
    value: unknown,
    options?: ValidateOptions
  ): Promise<ValidationResult<T>>;
  parse(
    value: unknown,
    options?: ValidateOptions
  ): Promise<ValidationResult<T>>;
}

export interface AsyncAwareValidator<T extends object> extends Validator<T> {
  withAsyncContext<C extends object>(
    context: AsyncContext<C>
  ): AsyncBoundValidator<T, C>;
}

export function withAsyncContext<T extends object, C extends object>(
  validator: Validator<T>,
  context: AsyncContext<C>
): AsyncBoundValidator<T, C> {
  return {
    context,
    async validate(value, options) {
      if (!context.isReady)
        return { valid: false, issues: describeFailures(context) };
      return validator.validate(value, mergeExternal(context, options));
    },
    async parse(value, options) {
      if (!context.isReady)
        return { valid: false, issues: describeFailures(context) };
      return validator.parse(value, mergeExternal(context, options));
    },
  };
}

/** The 1.x decorator name, kept. Adds the method without touching the core. */
export function addAsyncSupport<T extends object>(
  validator: Validator<T>
): AsyncAwareValidator<T> {
  return {
    validate(value, options) {
      return validator.validate(value, options);
    },
    parse(value, options) {
      return validator.parse(value, options);
    },
    pick<K extends FieldPath<T> & string>(key: K) {
      return validator.pick(key);
    },
    pickAll<const P extends readonly (FieldPath<T> & string)[]>(paths: P) {
      return validator.pickAll(paths);
    },
    withAsyncContext<C extends object>(context: AsyncContext<C>) {
      return withAsyncContext(validator, context);
    },
  };
}
