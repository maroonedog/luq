// ===========================================================================
// L6  src/builder/field-entry.types.ts
// One pending `.v()` call. It holds the user's callback UNRUN, wrapped in a
// closure that already knows which plugin bag it will be given: the callback
// must execute exactly once, at build(), and this is the shape that makes that
// provable — nothing but compileDeclarations can reach collectRules.
// ===========================================================================
import type { ChainBuildContext } from "../chain/create-chain-node";
import type { FieldChainOutcome } from "../chain/collect-field-rules";
import type { FieldNormalizer } from "./field-options.types";

export interface FieldEntry {
  readonly path: string;
  /** null unless `.v()`'s third argument declared a default. */
  readonly defaultOf: ((root: unknown) => unknown) | null;
  readonly applyDefaultToNull: boolean;
  /** null unless `.v()`'s third argument declared a normalizer. */
  readonly normalize: FieldNormalizer | null;
  /**
   * Runs the user's chain callback ONCE and returns its ordered rules,
   * together with what was declared to produce them.
   */
  collectRules(context: ChainBuildContext): FieldChainOutcome;
}
