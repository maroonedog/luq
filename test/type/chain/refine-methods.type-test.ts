// ===========================================================================
// RESIDUAL 4 / item 2 — refine* at the CALL SITE.
// Every assertion below is a call, not a declaration. The declaration-only
// verification is exactly what let refine* vanish.
// ===========================================================================
import {
  accountBuilder,
  type Assert,
  type Equals,
} from "../../support/config-model";
import {
  REFINE_METHOD_SLOTS,
  type RefineMethodName,
} from "../../../src/chain/refine-methods.types";

// The eight names, pinned. A ninth (or a missing one) breaks this equality.
export type RefineFamilyIsEight = Assert<
  Equals<
    RefineMethodName,
    | "refineString"
    | "refineNumber"
    | "refineBoolean"
    | "refineDate"
    | "refineArray"
    | "refineTuple"
    | "refineObject"
    | "refineUnion"
  >
>;
export type RefineSlotsAreConst = Assert<
  Equals<(typeof REFINE_METHOD_SLOTS)["refineDate"], "date">
>;

// ---- THE JSON SCHEMA CASE: type: ["string", "number"] on one linear chain ---
// `mixed` is string | number. The union slot admits it; refineString then makes
// the string keywords reachable and refineNumber then makes the number ones
// reachable. `.min()` resolves to stringMin in the first and numberMin in the
// second even though both plugins publish the method name "min".
accountBuilder.v("mixed", (b) =>
  b.union.required().refineString().min(2).refineNumber().min(0)
);

// The value type does NOT move, which is what makes the second refine legal.
accountBuilder.v("mixed", (b) =>
  b.union
    .required()
    .refineString()
    .transform((value) => {
      const stillTheUnion: string | number = value;
      return stillTheUnion;
    })
);

// ---- refine is available on every chain, exactly as in 1.x -----------------
accountBuilder.v("name", (b) =>
  b.string.required().min(1).refineUnion().required()
);

/**
 * All EIGHT members reached through a real call, so deleting one from the
 * family is a call-site failure and not only a registry failure.
 */
export const refineFamilyIsReachable = [
  accountBuilder.v("name", (b) => b.string.required().refineString()),
  accountBuilder.v("age", (b) => b.number.required().refineNumber()),
  accountBuilder.v("flag", (b) => b.boolean.required().refineBoolean()),
  accountBuilder.v("when", (b) => b.date.required().refineDate()),
  accountBuilder.v("tags", (b) => b.array.required().refineArray()),
  accountBuilder.v("tags", (b) => b.array.required().refineTuple()),
  accountBuilder.v("address", (b) => b.object.required().refineObject()),
  accountBuilder.v("mixed", (b) => b.union.required().refineUnion()),
];

// ---- NEW SAFETY: a refine the field type cannot reach is a hard error -------
accountBuilder.v("name", (b) =>
  // @ts-expect-error a string field has no Date shape, so refineDate is a SlotTypeMismatch
  b.string.required().refineDate()
);
accountBuilder.v("age", (b) =>
  // @ts-expect-error a number field has no object shape
  b.number.required().refineObject()
);
accountBuilder.v("mixed", (b) =>
  // @ts-expect-error `string | number` cannot be refined to an array
  b.union.required().refineArray()
);

// ---- the refined chain really is the OTHER slot's method set ----------------
accountBuilder.v("mixed", (b) =>
  // @ts-expect-error numberMin takes a number; after refineNumber "min" is numberMin
  b.union.required().refineNumber().min("two")
);
accountBuilder.v("mixed", (b) =>
  // @ts-expect-error `truthy` is a string-slot plugin and is gone after refineNumber
  b.union.required().refineString().truthy().refineNumber().truthy()
);

// ---- presence state survives a refine --------------------------------------
accountBuilder.v("mixed", (b) =>
  b.union
    .required()
    .refineString()
    .transform((value) => {
      // undefined was excluded before the refine and must still be excluded after
      const present: string | number = value;
      return present;
    })
);
accountBuilder.v("nick", (b) =>
  b.string
    .optional()
    .refineUnion()
    .transform((value) => {
      // @ts-expect-error optional() ran before the refine, so undefined is still here
      const present: string = value;
      return present;
    })
);
