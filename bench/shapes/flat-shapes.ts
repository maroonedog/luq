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
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { stringMaxPlugin } from "../../src/plugins/string-max";
import { stringEmailPlugin } from "../../src/plugins/string-email";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { numberMaxPlugin } from "../../src/plugins/number-max";
import type { BenchShape } from "./bench-shape.types";

export interface SingleFieldSubject {
  readonly name: string;
}

export interface MultiFieldSubject {
  readonly name: string;
  readonly email: string;
  readonly age: number;
}

export const SINGLE_FIELD_VALUE: SingleFieldSubject = { name: "Alexandra" };

export const MULTI_FIELD_VALUE: MultiFieldSubject = {
  name: "Alexandra",
  email: "alexandra@example.com",
  age: 34,
};

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
};
