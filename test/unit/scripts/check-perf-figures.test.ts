// Checks the performance-figure check itself.
//
// The easiest way to remove a gate is to delete a marker and have it report a
// match, so what matters most here is that a missing marker does not pass in
// silence.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  FIGURES_FILE,
  checkPerfFigures,
  readSources,
  renderReadme,
  writePerfFigures,
} from "../../../scripts/check-perf-figures";
import type {
  PerfBaseline,
  SizeBudget,
} from "../../../scripts/perf-figures/render-perf-tables";

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

const BUDGET: SizeBudget = {
  budgets: [
    {
      id: "core-only",
      gzipCeilingBytes: 100,
      recordedGzipBytes: 40,
      legacyGzipBytes: 400,
    },
    { id: "six-plugin", gzipCeilingBytes: 200, recordedGzipBytes: 80 },
    { id: "jsonschema-plugin", gzipCeilingBytes: 300, recordedGzipBytes: 150 },
    {
      id: "jsonschema-full-feature",
      gzipCeilingBytes: 400,
      recordedGzipBytes: 180,
    },
    { id: "full-feature", gzipCeilingBytes: 500, recordedGzipBytes: 200 },
  ],
};

const MARKED_DOCUMENT = [
  "| Shape | validate | parse |",
  "<!-- generated:perf-throughput -->",
  "<!-- /generated:perf-throughput -->",
  "",
  "| Shape | 1.x | this | ratio |",
  "<!-- generated:perf-legacy -->",
  "<!-- /generated:perf-legacy -->",
  "",
  "spread is <!-- generated:perf-spread --><!-- /generated:perf-spread -->.",
  "1.x did <!-- generated:perf-legacy-simple --><!-- /generated:perf-legacy-simple --> here.",
  "",
  "| Entry | gzip | 1.x |",
  "<!-- generated:bundle-size -->",
  "<!-- /generated:bundle-size -->",
  "",
  "core is <!-- generated:bundle-core-share --><!-- /generated:bundle-core-share -->.",
  "",
].join("\n");

/** Run against a root with its own sources and document, so the real config is never read. */
function withRepository(
  document: string,
  run: (root: string) => void,
  baseline: PerfBaseline = BASELINE
): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "luq-perf-figures-"));
  fs.mkdirSync(path.join(root, "config"));
  fs.mkdirSync(path.join(root, path.dirname(FIGURES_FILE)), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "config", "size-budget.json"),
    JSON.stringify(BUDGET),
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, "config", "perf-baseline.json"),
    JSON.stringify(baseline),
    "utf8"
  );
  fs.writeFileSync(path.join(root, FIGURES_FILE), document, "utf8");
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("the gate reads the measurement, not the prose around it", () => {
  it("passes once the document has been written from the baseline", () => {
    withRepository(MARKED_DOCUMENT, (root) => {
      expect(writePerfFigures(root)).toBe(0);
      expect(checkPerfFigures(root)).toBe(0);
    });
  });

  it("fails when a figure was measured again and the document was not", () => {
    withRepository(MARKED_DOCUMENT, (root) => {
      writePerfFigures(root);
      const file = path.join(root, FIGURES_FILE);
      const written = fs.readFileSync(file, "utf8");
      fs.writeFileSync(file, written.replace("1,000", "999,999"), "utf8");
      expect(checkPerfFigures(root)).toBe(1);
    });
  });

  it("leaves the hand-written sentences between the tables alone", () => {
    const withProse = MARKED_DOCUMENT.replace(
      "| Shape | 1.x | this | ratio |",
      "1.x carried a directory of specialised fast paths.\n\n| Shape | 1.x | this | ratio |"
    );
    withRepository(withProse, (root) => {
      writePerfFigures(root);
      expect(fs.readFileSync(path.join(root, FIGURES_FILE), "utf8")).toContain(
        "1.x carried a directory of specialised fast paths."
      );
    });
  });

  it("writes the 1.x simple figure in millions, inside its sentence", () => {
    withRepository(MARKED_DOCUMENT, (root) => {
      writePerfFigures(root);
      expect(fs.readFileSync(path.join(root, FIGURES_FILE), "utf8")).toContain(
        "1.x did <!-- generated:perf-legacy-simple -->0.00M<!-- /generated:perf-legacy-simple --> here."
      );
    });
  });

  it("puts the spread inside the sentence rather than on its own line", () => {
    withRepository(MARKED_DOCUMENT, (root) => {
      writePerfFigures(root);
      expect(fs.readFileSync(path.join(root, FIGURES_FILE), "utf8")).toContain(
        "spread is <!-- generated:perf-spread -->5.0–5.0%<!-- /generated:perf-spread -->."
      );
    });
  });
});

describe("a missing marker is a violation, not a pass", () => {
  it.each([
    ["<!-- generated:perf-legacy -->", "opening"],
    ["<!-- /generated:perf-legacy -->", "closing"],
  ])("refuses a document whose %s marker was deleted", (marker) => {
    withRepository(MARKED_DOCUMENT.replace(marker, ""), (root) => {
      expect(() => renderReadme(root, readSources(root))).toThrow(
        /perf-legacy/
      );
    });
  });

  it("refuses a document where the markers are the wrong way round", () => {
    const swapped = MARKED_DOCUMENT.replace(
      "<!-- generated:perf-legacy -->\n<!-- /generated:perf-legacy -->",
      "<!-- /generated:perf-legacy -->\n<!-- generated:perf-legacy -->"
    );
    withRepository(swapped, (root) => {
      expect(() => renderReadme(root, readSources(root))).toThrow(
        /perf-legacy/
      );
    });
  });
});
