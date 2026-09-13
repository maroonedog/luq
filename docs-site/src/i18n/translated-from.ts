// ===========================================================================
// docs-site/src/i18n/translated-from.ts
//
// What each translated page was translated FROM, and when it was last checked
// against it.
//
// A translation goes stale silently. That is its whole failure mode: the
// English page gains a paragraph, the Japanese one does not, and nothing in
// the build says so — a reader gets the older claim with no indication that it
// is older. This site spends most of its machinery on not publishing a figure
// nobody can reproduce; a translation that has drifted is the same defect in
// prose.
//
// So each entry records the English source and a digest of it. When the source
// changes, the digest stops matching and `npm run check-translations` fails
// until someone has looked at the translation and re-recorded it. The check is
// not clever: it cannot know whether the translation is CORRECT, only whether
// anyone has looked since the source moved. That is the part a build can hold.
//
// FIGURES ARE NOT TRANSLATED AND CANNOT DRIFT. A translated page imports the
// same generated data module the English one does — competitors.ts,
// bundle-size.ts, perf-baseline.json — so there is no second copy of a number
// to go stale. What is written here is prose only, and the digest covers prose
// only.
// ===========================================================================

export interface TranslationRecord {
  /** The page this one translates, relative to docs-site/src/pages. */
  readonly source: string;
  /** The translation, relative to docs-site/src/pages. */
  readonly translation: string;
  /**
   * sha256 of the source file as it stood when the translation was last
   * checked against it. Written by `npm run check-translations -- --write`.
   */
  readonly sourceDigest: string;
  /** Why a section is deliberately not carried over, when one is not. */
  readonly notes?: readonly string[];
}

export const TRANSLATIONS: readonly TranslationRecord[] = Object.freeze([
  {
    source: "index.astro",
    translation: "ja/index.astro",
    sourceDigest: "a0d3d68186b93856bc0efbeb40936583bb4406fa512019f2ea513114025ddcd4",
    notes: [
      "The hero's must-fail block is shown with its original English comments:",
      "check:doc-examples compiles that exact text, and a translated comment",
      "would be a second copy of the claim that the compiler is not checking.",
    ],
  },
]);
