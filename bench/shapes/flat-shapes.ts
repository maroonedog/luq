// ===========================================================================
// bench/shapes/flat-shapes.ts — the two flat shapes.
//
// `singleField` is the floor of the library: one declared field, one presence
// rule, one check. Anything the engine charges per validate() call that is not
// the rule itself shows up here and nowhere else.
//
// `multiField` is the shape 1.x published as "simple" (README: 1.2M ops/sec;
// the benchmarks page that actually measured it: 694,692 ops/sec). It is three
// fields and the same six plugins 1.x's bundle-size-comparison/implementations
// /luq/simple.ts imported: required, stringMin, stringMax, stringEmail,
// numberMin, numberMax. It is reproduced here so the two numbers can be put
// next to each other without an asterisk about which shape was measured.
//
// Each shape carries a POOL of accepted values and a pool of rejected ones.
// The accepted pool exists because one frozen value let V8 delete the
// hand-written reference for `singleField` entirely; the rejected pool is what
// proves the reference is checking anything at all, and is what the
// rejection-path ratio is measured on.
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringMaxPlugin } from "../../src/plugins/string-max";
import { stringEmailPlugin } from "../../src/plugins/string-email";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { numberMaxPlugin } from "../../src/plugins/number-max";
import type { ValuePool } from "../rotate-over-values";
import type { BenchShape } from "./bench-shape.types";

export interface SingleFieldSubject {
  readonly name: string;
}

export interface MultiFieldSubject {
  readonly name: string;
  readonly email: string;
  readonly age: number;
}

/** Four distinct objects of one hidden class: same keys, same order, same types. */
export const SINGLE_FIELD_VALUES: readonly [
  SingleFieldSubject,
  SingleFieldSubject,
  SingleFieldSubject,
  SingleFieldSubject,
] = [
  { name: "Alexandra" },
  { name: "Benedict" },
  { name: "Chiyoko" },
  { name: "Dimitrios" },
];

export const SINGLE_FIELD_VALUE: SingleFieldSubject = SINGLE_FIELD_VALUES[0];

/**
 * Three lengths below the minimum and one absent field, so the check rejects
 * three of them and the presence rule the fourth.
 *
 * `{ name: 42 }` is not here, and the reason this comment used to give was
 * wrong. It said Luq ACCEPTS it, on the grounds that the chain compiles to a
 * presence rule plus a length rule and the length rule passes a non-string.
 * It does not: `b.string` puts a slot type guard in front, and the value is
 * rejected with `stringType`. Run it.
 *
 * So Luq and the hand-written reference AGREE about it, and the value could go
 * in the pool. It is left out for a different and smaller reason: every other
 * member fails a rule the shape declares, and this one would fail the slot
 * guard instead, which is a different thing to be timing. Adding it means
 * re-recording every figure that quotes this pool, which is a decision with a
 * pull request attached rather than a comment.
 */
export const SINGLE_FIELD_REJECTED: ValuePool = [
  { name: "ab" },
  { name: "" },
  { name: "x" },
  {},
];

export const MULTI_FIELD_VALUES: readonly [
  MultiFieldSubject,
  MultiFieldSubject,
  MultiFieldSubject,
  MultiFieldSubject,
] = [
  { name: "Alexandra", email: "alexandra@example.com", age: 34 },
  { name: "Benedict", email: "benedict@example.co.uk", age: 51 },
  { name: "Chiyoko", email: "chiyoko.tanaka@example.jp", age: 27 },
  { name: "Dimitrios", email: "d.papas@mail.example.org", age: 63 },
];

export const MULTI_FIELD_VALUE: MultiFieldSubject = MULTI_FIELD_VALUES[0];

/**
 * The middle two are the reason the reference's email pattern had to be
 * replaced with the plugin's own: a leading dot in the local part and an
 * underscore in the domain are both accepted by the loose
 * `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` the reference used to carry, and both are
 * rejected by src/plugins/string-email. With them in this pool the two sides
 * cannot disagree without the agreement check saying so.
 */
export const MULTI_FIELD_REJECTED: ValuePool = [
  { name: "ab", email: "alexandra@example.com", age: 34 },
  { name: "Alexandra", email: ".alexandra@example.com", age: 34 },
  { name: "Alexandra", email: "alexandra@exam_ple.com", age: 34 },
  { name: "Alexandra", email: "alexandra@example.com", age: 12 },
];

export const singleFieldShape: BenchShape = {
  name: "singleField",
  declares: "1 field, 1 presence rule, 1 check (string.required().min(3))",
  buildValidator: () =>
    Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<SingleFieldSubject>()
      .v("name", (field) => field.string.required().min(3))
      .build(),
  acceptedValue: SINGLE_FIELD_VALUE,
  acceptedValues: SINGLE_FIELD_VALUES,
  rejectedValues: SINGLE_FIELD_REJECTED,
};

export const multiFieldShape: BenchShape = {
  name: "multiField",
  declares:
    "3 fields, 6 plugins (required/stringMin/stringMax/stringEmail/numberMin/numberMax) — 1.x's 'simple' shape",
  buildValidator: () =>
    Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(stringEmailPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .for<MultiFieldSubject>()
      .v("name", (field) => field.string.required().min(3).max(50))
      .v("email", (field) => field.string.required().email())
      .v("age", (field) => field.number.required().min(18).max(120))
      .build(),
  acceptedValue: MULTI_FIELD_VALUE,
  acceptedValues: MULTI_FIELD_VALUES,
  rejectedValues: MULTI_FIELD_REJECTED,
};
