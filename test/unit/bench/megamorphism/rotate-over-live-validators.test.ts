// The rotation is the whole subject of the megamorphism measurement: if it does
// not really visit every validator in turn, a figure labelled "40 validators
// alive" describes one validator being called forty times as often. And if the
// two counters advanced together, a window whose validator count is a multiple
// of its pool size would pin every validator to a single frozen value, which is
// a different measurement from the one-validator window it is divided by.
import {
  assertPoolVerdicts,
  rotateOverLiveValidators,
} from "../../../../bench/megamorphism/rotate-over-live-validators";
import type { LiveShape } from "../../../../bench/megamorphism/live-validator-family";

interface Visit {
  readonly member: string;
  readonly value: unknown;
}

function recordingShape(
  label: string,
  accepted: readonly unknown[],
  rejected: readonly unknown[],
  visits: Visit[]
): LiveShape {
  const answer = (value: unknown) => {
    visits.push({ member: label, value });
    return { valid: accepted.includes(value) };
  };
  return {
    label,
    validator: { validate: answer, parse: answer },
    accepted,
    rejected,
  };
}

function family(count: number, poolSize: number, visits: Visit[]): LiveShape[] {
  const shapes: LiveShape[] = [];
  for (let member = 0; member < count; member += 1) {
    const accepted: unknown[] = [];
    const rejected: unknown[] = [];
    for (let position = 0; position < poolSize; position += 1) {
      accepted.push(`ok-${member}-${position}`);
      rejected.push(`no-${member}-${position}`);
    }
    shapes.push(recordingShape(`form-${member}`, accepted, rejected, visits));
  }
  return shapes;
}

describe("rotateOverLiveValidators", () => {
  it("calls each validator once per turn, in order, wrapping", () => {
    const visits: Visit[] = [];
    const subject = rotateOverLiveValidators(family(3, 2, visits), true);
    for (let call = 0; call < 4; call += 1) subject();
    expect(visits.map((visit) => visit.member)).toEqual([
      "form-0",
      "form-1",
      "form-2",
      "form-0",
    ]);
  });

  // The failure this pins: advancing both counters every call. With four
  // validators and a pool of two, that gives every validator one value for the
  // whole run instead of both of them.
  it("gives every validator every one of its values over a full cycle", () => {
    const visits: Visit[] = [];
    const subject = rotateOverLiveValidators(family(4, 2, visits), true);
    for (let call = 0; call < 8; call += 1) subject();
    expect(visits.map((visit) => visit.value)).toEqual([
      "ok-0-0",
      "ok-1-0",
      "ok-2-0",
      "ok-3-0",
      "ok-0-1",
      "ok-1-1",
      "ok-2-1",
      "ok-3-1",
    ]);
  });

  it("wraps the value index back to the start after a full cycle", () => {
    const visits: Visit[] = [];
    const subject = rotateOverLiveValidators(family(2, 2, visits), true);
    for (let call = 0; call < 6; call += 1) subject();
    expect(visits.map((visit) => visit.value)).toEqual([
      "ok-0-0",
      "ok-1-0",
      "ok-0-1",
      "ok-1-1",
      "ok-0-0",
      "ok-1-0",
    ]);
  });

  it("answers whether the verdict was the promised one, not whether it passed", () => {
    const visits: Visit[] = [];
    const shapes = family(2, 2, visits);
    const accepting = rotateOverLiveValidators(shapes, true);
    const rejecting = rotateOverLiveValidators(shapes, false);
    expect([accepting(), accepting()]).toEqual([true, true]);
    expect([rejecting(), rejecting()]).toEqual([true, true]);
  });

  it("reports a disagreement as false instead of timing it as a success", () => {
    const visits: Visit[] = [];
    const shapes = family(1, 2, visits);
    // A rejected pool whose values the validator accepts: the drift the
    // verdict assertion exists to catch, seen from the subject's side.
    const drifted: LiveShape = { ...shapes[0]!, rejected: shapes[0]!.accepted };
    const subject = rotateOverLiveValidators([drifted], false);
    expect([subject(), subject()]).toEqual([false, false]);
  });
});

describe("assertPoolVerdicts", () => {
  it("counts every value in both pools when they answer as promised", () => {
    const visits: Visit[] = [];
    expect(assertPoolVerdicts(family(3, 4, visits))).toBe(24);
  });

  it("throws naming the member whose rejected pool is accepted", () => {
    const visits: Visit[] = [];
    const shapes = family(2, 2, visits);
    const drifted: LiveShape = { ...shapes[1]!, rejected: shapes[1]!.accepted };
    expect(() => assertPoolVerdicts([shapes[0]!, drifted])).toThrow("form-1");
  });

  it("throws naming the member whose accepted pool is rejected", () => {
    const visits: Visit[] = [];
    const shapes = family(1, 2, visits);
    const drifted: LiveShape = { ...shapes[0]!, accepted: shapes[0]!.rejected };
    expect(() => assertPoolVerdicts([drifted])).toThrow("form-0");
  });
});
