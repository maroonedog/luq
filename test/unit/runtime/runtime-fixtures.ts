import { PASS, fail } from "../../../src/types";
import type {
  ArrayItemContext,
  CheckOutcome,
  IssueDetail,
  IssueSeverity,
  MessageContext,
  RuleContext,
} from "../../../src/types";
import type { CheckRule } from "../../../src/plugin-kit/compiled-rule";
import { compileFieldDeclaration } from "../../../src/compile/compile-field";
import type {
  CompiledField,
  FieldDeclaration,
} from "../../../src/compile/validation-plan.types";
import {
  EMPTY_PLAN,
  eraseCompositeToCheck,
  planRefTo,
} from "../compile/rule-fixtures";
import { IndexStack } from "../../../src/runtime/index-stack";
import { IssueSink, resolveAbortPolicy } from "../../../src/runtime/issue-sink";
import type {
  FieldRunContext,
  RecursionRunner,
} from "../../../src/runtime/run-field";
import type { ValidateOptions } from "../../../src/types/validation-result.types";

/** Fields are built by the REAL compiler, so a runtime test can never pass
 *  against a hand-shaped plan the compiler would never produce. */
export function compileFieldAt(declaration: FieldDeclaration): CompiledField {
  return compileFieldDeclaration(
    declaration,
    planRefTo(EMPTY_PLAN),
    eraseCompositeToCheck
  );
}

export const refuseRecursion: RecursionRunner = () => {
  throw new Error("runRecursion was called for a field with no RecursiveRule");
};

export interface RunContextOverrides {
  readonly root?: unknown;
  readonly sink?: IssueSink;
  readonly indices?: IndexStack;
  readonly shouldApplyTransforms?: boolean;
  readonly runRecursion?: RecursionRunner;
  readonly item?: ArrayItemContext;
  readonly external?: Readonly<Record<string, unknown>>;
}

export function createRunContext(
  overrides: RunContextOverrides = {}
): FieldRunContext {
  return {
    root: "root" in overrides ? overrides.root : {},
    sink: overrides.sink ?? new IssueSink(resolveAbortPolicy()),
    indices: overrides.indices ?? new IndexStack(),
    shouldApplyTransforms: overrides.shouldApplyTransforms ?? false,
    runRecursion: overrides.runRecursion ?? refuseRecursion,
    item: overrides.item,
    external: overrides.external,
  };
}

export function createSink(options?: ValidateOptions): IssueSink {
  return new IssueSink(resolveAbortPolicy(options));
}

export interface CheckSpec {
  readonly code: string;
  readonly severity?: IssueSeverity;
  readonly detail?: IssueDetail;
  readonly run?: (value: unknown, ctx: RuleContext) => CheckOutcome;
  readonly describe?: (detail: IssueDetail, ctx: MessageContext) => string;
}

/** A check that fails with the exact detail it was given, and describes it. */
export function makeDetailedCheck(spec: CheckSpec): CheckRule {
  const detail = spec.detail ?? {};
  return {
    kind: "check",
    code: spec.code,
    severity: spec.severity ?? "error",
    run: spec.run ?? (() => fail(detail)),
    describe:
      spec.describe ?? ((_detail, ctx) => `${ctx.code} at ${ctx.path} failed`),
  };
}

export function makePassingCheck(code: string): CheckRule {
  return makeDetailedCheck({ code, run: () => PASS });
}
