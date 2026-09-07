// ===========================================================================
// test/type/plugins/composition-plugins.type-test.ts
// oneOfSchema / oneOf / conditionalSchema, all at the CALL site. The
// conditionalSchema block is the direct regression test for the ElementChain
// defect: declared with ElementChain, all four of those calls fail with
//   Property 'min' does not exist on type 'SlotTypeMismatch<"string", never>'.
// ===========================================================================
import { ab } from "../../support/object-fixtures";

// ==================== oneOfSchema (call site) ==============================
ab.v("plan", (b) =>
  b.string
    .required()
    .oneOfSchema([(sb) => sb.string.min(3), (sb) => sb.string.min(8)])
);
ab.v("labels", (b) =>
  b.object.required().oneOfSchema([(sb) => sb.object.required()])
);
ab.v("plan", (b) =>
  b.string.required().oneOfSchema([
    // @ts-expect-error an alternative constrains the same string, not a number
    (sb) => sb.number.min(3),
  ])
);
// @ts-expect-error oneOfSchema takes a LIST of alternatives, not one chain
ab.v("plan", (b) => b.string.required().oneOfSchema((sb) => sb.string.min(3)));

// ==================== oneOf, the legacy value enum (call site) =============
ab.v("plan", (b) => b.string.required().oneOf(["free", "pro", "team"]));
// @ts-expect-error the allowed values follow the field type: 42 is not a string
ab.v("plan", (b) => b.string.required().oneOf(["free", 42]));

// ==================== conditionalSchema (call site) ========================
// THE REGRESSION TEST for the ElementChain defect. Declared with ElementChain
// every one of these four calls fails with
//   Property 'min' does not exist on type 'SlotTypeMismatch<"string", never>'.
ab.v("plan", (b) =>
  b.string.required().conditionalSchema(
    (sb) => sb.string.min(3),
    (sb) => sb.string.min(8),
    (sb) => sb.string.min(1)
  )
);
ab.v("labels", (b) =>
  b.object.required().conditionalSchema(
    (sb) => sb.object.required(),
    (sb) => sb.object.propertyNames((kb) => kb.string.min(1))
  )
);
// `then` and `otherwise` really are optional (marker + undefined, the A-4 case).
ab.v("plan", (b) =>
  b.string.required().conditionalSchema((sb) => sb.string.min(3))
);
ab.v("plan", (b) =>
  b.string.required().conditionalSchema(
    (sb) => sb.string.min(3),
    // @ts-expect-error the `then` chain sees the same string, not a number
    (sb) => sb.number.min(3)
  )
);

// The builder still terminates: none of the above returned an error object.
export const accountValidator = ab.build();
