// ===========================================================================
// L8 (tier `extension`)  src/json-schema/extensions/json-schema/json-schema.ts
// `./plugins/jsonSchema` — the TREE-SHAKEABLE half of the two-tier story.
//
// WHAT CHANGED FROM 1.x, AND WHY (this is a deviation; it is argued, not hidden):
// 1.x shipped `jsonSchemaPlugin` as a BuilderExtensionPlugin that grew a
// `.fromJsonSchema()` method onto `Builder` itself. The rewritten core has no
// builder-extension mechanism at all — `Builder` was frozen at the contract
// gate (step 7) with exactly `use` / `withConfig` / `for` — so the method
// cannot be grown back without breaking that freeze. The conversion front door
// is therefore the FUNCTION `fromJsonSchema(bag, schema)` (step 25), re-exported
// from this directory's index, and this file adds the thing a function cannot
// express: a CHAIN METHOD, so a document can constrain one declared field.
//
// `.jsonSchema(document, bag)` takes the bag EXPLICITLY. That is the whole
// point of this subpath: importing the forty-five plugin entry files here would
// make every one of them statically reachable and end per-plugin tree-shaking,
// which is exactly the size difference 1.x published between this subpath and
// ./plugins/jsonSchemaFullFeature. The caller assembles the bag from the
// plugins they already import; the full-feature bundle ships a complete one.
//
// THE ROOT IS DECLARABLE HERE. flatten-schema refuses a rule-bearing keyword on
// the document ROOT because Luq declares rules per FIELD and the empty path is
// not a field. A chain method has a field — the one it is called on — so the
// WHOLE document becomes rules over that one subject through the same
// collectSubSchemaRules() every applicator arm already uses. `additionalProperties`,
// `anyOf`, `not`, `if/then/else`, `minProperties`, `propertyNames` and the rest
// are reachable at the top of a document through this method and through no
// other route in the library.
//
// WHAT IT STILL CANNOT DO: `null`. src/runtime/decide-presence.ts settles
// absence before any check runs, so a composite rule is never handed a null and
// `{"type":"string"}` cannot reject one from here. Nullability is the FIELD's
// presence policy — declare `.optional()` when the document forbids null, which
// is precisely what declare-presence.ts does for every child property. See
// needsFromOthers: a document-driven presence rule has no home yet.
// ===========================================================================
import { branch, composite } from "../../../plugin-kit/create-rule";
import type { Rule } from "../../../plugin-kit/compiled-rule";
import { definePlugin } from "../../../plugin-kit/plugin-definition";
import { PASS, type MessageContextExtra, type TypeName } from "../../../types";
import type { RuleBuildContext } from "../../../plugin-kit/rule-build-context";
import type { Unchanged } from "../../../plugin-kit/marker.types";
import {
  NotASchemaError,
  collectSubSchemaRules,
  createStructuralContext,
  isDraft07Schema,
  resolveSchemaNode,
  type Draft07Schema,
  type JsonSchemaBag,
} from "../../index";

/** Every slot: a JSON Schema document constrains a value of any shape. */
const SCHEMA_SLOTS: readonly TypeName[] = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
];

/** The label the whole document carries inside the composite it becomes. */
export const SCHEMA_BRANCH_LABEL = "schema";

/**
 * The document as a rule list over ONE subject. Exported because it is the
 * only part of this plugin the full-feature bundle needs, and because a test
 * can then count the rules a document produces without building a validator.
 */
export function collectDocumentRules(
  ctx: RuleBuildContext<MessageContextExtra>,
  document: unknown,
  bag: JsonSchemaBag
): readonly Rule[] {
  if (!isDraft07Schema(document)) throw new NotASchemaError(document);
  const root: Draft07Schema = document;
  // The seed's `chain` is a ChainBuildContext, whose three members a
  // RuleBuildContext already carries. Written inline because naming the type
  // would mean importing src/chain, which tier `extension` forbids.
  const seed = {
    bag,
    root,
    chain: {
      fieldPath: ctx.fieldPath,
      declaredSiblingKeys: ctx.declaredSiblingKeys,
      config: ctx.config,
    },
  };
  const node = resolveSchemaNode(root, root);
  const context = createStructuralContext(seed, node, []);
  return collectSubSchemaRules(root, context);
}

export const jsonSchemaPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [document: unknown, bag: JsonSchemaBag];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "jsonSchema",
  method: "jsonSchema",
  slots: SCHEMA_SLOTS,
  build: (ctx, document, bag) =>
    composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [
        branch(SCHEMA_BRANCH_LABEL, collectDocumentRules(ctx, document, bag)),
      ],
      combine: (runners) => (value, runContext) =>
        runners[0]?.run(value, runContext) ?? PASS,
      describe: () => "Value does not match the JSON Schema document",
      buildMessageContext: () => ({}),
    }),
});
