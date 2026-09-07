// ===========================================================================
// L6  src/builder/field-entry.types.ts
// One pending `.v()` call. It holds the user's callback UNRUN, wrapped in a
// closure that already knows which plugin bag it will be given: the callback
// must execute exactly once, at build(), and this is the shape that makes that
// provable — nothing but compileDeclarations can reach collectRules.
// ===========================================================================
import type { ChainBuildContext } from "../chain/create-chain-node";
import type { Rule } from "../plugin-kit/compiled-rule";

export interface FieldEntry {
  readonly path: string;
  /** null unless `.v()`'s third argument declared a default. */
  readonly defaultOf: ((root: unknown) => unknown) | null;
  readonly applyDefaultToNull: boolean;
  /** Runs the user's chain callback ONCE and returns its ordered rules. */
  collectRules(context: ChainBuildContext): readonly Rule[];
}
