// A floor reader that quietly answers nothing leaves the gate green while
// failing nothing. Failing is the requirement, so throwing on a broken
// baseline is what gets pinned.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  PERF_BASELINE_PATH,
  PerfBaselineUnreadableError,
  findRecordedFloor,
  readPerfBaseline,
} from "../../../bench/read-perf-baseline";

function withFile<T>(contents: string, read: (file: string) => T): T {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "luq-perf-baseline-"));
  try {
    const file = path.join(root, "perf-baseline.json");
    fs.writeFileSync(file, contents, "utf8");
    return read(file);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const ONE_RATIO = {
  shape: "singleField",
  operation: "validate",
  inputIsAccepted: true,
  luqOpsPerSecond: 1,
  referenceOpsPerSecond: 2,
  ratio: 0.5,
  ratioFloor: 0.4,
  luqSpreadPercent: 1,
  referenceSpreadPercent: 1,
  ratioSpreadPercent: 1,
  isQuiet: true,
};

const COMPLETE = {
  recordedAt: "2026-01-01T00:00:00.000Z",
  machine: {},
  conditions: {},
  referenceRatio: [ONE_RATIO],
};

describe("readPerfBaseline", () => {
  it("reads the real recorded file", () => {
    const baseline = readPerfBaseline(PERF_BASELINE_PATH);
    expect(baseline.referenceRatio.length).toBeGreaterThan(0);
  });

  it("throws when the file is missing", () => {
    expect(() =>
      readPerfBaseline(path.join(os.tmpdir(), "no-such.json"))
    ).toThrow(PerfBaselineUnreadableError);
  });

  it("throws when the JSON is broken", () => {
    withFile("{ not json", (file) => {
      expect(() => readPerfBaseline(file)).toThrow(PerfBaselineUnreadableError);
    });
  });

  it("throws on an empty referenceRatio, a gate with no floor passing everything", () => {
    withFile(JSON.stringify({ ...COMPLETE, referenceRatio: [] }), (file) => {
      expect(() => readPerfBaseline(file)).toThrow(PerfBaselineUnreadableError);
    });
  });

  it("throws on a ratioFloor of 0", () => {
    const zeroFloor = {
      ...COMPLETE,
      referenceRatio: [{ ...ONE_RATIO, ratioFloor: 0 }],
    };
    withFile(JSON.stringify(zeroFloor), (file) => {
      expect(() => readPerfBaseline(file)).toThrow(PerfBaselineUnreadableError);
    });
  });

  it("reads a file with a BOM", () => {
    withFile(`﻿${JSON.stringify(COMPLETE)}`, (file) => {
      expect(readPerfBaseline(file).referenceRatio).toHaveLength(1);
    });
  });
});

describe("findRecordedFloor", () => {
  it("returns a floor only for rows carrying shape, operation and outcome", () => {
    const baseline = readPerfBaseline(PERF_BASELINE_PATH);
    const accepted = findRecordedFloor(baseline, "multiField", {
      operation: "validate",
      inputIsAccepted: true,
    });
    const rejected = findRecordedFloor(baseline, "multiField", {
      operation: "validate",
      inputIsAccepted: false,
    });
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
    expect(accepted).not.toBe(rejected);
  });

  // Pins the exclusion itself. Restoring the singleField floor fails this, so
  // it cannot be restored without reading why it was removed.
  it("has no floor for singleField, the reference falling below the measurement floor", () => {
    const baseline = readPerfBaseline(PERF_BASELINE_PATH);
    for (const inputIsAccepted of [true, false]) {
      for (const operation of ["validate", "parse"] as const) {
        expect(
          findRecordedFloor(baseline, "singleField", {
            operation,
            inputIsAccepted,
          })
        ).toBeUndefined();
      }
    }
  });

  it("answers undefined for a combination that was not recorded", () => {
    withFile(JSON.stringify(COMPLETE), (file) => {
      const baseline = readPerfBaseline(file);
      expect(
        findRecordedFloor(baseline, "array", {
          operation: "parse",
          inputIsAccepted: true,
        })
      ).toBeUndefined();
    });
  });
});
