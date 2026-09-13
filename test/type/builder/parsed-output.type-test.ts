// ===========================================================================
// test/type/builder/parsed-output.type-test.ts
//
// `parse()` applies the transforms and hands back the transformed value. Its
// type used to say otherwise: a field declared `string` and transformed to a
// `Date` came back typed `string`, so `parsed.data.when.toUpperCase()`
// compiled and threw. The type was not imprecise, it was wrong in the
// direction that costs a caller something.
//
// `validate()` is the other half of the pair and must NOT move: it applies no
// transform, so its type is the declared one and stays that way. A change that
// made both of them the transformed type would be a different bug.
// ===========================================================================
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { transformPlugin } from "../../../src/plugins/transform";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import type { Assert, Equals } from "../../support/config-model";

/**
 * The success half of a result.
 *
 * A naked type parameter, so the conditional DISTRIBUTES over
 * `ValidationSuccess | ValidationRejection`. Written inline as
 * `ReturnType<...> extends { valid: true; data: infer D }` it does not: a
 * concrete union has to match as a whole, the rejection arm does not, and
 * every assertion below quietly compares `never` against `never` and passes.
 */
type DataOf<R> = R extends { valid: true; data: infer D } ? D : never;

interface Raw {
  readonly when: string;
  readonly keep: number;
}

const dated = Builder()
  .use(requiredPlugin)
  .use(transformPlugin)
  .for<Raw>()
  .v("when", (b) => b.string.required().transform((value) => new Date(value)))
  .build();

export type ParseCarriesTheTransform = Assert<
  Equals<
    DataOf<ReturnType<typeof dated.parse>>,
    { readonly when: Date; readonly keep: number }
  >
>;

export type ValidateKeepsTheDeclaredType = Assert<
  Equals<DataOf<ReturnType<typeof dated.validate>>, Raw>
>;

// ---- a builder with no transform is untouched -----------------------------

const plain = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<Raw>()
  .v("when", (b) => b.string.required().min(3))
  .build();

export type NoTransformLeavesParseAlone = Assert<
  Equals<DataOf<ReturnType<typeof plain.parse>>, Raw>
>;

// ---- nested and array paths -----------------------------------------------

interface Order {
  readonly customer: { readonly signedUp: string };
  readonly lines: readonly { readonly sku: string; readonly qty: number }[];
}

const nested = Builder()
  .use(requiredPlugin)
  .use(transformPlugin)
  .for<Order>()
  .v("customer.signedUp", (b) =>
    b.string.required().transform((value) => new Date(value))
  )
  .v("lines[*].sku", (b) =>
    b.string.required().transform((value) => value.length)
  )
  .build();

export type NestedAndElementPathsBothRewrite = Assert<
  Equals<
    DataOf<ReturnType<typeof nested.parse>>,
    {
      readonly customer: { readonly signedUp: Date };
      readonly lines: { readonly sku: number; readonly qty: number }[];
    }
  >
>;
