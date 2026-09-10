// ===========================================================================
// The type check a slot injects, and the regression it closes.
//
// 1.x prepended a type validator when a field entered `b.string` / `b.number`
// / etc., and the whole plugin catalog was written around it: a value rule
// answers PASS for a value outside its own type, because reporting the type
// mismatch belongs to the slot and duplicating it would produce two issues for
// one bad value. The record of the previous major marks that guard
// **must-preserve** (docs/legacy-spec/plugin-catalog-core.md, "Built-in type
// guards"; docs/legacy-spec/anti-patterns.md, "A plugin passes through a value
// outside its own type").
//
// The rewrite dropped the guard and kept the convention, so every slot began
// life with an empty rule list and nothing ever judged the type. A number
// field handed the string "abc" reported nothing at all.
//
// These tests pin both halves: the guard rejects the wrong type, and it still
// defers null and undefined to the presence rules rather than deciding them.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import { requiredPlugin } from "../../../src/plugins/required";
import { optionalPlugin } from "../../../src/plugins/optional";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../src/plugins/string-min";

type Model = {
  name: string;
  age: number;
  flag: boolean;
  when: Date;
  tags: string[];
  meta: Record<string, unknown>;
};

/** The codes reported for `value` at `path`, in order. */
function codesFor(
  validator: {
    validate(input: unknown): {
      valid: boolean;
      issues: readonly { code: string }[];
    };
  },
  input: unknown
): readonly string[] {
  const result = validator.validate(input);
  return result.issues.map((issue) => issue.code);
}

describe("the type check a slot injects", () => {
  it("rejects a value outside the slot's type, under `<slot>Type`", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(numberMinPlugin)
      .for<Model>()
      .v("age", (b) => b.number.required().min(18))
      .build();

    // Before the fix every one of these was reported as valid: numberMin
    // answers PASS for a non-number, and nothing else looked.
    expect(codesFor(validator, { age: "abc" })).toEqual(["numberType"]);
    expect(codesFor(validator, { age: "31" })).toEqual(["numberType"]);
    expect(codesFor(validator, { age: {} })).toEqual(["numberType"]);
    expect(codesFor(validator, { age: true })).toEqual(["numberType"]);
    expect(codesFor(validator, { age: [] })).toEqual(["numberType"]);
  });

  it("reports the type once, not once per value rule", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(numberMinPlugin)
      .for<Model>()
      .v("age", (b) => b.number.required().min(18))
      .build();

    // "one invalid value, one issue" is the reason value rules pass a
    // wrong-typed value through. Two issues here would mean a rule started
    // re-deciding the type.
    expect(
      validator.validate(
        { age: "abc" },
        { abortEarly: false, abortEarlyOnEachField: false }
      ).issues
    ).toHaveLength(1);
  });

  it("gives each slot its own code", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<Model>()
      .v("name", (b) => b.string.required())
      .v("flag", (b) => b.boolean.required())
      .v("when", (b) => b.date.required())
      .v("tags", (b) => b.array.required())
      .v("meta", (b) => b.object.required())
      .build();

    const wrong = {
      name: 1,
      flag: "yes",
      when: "2020-01-01",
      tags: {},
      meta: [],
    };
    expect(
      validator
        .validate(wrong, { abortEarly: false, abortEarlyOnEachField: false })
        .issues.map((issue) => `${issue.path}:${issue.code}`)
        .sort()
    ).toEqual([
      "flag:booleanType",
      "meta:objectType",
      "name:stringType",
      "tags:arrayType",
      "when:dateType",
    ]);
  });

  it("accepts a value of the slot's type", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<Model>()
      .v("name", (b) => b.string.required().min(2))
      .build();

    expect(validator.validate({ name: "ada" }).valid).toBe(true);
  });

  it("leaves undefined to the presence rules", () => {
    const required = Builder()
      .use(requiredPlugin)
      .for<Model>()
      .v("age", (b) => b.number.required())
      .build();
    const optional = Builder()
      .use(optionalPlugin)
      .for<Model>()
      .v("age", (b) => b.number.optional())
      .build();

    // The guard must not answer for absence; `required` owns it.
    expect(codesFor(required, {})).toEqual(["required"]);
    expect(optional.validate({}).valid).toBe(true);
  });

  it("leaves null to the presence rules", () => {
    const required = Builder()
      .use(requiredPlugin)
      .for<Model>()
      .v("age", (b) => b.number.required())
      .build();
    const nullable = Builder()
      .use(nullablePlugin)
      .for<Model>()
      .v("age", (b) => b.number.nullable())
      .build();

    expect(codesFor(required, { age: null })).toEqual(["required"]);
    expect(nullable.validate({ age: null }).valid).toBe(true);
  });

  it("treats NaN as a number, leaving its rejection to the value rules", () => {
    // 1.x's guard also rejected NaN, which the record of that major flags as
    // contradicting `required`'s documented NaN allowance. The guard answers
    // the type question only: `typeof NaN === "number"`, so it passes here and
    // `min` rejects it on the value.
    const bare = Builder()
      .use(requiredPlugin)
      .for<Model>()
      .v("age", (b) => b.number.required())
      .build();
    const withMin = Builder()
      .use(requiredPlugin)
      .use(numberMinPlugin)
      .for<Model>()
      .v("age", (b) => b.number.required().min(18))
      .build();

    expect(bare.validate({ age: Number.NaN }).valid).toBe(true);
    expect(codesFor(withMin, { age: Number.NaN })).toEqual(["numberMin"]);
  });

  it("does not guard the slots that never had one", () => {
    // `any` accepts anything by definition; 1.x gave `tuple` and `union` no
    // automatic check either, and restoring a guard is not the place to invent
    // one.
    const validator = Builder()
      .use(requiredPlugin)
      .for<{ anything: unknown }>()
      .v("anything", (b) => b.any.required())
      .build();

    expect(validator.validate({ anything: "x" }).valid).toBe(true);
    expect(validator.validate({ anything: 1 }).valid).toBe(true);
  });
});
