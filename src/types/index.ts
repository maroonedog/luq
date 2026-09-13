// ===========================================================================
// L0  src/types/index.ts — the vocabulary layer. No imports, no mutable state.
// ===========================================================================
export type TypeName =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "array"
  | "tuple"
  | "object"
  | "union"
  | "any";

/** The extra members a plugin contributes to its own message context. */
export type MessageContextExtra = object;

export interface MessageContext {
  readonly path: string;
  readonly value: unknown;
  readonly code: string;
}

export type MessageFactory<
  C extends MessageContextExtra = MessageContextExtra,
> = (context: MessageContext & C) => string;

/**
 * User decision 8 keeps severity. The legacy three-level SEVERITY
 * (INFO / WARN / ERROR) is carried over verbatim in meaning, spelled
 * lower-case to match every other string vocabulary in L0.
 */
export type IssueSeverity = "error" | "warning" | "info";

export interface RuleOptions<
  C extends MessageContextExtra = MessageContextExtra,
> {
  readonly code?: string;
  readonly messageFactory?: MessageFactory<C>;
  /** Per-call override. Legacy ValidationOptions.severity, same meaning. */
  readonly severity?: IssueSeverity;
}

export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
  /** Never optional: the chain resolves it once at build time, so a reader
   *  never has to re-implement the "absent means error" fallback. */
  readonly severity: IssueSeverity;
  /**
   * Why a composite failed, when the failing rule is one.
   *
   * `allOf`, `anyOf` and `oneOf` report their own code, which says WHICH
   * applicator failed and never why. The branch failures behind it land here,
   * so a caller can reach "minLength" without re-running the sub-schemas.
   *
   * ABSENT, not undefined, on an ordinary issue. A key present everywhere
   * would make `"causes" in issue` answer true for every issue the library
   * reports, which is the opposite of what it is for.
   */
  readonly causes?: readonly ValidationIssue[];
}

/** branch / index / causes let a composite failure explain itself. */
export interface IssueDetail {
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly branch?: string;
  readonly index?: number;
  readonly causes?: readonly ValidationIssue[];
}

export type CheckOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly detail: IssueDetail };

export const PASS: CheckOutcome = { ok: true };

export function fail(detail: IssueDetail): CheckOutcome {
  return { ok: false, detail };
}

/**
 * What a cross-field check may answer: a boolean, or a boolean with a message.
 *
 * It lives at the bottom layer because the chain layer needs it to build the
 * caller-facing type of `stitch`. Left in the plugin, that would be an import
 * running outward from the chain, which no layer may do. The plugin's
 * `StitchOutcome` is an alias of this one, so the public name is unchanged.
 */
export interface CrossFieldOutcome {
  readonly valid: boolean;
  readonly message?: string;
}

export interface ArrayItemContext {
  readonly index: number;
  readonly item: unknown;
  readonly array: readonly unknown[];
}

export interface RuleContext {
  readonly root: unknown;
  readonly path: string;
  readonly item?: ArrayItemContext;
  /** The ONE channel a pre-resolved async context arrives on. */
  readonly external?: Readonly<Record<string, unknown>>;
}

/** L0 keeps only the two presence flags. L3 extends it with guard coverage. */
export interface PresenceState {
  readonly undefinedAllowed: boolean;
  readonly nullAllowed: boolean;
}

export type Present<T, S extends PresenceState> = Exclude<
  T,
  | (S["undefinedAllowed"] extends false ? undefined : never)
  | (S["nullAllowed"] extends false ? null : never)
>;

export function isString(value: unknown): value is string {
  return typeof value === "string";
}
export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}
export function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isStringArray(value: unknown): value is readonly string[] {
  return isArray(value) && value.every(isString);
}

/**
 * Counts a string's length in code points.
 *
 * `.length` counts UTF-16 code units, so an emoji or any astral character
 * counts as two. JSON Schema §6.3.1 defines minLength / maxLength in code
 * points, and code points are also what someone writing "three characters"
 * means.
 *
 * This is a deliberate decision, not an inherited one: strings containing
 * astral characters are judged differently than under the legacy `.length`.
 */
export function countCodePoints(value: string): number {
  let count = 0;
  for (const _character of value) count += 1;
  return count;
}
