// 性能表の表記検査そのものを検査する。
//
// ゲートを外す一番簡単な方法は、印を消して「一致している」と言わせることで
// ある。だからここで一番大事なのは、印が欠けたときに黙って通らないことである。
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  README,
  checkPerfFigures,
  renderReadme,
  writePerfFigures,
} from "../../../scripts/check-perf-figures";
import type { PerfBaseline } from "../../../scripts/perf-figures/render-perf-tables";

const SHAPES = [
  "singleField",
  "multiField",
  "nested",
  "array",
  "jsonSchema",
] as const;

const BASELINE: PerfBaseline = {
  throughput: SHAPES.flatMap((shape, index) => [
    {
      shape,
      operation: "validate",
      opsPerSecond: 1000 * (index + 1),
      relativeSpreadPercent: 5,
    },
    {
      shape,
      operation: "parse",
      opsPerSecond: 2000 * (index + 1),
      relativeSpreadPercent: 5,
    },
  ]),
  legacyComparison: SHAPES.map((shape, index) => ({
    shape,
    legacyOpsPerSecond: 500 * (index + 1),
    currentOpsPerSecond: 1000 * (index + 1),
    speedup: 2,
  })),
};

const MARKED_README = [
  "| Shape | validate | parse |",
  "<!-- generated:perf-throughput -->",
  "<!-- /generated:perf-throughput -->",
  "",
  "| Shape | 1.x | this | ratio |",
  "<!-- generated:perf-legacy -->",
  "<!-- /generated:perf-legacy -->",
  "",
  "spread is <!-- generated:perf-spread --><!-- /generated:perf-spread -->.",
  "",
].join("\n");

/** 実際の config/ を読ませないため、baseline も readme も差し替えた根で回す。 */
function withRepository(
  readme: string,
  run: (root: string) => void,
  baseline: PerfBaseline = BASELINE
): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "luq-perf-figures-"));
  fs.mkdirSync(path.join(root, "config"));
  fs.writeFileSync(
    path.join(root, "config", "perf-baseline.json"),
    JSON.stringify(baseline),
    "utf8"
  );
  fs.writeFileSync(path.join(root, README), readme, "utf8");
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("the gate reads the measurement, not the prose around it", () => {
  it("passes once the README has been written from the baseline", () => {
    withRepository(MARKED_README, (root) => {
      expect(writePerfFigures(root)).toBe(0);
      expect(checkPerfFigures(root)).toBe(0);
    });
  });

  it("fails when a figure was measured again and the README was not", () => {
    withRepository(MARKED_README, (root) => {
      writePerfFigures(root);
      const file = path.join(root, README);
      const written = fs.readFileSync(file, "utf8");
      fs.writeFileSync(file, written.replace("1,000", "999,999"), "utf8");
      expect(checkPerfFigures(root)).toBe(1);
    });
  });

  it("leaves the hand-written sentences between the tables alone", () => {
    const withProse = MARKED_README.replace(
      "| Shape | 1.x | this | ratio |",
      "1.x carried a directory of specialised fast paths.\n\n| Shape | 1.x | this | ratio |"
    );
    withRepository(withProse, (root) => {
      writePerfFigures(root);
      expect(fs.readFileSync(path.join(root, README), "utf8")).toContain(
        "1.x carried a directory of specialised fast paths."
      );
    });
  });

  it("puts the spread inside the sentence rather than on its own line", () => {
    withRepository(MARKED_README, (root) => {
      writePerfFigures(root);
      expect(fs.readFileSync(path.join(root, README), "utf8")).toContain(
        "spread is <!-- generated:perf-spread -->5.0–5.0%<!-- /generated:perf-spread -->."
      );
    });
  });
});

describe("a missing marker is a violation, not a pass", () => {
  it.each([
    ["<!-- generated:perf-legacy -->", "opening"],
    ["<!-- /generated:perf-legacy -->", "closing"],
  ])("refuses a README whose %s marker was deleted", (marker) => {
    withRepository(MARKED_README.replace(marker, ""), (root) => {
      expect(() => renderReadme(root, BASELINE)).toThrow(/perf-legacy/);
    });
  });

  it("refuses a README where the markers are the wrong way round", () => {
    const swapped = MARKED_README.replace(
      "<!-- generated:perf-legacy -->\n<!-- /generated:perf-legacy -->",
      "<!-- /generated:perf-legacy -->\n<!-- generated:perf-legacy -->"
    );
    withRepository(swapped, (root) => {
      expect(() => renderReadme(root, BASELINE)).toThrow(/perf-legacy/);
    });
  });
});
