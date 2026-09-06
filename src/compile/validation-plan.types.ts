import type {
  CheckOutcome,
  IssueDetail,
  MessageContext,
  RuleContext,
} from "../types";
import type { PathSegment } from "../path/path-segment.types";
import type {
  GateRule,
  RecursionTarget,
  Rule,
  TransformRule,
} from "../plugin-kit/compiled-rule";

/** A check after compilation. A CheckRule already has this exact shape. */
export interface CompiledCheck {
  readonly code: string;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

/** Every PresenceRule on a field, merged into one order-independent policy. */
export interface PresencePolicy {
  readonly code: string;
  readonly allowUndefined: boolean;
  readonly allowNull: boolean;
  readonly emptyStringIsMissing: boolean;
  describe(ctx: MessageContext): string;
}

/** Late-bound reference to the plan a RecursiveRule re-enters. */
export interface PlanRef {
  resolve(): ValidationPlan;
}

export interface RecursionPolicy {
  readonly code: string;
  readonly target: RecursionTarget;
  readonly maxDepth: number;
  readonly plan: PlanRef;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

export interface CompiledField {
  readonly template: readonly PathSegment[];
  readonly read: (subject: unknown) => unknown;
  readonly write: ((subject: unknown, value: unknown) => void) | null;
  readonly defaultOf: ((root: unknown) => unknown) | null;
  readonly applyDefaultToNull: boolean;
  readonly presence: PresencePolicy;
  readonly gates: readonly GateRule[];
  /** Composites are already erased into this list, in declaration order. */
  readonly checks: readonly CompiledCheck[];
  readonly transforms: readonly TransformRule[];
  readonly recursion: RecursionPolicy | null;
}

/** Loop interchange: one array is read once however many element fields exist. */
export interface ArrayNode {
  readonly template: readonly PathSegment[];
  readonly read: (subject: unknown) => unknown;
  readonly elementFields: readonly CompiledField[];
  readonly nested: readonly ArrayNode[];
}

export interface ValidationPlan {
  readonly fields: readonly CompiledField[];
  readonly arrays: readonly ArrayNode[];
  readonly hasTransforms: boolean;
  readonly hasDefaults: boolean;
}

/** What the chain collector hands compile: one path, its ordered rules. */
export interface FieldDeclaration {
  readonly path: string;
  readonly rules: readonly Rule[];
}
