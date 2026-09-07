import { Builder } from "../../../../src/index";
import { objectPlugin } from "../../../../src/plugins/object";

type Bag = { readonly config: Record<string, unknown> };

const validator = Builder()
  .use(objectPlugin)
  .for<Bag>()
  .v("config", (b) => b.object.object())
  .build();

describe("object", () => {
  it("accepts a plain object", () => {
    expect(validator.validate({ config: {} }).valid).toBe(true);
    expect(validator.validate({ config: { a: 1 } }).valid).toBe(true);
  });

  it("rejects an array, which typeof calls an object", () => {
    const result = validator.validate({ config: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Value must be an object, but got array",
    ]);
  });

  it("rejects a primitive", () => {
    expect(validator.validate({ config: "x" }).valid).toBe(false);
    expect(validator.validate({ config: 1 }).valid).toBe(false);
  });

  // Legacy used "type_mismatch", the one snake_case code in the catalogue.
  it("uses the plugin name as its code", () => {
    expect(
      validator.validate({ config: 1 }).issues.map((issue) => issue.code)
    ).toEqual(["object"]);
  });

  // required / optional / nullable own absence: a check never sees undefined.
  it("leaves an absent value to the presence rules", () => {
    expect(validator.validate({}).valid).toBe(true);
    expect(validator.validate({ config: null }).valid).toBe(true);
  });
});
