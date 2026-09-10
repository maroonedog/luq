// ===========================================================================
// scripts/check-conformance-figures.ts
//
// Checks that every conformance figure written in the published documentation
// matches the measured pin.
//
// It exists because of a real incident. After the pass rate went up, several
// pages went on showing the old one. Every one of them was self-consistent —
// the old numerator really did give the old percentage — so no check for
// internal contradiction could catch it. Catching it requires knowing what the
// current value is.
//
// One source: the pinned measurement, which the conformance test asserts in
// both directions. The site reads a generated copy of it, so what is left for
// this check is mostly Markdown, where generation is not an option.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

/** Only the fields of the pin this check reads. */
interface SuitePinCounts {
  readonly caseCount: number;
  readonly passingCases: number;
  readonly validCases: number;
  readonly invalidCases: number;
  readonly passingValidCases: number;
  readonly passingInvalidCases: number;
}

/** The fractions that may be written. No entry without a reason. */
interface AllowedFigure {
  readonly numerator: number;
  readonly denominator: number;
  readonly why: string;
}

export interface FigureViolation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly detail: string;
}

/** The one rounding used for display. It must match the site's generator. */
export function toPercent(part: number, whole: number): string {
  return ((part / whole) * 100).toFixed(2);
}

/**
 * Whether a written percentage roughly matches its fraction to two decimals.
 *
 * Roughly, because a hand-written figure may have been rounded or truncated:
 * 508 / 551 is 92.196%, which is 92.20 rounded and 92.19 truncated. Demanding
 * an exact match lets a stale truncated figure pass as "not a pass rate at
 * all", and one did.
 */
function isNearly(written: string, part: number, whole: number): boolean {
  return Math.abs(Number(written) - (part / whole) * 100) < 0.011;
}

export function readPinCounts(repositoryRoot: string): SuitePinCounts {
  const file = path.join(repositoryRoot, "config", "json-schema-suite.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as SuitePinCounts;
}

/**
 * Figures measured on the previous major are historical and do not move. They
 * are not in the pin but do appear in comparison tables. Only what is listed
 * here counts as "looks stale, is correct".
 */
const HISTORICAL: readonly AllowedFigure[] = Object.freeze([
  { numerator: 536, denominator: 929, why: "measured on the previous major" },
  {
    numerator: 24,
    denominator: 378,
    why: "cases the previous major judged invalid",
  },
  {
    numerator: 512,
    denominator: 551,
    why: "cases the previous major judged valid",
  },
]);

export function allowedFigures(pin: SuitePinCounts): readonly AllowedFigure[] {
  return Object.freeze([
    {
      numerator: pin.passingCases,
      denominator: pin.caseCount,
      why: "the current number of passing cases",
    },
    {
      numerator: pin.validCases,
      denominator: pin.caseCount,
      why: "the floor a validator that only ever returns true reaches",
    },
    {
      numerator: pin.passingValidCases,
      denominator: pin.validCases,
      why: "the breakdown of cases that should be judged valid",
    },
    {
      numerator: pin.passingInvalidCases,
      denominator: pin.invalidCases,
      why: "the breakdown of cases that should be judged invalid",
    },
    {
      numerator: pin.passingCases,
      denominator: pin.caseCount - 57,
      why: "the denominator with the external-$ref cases removed",
    },
    ...HISTORICAL,
  ]);
}

/** Matches both `855 (92.03%)` and `855 / 929 = 92.03%`. */
const FIGURE = /(\d{3,4})\s*(?:\/\s*(\d{3,4})\s*=\s*)?\(?(\d{1,3}\.\d{2})%\)?/g;

/**
 * The denominators this corpus uses. A percentage over anything else is not a
 * conformance figure at all and is left alone — otherwise this check starts
 * insisting that unrelated numbers are stale pass rates.
 */
function corpusDenominators(pin: SuitePinCounts): readonly number[] {
  return [pin.caseCount, pin.validCases, pin.invalidCases, pin.caseCount - 57];
}

function isConformanceFigure(
  numerator: number,
  percent: string,
  denominators: readonly number[]
): boolean {
  return denominators.some((denominator) =>
    isNearly(percent, numerator, denominator)
  );
}

function isAllowed(
  numerator: number,
  percent: string,
  allowed: readonly AllowedFigure[]
): boolean {
  return allowed.some(
    (figure) =>
      figure.numerator === numerator &&
      isNearly(percent, figure.numerator, figure.denominator)
  );
}

export function findFigureViolations(
  repositoryRoot: string,
  files: readonly string[],
  pin: SuitePinCounts
): readonly FigureViolation[] {
  const allowed = allowedFigures(pin);
  const denominators = corpusDenominators(pin);
  const violations: FigureViolation[] = [];
  for (const relative of files) {
    const absolute = path.join(repositoryRoot, relative);
    if (!fs.existsSync(absolute)) continue;
    const lines = fs.readFileSync(absolute, "utf8").split("\n");
    lines.forEach((text, index) => {
      for (const match of text.matchAll(FIGURE)) {
        const numerator = Number(match[1]);
        const percent = match[3] ?? "";
        if (!isConformanceFigure(numerator, percent, denominators)) continue;
        if (isAllowed(numerator, percent, allowed)) continue;
        violations.push({
          file: relative,
          line: index + 1,
          text: text.trim(),
          detail:
            `${numerator} … ${percent}% matches no recorded measurement. ` +
            `The current pass rate is ${pin.passingCases} / ${pin.caseCount} = ` +
            `${toPercent(pin.passingCases, pin.caseCount)}%. ` +
            "config/json-schema-suite.json is the only source.",
        });
      }
    });
  }
  return violations;
}

/** The places a pass rate can be written and generation is not an option. */
export const CHECKED_FILES: readonly string[] = [
  "README.md",
  "docs/json-schema-conformance.md",
];

if (require.main === module) {
  runCheckAndExit(() => {
    const pin = readPinCounts(REPOSITORY_ROOT);
    const violations = findFigureViolations(
      REPOSITORY_ROOT,
      CHECKED_FILES,
      pin
    );
    if (violations.length > 0) {
      throw new Error(
        violations
          .map(
            (one) => `${one.file}:${one.line}\n  ${one.text}\n  ${one.detail}`
          )
          .join("\n\n")
      );
    }
    console.log(
      `Conformance figures: ${CHECKED_FILES.length} files, no violations`
    );
    return 0;
  });
}
