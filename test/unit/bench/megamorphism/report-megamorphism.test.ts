// config/megamorphism-baseline.json is a published measurement, and what it
// records is a ratio between two figures taken on the same machine. Ratios move
// with the machine — bench/competitors/ carries the same guard because a laptop
// recording once overwrote a runner one, changing the machine and the figures in
// a single commit. So the guard is pinned here: CI records, and a person who
// means to replace a runner record from their own machine has to say so.
import {
  printMeasurement,
  refuseToRecordOutsideCi,
} from "../../../../bench/megamorphism/report-megamorphism";
import type { MegamorphismMeasurement } from "../../../../bench/megamorphism/measure-megamorphism";

describe("refuseToRecordOutsideCi", () => {
  it("lets CI's runner record", () => {
    expect(() => refuseToRecordOutsideCi({ CI: "true" }, [])).not.toThrow();
    expect(() => refuseToRecordOutsideCi({ CI: "1" }, [])).not.toThrow();
  });

  it("lets a person record from their own machine when they say --local", () => {
    expect(() => refuseToRecordOutsideCi({}, ["--local"])).not.toThrow();
  });

  it("refuses an ordinary local run, naming the file it protects", () => {
    expect(() => refuseToRecordOutsideCi({}, [])).toThrow(
      "config/megamorphism-baseline.json"
    );
  });

  it("is not fooled by a CI variable set to something else", () => {
    expect(() => refuseToRecordOutsideCi({ CI: "false" }, [])).toThrow();
    expect(() => refuseToRecordOutsideCi({ CI: "" }, [])).toThrow();
  });
});

const MEASUREMENT: MegamorphismMeasurement = {
  measuredAt: "2026-01-01T00:00:00.000Z",
  machine: {
    cpuModel: "test cpu",
    logicalCores: 2,
    platform: "linux",
    arch: "x64",
    nodeVersion: "v20.0.0",
    totalMemoryGb: 8,
  },
  conditions: {
    windowSizes: [1, 40],
    repeatCount: 7,
    processPerWindow: "one child per window",
    familySize: 40,
    declares: "3 fields",
    moduleUnderTest: "src/",
  },
  resolution: {
    acceptedPercent: 2,
    rejectedPercent: 3,
    worstPercent: 3,
    note: "one window measured twice",
  },
  lanes: [
    {
      name: "liveValidators",
      question: "what N live validators cost",
      points: [
        {
          validatorCount: 1,
          poolSize: 4,
          distinctValues: 4,
          acceptedOpsPerSecond: 1000,
          rejectedOpsPerSecond: 500,
          acceptedDegradationPercent: 0,
          rejectedDegradationPercent: 0,
          runs: 7,
          acceptedRunSpreadPercent: 1,
          rejectedRunSpreadPercent: 1,
          everyRunQuiet: true,
        },
        {
          validatorCount: 40,
          poolSize: 4,
          distinctValues: 160,
          acceptedOpsPerSecond: 900,
          rejectedOpsPerSecond: 450,
          acceptedDegradationPercent: 10,
          rejectedDegradationPercent: 10,
          runs: 7,
          acceptedRunSpreadPercent: 4,
          rejectedRunSpreadPercent: 4,
          everyRunQuiet: false,
        },
      ],
    },
  ],
};

describe("printMeasurement", () => {
  it("names the machine, both pools and the noisy point", () => {
    let printed = "";
    printMeasurement(MEASUREMENT, (line) => {
      printed += line;
    });
    expect(printed).toContain("test cpu");
    expect(printed).toContain("accepted ops/sec");
    expect(printed).toContain("rejected ops/sec");
    expect(printed).toContain("10.00%");
    expect(printed).toContain("MACHINE WAS NOISY");
    // The run's own error floor is printed before any figure it would qualify.
    expect(printed).toContain("A degradation smaller than 3% is not evidence");
    expect(printed.indexOf("not evidence")).toBeLessThan(
      printed.indexOf("accepted ops/sec")
    );
  });
});
