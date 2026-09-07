// ===========================================================================
// L4  src/compile/compile-schema.ts — PLAN ASSEMBLY with PlanRef BACK-PATCHING.
//
// One pass: parse every declared path once, split the wildcard-carrying ones
// into array nodes, compile the rest into fields, and record whether the plan
// writes anything at all. Nothing here executes a rule.
//
// The back-patch is what makes `objectRecursively` expressible as FINITE data.
// A recursive schema's plan contains a RecursionPolicy that points at the very
// plan being built, so the holder is created FIRST, handed to every field, and
// filled in LAST. No field ever holds a partially built plan, no forward
// declaration is needed, and — the point of doing it with a closure over a
// local rather than a mutable plan object — not one assertion is written.
//
// `branchExecutor` is REQUIRED. compile/ has no traversal loop of its own and
// must not grow one: branch execution is L5's single engine, reached through
// the port. Making the parameter optional would be the door a second traversal
// walks through, so there is no default.
// ===========================================================================
import { parseFieldPath } from "../path/parse-field-path";
import { ROOT_PATH } from "./declared-child-keys";
import type { CompositeBranch } from "../plugin-kit/compiled-rule";
import type { BranchExecutor } from "./branch-executor.port";
import {
  compileArrayNode,
  compileRelativeDeclaration,
} from "./compile-array-node";
import type { NodeCompileContext } from "./compile-array-node";
import { compileComposite } from "./compile-composite";
import { APPLIES_DEFAULT_TO_NULL_BY_DEFAULT } from "./compile-field";
import type { CompositeEraser } from "./compile-field";
import { groupArrayFields } from "./group-array-fields";
import type { RelativeDeclaration } from "./group-array-fields";
import type {
  FieldDeclaration,
  PlanRef,
  ValidationPlan,
} from "./validation-plan.types";

/** A PlanRef resolved before its plan was assembled: only compilation itself
 *  could do that, and compilation resolving a recursive plan never ends. */
export class UnresolvedPlanError extends Error {
  constructor() {
    super(
      "A PlanRef was resolved before its plan finished compiling. " +
        "Recursion is resolved at validation time, never at build time."
    );
    this.name = "UnresolvedPlanError";
  }
}

export function compileSchema(
  declarations: readonly FieldDeclaration[],
  branchExecutor: BranchExecutor
): ValidationPlan {
  return compilePlan(
    declarations.map(parseRelativeDeclaration),
    branchExecutor
  );
}

/**
 * `relatives` is the FLAT list for one plan — array members included, because
 * grouping happens below. That is what lets hasTransforms / hasDefaults be
 * decided by one scan instead of by walking the compiled node tree.
 */
function compilePlan(
  relatives: readonly RelativeDeclaration[],
  executor: BranchExecutor
): ValidationPlan {
  let compiled: ValidationPlan | null = null;
  const planRef: PlanRef = {
    resolve: () => {
      if (compiled === null) throw new UnresolvedPlanError();
      return compiled;
    },
  };
  const grouped = groupArrayFields(relatives);
  const context: NodeCompileContext = {
    planRef,
    eraseComposite: createCompositeEraser(executor),
  };
  compiled = Object.freeze({
    fields: Object.freeze(
      grouped.direct.map((declaration) =>
        compileRelativeDeclaration(declaration, context)
      )
    ),
    arrays: Object.freeze(
      grouped.arrays.map((group) => compileArrayNode(group, context))
    ),
    hasTransforms: relatives.some((declaration) =>
      declaration.rules.some((rule) => rule.kind === "transform")
    ),
    hasDefaults: relatives.some(
      (declaration) => declaration.defaultOf !== null
    ),
  });
  return compiled;
}

/** Each branch gets its OWN plan, so a `recursively` inside a branch re-enters
 *  that branch and not the schema that happens to contain it. */
function createCompositeEraser(executor: BranchExecutor): CompositeEraser {
  return (rule) =>
    compileComposite(rule, {
      executor,
      compileBranchPlan: (branch) =>
        compilePlan(collectBranchDeclarations(branch), executor),
    });
}

/**
 * ROOT_PATH declares a rule on the SUBJECT ITSELF, and its template is the
 * EMPTY array — the very shape collectBranchDeclarations below already builds
 * for a branch's own rules, so the runtime has always supported it and only
 * this parse step forbade it. It is what lets a JSON Schema keyword that sits
 * on the document root (`additionalProperties`, `minProperties`, `anyOf`,
 * `if`/`then`/`else`, …) become a rule instead of being refused: see
 * src/json-schema/flatten-schema.ts. parseFieldPath still rejects "" for every
 * OTHER caller, because a *child* path may not be empty.
 */
function parseRelativeDeclaration(
  declaration: FieldDeclaration
): RelativeDeclaration {
  return {
    template:
      declaration.path === ROOT_PATH
        ? Object.freeze([])
        : parseFieldPath(declaration.path),
    rules: declaration.rules,
    fieldPath: declaration.path,
    defaultOf: declaration.defaultOf ?? null,
    applyDefaultToNull:
      declaration.applyDefaultToNull ?? APPLIES_DEFAULT_TO_NULL_BY_DEFAULT,
  };
}

/**
 * A branch is a plan over the branch SUBJECT: its own rules bind to the empty
 * template (the subject itself) and its fields to paths relative to it. The
 * subject entry is omitted when the branch declares no rules of its own, so a
 * pure `properties` branch compiles to exactly its fields.
 */
function collectBranchDeclarations(
  branch: CompositeBranch
): readonly RelativeDeclaration[] {
  const declarations: RelativeDeclaration[] = [];
  if (branch.rules.length > 0) {
    declarations.push({
      template: Object.freeze([]),
      rules: branch.rules,
      fieldPath: branch.label,
      defaultOf: null,
      applyDefaultToNull: APPLIES_DEFAULT_TO_NULL_BY_DEFAULT,
    });
  }
  for (const field of branch.fields) {
    declarations.push({
      template: parseFieldPath(field.path),
      rules: field.rules,
      fieldPath: field.path,
      defaultOf: null,
      applyDefaultToNull: APPLIES_DEFAULT_TO_NULL_BY_DEFAULT,
    });
  }
  return declarations;
}
