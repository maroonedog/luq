// The arithmetic that turns child-process figures into the sentence the site
// would print. It is separated from the measuring so it can be checked against
// numbers whose answer is known, and the sign convention is checked explicitly:
// a degradation figure that came out backwards would publish a slowdown as a
// speed-up.
import { summariseLane } from "../../../../bench/megamorphism/summarise-lane";
import type { WindowReport } from "../../../../bench/megamorphism/window-report.types";

function report(
  validatorCount: number,
  accepted: number,
  rejected: number,
  isQuiet = true
): WindowReport {
  const figure = (opsPerSecond: number) => ({
    opsPerSecond,
    relativeSpreadPercent: 1,
    isQuiet,
    agreedCalls: 10,
    totalCalls: 10,
  });
  return {
    request: { validatorCount, poolSize: 4, offset: 0 },
    distinctValues: validatorCount * 4,
    members: [],
    accepted: figure(accepted),
    rejected: figure(rejected),
    machine: {
      cpuModel: "test",
      logicalCores: 1,
      platform: "linux",
      arch: "x64",
      nodeVersion: "v20.0.0",
      totalMemoryGb: 1,
    },
  };
}

describe("summariseLane", () => {
  it("states a slower large window as a POSITIVE degradation", () => {
    const lane = summariseLane("live", "why", [
      [report(1, 1000, 500)],
      [report(40, 900, 400)],
    ]);
    expect(lane.points[1]?.acceptedDegradationPercent).toBe(10);
    expect(lane.points[1]?.rejectedDegradationPercent).toBe(20);
  });

  it("states a faster large window as a NEGATIVE degradation rather than zero", () => {
    const lane = summariseLane("live", "why", [
      [report(1, 1000, 1000)],
      [report(40, 1100, 1000)],
    ]);
    expect(lane.points[1]?.acceptedDegradationPercent).toBe(-10);
  });

  it("measures the baseline point against itself, which is always zero", () => {
    const lane = summariseLane("live", "why", [
      [report(1, 1000, 500)],
      [report(2, 990, 500)],
    ]);
    expect(lane.points[0]?.acceptedDegradationPercent).toBe(0);
  });

  // Interference only slows a process down, so the estimator is the median of
  // the fastest half. The mean of these five is 700 and the plain median 800;
  // the fastest half is 800, 900 and 1000, whose median is 900 — the answer
  // that does not follow the two processes that met a busy machine.
  it("keeps the median of the fastest half of the runs, not the mean", () => {
    const lane = summariseLane("live", "why", [
      [
        report(1, 200, 200),
        report(1, 600, 600),
        report(1, 800, 800),
        report(1, 900, 900),
        report(1, 1000, 1000),
      ],
    ]);
    expect(lane.points[0]?.acceptedOpsPerSecond).toBe(900);
    expect(lane.points[0]?.runs).toBe(5);
  });

  it("reports the full run-to-run range over the figure it kept", () => {
    const lane = summariseLane("live", "why", [
      [report(1, 500, 500), report(1, 1000, 1000), report(1, 1500, 1500)],
    ]);
    // Kept figure is the median of 1000 and 1500, which is 1250; the
    // range across all three is 1000, so the spread is 80%.
    expect(lane.points[0]?.acceptedRunSpreadPercent).toBe(80);
  });

  it("marks the point unquiet when any one contributing process was noisy", () => {
    const lane = summariseLane("live", "why", [
      [report(1, 1000, 1000, true), report(1, 1000, 1000, false)],
    ]);
    expect(lane.points[0]?.everyRunQuiet).toBe(false);
  });

  it("refuses to summarise a lane with no one-validator baseline to divide by", () => {
    expect(() => summariseLane("live", "why", [])).toThrow("baseline");
    expect(() => summariseLane("live", "why", [[]])).toThrow("baseline");
  });
});
