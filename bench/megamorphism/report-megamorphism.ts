// ===========================================================================
// bench/megamorphism/report-megamorphism.ts
//
// Runs the matrix and prints it; writes config/megamorphism-baseline.json only
// where a recording is allowed to come from.
//
//   npx ts-node --project bench/tsconfig.json bench/megamorphism/report-megamorphism.ts
//   npm run bench:megamorphism
//
// The recording rule is the one bench/competitors/report-competitors.ts
// already carries, for the same reason. What this file records is a RATIO
// between two figures taken on the same machine, and a ratio moves with the
// machine: the effect being measured is how V8 behaves once a call site has
// many targets, which depends on the CPU, the core count and the Node version.
// A laptop recording silently replacing a runner recording would change the
// machine and the figure in one commit and leave nobody able to say which
// moved the number. `--local` is the deliberate way through and is meant to be
// visible in a diff, because the machine block in the written file says what
// it ran on.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { measureMegamorphism } from "./measure-megamorphism";
import type { MegamorphismMeasurement } from "./measure-megamorphism";

const OUTPUT = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "megamorphism-baseline.json"
);

const NOTE: readonly string[] = [
  "How per-call throughput moves when many DIFFERENT validators are alive, measured by bench/megamorphism/.",
  "Each window is measured in its own child process, because V8's inline caches are process-wide and a",
  "one-validator figure taken after a forty-validator run in the same process cannot see the effect at all.",
  "degradationPercent is against the same lane's one-validator point; POSITIVE MEANS SLOWER, and a negative",
  "number means the larger window measured faster, which is what no effect plus noise looks like.",
  "Accepted and rejected pools are timed separately: under abortEarly the rejection path is a different",
  "program, and a pool that mixed the two would measure error construction as much as validation.",
  "The liveValues lane holds the working set equal with one set of call targets, so the liveValidators lane",
  "can be read net of it. Neither lane varies the SIZE of a validator; every family member does equal work.",
  "READ `resolution` FIRST. Both lanes start from the identical one-validator window, so their two first",
  "points are one request measured twice and their gap is what this run could not resolve. A degradation",
  "smaller than that gap is noise about the machine, not a fact about the library.",
];

export class MegamorphismRecordingRefused extends Error {}

export function refuseToRecordOutsideCi(
  env: Readonly<Record<string, string | undefined>>,
  argv: readonly string[]
): void {
  const inCi = env["CI"] === "true" || env["CI"] === "1";
  if (inCi || argv.includes("--local")) return;
  throw new MegamorphismRecordingRefused(
    "config/megamorphism-baseline.json is a published measurement and is recorded on CI's runner.\n" +
      "How V8 behaves once a call site is megamorphic moves with the machine, so a local recording is\n" +
      "not a drop-in replacement for one. Run it in CI, or pass --local if you mean to replace the\n" +
      "record from this machine."
  );
}

export function printMeasurement(
  measured: MegamorphismMeasurement,
  write: (line: string) => void
): void {
  write(
    `machine: ${measured.machine.cpuModel} / ${measured.machine.logicalCores} cores / node ${measured.machine.nodeVersion}\n`
  );
  write(
    `resolution: the two lanes measured the same one-validator window and disagreed by ` +
      `${measured.resolution.acceptedPercent}% (accepted) and ${measured.resolution.rejectedPercent}% ` +
      `(rejected). A degradation smaller than ${measured.resolution.worstPercent}% is not evidence.\n`
  );
  for (const lane of measured.lanes) {
    write(`\n${lane.name}: ${lane.question}\n`);
    write(
      "  window  values  accepted ops/sec   vs 1    rejected ops/sec   vs 1   runs\n"
    );
    for (const point of lane.points) {
      write(
        `  ${String(point.validatorCount).padStart(6)}  ${String(point.distinctValues).padStart(6)}` +
          `  ${String(point.acceptedOpsPerSecond).padStart(16)}` +
          `  ${point.acceptedDegradationPercent.toFixed(2).padStart(6)}%` +
          `  ${String(point.rejectedOpsPerSecond).padStart(16)}` +
          `  ${point.rejectedDegradationPercent.toFixed(2).padStart(6)}%` +
          `  ${String(point.runs).padStart(4)}${point.everyRunQuiet ? "" : "  MACHINE WAS NOISY"}\n`
      );
    }
  }
}

export function writeMegamorphismReport(
  measured: MegamorphismMeasurement
): void {
  refuseToRecordOutsideCi(process.env, process.argv);
  fs.writeFileSync(
    OUTPUT,
    `${JSON.stringify({ note: NOTE, ...measured }, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(
    `config/megamorphism-baseline.json: recorded ${measured.lanes.length} lanes\n`
  );
}

/** `--repeats=<n>` is for exploring a change quickly; the default is the record. */
function readRepeatCount(argv: readonly string[]): number | undefined {
  const found = argv.find((argument) => argument.startsWith("--repeats="));
  if (found === undefined) return undefined;
  const value = Number(found.slice("--repeats=".length));
  if (!Number.isInteger(value) || value < 1) {
    throw new MegamorphismRecordingRefused(
      `--repeats wants a whole number of processes per window, got "${found}"`
    );
  }
  return value;
}

function run(): void {
  const measured = measureMegamorphism({
    repeatCount: readRepeatCount(process.argv),
    onProgress: (line) => process.stderr.write(`${line}\n`),
  });
  printMeasurement(measured, (line) => process.stdout.write(line));
  if (process.argv.includes("--write")) writeMegamorphismReport(measured);
}

// Runs only as the entry point: importing printMeasurement from here must not
// start a five-minute measurement.
if (require.main === module) {
  try {
    run();
  } catch (failure) {
    process.stderr.write(
      `${failure instanceof Error ? failure.message : String(failure)}\n`
    );
    process.exitCode = 1;
  }
}
