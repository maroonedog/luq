// ===========================================================================
// L5  src/runtime/plan-can-recurse.ts
// Whether a plan needs a real recursion runner, asked once at build time.
//
// Building one allocates a WeakSet and several closures, and doing that on
// every validate() of a plan with no recursive rule in it was most of the fixed
// per-call cost. Whether a plan CAN recurse is a property of the plan, so it is
// answered where the plan is finished and never again.
//
// Its own file because create-validator has a line ceiling and this is the part
// of it that is about the plan rather than about running one.
// ===========================================================================
import type {
  ArrayNode,
  ValidationPlan,
} from "../compile/validation-plan.types";

/**
 * Whether the root needs a real runner.
 *
 * Only the fields directly under the root and the elements of array nodes
 * matter. A composite branch makes its own runner for the nested plan, so it
 * never uses the one passed from here.
 */
export function planCanRecurse(plan: ValidationPlan): boolean {
  return (
    plan.fields.some((field) => field.recursion !== null) ||
    plan.arrays.some(nodeCanRecurse)
  );
}

function nodeCanRecurse(node: ArrayNode): boolean {
  return (
    node.elementFields.some((field) => field.recursion !== null) ||
    node.nested.some(nodeCanRecurse)
  );
}
