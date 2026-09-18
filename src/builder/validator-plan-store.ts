import type { ValidationPlan } from "../compile/validation-plan.types";
import type { ResolvedGlobalConfig } from "../types/global-config";
import { readValidatorOrigin } from "../core/validator-origin";

interface ValidatorPlan {
  readonly plan: ValidationPlan;
  readonly config: ResolvedGlobalConfig;
}

const plans = new WeakMap<object, ValidatorPlan>();

export function rememberValidatorPlan(
  validator: object,
  plan: ValidationPlan,
  config: ResolvedGlobalConfig
): void {
  plans.set(validator, { plan, config });
}

export function readValidatorPlan(
  validator: object
): ValidatorPlan | undefined {
  return plans.get(readValidatorOrigin(validator));
}
