// ===========================================================================
// Plans for the L5 tests are built by the REAL compiler and wired to the REAL
// BranchExecutor. A hand-shaped plan would let a runtime test pass against a
// structure compileSchema never produces, which is exactly how the legacy tree
// grew two engines that disagreed.
// ===========================================================================
import { compileSchema } from "../../../../src/compile/compile-schema";
import type {
  FieldDeclaration,
  ValidationPlan,
} from "../../../../src/compile/validation-plan.types";
import type {
  CompositeBranch,
  CompositeCombine,
  CompositeRule,
  Rule,
} from "../../../../src/plugin-kit/compiled-rule";
import { createBranchExecutor } from "../../../../src/runtime/run-branch";
import { IndexStack } from "../../../../src/runtime/index-stack";
import {
  IssueSink,
  resolveAbortPolicy,
} from "../../../../src/runtime/issue-sink";
import type { FieldRunContext } from "../../../../src/runtime/run-field";
import { createRecursionRunner } from "../../../../src/runtime/run-recursion";
import type { ValidateOptions } from "../../../../src/types/validation-result.types";

export function planOf(
  declarations: readonly FieldDeclaration[]
): ValidationPlan {
  return compileSchema(declarations, createBranchExecutor());
}

export interface EngineHarness {
  readonly plan: ValidationPlan;
  readonly sink: IssueSink;
  readonly context: FieldRunContext;
}

/** A context wired exactly the way createValidator wires one. */
export function harnessFor(
  declarations: readonly FieldDeclaration[],
  root: unknown,
  options?: ValidateOptions & { readonly shouldApplyTransforms?: boolean }
): EngineHarness {
  const sink = new IssueSink(resolveAbortPolicy(options));
  return {
    plan: planOf(declarations),
    sink,
    context: {
      root,
      sink,
      indices: new IndexStack(),
      shouldApplyTransforms: options?.shouldApplyTransforms ?? false,
      runRecursion: createRecursionRunner({ root, sink }),
      external: options?.external,
    },
  };
}

export function issuePathsOf(sink: IssueSink): readonly string[] {
  return sink.issues.map((issue) => issue.path);
}

export function issueCodesOf(sink: IssueSink): readonly string[] {
  return sink.issues.map((issue) => issue.code);
}

export function branchOf(
  label: string,
  rules: readonly Rule[] = [],
  fields: CompositeBranch["fields"] = []
): CompositeBranch {
  return { label, rules, fields };
}

export function compositeOf(
  code: string,
  branches: readonly CompositeBranch[],
  combine: CompositeCombine
): CompositeRule {
  return {
    kind: "composite",
    code,
    severity: "error",
    branches,
    combine,
    describe: (detail) => `${code}: ${JSON.stringify(detail.causes ?? null)}`,
  };
}

/** Counts how many times the property behind an array path is READ. */
export function withCountedRead(
  key: string,
  value: unknown
): {
  readonly subject: Record<string, unknown>;
  readonly readCount: () => number;
} {
  let reads = 0;
  const subject: Record<string, unknown> = {};
  Object.defineProperty(subject, key, {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      return value;
    },
  });
  return { subject, readCount: () => reads };
}
