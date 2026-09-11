// ===========================================================================
// L6  src/builder/create-plan-validator.ts
// The four-member object build() returns. It is an OBJECT, not a function:
// the legacy README showed `const validate = Builder()...build(); validate(x)`
// and the implementation never did that — validator-factory always returned
// `{ validate, parse, pick }` (docs/legacy-spec/public-api-surface.md §1.5).
// `pickAll` is new and is the consumer PickPaths never had.
//
// validate and parse are the two closures L5 built ONCE from the plan; this
// file adds no behaviour to them and must not, or there would be two answers to
// "what does validate do". pick and pickAll are built per call because their
// argument is only known then, and each pre-resolves everything it can.
// ===========================================================================
import type { ValidationPlan } from "../compile/validation-plan.types";
import type { ResolvedGlobalConfig } from "../types/global-config";
import { createFieldValidator } from "../runtime/create-field-validator";
import { createValidator } from "../runtime/create-validator";
import type { PlanBackedValidator } from "./builder-surface.types";
import { createSubsetValidator } from "./create-subset-validator";

export function createPlanBackedValidator(
  plan: ValidationPlan,
  config: ResolvedGlobalConfig
): PlanBackedValidator {
  const validator = createValidator(plan, config);
  return Object.freeze({
    validate: validator.validate,
    parse: validator.parse,
    pick: (key: string) => createFieldValidator(plan, key),
    pickAll: (paths: readonly string[]) => createSubsetValidator(plan, paths),
  });
}
