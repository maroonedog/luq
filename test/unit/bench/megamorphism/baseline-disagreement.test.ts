// The run's own error floor. Both lanes' first points are the identical window
// — one validator over four values — so their gap cannot be a property of the
// library, and a degradation smaller than it is not evidence. What is pinned
// here is that the figure really is computed from two points that describe the
// same request, because a lane whose first point quietly became a different
// window would turn this from a resolution into a comparison.
import { measureResolution } from "../../../../bench/megamorphism/baseline-disagreement";
import type {
  Lane,
  LanePoint,
} from "../../../../bench/megamorphism/summarise-lane";

function point(
  validatorCount: number,
  poolSize: number,
  accepted: number,
  rejected: number
): LanePoint {
  return {
    validatorCount,
    poolSize,
    distinctValues: validatorCount * poolSize,
    acceptedOpsPerSecond: accepted,
    rejectedOpsPerSecond: rejected,
    acceptedDegradationPercent: 0,
    rejectedDegradationPercent: 0,
    runs: 7,
    acceptedRunSpreadPercent: 0,
    rejectedRunSpreadPercent: 0,
    everyRunQuiet: true,
  };
}

function lanes(first: LanePoint, second: LanePoint): readonly Lane[] {
  return [
    { name: "liveValidators", question: "", points: [first] },
    { name: "liveValues", question: "", points: [second] },
  ];
}

describe("measureResolution", () => {
  it("is zero when two measurements of the same window agree", () => {
    const measured = measureResolution(
      lanes(point(1, 4, 1000, 500), point(1, 4, 1000, 500))
    );
    expect(measured.acceptedPercent).toBe(0);
    expect(measured.worstPercent).toBe(0);
  });

  it("states the gap as a share of the larger figure, per pool", () => {
    const measured = measureResolution(
      lanes(point(1, 4, 1000, 400), point(1, 4, 800, 500))
    );
    expect(measured.acceptedPercent).toBe(20);
    expect(measured.rejectedPercent).toBe(20);
  });

  it("reports the worse of the two pools, because that is what a figure must beat", () => {
    const measured = measureResolution(
      lanes(point(1, 4, 1000, 1000), point(1, 4, 950, 600))
    );
    expect(measured.acceptedPercent).toBe(5);
    expect(measured.worstPercent).toBe(40);
  });

  it("refuses when the lanes no longer start from the same window", () => {
    expect(() =>
      measureResolution(lanes(point(1, 4, 1000, 500), point(2, 4, 1000, 500)))
    ).toThrow("same window");
  });

  it("refuses when there are not two lanes to compare", () => {
    expect(() => measureResolution([])).toThrow("fewer than two lanes");
    expect(() =>
      measureResolution([
        { name: "liveValidators", question: "", points: [point(1, 4, 1, 1)] },
      ])
    ).toThrow("fewer than two lanes");
  });
});
