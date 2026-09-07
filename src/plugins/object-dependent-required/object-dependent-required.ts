// ===========================================================================
// L7  src/plugins/object-dependent-required/object-dependent-required.ts
// Draft-07 `dependentRequired`.
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-structural.md#objectDependentRequiredPlugin):
// a trigger key that is present (own key, not undefined) demands every key it
// lists; a non-object passes; EVERY violation is reported in one message,
// joined with "; ".
//
// Two legacy defects are not carried over: the code was "DEPENDENT_REQUIRED"
// and no options bag was accepted, so neither the code nor the message could
// be overridden. Both follow the catalog-wide rule here.
//
// The `{ required, message }` object form of a dependency is dropped: a
// per-entry message is what options.messageFactory is for, and keeping two
// message channels is how the legacy catalog ended up with plugins that had
// neither. Deliberately marker-free, so the keyword table can bind to it.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isPlainObject } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import {
  describeViolations,
  findDependentRequiredViolations,
  readViolations,
  type DependentRequiredViolation,
} from "./dependent-required-violation";

export interface DependentRequiredContext {
  readonly violations: readonly DependentRequiredViolation[];
}

export const objectDependentRequiredPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [dependencies: Readonly<Record<string, readonly string[]>>];
  out: Unchanged;
  context: DependentRequiredContext;
}>()({
  name: "objectDependentRequired",
  method: "dependentRequired",
  slots: ["object"] as const,
  build: (ctx, dependencies) =>
    check<DependentRequiredContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isPlainObject(value)) return PASS;
        const violations = findDependentRequiredViolations(value, dependencies);
        return violations.length === 0 ? PASS : fail({ actual: violations });
      },
      describe: (detail) => describeViolations(readViolations(detail.actual)),
      buildMessageContext: (detail) => ({
        violations: readViolations(detail.actual),
      }),
    }),
});
