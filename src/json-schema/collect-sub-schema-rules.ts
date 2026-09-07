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
import { resolveSchemaNode } from "./collect-definitions";
import { declarePresenceRules } from "./declare-presence";
import { permitsNull } from "./declare-value-keywords";
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
  const node = resolveSchemaNode(child.schema, context.root);
  return {
    path: child.step,
    rules: Object.freeze([
      ...declarePresenceRules({
        isRequired: child.isRequired,
        allowsNull: permitsNull(node),
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

export function collectSubSchemaRules(
  schema: Draft07Schema,
  context: StructuralContext
): readonly Rule[] {
  const node = resolveSchemaNode(schema, context.root);
  const rules: Rule[] = [...expandSchemaRules(node, context)];
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

/** Every branch of every composite is built here, so a branch is one shape. */
export function toSchemaBranch(
  label: string,
  schema: Draft07Schema,
  context: StructuralContext
): CompositeBranch {
  return {
    label,
    rules: context.collectSubSchemaRules(schema),
    fields: NO_BRANCH_FIELDS,
  };
}
