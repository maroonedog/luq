// ===========================================================================
// bench/competitors/check-competitors.ts — the one CI runs.
//
// Two things, kept apart. **One is a gate; the other is a record.**
//
//   Agreement   Deterministic. If a competitor changes how strict its email
//               rule is, the number of agreed values changes. It does not
//               depend on the machine, so it can be a gate and should be —
//               timing a comparison whose verdicts disagree quietly destroys
//               what the comparison means.
//
//   Speed ratio Depends on the runner. Per-environment floors exist here
//               because the assumption that a ratio cancels the machine out
//               has already been disproved once; that mistake is not made
//               twice. CI measures it and **prints** it, and never fails on it.
//
// The recorded ratio and the CI ratio are printed side by side, so a
// difference in magnitude is visible to a person. No threshold, because
// adding one means having to justify the threshold separately.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { COMPETITORS } from "./index";
import { measureAllAgreement } from "./measure-agreement";
import { checkRecordedVersions } from "./check-recorded-versions";
import { reportCheckOutcome } from "./report-check-outcome";
import type { RecordedCompetitor } from "./check-recorded-versions";
import {
  measureAllRatios,
  summariseAgreement,
  writeCompetitorReport,
} from "./report-competitors";
import type { MeasuredRatio } from "./report-competitors";

const BASELINE = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "competitor-baseline.json"
);

interface RecordedAgreement {
  readonly shape: string;
  readonly competitor: string;
  readonly agreedValues: number;
  readonly disagreements: readonly unknown[];
}

interface RecordedRatio {
  readonly shape: string;
  readonly competitor: string;
  readonly ratio: number;
}

interface Baseline {
  readonly competitors: readonly RecordedCompetitor[];
  readonly agreement: readonly RecordedAgreement[];
  readonly measured: readonly RecordedRatio[];
}

function readBaseline(): Baseline {
  return JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Baseline;
}

function keyOf(shape: string, competitor: string): string {
  return `${shape}/${competitor}`;
}

/** Agreement only. Different here, and the comparison is a different one. */
function checkAgreement(
  baseline: Baseline,
  measuredAgreement: ReturnType<typeof measureAllAgreement>
): readonly string[] {
  const recorded = new Map(
    baseline.agreement.map((entry) => [
      keyOf(entry.shape, entry.competitor),
      entry,
    ])
  );
  const problems: string[] = [];

  for (const measured of measuredAgreement) {
    const key = keyOf(measured.shape, measured.competitor);
    const before = recorded.get(key);
    if (before === undefined) {
      problems.push(`${key}: a pairing appeared that is not in the record`);
      continue;
    }
    if (before.agreedValues !== measured.agreedValues.length) {
      problems.push(
        `${key}: agreed values changed from ${before.agreedValues} to ` +
          `${measured.agreedValues.length}, so the verdicts disagree more ` +
          `or less than they did — find out what changed before comparing speed`
      );
    }
    for (const disagreement of measured.disagreements) {
      const shown = JSON.stringify(disagreement.value)?.slice(0, 120);
      problems.push(
        `  ${key}: luq=${String(disagreement.luqSaid)} other=${String(!disagreement.luqSaid)} ${shown ?? ""}`
      );
    }
  }
  return problems;
}

function run(): void {
  const baseline = readBaseline();
  const recordedRatios = new Map(
    baseline.measured.map((entry) => [
      keyOf(entry.shape, entry.competitor),
      entry.ratio,
    ])
  );

  // Measured once, here. The same measurement is what gets judged and what
  // --write emits. Measuring separately for each meant every matchup was
  // timed twice, which was about half the job.
  const measuredAgreement = measureAllAgreement(COMPETITORS);
  const measuredRatios: readonly MeasuredRatio[] = measureAllRatios();

  const staleVersions = checkRecordedVersions(
    baseline.competitors,
    COMPETITORS
  );
  process.stdout.write("Recorded competitor versions:\n");
  if (staleVersions.length === 0) {
    process.stdout.write(
      "  every record was measured against the installed version\n"
    );
  } else {
    for (const line of staleVersions) process.stdout.write(`  ${line}\n`);
  }
  process.stdout.write("\n");

  const problems = checkAgreement(baseline, measuredAgreement);
  const disagreementsOnly = problems.every((line) => line.startsWith("  "));

  process.stdout.write("Agreement with competitors:\n");
  if (problems.length === 0) {
    process.stdout.write("  as recorded; nothing disagrees\n");
  } else {
    for (const line of problems) process.stdout.write(`${line}\n`);
  }

  process.stdout.write("\nSpeed ratio (this runner / recorded):\n");
  for (const measured of measuredRatios) {
    const key = keyOf(measured.shape, measured.competitor);
    const before = recordedRatios.get(key) ?? 0;
    process.stdout.write(
      `  ${key.padEnd(24)} ×${measured.ratio.toFixed(2)} / ×${before.toFixed(2)}\n`
    );
  }
  process.stdout.write(
    "\nRatios do not fail this check: they move when the runner does, which " +
      "is the same reason the floors are per environment.\n"
  );

  // Fails only when agreement differs from the record. A disagreement that is
  // already recorded is normal, so that line alone passes.
  const agreementFailed = problems.length > 0 && !disagreementsOnly;
  const versionsStale = staleVersions.length > 0;
  if (agreementFailed || versionsStale) {
    process.exitCode = 1;
  }

  // Which of the two it was, for the workflow. A stale version is something CI
  // can offer to fix by re-measuring; a moved verdict is not, and must not be
  // written into the baseline as though it were expected.
  reportCheckOutcome({ agreementFailed, versionsStale });

  // --write emits the very measurement that was judged. CI uploads it as an
  // artifact; measured separately, the artifact's figures would not
  // necessarily be the figures that passed.
  if (process.argv.includes("--write")) {
    writeCompetitorReport(
      summariseAgreement(measuredAgreement),
      measuredRatios
    );
  }
}

run();
