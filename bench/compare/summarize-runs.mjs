// ===========================================================================
// bench/compare/summarize-runs.mjs
// Many jobs' readings, reduced to one figure per shape: THE MEDIAN CHANGE.
//
// WHY A LAYER ABOVE THE JOB EXISTS AT ALL. One job compares two commits on one
// machine, which is the only way the comparison means anything. What it cannot
// do is tell you whether the machine it drew was representative. Measured on
// this repository's runners, the SAME commit as base came back at 9.18M, 9.50M
// and 11.84M ops/sec within an hour — a 29% spread with nothing changed —
// and two runs of one real comparison disagreed by eleven points on one shape
// and flipped its sign. A single job is one sample of a noisy population.
//
// WHY THE MEDIAN AND NOT THE BEST. Inside a job, best-of is right: interference
// on a shared machine only ever slows a sample down, so the fast tail is the
// signal. Between jobs that reasoning does not hold — the jobs did not
// interfere with each other, they ran on DIFFERENT machines. Taking the best
// across them would report whichever runner happened to be quickest, which is
// a fact about GitHub's fleet. The median is the middle machine.
//
// WHY CHANGES AND NOT RATES. Each job's change already has its machine divided
// out, because both sides were measured on it. Absolute rates from different
// jobs are not comparable and are never pooled here; they are printed per job
// so a reader can see the spread that makes this layer necessary.
//
//   node bench/compare/summarize-runs.mjs <directory of *.json readings>
// ===========================================================================
import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const directory = process.argv[2];
if (directory === undefined) {
  process.stderr.write("usage: node bench/compare/summarize-runs.mjs <dir>\n");
  process.exit(2);
}

/** Every reading a job left behind, at any depth — artifacts arrive nested. */
function collectReadings(root) {
  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectReadings(full));
    } else if (entry.name.endsWith(".json")) {
      found.push(JSON.parse(readFileSync(full, "utf8")));
    }
  }
  return found;
}

const readings = collectReadings(directory);
if (readings.length === 0) throw new Error(`no readings under ${directory}`);

/** Middle value; for an even count, the mean of the two middle ones. */
function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

const byShape = new Map();
for (const reading of readings) {
  for (const entry of reading.shapes) {
    const list = byShape.get(entry.shape) ?? [];
    list.push(entry);
    byShape.set(entry.shape, list);
  }
}

const sign = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

const lines = [
  `## Median of ${String(readings.length)} jobs`,
  "",
  "Each job measured both sides on one machine, so its change has that machine",
  "divided out. The median is across jobs, never across absolute rates.",
  "",
  "| shape | median change | slowest job | fastest job | jobs |",
  "| --- | ---: | ---: | ---: | ---: |",
];
for (const [shape, entries] of byShape) {
  const changes = entries.map((entry) => entry.changePercent);
  lines.push(
    `| ${shape} | **${sign(median(changes))}** | ${sign(Math.min(...changes))} | ` +
      `${sign(Math.max(...changes))} | ${String(changes.length)} |`
  );
}

lines.push(
  "",
  "### The spread this layer exists for",
  "",
  "Absolute rates for the SAME base commit, one row per job. These are not",
  "pooled and must not be: they are here so the range is visible.",
  "",
  "| job | machine | base singleField ops/sec |",
  "| --- | --- | ---: |"
);
readings.forEach((reading, index) => {
  const single = reading.shapes.find((entry) => entry.shape === "singleField");
  lines.push(
    `| ${String(index + 1)} | ${reading.cpuModel} | ` +
      `${(single?.baseOpsPerSecond ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} |`
  );
});

const report = lines.join("\n");
process.stdout.write(`${report}\n`);

const summaryFile = process.env["GITHUB_STEP_SUMMARY"];
if (summaryFile !== undefined && summaryFile !== "") {
  appendFileSync(summaryFile, `${report}\n`, "utf8");
}
