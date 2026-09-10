// ===========================================================================
// L6  src/builder/field-declared-calls.types.ts
//
// What was declared, per field path, carried back alongside the plan.
//
// Deliberately not part of the plan. The plan is what validation time reads,
// and validation time never reads this — putting it there would fatten the
// plan for everyone to serve the few who ask for it.
// ===========================================================================
import type { DeclaredCall } from "../chain/declared-call.types";

export interface FieldDeclaredCalls {
  readonly path: string;
  /** null means no record was kept; the empty list means nothing was declared. */
  readonly calls: readonly DeclaredCall[] | null;
}
