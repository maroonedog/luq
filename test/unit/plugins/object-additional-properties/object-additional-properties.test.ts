import { Builder } from "../../../../src/index";
import { objectAdditionalPropertiesPlugin } from "../../../../src/plugins/object-additional-properties";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";

type Bag = { readonly user: { readonly name: string; readonly nick: string } };

// The known key set is DERIVED from the sibling declarations below, which is
// the legacy design defect this closes: legacy made the caller retype the key
// list in options.allowedProperties.
const derived = Builder()
  .use(objectAdditionalPropertiesPlugin)
  .use(probeMinCharsPlugin)
  .for<Bag>()
  .v("user", (b) => b.object.additionalProperties(false))
  .v("user.name", (b) => b.string.minChars(1))
  .v("user.nick", (b) => b.string.minChars(1))
  .build();

describe("objectAdditionalProperties", () => {
  it("accepts an object holding only the declared keys", () => {
    expect(derived.validate({ user: { name: "a", nick: "b" } }).valid).toBe(
      true
    );
  });

  it("rejects a key no sibling declaration named", () => {
    const result = derived.validate({
      user: { name: "a", nick: "b", extra: 1 },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectAdditionalProperties",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Unexpected properties: extra",
    ]);
  });

  it("allows anything when the flag is true", () => {
    const permissive = Builder()
      .use(objectAdditionalPropertiesPlugin)
      .for<Bag>()
      .v("user", (b) => b.object.additionalProperties(true))
      .build();
    expect(permissive.validate({ user: { anything: 1 } }).valid).toBe(true);
  });

  it("lets an explicit key list win over the derived one", () => {
    const explicit = Builder()
      .use(objectAdditionalPropertiesPlugin)
      .use(probeMinCharsPlugin)
      .for<Bag>()
      .v("user", (b) => b.object.additionalProperties(false, ["name"]))
      .v("user.nick", (b) => b.string.minChars(1))
      .build();
    expect(explicit.validate({ user: { name: "a" } }).valid).toBe(true);
    expect(explicit.validate({ user: { name: "a", nick: "b" } }).valid).toBe(
      false
    );
  });

  it("passes a non-object through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      derived.validate({ user: "a" }).issues.map((issue) => issue.code)
    ).toEqual(["objectType"]);
  });
});
