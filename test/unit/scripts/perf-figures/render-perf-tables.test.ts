// Checks the side that assembles the README's performance tables.
//
// These tables rot in the self-consistent way: every figure in them was true
// when it was written. So what is checked is not consistency but that **the
// measurement handed in becomes the row**, and that a shape which could not be
// compared stays visible as "not comparable" rather than quietly disappearing.
import {
  renderLegacyTable,
  renderSpreadRange,
  renderThroughputTable,
} from "../../../../scripts/perf-figures/render-perf-tables";
import type { PerfBaseline } from "../../../../scripts/perf-figures/render-perf-tables";

const SHAPES = [
  "singleField",
  "multiField",
  "nested",
  "array",
  "jsonSchema",
] as const;

function baselineWith(
  legacy: readonly {
    shape: string;
    legacyOpsPerSecond: number | null;
    currentOpsPerSecond: number;
    speedup: number | null;
  }[]
): PerfBaseline {
  return {
    throughput: SHAPES.flatMap((shape, index) => [
      {
        shape,
        operation: "validate",
        opsPerSecond: 1000 * (index + 1),
        relativeSpreadPercent: 3 + index,
      },
      {
        shape,
        operation: "parse",
        opsPerSecond: 2000 * (index + 1),
        relativeSpreadPercent: 4 + index,
      },
    ]),
    legacyComparison: legacy,
  };
}

const EVERY_SHAPE_COMPARABLE = SHAPES.map((shape, index) => ({
  shape,
  legacyOpsPerSecond: 500 * (index + 1),
  currentOpsPerSecond: 1000 * (index + 1),
  speedup: 2,
}));

describe("the throughput table carries the measured figures", () => {
  it("puts validate and parse of one shape on one row", () => {
    const rendered = renderThroughputTable(
      baselineWith(EVERY_SHAPE_COMPARABLE)
    );
    expect(rendered).toContain("| 1 field, 1 check | 1,000 | 2,000 |");
    expect(rendered).toContain("| JSON Schema document | 5,000 | 10,000 |");
  });

  it("renders one row per shape and nothing else", () => {
    const rendered = renderThroughputTable(
      baselineWith(EVERY_SHAPE_COMPARABLE)
    );
    expect(rendered.split("\n")).toHaveLength(SHAPES.length);
  });

  it("refuses a baseline missing a shape rather than dropping the row", () => {
    const partial: PerfBaseline = {
      throughput: [
        {
          shape: "singleField",
          operation: "validate",
          opsPerSecond: 1,
          relativeSpreadPercent: 1,
        },
      ],
      legacyComparison: EVERY_SHAPE_COMPARABLE,
    };
    expect(() => renderThroughputTable(partial)).toThrow(/singleField\/parse/);
  });
});

describe("the 1.x table marks the losses, from the measurement", () => {
  it("bolds a ratio below 1 and leaves a win plain", () => {
    const rendered = renderLegacyTable(
      baselineWith([
        {
          shape: "singleField",
          legacyOpsPerSecond: 100,
          currentOpsPerSecond: 50,
          speedup: 0.5,
        },
        {
          shape: "multiField",
          legacyOpsPerSecond: 100,
          currentOpsPerSecond: 200,
          speedup: 2,
        },
        ...EVERY_SHAPE_COMPARABLE.slice(2),
      ])
    );
    expect(rendered).toContain("| 1 field | 100 | 50 | **×0.50** |");
    expect(rendered).toContain("| 3 fields | 100 | 200 | ×2.00 |");
  });

  it("says not comparable instead of dropping a shape that could not be measured", () => {
    const rendered = renderLegacyTable(
      baselineWith([
        {
          shape: "singleField",
          legacyOpsPerSecond: null,
          currentOpsPerSecond: 4242,
          speedup: null,
        },
        ...EVERY_SHAPE_COMPARABLE.slice(1),
      ])
    );
    expect(rendered).toContain("| 1 field | not comparable | 4,242 | — |");
    expect(rendered.split("\n")).toHaveLength(SHAPES.length);
  });
});

describe("the spread range covers every recorded figure", () => {
  it("reports the lowest and the highest", () => {
    expect(renderSpreadRange(baselineWith(EVERY_SHAPE_COMPARABLE))).toBe(
      "3.0–8.0%"
    );
  });
});
