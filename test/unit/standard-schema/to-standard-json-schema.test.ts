import { Builder } from "../../../src/builder/field-builder.types";
import { arrayMinLengthPlugin } from "../../../src/plugins/array-min-length";
import { customPlugin } from "../../../src/plugins/custom";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { numberIntegerPlugin } from "../../../src/plugins/number-integer";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { optionalPlugin } from "../../../src/plugins/optional";
import { oneOfPlugin } from "../../../src/plugins/one-of";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringEmailPlugin } from "../../../src/plugins/string-email";
import { stringMaxPlugin } from "../../../src/plugins/string-max";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { fromJsonSchema } from "../../../src/json-schema/index";
import { jsonSchemaBagFixture } from "../json-schema/convert/json-schema-bag-fixture";
import {
  DeclarationsUnavailableError,
  toStandardJsonSchema,
  UnrepresentableRuleError,
  UnsupportedJsonSchemaTargetError,
} from "../../../src/standard-schema";

interface Employee {
  readonly name: string;
}

interface Model {
  readonly title: string;
  readonly email: string;
  readonly age: number;
  readonly note: string;
  readonly employees: readonly Employee[];
}

const built = Builder()
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

const emit = (target: string): Record<string, unknown> =>
  toStandardJsonSchema(built)["~standard"].jsonSchema.input({ target });

describe("what the emitted schema says", () => {
  it("gives every declared field its type and its keywords", () => {
    const properties = emit("draft-07")["properties"] as Record<
      string,
      Record<string, unknown>
    >;
    expect(properties["title"]).toEqual({
      type: "string",
      minLength: 3,
      maxLength: 50,
    });
    expect(properties["email"]).toEqual({ type: "string", format: "email" });
    expect(properties["age"]).toEqual({ type: "number", minimum: 0 });
  });

  it("puts required on the OBJECT that owns the key, not on the key", () => {
    const schema = emit("draft-07");
    expect(schema["required"]).toEqual(["title", "email", "age", "employees"]);
    // A field declaring `.optional()` does not join the required list.
    expect(schema["required"]).not.toContain("note");
  });

  it("turns an element path into items, and keeps that object's required", () => {
    const properties = emit("draft-07")["properties"] as Record<
      string,
      Record<string, unknown>
    >;
    expect(properties["employees"]).toEqual({
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: { name: { type: "string", minLength: 1 } },
        required: ["name"],
      },
    });
  });

  it("nests a dotted path under properties", () => {
    const nested = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ readonly owner: { readonly name: string } }>()
      .v("owner.name", (b) => b.string.required().min(1))
      .build();
    const schema = toStandardJsonSchema(nested)["~standard"].jsonSchema.input({
      target: "draft-07",
    });
    expect(schema["properties"]).toEqual({
      owner: {
        type: "object",
        properties: { name: { type: "string", minLength: 1 } },
        required: ["name"],
      },
    });
  });

  it("spells nullable as a type list, which is the JSON Schema vocabulary", () => {
    const nullableModel = Builder()
      .use(requiredPlugin)
      .use(nullablePlugin)
      .use(stringMinPlugin)
      .for<{ readonly note: string | null }>()
      .v("note", (b) => b.string.nullable().min(1))
      .build();
    const properties = toStandardJsonSchema(nullableModel)[
      "~standard"
    ].jsonSchema.input({ target: "draft-07" })["properties"] as Record<
      string,
      unknown
    >;
    expect(properties["note"]).toEqual({
      type: ["string", "null"],
      minLength: 1,
    });
  });

  it("writes integer as a type, and oneOf as enum", () => {
    const model = Builder()
      .use(requiredPlugin)
      .use(numberIntegerPlugin)
      .use(oneOfPlugin)
      .for<{ readonly count: number; readonly tone: string }>()
      .v("count", (b) => b.number.required().integer())
      .v("tone", (b) => b.string.required().oneOf(["light", "dark"]))
      .build();
    const properties = toStandardJsonSchema(model)[
      "~standard"
    ].jsonSchema.input({ target: "draft-07" })["properties"] as Record<
      string,
      unknown
    >;
    expect(properties["count"]).toEqual({ type: "integer" });
    expect(properties["tone"]).toEqual({
      type: "string",
      enum: ["light", "dark"],
    });
  });
});

describe("the target", () => {
  it("names the draft it was asked for", () => {
    expect(emit("draft-07")["$schema"]).toBe(
      "http://json-schema.org/draft-07/schema#"
    );
    expect(emit("draft-2020-12")["$schema"]).toBe(
      "https://json-schema.org/draft/2020-12/schema"
    );
  });

  it("refuses a target it does not support instead of guessing", () => {
    // The spec says to throw on an unsupported target. Returning draft-07
    // quietly hands the caller a document they read under the wrong rules.
    expect(() => emit("openapi-3.0")).toThrow(UnsupportedJsonSchemaTargetError);
    expect(() => emit("draft-4")).toThrow(UnsupportedJsonSchemaTargetError);
  });

  it("checks the target before the declarations, so a typo is not masked", () => {
    // Even for a validator carrying no declarations, the wrong target is
    // reported first. The other order refuses with "no declarations" and the
    // misspelling goes unnoticed.
    const fromSchema = fromJsonSchema(jsonSchemaBagFixture, {
      type: "object",
      properties: { a: { type: "string" } },
    });
    expect(() =>
      toStandardJsonSchema(fromSchema)["~standard"].jsonSchema.input({
        target: "nonsense",
      })
    ).toThrow(UnsupportedJsonSchemaTargetError);
  });
});

describe("declarations JSON Schema cannot express", () => {
  const withCustom = Builder()
    .use(requiredPlugin)
    .use(customPlugin)
    .for<{ readonly code: string }>()
    .v("code", (b) =>
      b.string.required().custom((value) => value !== "forbidden")
    )
    .build();

  it("throws by default, naming the field and the plugin", () => {
    expect(() =>
      toStandardJsonSchema(withCustom)["~standard"].jsonSchema.input({
        target: "draft-07",
      })
    ).toThrow(UnrepresentableRuleError);
    expect(() =>
      toStandardJsonSchema(withCustom)["~standard"].jsonSchema.input({
        target: "draft-07",
      })
    ).toThrow(/"code".*custom/s);
  });

  it("drops it only when the caller asked for that in libraryOptions", () => {
    const schema = toStandardJsonSchema(withCustom)[
      "~standard"
    ].jsonSchema.input({
      target: "draft-07",
      libraryOptions: { unrepresentable: "omit" },
    });
    expect((schema["properties"] as Record<string, unknown>)["code"]).toEqual({
      type: "string",
    });
  });

  it("treats an unknown libraryOptions value as the strict side", () => {
    // A misspelled "omitt" falling quietly to the lax side is an incident.
    expect(() =>
      toStandardJsonSchema(withCustom)["~standard"].jsonSchema.input({
        target: "draft-07",
        libraryOptions: { unrepresentable: "omitt" },
      })
    ).toThrow(UnrepresentableRuleError);
  });

  it("says so when the validator carries no declarations at all", () => {
    // A validator built from a document assembles rules directly and goes
    // through no chain, so it carries no declarations. An empty schema would
    // read as "no constraints", so this says "not known" instead — and says it
    // even when omit was asked for: what would be omitted is unknown too.
    const fromSchema = fromJsonSchema(jsonSchemaBagFixture, {
      type: "object",
      properties: { a: { type: "string", minLength: 2 } },
    });
    expect(() =>
      toStandardJsonSchema(fromSchema)["~standard"].jsonSchema.input({
        target: "draft-07",
        libraryOptions: { unrepresentable: "omit" },
      })
    ).toThrow(DeclarationsUnavailableError);
  });
});

describe("it is still a Standard Schema", () => {
  it("keeps validate, version and vendor beside jsonSchema", () => {
    const standard = toStandardJsonSchema(built)["~standard"];
    expect(standard.version).toBe(1);
    expect(standard.vendor).toBe("luq");
    expect(typeof standard.jsonSchema.input).toBe("function");
    expect(typeof standard.jsonSchema.output).toBe("function");
    const outcome = standard.validate({
      title: "ab",
      email: "no",
      age: 1,
      note: undefined,
      employees: [{ name: "Ada" }],
    });
    expect(outcome.issues?.length).toBeGreaterThan(0);
  });

  it("keeps the validator's own members", () => {
    const schema = toStandardJsonSchema(built);
    expect(schema.validate({ title: "abc" }).valid).toBe(false);
    expect(schema.pick("title").path).toBe("title");
  });
});
