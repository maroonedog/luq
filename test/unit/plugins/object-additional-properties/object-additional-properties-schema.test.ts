import { Builder } from "../../../../src/index";
import { objectAdditionalPropertiesSchemaPlugin } from "../../../../src/plugins/object-additional-properties";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";

type Bag = { readonly labels: Record<string, string> };

const validator = Builder()
  .use(objectAdditionalPropertiesSchemaPlugin)
  .use(probeMinCharsPlugin)
  .for<Bag>()
  .v("labels", (b) =>
    b.object.additionalPropertiesSchema((pb) => pb.string.minChars(3), ["env"])
  )
  .build();

describe("objectAdditionalPropertiesSchema", () => {
  it("leaves the listed keys alone", () => {
    expect(validator.validate({ labels: { env: "a" } }).valid).toBe(true);
  });

  // The sub-chain's subject is the VALUE behind an unlisted key, which is why
  // its marker is PropertyValueChain.
  it("applies the sub-chain to every unlisted key", () => {
    expect(
      validator.validate({ labels: { env: "a", tier: "abc" } }).valid
    ).toBe(true);
    const result = validator.validate({ labels: { env: "a", tier: "ab" } });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectAdditionalPropertiesSchema",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Unexpected properties: tier",
    ]);
  });

  it("passes a non-object through", () => {
    expect(validator.validate({ labels: 1 }).valid).toBe(true);
  });
});
