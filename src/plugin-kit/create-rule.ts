import type {
  CheckOutcome,
  IssueDetail,
  IssueSeverity,
  MessageContext,
  MessageContextExtra,
  MessageFactory,
  RuleContext,
} from "../types";
import { renderMessage } from "./rule-build-context";
import type {
  BranchField,
  CheckRule,
  CompositeBranch,
  CompositeCombine,
  CompositeRule,
  GateRule,
  PresenceRule,
  RecursionTarget,
  RecursiveRule,
  Rule,
  TransformRule,
} from "./compiled-rule";

const EMPTY_FIELDS: readonly BranchField[] = Object.freeze([]);
const EMPTY_RULES: readonly Rule[] = Object.freeze([]);

export interface CheckSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly severity: IssueSeverity;
  run(value: unknown, ctx: RuleContext): CheckOutcome;
  describe(detail: IssueDetail, ctx: MessageContext): string;
  buildMessageContext(detail: IssueDetail): C;
}

export function check<C extends MessageContextExtra>(
  spec: CheckSpec<C>
): CheckRule {
  return {
    kind: "check",
    code: spec.code,
    severity: spec.severity,
    run: (value, ctx) => spec.run(value, ctx),
    describe: (detail, ctx) =>
      renderMessage(
        spec.messageFactory,
        ctx,
        spec.buildMessageContext(detail),
        spec.describe(detail, ctx)
      ),
  };
}

export interface PresenceSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly severity: IssueSeverity;
  readonly allowUndefined: boolean;
  readonly allowNull: boolean;
  readonly emptyStringIsMissing: boolean;
  /**
   * True when `null` must be JUDGED here rather than settled by presence.
   *
   * OPTIONAL, and false by default, because `presence()` is an API plugin
   * AUTHORS use: making it required would break every plugin outside this
   * repository to add a flag almost none of them want. The default is the
   * behaviour that was always there — `.nullable()` ends the field on null.
   * src/json-schema/ sets it, because a DOCUMENT decides whether null is
   * allowed and `type` is not the only keyword that decides it.
   */
  readonly nullIsValue?: boolean;
  describe(ctx: MessageContext): string;
  buildMessageContext(): C;
}

export function presence<C extends MessageContextExtra>(
  spec: PresenceSpec<C>
): PresenceRule {
  return {
    kind: "presence",
    code: spec.code,
    severity: spec.severity,
    allowUndefined: spec.allowUndefined,
    allowNull: spec.allowNull,
    emptyStringIsMissing: spec.emptyStringIsMissing,
    nullIsValue: spec.nullIsValue === true,
    describe: (ctx) =>
      renderMessage(
        spec.messageFactory,
        ctx,
        spec.buildMessageContext(),
        spec.describe(ctx)
      ),
  };
}

export function gate(
  code: string,
  shouldRun: (value: unknown, ctx: RuleContext) => boolean
): GateRule {
  return { kind: "gate", code, shouldRun };
}

export function transform(
  apply: (value: unknown, ctx: RuleContext) => unknown
): TransformRule {
  return { kind: "transform", apply };
}

/** Declares a branch of a composite. */
export function branch(
  label: string,
  rules: readonly Rule[],
  fields: readonly BranchField[] = EMPTY_FIELDS
): CompositeBranch {
  return { label, rules, fields };
}

/** Declares a branch that only constrains sub-paths. */
export function fieldsBranch(
  label: string,
  fields: readonly BranchField[]
): CompositeBranch {
  return { label, rules: EMPTY_RULES, fields };
}

export interface CompositeSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly severity: IssueSeverity;
  readonly branches: readonly CompositeBranch[];
  readonly combine: CompositeCombine;
  describe(detail: IssueDetail, ctx: MessageContext): string;
  buildMessageContext(detail: IssueDetail): C;
}

export function composite<C extends MessageContextExtra>(
  spec: CompositeSpec<C>
): CompositeRule {
  return {
    kind: "composite",
    code: spec.code,
    severity: spec.severity,
    branches: spec.branches,
    combine: spec.combine,
    describe: (detail, ctx) =>
      renderMessage(
        spec.messageFactory,
        ctx,
        spec.buildMessageContext(detail),
        spec.describe(detail, ctx)
      ),
  };
}

export interface RecursiveSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly severity: IssueSeverity;
  readonly target: RecursionTarget;
  readonly maxDepth: number;
  describe(detail: IssueDetail, ctx: MessageContext): string;
  buildMessageContext(detail: IssueDetail): C;
}

export function recursive<C extends MessageContextExtra>(
  spec: RecursiveSpec<C>
): RecursiveRule {
  return {
    kind: "recursive",
    code: spec.code,
    severity: spec.severity,
    target: spec.target,
    maxDepth: spec.maxDepth,
    describe: (detail, ctx) =>
      renderMessage(
        spec.messageFactory,
        ctx,
        spec.buildMessageContext(detail),
        spec.describe(detail, ctx)
      ),
  };
}
