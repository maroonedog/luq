import { Builder } from "../../../../src/index";
import { objectMaxPropertiesPlugin } from "../../../../src/plugins/object-max-properties";

type Bag = { readonly config: Record<string, unknown> };

const validator = Builder()
  .use(objectMaxPropertiesPlugin)
  .for<Bag>()
  .v("config", (b) => b.object.maxProperties(2))
  .build();

describe("objectMaxProperties", () => {
  it("accepts at the bound and below it", () => {
    expect(validator.validate({ config: { a: 1, b: 2 } }).valid).toBe(true);
    expect(validator.validate({ config: {} }).valid).toBe(true);
  });

  it("rejects above it with the legacy message", () => {
    const result = validator.validate({ config: { a: 1, b: 2, c: 3 } });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectMaxProperties",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Must have at most 2 properties, but has 3",
    ]);
  });

  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator
        .validate({ config: [1, 2, 3, 4] })
        .issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });
});
