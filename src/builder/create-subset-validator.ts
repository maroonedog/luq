// ===========================================================================
// L6  src/builder/create-subset-validator.ts — `pickAll(["a", "b[*].c"])`.
//
// A form validates several named paths at once and wants back exactly those
// paths, keyed by the strings it asked for. It runs the SAME plan on the SAME
// engine as validate(): there is no subset plan, because a cross-field rule on
// a picked path reads fields the caller did not pick, and compiling a smaller
// plan would silently change that rule's answer.
//
// What is narrowed is the ISSUE LIST, by the one matcher, and the caller's
// abortEarly is deliberately overridden the way createFieldValidator overrides
// it: an unrelated field must not be able to stop the run before a picked field
// is reached.
// ===========================================================================
import type { ValidationPlan } from "../compile/validation-plan.types";
import { matchPathPattern } from "../path/match-path-pattern";
import {
  createValidator,
  hasRejectingIssue,
} from "../runtime/create-validator";
import type { ValidationResult } from "../types/validation-result.types";
import type { PlanSubsetValidator } from "./builder-surface.types";
import { createProjectionReader } from "./create-projection-reader";
import type { ProjectionReader } from "./create-projection-reader";

interface PathProjection {
  readonly path: string;
  readonly read: ProjectionReader;
}

export function createSubsetValidator(
  plan: ValidationPlan,
  paths: readonly string[]
): PlanSubsetValidator {
  const projections: readonly PathProjection[] = Object.freeze(
    paths.map((path) => ({ path, read: createProjectionReader(path) }))
  );
  const declared = Object.freeze(paths.slice());
  const validator = createValidator(plan);
  const subset: PlanSubsetValidator = {
    paths: declared,
    validate(value, options): ValidationResult<unknown> {
      const outcome = validator.validate(value, {
        ...options,
        abortEarly: false,
      });
      const issues = Object.freeze(
        outcome.issues.filter((issue) =>
          projections.some((projection) =>
            matchPathPattern(projection.path, issue.path)
          )
        )
      );
      if (hasRejectingIssue(issues)) return { valid: false, issues };
      return { valid: true, data: projectPaths(projections, value), issues };
    },
  };
  return Object.freeze(subset);
}

/**
 * The result is keyed by the declared path STRING — `{"user.name": "…"}` — and
 * not re-nested, which is what PickPaths<T, P> describes and what lets the
 * caller read back exactly what it asked for with no re-narrowing.
 */
function projectPaths(
  projections: readonly PathProjection[],
  value: unknown
): Readonly<Record<string, unknown>> {
  const projected: Record<string, unknown> = {};
  for (const projection of projections) {
    Object.defineProperty(projected, projection.path, {
      value: projection.read(value),
      enumerable: true,
    });
  }
  return Object.freeze(projected);
}
