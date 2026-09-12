// The parent reads a child's answer off a pipe. A child that died halfway, or
// that printed a warning where the report was expected, must not be read as a
// measurement — least of all as a measurement of zero, which would pull a
// window's median down and look like a degradation.
//
// The malformed values are obtained through JSON.parse, as the parent obtains
// them, so nothing here has to assert a type it does not have.
import { isWindowReport } from "../../../../bench/megamorphism/window-report.types";

const COMPLETE = {
  request: { validatorCount: 40, poolSize: 4, offset: 0 },
  distinctValues: 160,
  members: ["form-00"],
  accepted: {
    opsPerSecond: 1000,
    relativeSpreadPercent: 2,
    isQuiet: true,
    agreedCalls: 10,
    totalCalls: 10,
  },
  rejected: {
    opsPerSecond: 500,
    relativeSpreadPercent: 3,
    isQuiet: true,
    agreedCalls: 10,
    totalCalls: 10,
  },
  machine: { cpuModel: "test" },
};

function parsed(edit: (draft: Record<string, unknown>) => void): unknown {
  const draft = JSON.parse(JSON.stringify(COMPLETE));
  edit(draft);
  return JSON.parse(JSON.stringify(draft));
}

describe("isWindowReport", () => {
  it("accepts a complete report", () => {
    expect(isWindowReport(parsed(() => undefined))).toBe(true);
  });

  it("rejects what a dead child leaves behind", () => {
    expect(isWindowReport(undefined)).toBe(false);
    expect(isWindowReport(null)).toBe(false);
    expect(isWindowReport("")).toBe(false);
    expect(isWindowReport(JSON.parse('"a warning line"'))).toBe(false);
    expect(isWindowReport(JSON.parse("{}"))).toBe(false);
  });

  it("rejects a report missing either timed pool", () => {
    expect(
      isWindowReport(
        parsed((draft) => {
          delete draft["accepted"];
        })
      )
    ).toBe(false);
    expect(
      isWindowReport(
        parsed((draft) => {
          delete draft["rejected"];
        })
      )
    ).toBe(false);
  });

  it("rejects a pool whose rate arrived as a string", () => {
    expect(
      isWindowReport(
        parsed((draft) => {
          draft["accepted"] = { ...COMPLETE.accepted, opsPerSecond: "1000" };
        })
      )
    ).toBe(false);
  });

  it("rejects a report whose window it cannot name", () => {
    expect(
      isWindowReport(
        parsed((draft) => {
          draft["request"] = { poolSize: 4, offset: 0 };
        })
      )
    ).toBe(false);
  });

  it("rejects a report with no machine recorded", () => {
    expect(
      isWindowReport(
        parsed((draft) => {
          delete draft["machine"];
        })
      )
    ).toBe(false);
  });
});
