// ===========================================================================
// test/type/chain/transform-closes-the-chain.type-test.ts
//
// The runtime order is fixed and is NOT the order a chain is written in:
// default, normalize, presence, every check, then every transform. So a check
// written after a transform runs BEFORE it, on a value the transform has not
// touched.
//
//     b.string.required().transform((s) => `${s}!`).min(3)
//
// reads as "append, then require three characters". What it does: "ab" fails
// min, and the transform never runs. It used to compile.
// ===========================================================================
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { transformPlugin } from "../../../src/plugins/transform";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import type { Assert, Equals } from "../../support/config-model";
import type { CheckAfterTransform } from "../../../src/chain/plugin-not-imported.types";

const bag = Builder()
  .use(requiredPlugin)
  .use(transformPlugin)
  .use(stringMinPlugin);

type DataOf<R> = R extends { valid: true; data: infer D } ? D : never;

// ---- what must still work -------------------------------------------------

const chained = bag
  .for<{ name: string }>()
  .v("name", (f) =>
    f.string
      .required()
      .transform((value) => value.length)
      .transform((length) => length + 1)
  )
  .build();

export type TransformFollowsTransform = Assert<
  Equals<DataOf<ReturnType<typeof chained.parse>>, { name: number }>
>;

const ordered = bag
  .for<{ name: string }>()
  .v("name", (f) =>
    f.string
      .required()
      .min(3)
      .transform((v) => v.length)
  )
  .build();

export type CheckBeforeTransformIsTheWorkingOrder = Assert<
  Equals<DataOf<ReturnType<typeof ordered.parse>>, { name: number }>
>;

// ---- what must not ---------------------------------------------------------

// The directive sits on the line the error lands on: the chain spans several
// lines and it is the CALL that is refused, not the expression around it.
bag.for<{ name: string }>().v("name", (f) =>
  f.string
    .required()
    .transform((value) => `${value}!`)
    // @ts-expect-error a check after a transform runs before it, so the name
    // resolves to a refusal carrying the reason rather than to a method.
    .min(3)
);

// A forgotten import fails the same way to the compiler's eye — "does not
// exist" — and the two have different fixes, which is why the refusal is a
// named shape rather than an absence.
declare const refusal: CheckAfterTransform<"min">;
export type RefusalNamesTheMethod = Assert<
  Equals<(typeof refusal)["method"], "min">
>;
export type RefusalIsItsOwnKind = Assert<
  Equals<(typeof refusal)["luqError"], "checkAfterTransform">
>;
