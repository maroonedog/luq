// ===========================================================================
// L8  src/json-schema/collect-sub-schema-rules.ts — a WHOLE sub-schema as a
// rule list over one subject.
//
// A declared path gets its children as their own `.v()` declarations, because a
// real path renders a real issue path. A sub-schema INSIDE an applicator cannot:
// `anyOf` needs one verdict for the whole arm, so the arm's `properties` become
// CompositeBranch FIELDS (paths relative to the branch subject) and its `items`
// go through `.each()`. `[*]` cannot be a branch field path — parse-field-path
// rejects a bracket that trails no key — which is exactly why arrayEach is in
// the bag (docs/design/verification.md, the retracted "arrayEach does not
// exist" item).
//
// This is the recursion every applicator shares: compose-keyword, compose-
// conditional, patternProperties, propertyNames, dependentSchemas and
// additionalProperties all reach it through StructuralContext, so there is one
// answer to "what does this sub-schema mean" and not one per keyword.
// ===========================================================================
import { composite, fieldsBranch } from "../plugin-kit/create-rule";
import type {
  BranchField,
  CompositeBranch,
  Rule,
} from "../plugin-kit/compiled-rule";
import { PASS } from "../types";
import { resolveSchemaNodeInScope } from "./collect-definitions";
import { declarePresenceRules } from "./declare-presence";
import type { Draft07Schema } from "./draft07.types";
import { EACH_STEP } from "./flatten-array-schema";
import { expandSchemaRules, readChildSchemas } from "./schema-to-declarations";
import type {
  ChildSchema,
  StructuralContext,
} from "./structural-expansion.types";

const NO_BRANCH_FIELDS: readonly BranchField[] = Object.freeze([]);

function toBranchField(
  child: ChildSchema,
  context: StructuralContext
): BranchField {
  return {
    path: child.step,
    rules: Object.freeze([
      ...declarePresenceRules({
        isRequired: child.isRequired,
        severity: context.build.config.defaultSeverity,
      }),
      ...context.collectSubSchemaRules(child.schema),
    ]),
  };
}

/** One composite whose single branch carries the properties as fields. */
function composeProperties(
  children: readonly ChildSchema[],
  context: StructuralContext
): readonly Rule[] {
  const fields = children.map((child) => toBranchField(child, context));
  return [
    composite({
      code: "properties",
      severity: context.build.config.defaultSeverity,
      branches: [fieldsBranch("properties", fields)],
      combine: (runners) => (value, ctx) => runners[0]?.run(value, ctx) ?? PASS,
      describe: () => "One or more properties do not match their schema",
      buildMessageContext: () => ({}),
    }),
  ];
}

/**
 * Every sub-schema subject gets the same one-line statement: null is a VALUE
 * here, so the checks run on it.
 *
 * src/runtime/run-field.ts settles presence BEFORE any check, and a subject
 * with no presence rule carries OPEN_PRESENCE, which ends the field on null.
 * A branch subject and an array element both arrive without one, so every
 * check the sub-schema declared was skipped for null: `[null]` passed
 * `{"items":{"type":"boolean"}}`, and `additionalItems: false` accepted a
 * trailing null. Deciding it from `type` alone is not enough either —
 * `false`, `{"not": {}}` and an `enum` without null forbid null while
 * saying nothing about `type`.
 */
function declareOwnNullPolicy(context: StructuralContext): readonly Rule[] {
  return declarePresenceRules({
    isRequired: false,
    severity: context.build.config.defaultSeverity,
  });
}

export function collectSubSchemaRules(
  schema: Draft07Schema,
  context: StructuralContext
): readonly Rule[] {
  const node = resolveSchemaNodeInScope(schema, context.scope).node;
  const rules: Rule[] = [
    ...declareOwnNullPolicy(context),
    ...expandSchemaRules(node, context),
  ];
  const children = readChildSchemas(node);
  const properties = children.filter((child) => child.step !== EACH_STEP);
  if (properties.length > 0) {
    rules.push(...composeProperties(properties, context));
  }
  for (const element of children) {
    if (element.step !== EACH_STEP) continue;
    const plugin = context.bag.arrayEach;
    rules.push(
      plugin.build(
        context.ruleContextFor(plugin.name, "items"),
        context.collectSubSchemaRules(element.schema)
      )
    );
  }
  return Object.freeze(rules);
}

/**
 * Every branch of every composite is built here, so a branch is one shape.
 *
 * The call is to the function above and NOT to `context.collectSubSchemaRules`,
 * and the difference is load-bearing. `context` is already the child context
 * that createStructuralContext produced by DESCENDING through this schema, so
 * a `$ref` here is already recorded in `visitedRefs`. Going through the
 * context would descend the same `$ref` a second time, the recursion guard
 * would see it as a cycle, and the branch would come back with no rules at all
 * — `{"items":[{"$ref":"#/definitions/x"}]}` constrained nothing while the
 * inline form `{"items":[{"type":"integer"}]}` worked.
 */
export function toSchemaBranch(
  label: string,
  schema: Draft07Schema,
  context: StructuralContext
): CompositeBranch {
  return {
    label,
    rules: collectSubSchemaRules(schema, context),
    fields: NO_BRANCH_FIELDS,
  };
}
