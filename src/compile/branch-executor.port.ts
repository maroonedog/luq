import type { CheckOutcome, RuleContext } from "../types";
import type { ValidationPlan } from "./validation-plan.types";

/** L4 declares the PORT, L5 implements it, L6 wires them. */
export interface BranchExecutor {
  runBranch(
    plan: ValidationPlan,
    value: unknown,
    ctx: RuleContext
  ): CheckOutcome;
}
