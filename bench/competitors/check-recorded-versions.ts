// ===========================================================================
// bench/competitors/check-recorded-versions.ts
//
// The recorded competitor versions must be the installed ones.
//
// Without this the baseline can quietly describe a library nobody runs any
// more, and the published ratio becomes a claim about history. It did: the
// lockfile held zod 4.0.14 for fourteen months while 4.6.2 shipped, and most
// of the "19.28x faster than zod" figure was zod's old error-construction path
// rather than a difference in validation. Nothing failed, because nothing was
// comparing the two numbers.
//
// Agreement is gated against behaviour and speed is only printed, so this is
// the one place a stale dependency can be caught at all. .github/dependabot.yml
// raises the bump; this refuses to let the old figure stand once it lands.
// ===========================================================================

/** The version each recorded figure was measured against. */
export interface RecordedCompetitor {
  readonly name: string;
  readonly version: string;
}

export interface InstalledCompetitor {
  readonly name: string;
  readonly version: string;
}

export function checkRecordedVersions(
  recordedCompetitors: readonly RecordedCompetitor[],
  installedCompetitors: readonly InstalledCompetitor[]
): readonly string[] {
  const recorded = new Map(
    recordedCompetitors.map((entry) => [entry.name, entry.version])
  );
  const problems: string[] = [];

  for (const installed of installedCompetitors) {
    const before = recorded.get(installed.name);
    if (before === undefined) {
      problems.push(
        `${installed.name}: installed at ${installed.version} and absent from the record`
      );
      continue;
    }
    if (before !== installed.version) {
      problems.push(
        `${installed.name}: the record was measured against ${before}, ` +
          `${installed.version} is installed — re-record with ` +
          "`npm run bench:competitors` before the published ratio is quoted again"
      );
    }
  }

  return problems;
}
