// The only test here that actually measures. It is slow on purpose: it is the
// proof that the child process produces a report the parent can read, end to
// end, rather than each half being correct against a fixture of the other.
//
// The smallest possible window is used — two validators over two values each —
// because what is being pinned is the shape and the self-consistency of a
// report, never a rate.
import { measureLiveWindow } from "../../../../bench/megamorphism/measure-live-window";
import { isWindowReport } from "../../../../bench/megamorphism/window-report.types";
import { spawnLiveWindow } from "../../../../bench/megamorphism/spawn-live-window";

const SLOW_MS = 120000;

describe("measureLiveWindow", () => {
  it(
    "reports a window the parent can read, with both pools timed separately",
    () => {
      const report = measureLiveWindow({
        validatorCount: 2,
        poolSize: 2,
        offset: 0,
      });
      expect(isWindowReport(report)).toBe(true);
      expect(report.members).toEqual(["form-00", "form-01"]);
      expect(report.distinctValues).toBe(4);
      expect(report.accepted.opsPerSecond).toBeGreaterThan(0);
      expect(report.rejected.opsPerSecond).toBeGreaterThan(0);
      // Every timed call gave the verdict its pool promised. A shortfall would
      // mean a validator changed its mind partway through a timed run.
      expect(report.accepted.agreedCalls).toBe(report.accepted.totalCalls);
      expect(report.rejected.agreedCalls).toBe(report.rejected.totalCalls);
      expect(report.machine.nodeVersion).toBe(process.version);
    },
    SLOW_MS
  );

  it(
    "refuses a window the family cannot supply, before timing anything",
    () => {
      expect(() =>
        measureLiveWindow({ validatorCount: 0, poolSize: 4, offset: 0 })
      ).toThrow();
    },
    SLOW_MS
  );
});

describe("spawnLiveWindow", () => {
  // A child that fails must reach the parent as a failure. Recorded as a zero
  // it would drag a window's figure down and read as a degradation.
  it(
    "throws naming the window when the child cannot measure it",
    () => {
      expect(() =>
        spawnLiveWindow({ validatorCount: 0, poolSize: 4, offset: 0 })
      ).toThrow("validators=0");
    },
    SLOW_MS
  );
});
