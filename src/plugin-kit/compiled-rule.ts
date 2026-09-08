import type {
  ArrayItemContext,
  CheckOutcome,
  IssueDetail,
  IssueSeverity,
  MessageContext,
  RuleContext,
} from "../types";

export type RuleKind =
  | "check"
  | "presence"
  | "conditionalPresence"
  | "gate"
  | "transform"
  | "composite"
  | "recursive";

export interface CheckRule {
  readonly kind: "check";
  readonly code: string;
  readonly severity: IssueSeverity;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

/**
 * WHICH absences a rule permits, without the identity that reports a refusal.
 * Split out because a conditional presence rule owns TWO of these — one per
 * side of its predicate — while both sides share its code and its message.
 */
export interface PresenceAllowance {
  readonly allowUndefined: boolean;
  readonly allowNull: boolean;
  readonly emptyStringIsMissing: boolean;
  /**
   * True when `null` is a VALUE this subject has to judge, rather than an
   * absence presence may settle. Draft-07 sub-schemas need it: `false`,
   * `{"not": {}}` and an `enum` without null all forbid null WITHOUT saying
   * anything about `type`, and presence — which runs first — was answering
   * for them. `[null]` passed `{"items":{"not":{}}}` because no check ever
   * ran.
   *
   * Optional, and absent means false: a field the user declared keeps the
   * builder's meaning, where `.nullable()` ENDS the field on null. Only
   * src/json-schema/ turns it on.
   */
  readonly nullIsValue?: boolean;
}

export interface PresenceRule extends PresenceAllowance {
  readonly kind: "presence";
  readonly code: string;
  readonly severity: IssueSeverity;
  describe(ctx: MessageContext): string;
}

/**
 * Presence only a value of the ROOT can settle: `.requiredIf(when)` and
 * `.optionalIf(when)`.
 *
 * Plain PresenceRules merge into ONE policy at build time, which is why
 * nothing before this could make a MISSING value depend on a sibling field.
 * requiredIf had to be a check instead, and a check never sees undefined
 * because the presence gate returns first — so `.requiredIf(cond)` alone was
 * silent on the very absence it exists to forbid.
 *
 * The condition is therefore carried HERE, and compilation turns each side
 * into a finished PresencePolicy. The run time evaluates one predicate and
 * PICKS; it never assembles a policy and never asks what a rule is.
 *
 * `whenMet` / `whenUnmet` is null on the side that has no opinion, and the
 * field then keeps the policy its unconditional rules already merged to. That
 * is what leaves `.required().requiredIf(cond)` rejecting a missing value
 * while the condition is false.
 */
export interface ConditionalPresenceRule {
  readonly kind: "conditionalPresence";
  readonly code: string;
  readonly severity: IssueSeverity;
  /** Evaluated once per field run, BEFORE the value is judged. */
  when(root: unknown, arrayContext?: ArrayItemContext): boolean;
  readonly whenMet: PresenceAllowance | null;
  readonly whenUnmet: PresenceAllowance | null;
  describe(ctx: MessageContext): string;
}

export interface GateRule {
  readonly kind: "gate";
  readonly code: string;
  shouldRun(value: unknown, ctx: RuleContext): boolean;
}

export interface TransformRule {
  readonly kind: "transform";
  apply(value: unknown, ctx: RuleContext): unknown;
}

/** Rules bound to a path RELATIVE to the branch subject. */
export interface BranchField {
  readonly path: string;
  readonly rules: readonly Rule[];
}

export interface CompositeBranch {
  readonly label: string;
  readonly rules: readonly Rule[];
  readonly fields: readonly BranchField[];
}

/** A branch after compilation: the same call shape as a check. */
export interface BranchRunner {
  readonly label: string;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
}

export type CompositeExecute = (
  value: unknown,
  ctx: RuleContext
) => CheckOutcome;
export type CompositeCombine = (
  runners: readonly BranchRunner[]
) => CompositeExecute;

export interface CompositeRule {
  readonly kind: "composite";
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly branches: readonly CompositeBranch[];
  /** Called ONCE at build time; runners[i] corresponds to branches[i]. */
  readonly combine: CompositeCombine;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

export type RecursionTarget = "self" | "element";

export interface RecursiveRule {
  readonly kind: "recursive";
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly target: RecursionTarget;
  readonly maxDepth: number;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

export type Rule =
  | CheckRule
  | PresenceRule
  | ConditionalPresenceRule
  | GateRule
  | TransformRule
  | CompositeRule
  | RecursiveRule;
