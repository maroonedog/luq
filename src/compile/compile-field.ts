// ===========================================================================
// L4  src/compile/compile-field.ts — one declaration becomes one CompiledField.
//
// Everything the runtime needs is decided HERE: which reader to call, whether
// there is a writer at all, what presence means, which checks run and in what
// order. The runtime receives arrays and closures, never a rule to classify.
//
// The user's `run` / `shouldRun` / `apply` functions are stored BY IDENTITY and
// never re-wrapped. That is what makes the RuleContext L5 builds — root, path,
// item and `external`, the one channel a pre-resolved async context arrives on
// — reach a plugin verbatim: there is no compiled layer in between that could
// rebuild the object and drop a member.
// ===========================================================================
import type { PathSegment } from "../path/path-segment.types";
import { createValueReader } from "../path/create-value-reader";
import { formatIssuePath } from "../path/format-issue-path";
import { createValueWriter } from "../path/create-value-writer";
import { parseFieldPath } from "../path/parse-field-path";
import type { CompositeRule, Rule } from "../plugin-kit/compiled-rule";
import type {
  CompiledCheck,
  CompiledField,
  FieldDeclaration,
  PlanRef,
} from "./validation-plan.types";
import { resolveConditionalPresence } from "./resolve-conditional-presence";
import { resolvePresence } from "./resolve-presence";
import { resolveRecursion } from "./resolve-recursion";
import { splitRulesByKind } from "./split-rules-by-kind";

/**
 * Erases one CompositeRule to a plain CompiledCheck. Supplied by L4 part 2
 * (compile-composite), which owns branch compilation and calls `combine` once.
 * Injecting it here is what keeps "no rule kind other than check reaches L5"
 * true without compile-field knowing anything about branches.
 */
export type CompositeEraser = (rule: CompositeRule) => CompiledCheck;

/** Whether a field with no explicit setting replaces a null with its default. */
export const APPLIES_DEFAULT_TO_NULL_BY_DEFAULT = true;

export interface FieldCompileRequest {
  /** The path RELATIVE to the subject this field is read from. */
  readonly template: readonly PathSegment[];
  readonly rules: readonly Rule[];
  /** The declared path, used only to name a build-time failure. */
  readonly fieldPath: string;
  readonly defaultOf: ((root: unknown) => unknown) | null;
  readonly applyDefaultToNull: boolean;
  readonly planRef: PlanRef;
  readonly eraseComposite: CompositeEraser;
}

/** 添字はここでは入らない。開いている添字は実行時に接頭辞が持つ。 */
const NO_INDICES: readonly number[] = Object.freeze([]);

export function compileField(request: FieldCompileRequest): CompiledField {
  const byKind = splitRulesByKind(request.rules);
  const hasDefault = request.defaultOf !== null;
  const needsWriter = byKind.transforms.length > 0 || hasDefault;
  const template = Object.freeze(request.template);
  // read を先に作る。ワイルドカードを含むテンプレートを拒むのは
  // createValueReader の役目で、それより先に formatIssuePath を呼ぶと
  // 「添字が足りない」という RangeError が、本来の PathSyntaxError を
  // 追い越して出てしまう (テストがそれを捕まえた)。
  const read = createValueReader(template);
  const field: CompiledField = {
    template,
    renderedPath: formatIssuePath(template, NO_INDICES),
    read,
    write: needsWriter ? createValueWriter(template) : null,
    defaultOf: request.defaultOf,
    applyDefaultToNull: request.applyDefaultToNull,
    presence: resolvePresence(byKind.presences),
    presenceOverrides: resolveConditionalPresence(byKind.conditionalPresences),
    gates: byKind.gates,
    checks: collectOrderedChecks(request.rules, request.eraseComposite),
    transforms: byKind.transforms,
    recursion: resolveRecursion(
      byKind.recursions,
      request.planRef,
      request.fieldPath
    ),
  };
  return Object.freeze(field);
}

/**
 * The convenience entry point for a field declared at an absolute path. A
 * malformed or unsafe path throws PathSyntaxError HERE, at build time, naming
 * the path: the legacy silent `return () => null` turned a typo into a rule
 * that never ran.
 */
export function compileFieldDeclaration(
  declaration: FieldDeclaration,
  planRef: PlanRef,
  eraseComposite: CompositeEraser
): CompiledField {
  return compileField({
    template: parseFieldPath(declaration.path),
    rules: declaration.rules,
    fieldPath: declaration.path,
    defaultOf: declaration.defaultOf ?? null,
    applyDefaultToNull:
      declaration.applyDefaultToNull ?? APPLIES_DEFAULT_TO_NULL_BY_DEFAULT,
    planRef,
    eraseComposite,
  });
}

/**
 * Checks and composites share one list because they share one call shape, and
 * they keep DECLARATION order between them: a composite declared before a
 * check must still run before it. Splitting them into two arrays and
 * concatenating would quietly reorder the user's rules.
 */
function collectOrderedChecks(
  rules: readonly Rule[],
  eraseComposite: CompositeEraser
): readonly CompiledCheck[] {
  const checks: CompiledCheck[] = [];
  for (const rule of rules) {
    if (rule.kind === "check") checks.push(rule);
    else if (rule.kind === "composite") checks.push(eraseComposite(rule));
  }
  return Object.freeze(checks);
}
