#!/usr/bin/env node
// ===========================================================================
// scripts/run-bench.ts — the two things anyone does with bench/.
//
//   run-bench --record [--recalibrate-floors]
//       Measures everything and REWRITES config/perf-baseline.json. Slow
//       (minutes). Run on a quiet, named machine; the machine is recorded into
//       the file automatically. --recalibrate-floors is the only way to move a
//       CI floor, so moving one is always a visible diff in a reviewed commit.
//
//   run-bench --gate
//       What CI runs. Measures luq_ops / reference_ops for each shape in this
//       process and exits non-zero below the recorded floor. Absolute ops/sec
//       is printed for information and gated on by NOTHING: a shared runner's
//       absolute throughput is not a property of this repository.
//
// Exit codes: 0 pass, 1 a floor was breached or the baseline is unusable,
// 2 the arguments made no sense.
// ===========================================================================
import { writeFileSync } from "fs";
import {
  PERF_BASELINE_PATH,
  gateThroughputRatio,
  recordPerfBaseline,
} from "../bench/index";

function printRecorded(): void {
  const recalibrate = process.argv.includes("--recalibrate-floors");
  process.stdout.write(
    `recording perf baseline${recalibrate ? " (recalibrating CI floors)" : ""}...\n`
  );
  const baseline = recordPerfBaseline({ recalibrateFloors: recalibrate });
  writeFileSync(
    PERF_BASELINE_PATH,
    `${JSON.stringify(baseline, null, 2)}\n`,
    "utf8"
  );

  process.stdout.write(
    `\nmachine: ${baseline.machine.cpuModel} / ${baseline.machine.logicalCores} cores / node ${baseline.machine.nodeVersion}\n`
  );
  process.stdout.write(
    "\nthroughput (ops/sec, median of the fastest half of 9 samples)\n"
  );
  for (const record of baseline.throughput) {
    process.stdout.write(
      `  ${record.shape.padEnd(12)} ${record.operation.padEnd(9)} ${String(
        record.opsPerSecond
      ).padStart(12)}  (spread ${record.relativeSpreadPercent}%${
        record.isQuiet ? "" : ", MACHINE WAS NOISY"
      })\n`
    );
  }
  process.stdout.write("\nbuild() versus validate()\n");
  for (const record of baseline.buildCost) {
    process.stdout.write(
      `  ${record.shape.padEnd(12)} ${String(
        record.microsecondsPerBuild
      ).padStart(
        9
      )} us/build   one build pays for ${record.validateCallsPerBuild} validate() calls${
        record.isQuiet ? "" : "   (MACHINE WAS NOISY)"
      }\n`
    );
  }
  process.stdout.write(
    "\nversus the 1.x sources (git archive of the legacy ref)\n"
  );
  for (const record of baseline.legacyComparison) {
    const legacy =
      record.legacyOpsPerSecond === null
        ? "not comparable"
        : `${record.legacyOpsPerSecond} -> ${record.currentOpsPerSecond} (x${record.speedup})`;
    process.stdout.write(`  ${record.shape.padEnd(12)} ${legacy}\n`);
  }
  process.stdout.write(`\nwrote ${PERF_BASELINE_PATH}\n`);

  const noisy = [
    ...baseline.throughput.filter((record) => !record.isQuiet),
    ...baseline.buildCost.filter((record) => !record.isQuiet),
    ...baseline.referenceRatio.filter((record) => !record.isQuiet),
  ];
  if (noisy.length > 0) {
    process.stderr.write(
      `\nWARNING: ${noisy.length} figure(s) were still noisy after retrying. The machine was busy; re-record on a quiet one before quoting them.\n`
    );
  }
}

function runGate(): number {
  const report = gateThroughputRatio();
  process.stdout.write(
    `ratio gate against floors recorded ${report.recordedAt}\n`
  );
  for (const outcome of report.outcomes) {
    process.stdout.write(
      `  ${outcome.passed ? "PASS" : "FAIL"} ${outcome.shape.padEnd(12)} ratio ${outcome.ratio.toFixed(
        4
      )} (floor ${outcome.ratioFloor.toFixed(4)})  luq ${Math.round(
        outcome.luqOpsPerSecond
      )} / reference ${Math.round(outcome.referenceOpsPerSecond)} ops/sec\n`
    );
  }
  if (report.failures.length === 0) {
    process.stdout.write(
      `\nall ${report.outcomes.length} shapes are within their recorded ratio floor\n`
    );
    return 0;
  }
  process.stderr.write(
    `\n${report.failures.length} shape(s) below floor. Luq got slower RELATIVE to a hand-written validator measured in the same process, so this is not runner noise.\n`
  );
  return 1;
}

function main(): number {
  if (process.argv.includes("--record")) {
    printRecorded();
    return 0;
  }
  if (process.argv.includes("--gate")) return runGate();
  process.stderr.write(
    "usage: run-bench --record [--recalibrate-floors] | --gate\n"
  );
  return 2;
}

try {
  process.exitCode = main();
} catch (failure) {
  process.stderr.write(
    `${failure instanceof Error ? failure.message : String(failure)}\n`
  );
  process.exitCode = 1;
}
