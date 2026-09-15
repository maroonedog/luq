// ===========================================================================
// bench/compare/compare-checkouts.mjs
// Two checkouts of this repository, measured against each other ON ONE MACHINE.
//
// WHY THIS EXISTS. The published figures come from one machine at one moment,
// and a laptop reading cannot be compared against a CI reading — that mistake
// was made in this repository and corrected. What means something is before
// and after measured the same way, and the only way to be sure the machine is
// the same is to measure both sides inside one job.
//
// THE PROTOCOL, recorded in config/size-budget.json. Interference on a shared
// machine is one-sided: a sample can only be made slower, never faster. So the
// fast tail is the signal and the estimator is best-of-N per side, not a mean.
// The sides alternate, and which side goes first alternates too, because a
// runner that is slow for the first thirty seconds would otherwise be charged
// entirely to whichever side ran first.
//
// IT DOES NOT SUPPLY THE APPARATUS. Each directory must already hold a bench/
// that can measure it, and the caller is responsible for making those two
// identical — perf-compare.yml copies one bench/ into both sides before
// calling this. Letting each side bring its own would measure changes to the
// harness as if they were changes to the library, which is exactly how three
// recorded competitor figures in this repository became uncomparable.
//
// HOW TO READ IT. Run it with both paths pointing at the SAME commit first.
// That reading is the floor, and a difference smaller than it is not a result.
// Fourteen rounds a side resolved 0.1% on identical code locally; six rounds
// reported 6.9% on identical code, which is why the default is not six.
//
//   node bench/compare/compare-checkouts.mjs <baseDir> <headDir> [rounds]
// ===========================================================================
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const [, , baseDir, headDir, roundsArgument] = process.argv;
if (baseDir === undefined || headDir === undefined) {
  process.stderr.write(
    "usage: node bench/compare/compare-checkouts.mjs <baseDir> <headDir> [rounds]\n"
  );
  process.exit(2);
}
for (const directory of [baseDir, headDir]) {
  if (!existsSync(join(directory, "package.json"))) {
    throw new Error(`${directory} is not a checkout of this repository`);
  }
}
const ROUNDS = Number(roundsArgument ?? 14);

/** One reading of one checkout: shape name to ops/sec. */
function measure(directory) {
  const result = spawnSync(
    "npx",
    [
      "ts-node",
      "--project",
      "bench/tsconfig.json",
      "bench/compare/measure-side.ts",
    ],
    { cwd: directory, encoding: "utf8", shell: process.platform === "win32" }
  );
  if (result.status !== 0) {
    throw new Error(`measuring ${directory} failed:\n${result.stderr}`);
  }
  const readings = new Map();
  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const parsed = JSON.parse(trimmed);
    readings.set(parsed.shape, parsed.opsPerSecond);
  }
  if (readings.size === 0) throw new Error(`${directory} reported no shapes`);
  return readings;
}

const best = { base: new Map(), head: new Map() };
const keepBest = (side, readings) => {
  for (const [shape, opsPerSecond] of readings) {
    const standing = best[side].get(shape) ?? 0;
    // Best-of: the fastest reading is the one least interfered with.
    if (opsPerSecond > standing) best[side].set(shape, opsPerSecond);
  }
};

for (let round = 0; round < ROUNDS; round += 1) {
  const order = round % 2 === 0 ? ["base", "head"] : ["head", "base"];
  for (const side of order) {
    keepBest(side, measure(side === "base" ? baseDir : headDir));
  }
  process.stderr.write(`round ${String(round + 1)}/${String(ROUNDS)}\n`);
}

const format = (value) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 0 });
const lines = [
  `Best of ${String(ROUNDS)} per side, alternating, one machine.`,
  "",
  "| shape | base ops/sec | head ops/sec | change |",
  "| --- | ---: | ---: | ---: |",
];
for (const shape of best.base.keys()) {
  const baseValue = best.base.get(shape) ?? 0;
  const headValue = best.head.get(shape) ?? 0;
  const change = ((headValue - baseValue) / baseValue) * 100;
  lines.push(
    `| ${shape} | ${format(baseValue)} | ${format(headValue)} | ` +
      `${change >= 0 ? "+" : ""}${change.toFixed(1)}% |`
  );
}
lines.push(
  "",
  "Run both paths at the SAME commit to learn this machine's floor; a change",
  "smaller than that floor is not a result."
);

const report = lines.join("\n");
process.stdout.write(`${report}\n`);

const { appendFileSync, writeFileSync } = await import("node:fs");

const summaryFile = process.env["GITHUB_STEP_SUMMARY"];
if (summaryFile !== undefined && summaryFile !== "") {
  appendFileSync(summaryFile, `${report}\n`, "utf8");
}

// One job's reading, for the layer above. This job's comparison already
// cancels the machine it ran on — both sides were measured here — so what
// summarize-runs.mjs collects across jobs is the CHANGE, never the absolute
// rate. Absolute rates are not comparable between jobs: the same commit
// measured as base came back at 9.18M, 9.50M and 11.84M ops/sec on three
// runners within an hour.
const resultFile = process.env["PERF_COMPARE_OUT"];
if (resultFile !== undefined && resultFile !== "") {
  const { cpus } = await import("node:os");
  writeFileSync(
    resultFile,
    `${JSON.stringify(
      {
        rounds: ROUNDS,
        cpuModel: cpus()[0]?.model ?? "unknown",
        logicalCores: cpus().length,
        shapes: [...best.base.keys()].map((shape) => {
          const baseValue = best.base.get(shape) ?? 0;
          const headValue = best.head.get(shape) ?? 0;
          return {
            shape,
            baseOpsPerSecond: baseValue,
            headOpsPerSecond: headValue,
            changePercent: ((headValue - baseValue) / baseValue) * 100,
          };
        }),
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}
