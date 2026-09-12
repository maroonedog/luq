// Two properties make the family a fair measurement, and neither is visible in
// an ops/sec figure, so both are pinned here.
//
// EQUAL WORK: comparing a rate taken with one validator alive against a rate
// taken with forty only means something if a call costs the same in both. Every
// member therefore declares the same three fields with the same rule kinds over
// values of the same lengths.
//
// DISTINCT IDENTITY: the effect being looked for is what happens when a shared
// call site sees many targets, so no two members may share a field name, a
// pattern or a validator.
import {
  FAMILY_SIZE,
  buildLiveFamily,
} from "../../../../bench/megamorphism/live-validator-family";
import { assertPoolVerdicts } from "../../../../bench/megamorphism/rotate-over-live-validators";

function keysOf(value: unknown): readonly string[] {
  return Object.keys(JSON.parse(JSON.stringify(value)));
}

describe("buildLiveFamily", () => {
  it("gives every member its own field names, so no two share a reader", () => {
    const shapes = buildLiveFamily(FAMILY_SIZE, 0, 4);
    const names = shapes.flatMap((shape) => keysOf(shape.accepted[0]));
    expect(names).toHaveLength(FAMILY_SIZE * 3);
    expect(new Set(names).size).toBe(FAMILY_SIZE * 3);
  });

  it("gives every member its own validator object", () => {
    const shapes = buildLiveFamily(FAMILY_SIZE, 0, 4);
    expect(new Set(shapes.map((shape) => shape.validator)).size).toBe(
      FAMILY_SIZE
    );
  });

  it("declares the same three fields and the same value lengths for every member", () => {
    const shapes = buildLiveFamily(FAMILY_SIZE, 0, 4);
    for (const shape of shapes) {
      for (const value of shape.accepted) {
        const parsed = JSON.parse(JSON.stringify(value));
        const values = Object.keys(parsed).map((key) => parsed[key]);
        expect(values).toHaveLength(3);
        expect(String(values[0])).toHaveLength(8);
        expect(String(values[1])).toHaveLength(6);
        expect(typeof values[2]).toBe("number");
      }
    }
  });

  it("accepts every value of every accepted pool and rejects every rejected one", () => {
    expect(assertPoolVerdicts(buildLiveFamily(FAMILY_SIZE, 0, 4))).toBe(
      FAMILY_SIZE * 8
    );
  });

  // Every rejection must fail on the LAST declared field, so a rejected call
  // walks the same three fields an accepted one walks. A rejection that fired
  // on the first field would measure almost none of the traversal.
  it("fails every rejected value on the last declared field", () => {
    for (const shape of buildLiveFamily(4, 0, 4)) {
      const lastField = keysOf(shape.accepted[0])[2];
      for (const value of shape.rejected) {
        const issues = shape.validator.validate(value);
        expect(JSON.stringify(issues)).toContain(`"path":"${lastField}"`);
      }
    }
  });

  it("wraps at the end of the family so an offset never runs out of members", () => {
    const wrapped = buildLiveFamily(4, FAMILY_SIZE - 2, 4);
    expect(wrapped.map((shape) => shape.label)).toEqual([
      "form-38",
      "form-39",
      "form-00",
      "form-01",
    ]);
  });

  it("gives a pool of the asked-for size", () => {
    const shapes = buildLiveFamily(2, 0, 40);
    expect(shapes[0]?.accepted).toHaveLength(40);
    expect(shapes[0]?.rejected).toHaveLength(40);
    expect(new Set(shapes[0]?.accepted).size).toBe(40);
  });

  it("refuses a window larger than the family, rather than repeating a member", () => {
    expect(() => buildLiveFamily(FAMILY_SIZE + 1, 0, 4)).toThrow(
      String(FAMILY_SIZE)
    );
  });

  it("refuses a pool of one, which leaves a constant for the engine to fold", () => {
    expect(() => buildLiveFamily(2, 0, 1)).toThrow("at least 2");
  });
});
