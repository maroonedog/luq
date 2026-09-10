// ===========================================================================
// L3  src/chain/declared-call.types.ts — one chain method call, kept as values.
//
// THE DEFECT THIS TYPE EXISTS TO KILL: a plugin turns its arguments into a
// closure and returns a rule, so `.min(3)`'s 3 survives only inside that
// closure. A compiled rule carries a code and a function; the 3 is nowhere to
// be read. Anything that has to WRITE the constraint back out — a JSON Schema,
// a form descriptor — needs the value, so it is kept as the call happens.
//
// Nothing at validation time reads this. It is made once and read only when
// asked for. Its length does not match the rule list: one method call can add
// more than one rule.
// ===========================================================================
import type { TypeName } from "../types";

/** One call of one chain method. */
export interface DeclaredCall {
  readonly pluginName: string;
  readonly method: string;
  readonly slot: TypeName;
  /**
   * The arguments as declared, after argument resolution and nothing else.
   *
   * They are not converted: a RegExp stays a RegExp. How a given output format
   * spells a value is that writer's business, and converting here would make
   * everyone pay for a conversion only some of them want.
   */
  readonly args: readonly unknown[];
}
