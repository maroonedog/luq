// ===========================================================================
// test/json-schema/suite-skip-list.ts — THE ONLY PERMITTED EXCLUSION from the
// JSON-Schema-Test-Suite corpus.
//
// TYPED DATA, NEVER JSON. Every entry has to name a `cause` from a closed
// union, a `reason` a reviewer can read, and an `expiresWith` naming the thing
// that must exist before the entry may be deleted — and all three are enforced
// by the compiler, not by a review convention: `cause` and `expiresWith` are
// string-literal unions, `reason` is a required property, and a missing or
// misspelled one is a type error rather than a silently ignored field.
//
// WHAT STOPS THIS LIST FROM ROTTING: `findStaleSkips()` in
// test/integration/json-schema-suite.test.ts runs every skipped case anyway
// and FAILS the build when one of them passes. A skip is therefore an
// assertion that the case still fails, not a place to hide a regression. The
// published pass rate in docs/json-schema-conformance.md counts skipped cases
// as FAILURES; skipping changes what the build reports, never the number.
// ===========================================================================

/**
 * Why a case is excluded. Closed: a new kind of failure has to be named here
 * before it can be skipped, which is what makes the list reviewable.
 *
 * IT IS EMPTY, and that is the point. Every cause this union once carried was
 * deleted when the thing it was waiting for got built, and the list below is
 * empty too — the corpus passes 929 of 929. A `never` here means `SuiteSkip`
 * cannot be constructed at all, so re-introducing a skip is not a matter of
 * adding a row: it takes adding a name to this union, in a diff a reviewer
 * reads. That is exactly the friction the list is for.
 */
export type SuiteSkipCause = never;

/**
 * WHAT MUST EXIST before the entry may be deleted. `feature:` names conversion
 * work and `decision:` names an entry that is only removable if a recorded
 * decision is reversed (the reserved-segment refusal is deliberate, so its
 * entries are the ones expected to outlive the rest).
 *
 * The `plugin:` arm is GONE, and so are the `unsupported-format` and
 * `structural-equality` causes: every entry they carried has been deleted
 * because the thing it waited for now exists. A dead name here is an
 * invitation to re-skip under an old excuse, so the union shrinks with the
 * list.
 */
export type SuiteSkipExpiry = never;

export interface SuiteSkip {
  /** File name under tests/draft7, e.g. "ref.json". */
  readonly file: string;
  /** The group's `description`. */
  readonly group: string;
  /** One case's `description`. ABSENT means the whole group. */
  readonly test?: string;
  readonly cause: SuiteSkipCause;
  readonly reason: string;
  readonly expiresWith: SuiteSkipExpiry;
}

/** Empty. The corpus passes 929 / 929; nothing is excluded. */
export const SUITE_SKIPS: readonly SuiteSkip[] = Object.freeze([]);
/** True when this exact case is excluded, or its whole group is. */
export function findSuiteSkip(
  file: string,
  group: string,
  test: string
): SuiteSkip | undefined {
  return SUITE_SKIPS.find(
    (skip) =>
      skip.file === file &&
      skip.group === group &&
      (skip.test === undefined || skip.test === test)
  );
}
