// ===========================================================================
// L5  src/runtime/create-field-validator.ts
// `pick("user.email")` executed: one declared path, validated on its own, on
// the same plan and the same engine.
//
// The legacy implementation built `{ [key]: value }`, ran the whole validator
// over it and filtered the errors by a RegExp compiled from the path string on
// every call. Two things go wrong there and both are fixed here: a wildcard
// path such as `employees[*].name` had no object shape to put the value into,
// and the caller's `abortEarly` could stop the run at an unrelated field so the
// picked field was never reached.
//
// So: the subject shape is composed ONCE at build time — a copy-on-write write
// for a plain path, a nested wrapper for a wildcard one — the run always
// collects every field, and the issues are then matched against the declared
// pattern by the ONE matcher, which parses rather than compiles a RegExp.
// ===========================================================================
import { isPlainObject } from "../types";
import type {
  ValidateOptions,
  ValidationResult,
} from "../types/validation-result.types";
import type { ValidationPlan } from "../compile/validation-plan.types";
import { createValueWriter } from "../path/create-value-writer";
import { matchPathPattern } from "../path/match-path-pattern";
import { parseFieldPath } from "../path/parse-field-path";
import type { PathSegment } from "../path/path-segment.types";
import { createValidator, hasRejectingIssue } from "./create-validator";

/**
 * `siblings` is legacy's `allValues?: Partial<T>`: the rest of the object, so a
 * cross-field rule declared on this path can still read what it compares
 * against.
 */
export interface PlanFieldValidator {
  readonly path: string;
  validate(
    value: unknown,
    siblings?: object,
    options?: ValidateOptions
  ): ValidationResult<unknown>;
}

/** Composes the subject the plan runs against. Chosen once, by path shape. */
type SubjectComposer = (
  siblings: object | undefined,
  value: unknown
) => unknown;

export function createFieldValidator(
  plan: ValidationPlan,
  path: string
): PlanFieldValidator {
  const template = parseFieldPath(path);
  const compose = createSubjectComposer(template);
  const validator = createValidator(plan);
  return {
    path,
    validate(value, siblings, options) {
      const outcome = validator.validate(compose(siblings, value), {
        ...options,
        abortEarly: false,
      });
      const issues = Object.freeze(
        outcome.issues.filter((issue) => matchPathPattern(path, issue.path))
      );
      if (hasRejectingIssue(issues)) return { valid: false, issues };
      return { valid: true, data: value, issues };
    },
  };
}

/**
 * A wildcard-free path writes into the siblings copy-on-write, so every other
 * declared field keeps whatever the caller supplied for it.
 *
 * A wildcard path cannot: `employees[*].name` names one member of every
 * element, and there is no such place in an arbitrary object. The value is
 * wrapped into the minimal structure the pattern describes — a ONE-element
 * array at each `[*]` — which makes the issue come back as `employees[0].name`
 * and match the pattern it was picked by.
 */
function createSubjectComposer(
  template: readonly PathSegment[]
): SubjectComposer {
  if (!template.some((segment) => segment.kind === "each")) {
    const write = createValueWriter(template);
    return (siblings, value) => write(siblings ?? {}, value);
  }
  const nest = compileNester(template);
  return (siblings, value) => mergeOntoSiblings(siblings, nest(value));
}

/**
 * Walks the template **once** and folds it into a wrapping function.
 *
 * Walking it per validation re-read each segment's kind every time, which is
 * exactly the thing validation time must not do: what something IS was settled
 * at compile time. The non-wildcard route was always shaped this way.
 */
function compileNester(
  template: readonly PathSegment[]
): (value: unknown) => unknown {
  let nest: (value: unknown) => unknown = (value) => value;
  for (let index = template.length - 1; index >= 0; index -= 1) {
    const segment = template[index];
    if (segment === undefined) continue;
    const inner = nest;
    nest =
      segment.kind === "each"
        ? (value) => [inner(value)]
        : ((key) => (value: unknown) => ({ [key]: inner(value) }))(segment.key);
  }
  return nest;
}

/** The wrapper wins on the key it names; every other sibling survives. */
function mergeOntoSiblings(
  siblings: object | undefined,
  fragment: unknown
): unknown {
  if (siblings === undefined || !isPlainObject(fragment)) return fragment;
  return { ...siblings, ...fragment };
}
