// ===========================================================================
// L7  src/plugins/from-context/from-context.ts
// THE READ SIDE OF THE ASYNC STORY. The pre-resolved external context arrives
// on RuleContext.external and is read through the one L2 door,
// readExternalContext, so this plugin has no idea the word "async" exists.
//
// 1.x's version was unreachable: its hoisted check assigned `allValues` to the
// context and only when `required` was FALSE, so `required: true` could never
// see a context and always failed, while the real implementation
// (performContextValidation) was called from no execution path at all
// (docs/legacy-spec/plugin-catalog-relational.md). Here `required: true` reads
// the same channel as `required: false` and fails only when it is truly empty.
// ===========================================================================
import { PASS, fail, isPlainObject, isString } from "../../types";
import type { CheckOutcome } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { readExternalContext } from "../../plugin-kit/external-context";
import type { Unchanged } from "../../plugin-kit/marker.types";

export type ExternalContext = Readonly<Record<string, unknown>>;

/** 1.x's `{ valid, message? }`, unchanged. */
export interface FromContextOutcome {
  readonly valid: boolean;
  readonly message?: string;
}

export type FromContextCheck = (
  value: unknown,
  context: ExternalContext,
  root: unknown
) => FromContextOutcome;

/**
 * 1.x's ContextValidationOptions minus `code`, which is now the uniform
 * trailing RuleOptions every plugin method already accepts.
 */
export interface FromContextOptions {
  readonly check: FromContextCheck;
  /** No context at all is a failure. Default false, as in 1.x. */
  readonly required?: boolean;
  /** What "no context" means when it is not required. Default true. */
  readonly fallbackToValid?: boolean;
  readonly errorMessage?: string;
}

export interface FromContextExtra {
  readonly message: string;
}

const FROM_CONTEXT_SLOTS = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
  "tuple",
  "union",
] as const;

const MISSING_REQUIRED_MESSAGE = "Context data is required for validation";
const FAILED_MESSAGE = "Context validation failed";

export const fromContextPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [options: FromContextOptions];
  out: Unchanged;
  context: FromContextExtra;
}>()({
  name: "fromContext",
  method: "fromContext",
  slots: FROM_CONTEXT_SLOTS,
  build: (ctx, options) => {
    const isRequired = options.required ?? false;
    const isValidWithoutContext = options.fallbackToValid ?? true;
    const errorMessage = options.errorMessage;
    const runCheck = options.check;
    return check<FromContextExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, runCtx) => {
        const external = readExternalContext(runCtx, isPlainObject);
        if (external === undefined) {
          if (isRequired) {
            return fail({ actual: errorMessage ?? MISSING_REQUIRED_MESSAGE });
          }
          return isValidWithoutContext
            ? PASS
            : fail({ actual: errorMessage ?? FAILED_MESSAGE });
        }
        return runCheckedOutcome(
          runCheck,
          value,
          external,
          runCtx.root,
          errorMessage
        );
      },
      describe: (detail) =>
        isString(detail.actual) ? detail.actual : FAILED_MESSAGE,
      buildMessageContext: (detail) => ({
        message: isString(detail.actual) ? detail.actual : FAILED_MESSAGE,
      }),
    });
  },
});

/**
 * A throwing check is a FAILURE carrying the thrown text, never a silent pass:
 * 1.x swallowed the exception into `false` with no explanation, and the
 * anti-pattern the spec records is the swallowing, not the failing.
 */
function runCheckedOutcome(
  runCheck: FromContextCheck,
  value: unknown,
  external: ExternalContext,
  root: unknown,
  errorMessage: string | undefined
): CheckOutcome {
  try {
    const outcome = runCheck(value, external, root);
    if (outcome.valid) return PASS;
    return fail({
      actual: outcome.message ?? errorMessage ?? FAILED_MESSAGE,
    });
  } catch (thrown) {
    return fail({
      actual: errorMessage ?? `Context validation error: ${String(thrown)}`,
    });
  }
}
