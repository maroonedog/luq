// ===========================================================================
// scripts/check-perf-figures.ts
//
// Checks the performance tables in docs/measurements.md against the recorded
// baseline, and writes them back with `--write`.
//
//   npm run generate:perf-figures    write them back
//   npm run check:perf-figures       exit 1 if they differ (for CI)
//
// Why a check is needed. Same failure as with the conformance figures: the
// numbers in the document are **self-consistent**. Every one of them was true
// when it was written. No check for contradiction catches that; catching it
// takes knowing what the current value is, and only the recorded baseline
// knows — written by the benchmark and by nothing else.
//
// The tables are fenced by generation markers and only the inside is replaced,
// so the prose around them — why a shape loses, what was verified — stays as a
// person wrote it. The numbers are automatic; the interpretation is not.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import {
  renderCoreShare,
  renderLegacySimpleOps,
  renderLegacyTable,
  renderSizeTable,
  renderSpreadRange,
  renderThroughputTable,
} from "./perf-figures/render-perf-tables";
import type {
  PerfBaseline,
  SizeBudget,
} from "./perf-figures/render-perf-tables";

export const FIGURES_FILE = path.join("docs", "measurements.md");
const BASELINE = path.join("config", "perf-baseline.json");
const SIZE_BUDGET = path.join("config", "size-budget.json");

/** The sources read. Both are written by measurement, never by hand. */
interface Sources {
  readonly baseline: PerfBaseline;
  readonly budget: SizeBudget;
}

interface GeneratedBlock {
  readonly name: string;
  readonly render: (sources: Sources) => string;
  /** A marker inside a sentence. Inserted as-is; a newline would break the paragraph. */
  readonly isInline?: boolean;
}

const BLOCKS: readonly GeneratedBlock[] = [
  { name: "perf-throughput", render: (s) => renderThroughputTable(s.baseline) },
  { name: "perf-legacy", render: (s) => renderLegacyTable(s.baseline) },
  {
    name: "perf-spread",
    render: (s) => renderSpreadRange(s.baseline),
    isInline: true,
  },
  {
    name: "perf-legacy-simple",
    render: (s) => renderLegacySimpleOps(s.baseline),
    isInline: true,
  },
  { name: "bundle-size", render: (s) => renderSizeTable(s.budget) },
  {
    name: "bundle-core-share",
    render: (s) => renderCoreShare(s.budget),
    isInline: true,
  },
];

function openMarker(name: string): string {
  return `<!-- generated:${name} -->`;
}

function closeMarker(name: string): string {
  return `<!-- /generated:${name} -->`;
}

export function readSources(repositoryRoot: string): Sources {
  return {
    baseline: JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, BASELINE), "utf8")
    ) as PerfBaseline,
    budget: JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, SIZE_BUDGET), "utf8")
    ) as SizeBudget,
  };
}

/**
 * A missing marker, or only one of the pair, is a violation. Passing quietly
 * would mean deleting a marker disables the check, which is the easiest way to
 * remove a gate and must not be available.
 */
function replaceBlock(
  contents: string,
  name: string,
  rendered: string,
  isInline: boolean
): string {
  const open = openMarker(name);
  const close = closeMarker(name);
  const from = contents.indexOf(open);
  const to = contents.indexOf(close);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`${FIGURES_FILE} has no matching ${open} … ${close} pair`);
  }
  const head = contents.slice(0, from + open.length);
  const tail = contents.slice(to);
  return isInline
    ? `${head}${rendered}${tail}`
    : `${head}\n${rendered}\n${tail}`;
}

export function renderReadme(repositoryRoot: string, sources: Sources): string {
  const file = path.join(repositoryRoot, FIGURES_FILE);
  let contents = fs.readFileSync(file, "utf8");
  for (const block of BLOCKS) {
    contents = replaceBlock(
      contents,
      block.name,
      block.render(sources),
      block.isInline === true
    );
  }
  return contents;
}

export function checkPerfFigures(repositoryRoot: string): number {
  const expected = renderReadme(repositoryRoot, readSources(repositoryRoot));
  const actual = fs.readFileSync(
    path.join(repositoryRoot, FIGURES_FILE),
    "utf8"
  );
  if (expected === actual) {
    console.error(
      `Performance figures: ${FIGURES_FILE} matches the measurements`
    );
    return 0;
  }
  console.error(
    `${FIGURES_FILE} disagrees with ${BASELINE} / ${SIZE_BUDGET}. ` +
      "Run npm run generate:perf-figures to write it back."
  );
  return 1;
}

export function writePerfFigures(repositoryRoot: string): number {
  fs.writeFileSync(
    path.join(repositoryRoot, FIGURES_FILE),
    renderReadme(repositoryRoot, readSources(repositoryRoot)),
    "utf8"
  );
  console.error(`Generated: the performance tables in ${FIGURES_FILE}`);
  return 0;
}

if (require.main === module) {
  const shouldWrite = process.argv.includes("--write");
  runCheckAndExit(() =>
    shouldWrite
      ? writePerfFigures(REPOSITORY_ROOT)
      : checkPerfFigures(REPOSITORY_ROOT)
  );
}
