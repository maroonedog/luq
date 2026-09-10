// Rotating over a pool is the structural answer to the engine eliminating the
// reference implementation so thoroughly that it measured faster than doing
// nothing, and the whole ratio gate rests on it. This pins that the rotation
// really visits every element in turn and that both sides are wrapped the same
// way.
import {
  rotateOverNothing,
  rotateOverValues,
  type ValuePool,
} from "../../../bench/rotate-over-values";

const POOL: ValuePool = ["a", "b", "c", "d"];

describe("rotateOverValues", () => {
  it("goes through the pool in order and wraps from the end to the start", () => {
    const seen: unknown[] = [];
    const subject = rotateOverValues(POOL, (value) => {
      seen.push(value);
      return true;
    });
    for (let call = 0; call < 6; call += 1) subject();
    expect(seen).toEqual(["a", "b", "c", "d", "a", "b"]);
  });

  it("returns what consume answered, the accepted-count assertion resting on it", () => {
    const subject = rotateOverValues(POOL, (value) => value === "a");
    expect([subject(), subject(), subject(), subject()]).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("answers false without calling consume when the pool holds undefined", () => {
    const calls: unknown[] = [];
    const subject = rotateOverValues(["a", undefined] as ValuePool, (value) => {
      calls.push(value);
      return true;
    });
    expect(subject()).toBe(true);
    expect(subject()).toBe(false);
    expect(calls).toEqual(["a"]);
  });

  it("keeps two subjects from advancing each other's position", () => {
    const first: unknown[] = [];
    const second: unknown[] = [];
    const one = rotateOverValues(POOL, (value) => {
      first.push(value);
      return true;
    });
    const other = rotateOverValues(POOL, (value) => {
      second.push(value);
      return true;
    });
    one();
    one();
    other();
    expect(first).toEqual(["a", "b"]);
    expect(second).toEqual(["a"]);
  });
});

describe("rotateOverNothing", () => {
  it("always answers true through the same rotation, measuring the rotation's own cost", () => {
    const subject = rotateOverNothing(POOL);
    expect([subject(), subject(), subject(), subject(), subject()]).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});
