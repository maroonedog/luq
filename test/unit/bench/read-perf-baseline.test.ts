// 床の読み取りが黙って空を返すと、ゲートは何も落とさないまま緑になる。
// 「落ちる」ことのほうが要件なので、壊した baseline で throw することを固定する。
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
  it("記録されている実物を読める", () => {
    const baseline = readPerfBaseline(PERF_BASELINE_PATH);
    expect(baseline.referenceRatio.length).toBeGreaterThan(0);
  });

  it("ファイルが無ければ throw する", () => {
    expect(() =>
      readPerfBaseline(path.join(os.tmpdir(), "no-such.json"))
    ).toThrow(PerfBaselineUnreadableError);
  });

  it("JSON として壊れていれば throw する", () => {
    withFile("{ not json", (file) => {
      expect(() => readPerfBaseline(file)).toThrow(PerfBaselineUnreadableError);
    });
  });

  it("referenceRatio が空なら throw する — 床の無いゲートは全通過になるため", () => {
    withFile(JSON.stringify({ ...COMPLETE, referenceRatio: [] }), (file) => {
      expect(() => readPerfBaseline(file)).toThrow(PerfBaselineUnreadableError);
    });
  });

  it("ratioFloor が 0 なら throw する", () => {
    const zeroFloor = {
      ...COMPLETE,
      referenceRatio: [{ ...ONE_RATIO, ratioFloor: 0 }],
    };
    withFile(JSON.stringify(zeroFloor), (file) => {
      expect(() => readPerfBaseline(file)).toThrow(PerfBaselineUnreadableError);
    });
  });

  it("BOM 付きでも読める", () => {
    withFile(`﻿${JSON.stringify(COMPLETE)}`, (file) => {
      expect(readPerfBaseline(file).referenceRatio).toHaveLength(1);
    });
  });
});

describe("findRecordedFloor", () => {
  it("shape・operation・受理/拒否の3つが揃った行の床だけを返す", () => {
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

  // 除外そのものを固定する。singleField の床を戻すとここが落ちるので、
  // 「なぜ外したか」を読まずに戻すことはできない。
  it("singleField には床が無い（参照が測定下限を下回るため比率ゲートの対象外）", () => {
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

  it("記録の無い組み合わせには undefined を返す", () => {
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
