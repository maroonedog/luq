// ===========================================================================
// Reads an emitted schema back in and checks the same values get the same
// verdicts.
//
// The unit tests confirm that a given keyword is emitted, which only says the
// spelling matches what was expected. Spelled right but meaning something
// else, a recipient judges differently. The reading direction already passes
// the conformance suite, so using it as a mirror is what checks the MEANING of
// what was written.
//
// Only the valid/invalid verdict is compared. Messages are a different thing
// and have no reason to match.
// ===========================================================================
import { fromJsonSchema } from "../../src/json-schema/index";
import { Builder } from "../../src/builder/field-builder.types";
import { arrayMinLengthPlugin } from "../../src/plugins/array-min-length";
import { numberMinPlugin } from "../../src/plugins/number-min";
import { optionalPlugin } from "../../src/plugins/optional";
import { requiredPlugin } from "../../src/plugins/required";
import { stringEmailPlugin } from "../../src/plugins/string-email";
import { stringMaxPlugin } from "../../src/plugins/string-max";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { toStandardJsonSchema } from "../../src/standard-schema";
import { jsonSchemaBagFixture } from "../unit/json-schema/convert/json-schema-bag-fixture";

interface Employee {
  readonly name: string;
}

interface Model {
  readonly title: string;
  readonly email: string;
  readonly age: number;
  readonly note?: string;
  readonly employees: readonly Employee[];
}

const declared = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(stringMinPlugin)
  .use(stringMaxPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .use(arrayMinLengthPlugin)
  .for<Model>()
  .v("title", (b) => b.string.required().min(3).max(50))
  .v("email", (b) => b.string.required().email())
  .v("age", (b) => b.number.required().min(0))
  .v("note", (b) => b.string.optional())
  .v("employees", (b) => b.array.required().minLength(1))
  .v("employees[*].name", (b) => b.string.required().min(1))
  .build();

const emitted = toStandardJsonSchema(declared)["~standard"].jsonSchema.input({
  target: "draft-07",
});
const readBack = fromJsonSchema<Model>(jsonSchemaBagFixture, emitted);

const valid = {
  title: "Report",
  email: "ada@example.com",
  age: 36,
  employees: [{ name: "Ada" }],
};

/** Values broken one at a time. Each name says which keyword it exercises. */
const broken: readonly (readonly [string, unknown])[] = [
  ["title too short", { ...valid, title: "ab" }],
  ["title too long", { ...valid, title: "a".repeat(51) }],
  ["title missing", { ...valid, title: undefined }],
  ["email in the wrong format", { ...valid, email: "not-an-email" }],
  ["age below the minimum", { ...valid, age: -1 }],
  ["employees empty", { ...valid, employees: [] }],
  ["an element's name empty", { ...valid, employees: [{ name: "" }] }],
  ["an element's name missing", { ...valid, employees: [{}] }],
];

describe("emitted schema, read back", () => {
  it("accepts what the declared validator accepts", () => {
    expect(declared.validate(valid).valid).toBe(true);
    expect(readBack.validate(valid).valid).toBe(true);
  });

  it("rejects the same values the declared validator rejects", () => {
    for (const [label, value] of broken) {
      expect({
        [label]: declared.validate(value).valid,
      }).toEqual({ [label]: false });
      expect({
        [label]: readBack.validate(value).valid,
      }).toEqual({ [label]: false });
    }
  });

  it("agrees that an absent optional field is fine", () => {
    // note is `.optional()`, so it is not in the required list. Were it
    // there, only the read-back side would reject.
    const withoutNote = { ...valid };
    expect(declared.validate(withoutNote).valid).toBe(true);
    expect(readBack.validate(withoutNote).valid).toBe(true);
  });

  it("emits a schema the reader accepts as a schema at all", () => {
    // The reading direction throws at build time on a keyword it does not
    // know. Getting this far means the emitted vocabulary is inside its own.
    expect(emitted["$schema"]).toBe("http://json-schema.org/draft-07/schema#");
  });
});
