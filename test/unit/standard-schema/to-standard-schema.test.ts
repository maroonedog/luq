import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { toStandardSchema } from "../../../src/standard-schema/to-standard-schema";

type Account = {
  name: string;
  age: number;
};

type Order = {
  items: { sku: string }[];
};

function buildAccountSchema() {
  return toStandardSchema(
    Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<Account>()
      .v("name", (b) => b.string.required().min(3))
      .v("age", (b) => b.number.required().min(18))
      .build()
  );
}

describe("toStandardSchema", () => {
  it("carries every prop the spec asks for", () => {
    const schema = buildAccountSchema();
    expect(schema["~standard"].version).toBe(1);
    expect(schema["~standard"].vendor).toBe("luq");
    expect(typeof schema["~standard"].validate).toBe("function");
  });

  it("keeps the original validator's members", () => {
    // The promise that neither face has to be given up for the other.
    const schema = buildAccountSchema();
    for (const member of ["validate", "parse", "pick", "pickAll"] as const) {
      expect(typeof schema[member]).toBe("function");
    }
  });

  it("parses through the original validator, options and all", () => {
    // Having the member is not the same as it working. This one is reached
    // only by calling it: a copy that forwarded to the wrong validator, or
    // dropped the options, would still answer `typeof === "function"`.
    const schema = buildAccountSchema();
    const accepted = schema.parse({ name: "John", age: 25 });
    expect(accepted.valid).toBe(true);
    expect(accepted.valid && accepted.data).toEqual({ name: "John", age: 25 });
    const refused = schema.parse({ name: "Jo", age: 3 }, { abortEarly: false });
    expect(refused.valid).toBe(false);
    expect(refused.issues.map((issue) => issue.path)).toEqual(["name", "age"]);
  });

  it("picks a subset through the original validator", () => {
    // pickAll pre-resolves the paths it was handed, so the subset it answers
    // with has to be the one the underlying validator made, not a new shape.
    const subset = buildAccountSchema().pickAll(["age"]);
    expect(subset.paths).toEqual(["age"]);
    // A short name is outside the subset, so it is not what is judged here.
    expect(subset.validate({ name: "Jo", age: 25 }).valid).toBe(true);
    // A refusal has to be the age bound and nothing else: "not valid" on its
    // own would also be the answer if the subset had judged the whole object.
    const refused = subset.validate({ name: "John", age: 3 });
    expect(refused.valid).toBe(false);
    expect(refused.issues.map((issue) => issue.path)).toEqual(["age"]);
  });

  it("answers { value } for a valid value", () => {
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "John",
      age: 25,
    });
    expect(outcome).toEqual({ value: { name: "John", age: 25 } });
  });

  it("carries no issues on success", () => {
    // The spec's success result has issues?: undefined, and consumers branch
    // on whether issues is there.
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "John",
      age: 25,
    });
    expect("issues" in outcome && outcome.issues !== undefined).toBe(false);
  });

  it("answers issues and no value for an invalid one", () => {
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "Jo",
      age: 25,
    });
    expect("value" in outcome).toBe(false);
    if ("issues" in outcome && outcome.issues !== undefined) {
      expect(outcome.issues.length).toBeGreaterThan(0);
    }
  });

  it("opens the path into a list", () => {
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "Jo",
      age: 25,
    });
    if (!("issues" in outcome) || outcome.issues === undefined) {
      throw new Error("no issues came back");
    }
    expect(outcome.issues[0]?.path).toEqual(["name"]);
  });

  it("carries a message", () => {
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "Jo",
      age: 25,
    });
    if (!("issues" in outcome) || outcome.issues === undefined) {
      throw new Error("no issues came back");
    }
    expect(typeof outcome.issues[0]?.message).toBe("string");
    expect(outcome.issues[0]?.message.length).toBeGreaterThan(0);
  });

  it("returns every field's violation, leaving abortEarly off", () => {
    // The library default stops at the first field, but a form consumes this
    // entry point, and one issue at a time means "fix it, get the next".
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "Jo",
      age: 3,
    });
    if (!("issues" in outcome) || outcome.issues === undefined) {
      throw new Error("no issues came back");
    }
    const paths = outcome.issues.map((issue) => JSON.stringify(issue.path));
    expect(paths).toContain(JSON.stringify(["name"]));
    expect(paths).toContain(JSON.stringify(["age"]));
  });

  it("gives an array element's path the real index, as a number", () => {
    const schema = toStandardSchema(
      Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Order>()
        .v("items[*].sku", (b) => b.string.required().min(5))
        .build()
    );
    const outcome = schema["~standard"].validate({
      items: [{ sku: "PROD-1" }, { sku: "X" }],
    });
    if (!("issues" in outcome) || outcome.issues === undefined) {
      throw new Error("no issues came back");
    }
    expect(outcome.issues.map((issue) => issue.path)).toContainEqual([
      "items",
      1,
      "sku",
    ]);
  });

  it("returns the value after transforms, meaning it calls parse", () => {
    // Back on validate(), transforms silently stop happening.
    const schema = toStandardSchema(
      Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string.required().transform((value) => value.trim())
        )
        .build()
    );
    const outcome = schema["~standard"].validate({ name: "  John  " });
    expect(outcome).toEqual({ value: { name: "John" } });
  });

  it("does not modify the input object", () => {
    const input = { name: "  John  " };
    const snapshot = JSON.stringify(input);
    const schema = toStandardSchema(
      Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string.required().transform((value) => value.trim())
        )
        .build()
    );
    schema["~standard"].validate(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("has no types at run time, it being a type-carrying member only", () => {
    const schema = buildAccountSchema();
    expect(schema["~standard"].types).toBeUndefined();
  });
});
