import type {
  CheckOutcome,
  IssueDetail,
  IssueSeverity,
  MessageContext,
  RuleContext,
} from "../types";

export type RuleKind =
  | "check"
  | "presence"
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

export interface PresenceRule {
  readonly kind: "presence";
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly allowUndefined: boolean;
  readonly allowNull: boolean;
  readonly emptyStringIsMissing: boolean;
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
  | GateRule
  | TransformRule
  | CompositeRule
  | RecursiveRule;
