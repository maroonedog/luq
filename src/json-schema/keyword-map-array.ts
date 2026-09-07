// ===========================================================================
// L8  src/json-schema/keyword-map-array.ts — the six array keywords.
//
// THE C2 REGRESSION LIVES HERE, and is fixed by one word per entry: the
// Draft-07 keyword is `minItems`, the chain method is `minLength`. 1.x wrote
// `if (constraints.minItems !== undefined && chain.minItems) chain.minItems(n)`
// — `minItems` is not a chain method, the guard was false, and the constraint
// evaporated with no error at build time or run time. Writing "minItems" as
// the method below does not compile; the type test flips exactly that word.
// ===========================================================================
import { bindKeyword, structural } from "./bind-keyword";
import type { KeywordTable } from "./keyword-binding.types";
import type { Draft07ArrayKeyword } from "./draft07-keyword-value.types";
import { arrayMinLengthPlugin } from "../plugins/array-min-length";
import { arrayMaxLengthPlugin } from "../plugins/array-max-length";
import { arrayUniquePlugin } from "../plugins/array-unique";

export const minItemsBinding = bindKeyword(
  "array",
  "minLength",
  arrayMinLengthPlugin,
  (v: number) => [v] as const
);

export const maxItemsBinding = bindKeyword(
  "array",
  "maxLength",
  arrayMaxLengthPlugin,
  (v: number) => [v] as const
);

/**
 * The value type is `true`, not `boolean`. Draft-07 §6.4.3 defines
 * `uniqueItems: false` as imposing no constraint, so applying this binding for
 * `false` would add a rule the document does not state. The converter cannot
 * reach the binding without narrowing to `true` first — the compiler, not a
 * comment, is what enforces the no-op.
 */
export const uniqueItemsBinding = bindKeyword(
  "array",
  "unique",
  arrayUniquePlugin,
  (_v: true) => [] as const
);

export const arrayKeywordMap: KeywordTable<Draft07ArrayKeyword> = {
  items: structural(
    "a single sub-schema becomes one sub-chain through .each(); the TUPLE " +
      "form drives tupleBuilder's .builder(), whose method is `builder` and " +
      "never `tupleBuilder` — the third name 1.x guessed wrong"
  ),
  additionalItems: structural(
    "the rest sub-chain of .builder(); meaningful only beside a tuple `items`"
  ),
  maxItems: maxItemsBinding,
  minItems: minItemsBinding,
  uniqueItems: uniqueItemsBinding,
  contains: structural(
    "a sub-chain applied existentially; arrayContains takes an ElementChain"
  ),
};
