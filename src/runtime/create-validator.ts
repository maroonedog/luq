// ===========================================================================
// L5  src/runtime/create-validator.ts
// One plan becomes TWO CLOSURES, built once, at build() time.
//
// Everything that distinguishes validate() from parse() is decided here and
// then frozen into the closure: whether output is produced, and which array
// write targets exist. A call therefore carries no mode flag to test and no
// plan to inspect — it allocates a sink, an index stack and a context, and
// walks the one engine loop.
//
// When the plan writes nothing at all — no transform anywhere, no default
// anywhere — createPlanWriteTargets returns null and parse() becomes exactly
// validate(): no writer is built, none is called, and the caller's object comes
// back by identity.
//
// `data` is `unknown` on purpose. L5 knows a plan, not the type the plan was
// declared against, and this layer holds no type assertion; L6 owns the one
// erasure that turns this into Validator<T>.
// ===========================================================================
import type { ValidationIssue } from "../types";
import type {
  ValidateOptions,
  ValidationResult,
} from "../types/validation-result.types";
import type { ValidationPlan } from "../compile/validation-plan.types";
import { IndexStack } from "./index-stack";
import { IssueSink, resolveAbortPolicy } from "./issue-sink";
import { NO_WRITE_TARGETS, createPlanWriteTargets } from "./output-writer";
import type { ArrayWriteTarget } from "./output-writer";
import { createRecursionRunner } from "./run-recursion";
import { runPlan } from "./run-plan";

/** The untyped pair. L6 puts the declared type back on top of it. */
export interface PlanValidator {
  validate(
    value: unknown,
    options?: ValidateOptions
  ): ValidationResult<unknown>;
  parse(value: unknown, options?: ValidateOptions): ValidationResult<unknown>;
}

/** The legacy root short-circuit, wording included (validator-factory.ts:498). */
export const ROOT_MISSING_CODE = "REQUIRED";
export const ROOT_MISSING_MESSAGE = "Value is required";

/**
 * A null or undefined subject fails before the plan runs. Without it every
 * reader would answer `undefined`, OPEN_PRESENCE would permit every absence,
 * and `validate(null)` would report success for a schema that declares nothing
 * required.
 */
function rejectMissingRoot(): ValidationResult<unknown> {
  return {
    valid: false,
    issues: Object.freeze([
      Object.freeze({
        path: "",
        code: ROOT_MISSING_CODE,
        message: ROOT_MISSING_MESSAGE,
        severity: "error" as const,
      }),
    ]),
  };
}

/**
 * Severity decides validity, and nothing else does. An `info` or `warning`
 * issue is still an issue — the sink counted it and abortEarly saw it — but it
 * does not reject the value, which is the only reason ValidationSuccess carries
 * an `issues` list at all.
 */
export function hasRejectingIssue(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

function runRoot(
  plan: ValidationPlan,
  value: unknown,
  options: ValidateOptions | undefined,
  targets: readonly ArrayWriteTarget[],
  shouldApplyTransforms: boolean
): ValidationResult<unknown> {
  if (value === null || value === undefined) return rejectMissingRoot();
  const sink = new IssueSink(resolveAbortPolicy(options));
  const output = runPlan(
    plan,
    value,
    {
      root: value,
      sink,
      indices: new IndexStack(),
      shouldApplyTransforms,
      runRecursion: createRecursionRunner({
        root: value,
        sink,
        external: options?.external,
      }),
      external: options?.external,
    },
    targets
  );
  const issues = Object.freeze(sink.issues);
  if (hasRejectingIssue(issues)) return { valid: false, issues };
  return { valid: true, data: output, issues };
}

export function createValidator(plan: ValidationPlan): PlanValidator {
  const parseTargets = createPlanWriteTargets(plan);
  const shouldWriteOutput = parseTargets !== null;
  return {
    validate: (value, options) =>
      runRoot(plan, value, options, NO_WRITE_TARGETS, false),
    parse: (value, options) =>
      runRoot(
        plan,
        value,
        options,
        parseTargets ?? NO_WRITE_TARGETS,
        shouldWriteOutput
      ),
  };
}
