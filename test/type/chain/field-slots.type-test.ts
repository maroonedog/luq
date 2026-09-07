import { Builder } from "../../../src/builder/field-builder.types";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";
import { compareFieldPlugin } from "../../../src/plugins/compare-field";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { arrayContainsPlugin } from "../../../src/plugins/array-contains";
import { objectRecursivelyPlugin } from "../../../src/plugins/object-recursively";
import { unionGuardPlugin } from "../../../src/plugins/union-guard";
import { conditionalSchemaPlugin } from "../../../src/plugins/conditional-schema";
import { tupleBuilderPlugin } from "../../../src/plugins/tuple-builder";
import { stitchPlugin } from "../../../src/plugins/stitch";
import { validateIfPlugin } from "../../../src/plugins/validate-if";
import { compareToRootPlugin } from "../../support/probe-marker-plugins";
import type { MarkerResolutionProof } from "../../../src/chain/marker-coverage.types";
import { isCat, isDog } from "../../support/model";
import type { User } from "../../support/model";

/** Instantiating this runs all four marker exhaustiveness assertions. */
export type MarkersAreCovered = MarkerResolutionProof;

const b0 = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(nullablePlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(transformPlugin)
  .use(arrayContainsPlugin)
  .use(unionGuardPlugin)
  .use(compareFieldPlugin)
  .use(tupleBuilderPlugin)
  .use(conditionalSchemaPlugin)
  .use(objectRecursivelyPlugin)
  .use(validateIfPlugin)
  .use(compareToRootPlugin)
  .use(stitchPlugin)
  .for<User>();

// ===========================================================================
// POSITIVE: the shapes the README promises must compile.
// ===========================================================================
export const simpleValidator = b0
  .v("name", (b) => b.string.required().min(3))
  .build();

b0.v("user.address.street", (b) => b.string.required().min(1));
b0.v("items[*].name", (b) => b.string.required().min(2));
b0.v("matrix[*][*]", (b) => b.number.required().min(0));
b0.v("when", (b) => b.date.required());
b0.v("age", (b) =>
  b.number
    .required()
    .min(0)
    .validateIf((root) => root.name.length > 0)
);
b0.v("age", (b) => b.number.required().compareToRoot((root) => root.age));
b0.v("name", (b) =>
  b.string
    .required()
    .stitch(["user.address.street", "nick"], (fieldValues) => ({
      valid: fieldValues["nick"] !== undefined,
    }))
);

// element chain, with the concrete bag preserved
b0.v("tags", (b) => b.array.contains((eb) => eb.string.min(2)));
b0.v("tags", (b) =>
  b.array.contains((eb) => eb.string.min(2), { min: 1, max: 4 })
);
b0.v("items", (b) => b.array.contains((eb) => eb.object.required()));

// tuple builder: an ARRAY of element chains plus an optional rest
b0.v("scores", (b) =>
  b.tuple.builder([(eb) => eb.number.min(0), (eb) => eb.number.min(1)], (eb) =>
    eb.number.min(2)
  )
);
b0.v("scores", (b) => b.tuple.builder([(eb) => eb.number.min(0)]));

// optional marker arguments
b0.v("user", (b) =>
  b.object.conditionalSchema(
    (eb) => eb.object.required(),
    (eb) => eb.object.required()
  )
);
b0.v("user", (b) => b.object.conditionalSchema((eb) => eb.object.required()));
b0.v("user", (b) => b.object.recursively("self", { maxDepth: 4 }));

// transform after a presence shift: `value` is narrowed
b0.v("nick", (b) =>
  b.string.required().transform((value) => {
    const present: string = value;
    return present.toUpperCase();
  })
);

// nullable widens the value type
b0.v("name", (b) =>
  b.string
    .required()
    .nullable()
    .transform((value) => (value === null ? "" : value))
);

// union guards, exhaustive
export const guardedValidator = b0
  .v("pet", (b) =>
    b.union
      .required()
      .guard(isCat, (gb) => gb.object.required())
      .guard(isDog, (gb) => gb.object.required())
  )
  .build();

// a chain that declares no guard at all is never checked
b0.v("pet", (b) => b.union.required()).build();

// ===========================================================================
// NEGATIVE: each of these MUST fail.
// ===========================================================================

// 1. a field path that does not exist
// @ts-expect-error "nope" is not a FieldPath<User>
b0.v("nope", (b) => b.string.required());

// 2. "items.name" -- the [*] was forgotten
// @ts-expect-error array members are never enumerated; use items[*].name
b0.v("items.name", (b) => b.string.required());

// 3. "when.getTime" -- a Date method is not a field
// @ts-expect-error Date is opaque; its members are implementation, not data
b0.v("when.getTime", (b) => b.any.required());

// 3b. an array prototype member is not a field either
// @ts-expect-error tags.length is not a data path
b0.v("tags.length", (b) => b.number.required());

// 3c. an indexed literal is not the wildcard
// @ts-expect-error items[0].name is not the L1 grammar
b0.v("items[0].name", (b) => b.string.required());

// 4. a method that does not exist inside an element chain
b0.v("tags", (b) =>
  b.array.contains((eb) =>
    // @ts-expect-error completelyMadeUpMethod is not on the string chain
    eb.string.completelyMadeUpMethod(1, 2, 3)
  )
);

// 4b. wrong arity inside an element chain
b0.v("scores", (b) =>
  b.array.contains((eb) =>
    // @ts-expect-error numberMin takes one number, not three strings
    eb.number.min("wrong", "arity", "abuse")
  )
);

// 4c. a slot unrelated to the ELEMENT type inside an element chain
b0.v("tags", (b) =>
  b.array.contains((eb) =>
    // @ts-expect-error a string element cannot be validated through b.number
    eb.number.min(1)
  )
);

// 4d. the same, inside a tuple-builder position
b0.v("scores", (b) =>
  b.tuple.builder([
    (eb) =>
      // @ts-expect-error a number element cannot be validated through b.string
      eb.string.min(1),
  ])
);

// 5. a slot unrelated to the field type
// @ts-expect-error age is a number; the string slot does not accept it
b0.v("age", (b) => b.string.required());

// 5b. and the other direction
// @ts-expect-error name is a string; the number slot does not accept it
b0.v("name", (b) => b.number.required());

// 6. after .optional(), the transform argument still contains undefined
b0.v("nick", (b) =>
  b.string.optional().transform((value) => {
    // @ts-expect-error value is string | undefined here
    const present: string = value;
    return present;
  })
);

// 6b. after .nullable(), it contains null
b0.v("name", (b) =>
  b.string
    .required()
    .nullable()
    .transform((value) => {
      // @ts-expect-error value is string | null here
      const present: string = value;
      return present;
    })
);

// 7. a FieldRef argument is checked against FieldPath<TRoot>
b0.v("name", (b) => b.string.compareField("age"));
b0.v("name", (b) =>
  b.string.compareField("age", (value, target) => value !== target)
);
// @ts-expect-error "nope" is not a FieldPath<User>
b0.v("name", (b) => b.string.compareField("nope"));

// 8. union guard exhaustiveness
b0.v("pet", (b) =>
  b.union.required().guard(isCat, (gb) => gb.object.required())
)
  // @ts-expect-error Dog is still uncovered, so there is no .build() here
  .build();

b0.v("pet", (b) =>
  b.union.guard(isCat, (gb) => gb.object.required()).required()
)
  // @ts-expect-error Dog is still uncovered AFTER .required()
  .build();

b0.v("pet", (b) =>
  b.union.guard(isCat, (gb) =>
    // @ts-expect-error the guard sub-chain is typed for Cat, not for a string
    gb.string.min(1)
  )
)
  // @ts-expect-error Dog is uncovered here too
  .build();
