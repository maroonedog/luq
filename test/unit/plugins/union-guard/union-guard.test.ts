import { Builder } from "../../../../src/index";
import { unionGuardPlugin } from "../../../../src/plugins/union-guard";
import { objectMinPropertiesPlugin } from "../../../../src/plugins/object-min-properties";
import { isCat, isDog } from "../../../support/model";
import type { Pet } from "../../../support/model";

type Bag = { readonly pet: Pet };

const validator = Builder()
  .use(unionGuardPlugin)
  .use(objectMinPropertiesPlugin)
  .for<Bag>()
  .v("pet", (b) =>
    b.union
      .guard(isCat, (sb) => sb.object.minProperties(3))
      .guard(isDog, (sb) => sb.object.minProperties(1))
  )
  .build();

describe("unionGuard", () => {
  it("runs only the branch whose guard holds", () => {
    expect(
      validator.validate({ pet: { kind: "dog", breed: "corgi" } }).valid
    ).toBe(true);
    const result = validator.validate({ pet: { kind: "cat", lives: 9 } });
    expect(result.valid).toBe(false);
    // A composite is ONE rule, so the issue carries the composite's code.
    expect(result.issues.map((issue) => issue.code)).toEqual(["unionGuard"]);
  });

  it("passes a value no guard accepts", () => {
    expect(validator.validate({ pet: { kind: "fish" } }).valid).toBe(true);
  });

  it("accepts a cat that satisfies its own branch", () => {
    expect(
      validator.validate({ pet: { kind: "cat", lives: 9, name: "Tom" } }).valid
    ).toBe(true);
  });

  it("applies each branch's own bound, not one shared bound", () => {
    // The dog branch demands 1 property and the cat branch 3, so the same
    // two-key object passes as a dog and fails as a cat.
    expect(
      validator.validate({ pet: { kind: "dog", breed: "corgi" } }).valid
    ).toBe(true);
    expect(validator.validate({ pet: { kind: "cat", lives: 9 } }).valid).toBe(
      false
    );
    expect(
      validator
        .validate({ pet: { kind: "cat", lives: 9 } })
        .issues.map((issue) => issue.message)
    ).toEqual(["Value does not satisfy the guarded branch"]);
  });
});
