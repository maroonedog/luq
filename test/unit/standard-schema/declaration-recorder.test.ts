// ===========================================================================
// The WeakMap that holds what a chain declared, seen through the schema it
// lets Luq emit. The record adds no member to anything, so there is nothing to
// read off a validator directly — what it kept only becomes visible as
// keywords in an emitted JSON Schema.
//
// The step under test is the one that declares nothing of its own: a refine*
// method moves the chain to another slot and appends no call. It still has to
// carry the record across, because the calls made BEFORE it are the ones that
// would otherwise disappear — and a keyword missing from an emitted schema is
// a constraint the receiver never learns about.
//
// The chains here start on the union slot, which is what admits a field typed
// `string | number` and leaves both refinements reachable. Emitting is asked
// for with `unrepresentable: "omit"` because such a chain settles on no single
// JSON type and the strict policy refuses it outright; the keywords are what
// is under test, not the type.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import type { Validator } from "../../../src/builder/validator.types";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { toStandardJsonSchema } from "../../../src/standard-schema";

/** A field that both the string and the number refinement can address. */
interface Mixed {
  readonly value: string | number;
}

const mixedBuilder = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .for<Mixed>();

/** The whole emitted schema, with unwritable declarations dropped. */
function wholeSchema(validator: Validator<Mixed>): Record<string, unknown> {
  return toStandardJsonSchema(validator)["~standard"].jsonSchema.input({
    target: "draft-07",
    libraryOptions: { unrepresentable: "omit" },
  });
}

/** Just the one field's schema out of that. */
function fieldSchema(validator: Validator<Mixed>): unknown {
  return (wholeSchema(validator)["properties"] as Record<string, unknown>)[
    "value"
  ];
}

describe("the standard-schema declaration recorder across a refine step", () => {
  const refinedLate = mixedBuilder
    .v("value", (b) =>
      b.union.required().refineString().min(3).refineNumber().min(10)
    )
    .build();

  it("keeps the calls made before a refine alongside those made after", () => {
    // Lose the carry-across and `minLength` is what vanishes: the emitted
    // schema would promise only the number bound, so a one-character string
    // would read as acceptable while the validator rejects it.
    expect(fieldSchema(refinedLate)).toEqual({ minLength: 3, minimum: 10 });
  });

  it("keeps required across a refine, so the parent still lists the key", () => {
    // Whether the owning object lists the key is read from the same record.
    // That is why the carry-across cannot be narrowed to keywords alone.
    expect(wholeSchema(refinedLate)["required"]).toEqual(["value"]);
  });

  it("has nothing to carry when the refine comes before any declaration", () => {
    // A refine on a chain that has declared nothing has no record to copy, so
    // the calls that FOLLOW it are the whole record — and all of them, which
    // is why the whole document is pinned here rather than the field alone.
    // The field reads as a plain number, carrying no string keyword it never
    // declared, and the `.required()` that came after the refine still puts
    // the key in the owning object's required list.
    const refinedFirst = mixedBuilder
      .v("value", (b) => b.union.refineNumber().required().min(10))
      .build();
    expect(wholeSchema(refinedFirst)).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: { value: { type: "number", minimum: 10 } },
      required: ["value"],
    });
  });
});
