// ===========================================================================
// L4  src/compile/validation-plan.types.ts — the plan is DATA.
//
// Everything here is produced ONCE by build() and only read at validation
// time. There is deliberately no `kind` discriminant left on a compiled part:
// the runtime must not re-decide what a rule is, because deciding is what
// compilation already did.
// ===========================================================================
import type {
  ArrayItemContext,
  CheckOutcome,
  IssueDetail,
  IssueSeverity,
  MessageContext,
  RuleContext,
} from "../types";
import type { PathSegment } from "../path/path-segment.types";
import type { ValueWriter } from "../path/create-value-writer";
import type {
  GateRule,
  RecursionTarget,
  Rule,
  TransformRule,
} from "../plugin-kit/compiled-rule";

/**
 * A check after compilation. A CheckRule already has this exact shape.
 *
 * `severity` is carried, not dropped: ValidationIssue.severity is not optional
 * and the chain resolved it once at build time. A CompiledCheck without it
 * would force L5 to invent a fallback, which is precisely the second
 * resolution site that makes an override stop working.
 */
export interface CompiledCheck {
  readonly code: string;
  readonly severity: IssueSeverity;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

/** Every PresenceRule on a field, merged into one order-independent policy. */
export interface PresencePolicy {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly allowUndefined: boolean;
  readonly allowNull: boolean;
  readonly emptyStringIsMissing: boolean;
  /**
   * True when `null` is a VALUE this subject has to judge, rather than an
   * absence presence may settle. Draft-07 sub-schemas need it: `false`,
   * `{"not": {}}` and an `enum` without null all forbid null WITHOUT saying
   * anything about `type`, and presence — which runs first — was answering
   * for them. `[null]` passed `{"items":{"not":{}}}` because no check ever
   * ran. Only src/json-schema/ sets it; a field the user declared keeps the
   * builder's meaning, where `.nullable()` ends the field.
   */
  readonly nullIsValue: boolean;
  describe(ctx: MessageContext): string;
}

/**
 * Two finished policies and the predicate that picks between them.
 *
 * Both sides are built ONCE, at compile time. The run time evaluates `when`
 * and takes a reference — it never merges flags, allocates a policy, or looks
 * at a rule kind. A null side leaves whatever policy is standing in place, so
 * a conditional rule can decline to have an opinion instead of having to
 * fabricate a permissive policy that would erase the field's `.required()`.
 */
export interface ConditionalPresence {
  when(root: unknown, arrayContext?: ArrayItemContext): boolean;
  readonly whenMet: PresencePolicy | null;
  readonly whenUnmet: PresencePolicy | null;
}

/** Late-bound reference to the plan a RecursiveRule re-enters. compileSchema
 *  creates the holder BEFORE compiling its fields and fills it afterwards, so a
 *  self-referential plan needs no forward declaration and no cast. */
export interface PlanRef {
  resolve(): ValidationPlan;
}

export interface RecursionPolicy {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly target: RecursionTarget;
  readonly maxDepth: number;
  readonly plan: PlanRef;
  describe(detail: IssueDetail, ctx: MessageContext): string;
}

export interface CompiledField {
  readonly template: readonly PathSegment[];
  readonly read: (subject: unknown) => unknown;
  /**
   * null unless the field declared a transform or a default — the runtime then
   * skips the writer without asking why.
   *
   * It returns the NEW root rather than `void`: the writer is copy-on-write
   * (src/path/create-value-writer.ts) and cannot report its result through the
   * argument it refused to mutate.
   */
  readonly write: ValueWriter | null;
  readonly defaultOf: ((root: unknown) => unknown) | null;
  readonly applyDefaultToNull: boolean;
  readonly presence: PresencePolicy;
  /**
   * The conditional overrides of `presence`, in declaration order, and the
   * shared frozen empty array on every field that declared none — which is
   * almost all of them, so the runtime's whole cost is one length test.
   * A later applicable override wins over an earlier one.
   */
  readonly presenceOverrides: readonly ConditionalPresence[];
  readonly gates: readonly GateRule[];
  /** Composites are already erased into this list, in declaration order. */
  readonly checks: readonly CompiledCheck[];
  readonly transforms: readonly TransformRule[];
  /** null for every field that declared no RecursiveRule, i.e. almost all. */
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

/**
 * What the chain collector hands compile: one path, its ordered rules, and the
 * field options that are NOT rules.
 *
 * `defaultOf` / `applyDefaultToNull` come from `.v()`'s third argument, which
 * is a field configuration and never a Rule — there is no "default" rule kind
 * to carry them. Both are optional so a declaration that has neither stays
 * `{ path, rules }`; compileField reads the documented fallbacks (no default,
 * and `applyDefaultToNull` true).
 */
export interface FieldDeclaration {
  readonly path: string;
  readonly rules: readonly Rule[];
  readonly defaultOf?: (root: unknown) => unknown;
  readonly applyDefaultToNull?: boolean;
}
