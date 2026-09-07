import { Builder } from "../../../../src/index";
import { objectPatternPropertiesPlugin } from "../../../../src/plugins/object-pattern-properties";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";

type Bag = { readonly labels: Record<string, string> };

const validator = Builder()
  .use(objectPatternPropertiesPlugin)
  .use(probeMinCharsPlugin)
  .for<Bag>()
  .v("labels", (b) =>
    b.object.patternProperties({
      "^env": (pb) => pb.string.minChars(2),
      prod$: (pb) => pb.string.minChars(5),
    })
  )
  .build();

describe("objectPatternProperties", () => {
  it("applies a pattern to the keys that match it", () => {
    expect(validator.validate({ labels: { envA: "dev" } }).valid).toBe(true);
    expect(validator.validate({ labels: { envA: "d" } }).valid).toBe(false);
  });

  it("leaves a key that matches no pattern alone", () => {
    expect(validator.validate({ labels: { other: "" } }).valid).toBe(true);
  });

  // LEGACY BUG: legacy stopped at the FIRST matching pattern, which Draft-07
  // does not. "envprod" matches both, and both must apply.
  it("applies EVERY matching pattern, not just the first", () => {
    expect(validator.validate({ labels: { envprod: "abcde" } }).valid).toBe(
      true
    );
    const result = validator.validate({ labels: { envprod: "abc" } });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectPatternProperties",
    ]);
  });

  it("names every violating property in the message", () => {
    const result = validator.validate({ labels: { envA: "d", envB: "e" } });
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Properties failing their pattern schema: envA,envB",
    ]);
  });

  it("passes a non-object through", () => {
    expect(validator.validate({ labels: "envA" }).valid).toBe(true);
  });
});
