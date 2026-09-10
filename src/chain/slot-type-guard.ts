// ===========================================================================
// L3  src/chain/slot-type-guard.ts — the type check a slot brings with it.
//
// Entering `b.string` is a claim about the value, and this is the rule that
// holds the claim up. It is seeded as the first rule of the chain, so it runs
// before any value rule.
//
// It exists because every value rule in the catalog answers PASS for a value
// outside its own type — `!isNumber(value) || ...` is the convention, not
// defensive clutter. That convention only keeps "one invalid value, one issue"
// true while something else reports the type, and this is that something. With
// it absent, a number field handed "abc" reported nothing at all: `min` waved
// the string through as none of its business and no rule behind it looked.
//
// Two things it deliberately does NOT decide.
//
// `undefined` and `null` pass. Absence belongs to required / optional /
// nullable, which run in the same list; answering here would report a type
// error for a field that is simply missing, and would do it under a code the
// caller cannot switch off with `.optional()`.
//
// `NaN` is a number. `typeof NaN === "number"`, and this rule answers the type
// question only. The previous major rejected it here, which its own record
// notes contradicts `required`'s documented allowance of NaN; a value rule
// (`min`, `integer`, `finite`) is where a caller says what they think of it.
//
// `tuple`, `union` and `any` get no guard, matching the previous major. `any`
// accepts everything by definition, and the other two are settled by the
// branches declared inside them rather than by a single typeof.
// ===========================================================================
import type { IssueSeverity, TypeName } from "../types";
import {
  PASS,
  fail,
  isArray,
  isNumber,
  isPlainObject,
  isString,
} from "../types";
import type { Rule } from "../plugin-kit/compiled-rule";
import { check } from "../plugin-kit/create-rule";

/** What the slot claims, and the noun its message uses. */
interface SlotType {
  readonly accepts: (value: unknown) => boolean;
  readonly noun: string;
}

const SLOT_TYPES: Readonly<Partial<Record<TypeName, SlotType>>> = Object.freeze(
  {
    string: { accepts: isString, noun: "a string" },
    number: { accepts: isNumber, noun: "a number" },
    boolean: {
      accepts: (value) => typeof value === "boolean",
      noun: "a boolean",
    },
    date: { accepts: (value) => value instanceof Date, noun: "a Date" },
    array: { accepts: isArray, noun: "an array" },
    object: { accepts: isPlainObject, noun: "an object" },
  }
);

/**
 * The rule `b.<slot>` starts its chain with, or null for a slot that claims
 * nothing about the runtime type.
 *
 * The code is `<slot>Type` — `stringType`, `numberType` — which reads as the
 * plugin name it would have had, matching every other code in the library.
 */
export function slotTypeGuard(
  slot: TypeName,
  severity: IssueSeverity
): Rule | null {
  const slotType = SLOT_TYPES[slot];
  if (slotType === undefined) return null;
  return check({
    code: `${slot}Type`,
    severity,
    run: (value) =>
      value === undefined || value === null || slotType.accepts(value)
        ? PASS
        : fail({ expected: slotType.noun, actual: value }),
    describe: () => `Value must be ${slotType.noun}`,
    buildMessageContext: () => ({}),
  });
}
