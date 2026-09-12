// ===========================================================================
// L8  src/json-schema/keyword-map-core.ts — the 21 keywords that belong to no
// single Luq slot: document plumbing, annotations, the any-instance keywords
// and the applicators.
//
// Every entry is one of three written decisions and there is NO fall-through:
//   bind        a chain method, with the method name checked by the compiler.
//   structural  the CONVERTER expands it (it recurses, or it picks the slot).
//               A sub-schema becomes a sub-CHAIN, which is a marker argument,
//               so such a keyword can never be a binding — bindKeyword rejects
//               it and the type test proves the rejection.
//   unsupported out of scope, in writing, with the reason. 1.x stored eleven
//               keywords it never read again; that is the failure this table
//               exists to make impossible.
// ===========================================================================
import { bindKeyword, structural, unsupported } from "./bind-keyword";
import type { KeywordTable } from "./keyword-binding.types";
import type { Draft07CoreKeyword } from "./draft07-keyword-value.types";
import { literalPlugin } from "../plugins/literal";

const ANNOTATION_ONLY = "an annotation with no validation effect in Draft-07";

/**
 * `const` reaches every slot: literalPlugin's `slots` is the whole TypeName
 * list, so `.literal()` is on the "any" chain as well as on each typed one.
 */
export const constBinding = bindKeyword(
  "any",
  "literal",
  literalPlugin,
  (v: unknown) => [v] as const
);

export const coreKeywordMap: KeywordTable<Draft07CoreKeyword> = {
  $schema: unsupported(
    "read at the document ROOT by assert-supported-dialect and then " +
      "discarded: Luq implements Draft-07 and never switches dialect, so a " +
      "root `$schema` naming another one is refused rather than ignored"
  ),
  $id: unsupported(
    "no base-URI resolution; resolve-ref accepts local $ref only"
  ),
  $comment: unsupported(ANNOTATION_ONLY),
  $ref: structural("resolved by resolve-ref before any keyword is read"),
  definitions: structural("a container of schemas, never a constraint itself"),

  title: unsupported(ANNOTATION_ONLY),
  description: unsupported(ANNOTATION_ONLY),
  default: unsupported(
    "Luq never mutates the input it validates, so a default has nowhere to land"
  ),
  examples: unsupported(ANNOTATION_ONLY),
  readOnly: unsupported(
    `${ANNOTATION_ONLY}; the readOnly plugin exists but is chain-only, because ` +
      "Draft-07 gives readOnly no assertion behaviour"
  ),
  writeOnly: unsupported(
    `${ANNOTATION_ONLY}; the writeOnly plugin exists but is chain-only`
  ),

  type: structural(
    "chooses the slot (b.string / b.number / ...), not a method on one; " +
      "`integer` adds .integer() and a type ARRAY becomes nullable or a union"
  ),
  enum: structural(
    "the allowed-value list is typed against the FIELD (.oneOf() takes " +
      "readonly SelfValue[]), so it carries a marker and cannot be a binding; " +
      "the converter resolves the list and calls .oneOf() itself"
  ),
  const: constBinding,

  allOf: structural("every sub-schema becomes a sub-chain the composite runs"),
  anyOf: structural("sub-chains combined existentially"),
  oneOf: structural(
    "sub-chains counted; exactly one must pass. NB: the `enum` KEYWORD drives " +
      "the .oneOf() METHOD, which is a different thing from this keyword"
  ),
  not: structural("one negated sub-chain"),
  if: structural("the condition sub-chain of conditionalSchema"),
  then: structural("the then sub-chain of conditionalSchema"),
  else: structural("the else sub-chain of conditionalSchema"),
};
