// ===========================================================================
// test/unit/plugins/string/string-model.ts
// The one-field model every string boundary table runs against, plus the two
// things all 25 tables need: a way to push a WRONG-TYPED value through a
// typed entry point, and a way to read the issues back.
//
// Nothing here asserts. The tables in the sibling files are the tests.
// ===========================================================================
import type { ValidationIssue } from "../../../../src/index";

export interface StringModel {
  readonly text: string;
}

/** The type system says `text` is a string; these tables deliberately lie. */
export function feed(value: unknown): StringModel {
  return { text: value } as unknown as StringModel;
}

export interface StringValidator {
  validate(input: StringModel): {
    readonly valid: boolean;
    readonly issues: readonly ValidationIssue[];
  };
}

export function isAccepted(
  validator: StringValidator,
  value: unknown
): boolean {
  return validator.validate(feed(value)).valid;
}

export function issuesOf(
  validator: StringValidator,
  value: unknown
): readonly ValidationIssue[] {
  return validator.validate(feed(value)).issues;
}

export function firstIssue(
  validator: StringValidator,
  value: unknown
): ValidationIssue {
  const issues = issuesOf(validator, value);
  const issue = issues[0];
  if (issue === undefined) throw new Error("expected at least one issue");
  return issue;
}

/**
 * True when nothing but the slot's own type check objected.
 *
 * What these tables assert is that the PLUGIN stays out of it: a value rule
 * answers PASS for a value outside its own type, because reporting the type
 * belongs to the slot and a second report would mean two issues for one bad
 * value. So they must look past `stringType` rather than at the field's
 * verdict, which the slot legitimately fails.
 */
export function passesThrough(
  validator: StringValidator,
  value: unknown
): boolean {
  return issuesOf(validator, value).every(
    (issue) => issue.code === "stringType"
  );
}

/** Wrong types and absent values are the slot guard's and presence's job. */
export const NON_STRINGS: readonly unknown[] = [
  undefined,
  null,
  42,
  true,
  {},
  [],
];
