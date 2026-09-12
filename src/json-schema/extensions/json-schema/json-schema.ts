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
  assertSupportedDialect,
  collectSubSchemaRules,
  createStructuralContext,
  createDocumentScope,
  isDraft07Schema,
  resolveSchemaNodeInScope,
  type DialectOptions,
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
 * What the converter may reach beyond the document itself.
 *
 * `externalDocuments` is a MAP, deliberately, and not a loader function:
 *   * Luq never opens a socket, so a schema cannot make the process fetch a
 *     URL it names (SSRF) — what can be read is written in the caller's code;
 *   * conversion stays synchronous, so `build()` keeps returning a validator
 *     rather than a promise;
 *   * nothing is evaluated, so the CSP guarantee is untouched.
 * The caller fetches, reads from disk, or bundles — whichever is right for
 * their deployment — and hands over what they already have.
 */
export interface JsonSchemaOptions extends DialectOptions {
  readonly externalDocuments?: Readonly<Record<string, unknown>> | undefined;
}

const NO_EXTERNAL_DOCUMENTS: Readonly<Record<string, unknown>> = Object.freeze(
  {}
);

/**
 * The document as a rule list over ONE subject. Exported because it is the
 * only part of this plugin the full-feature bundle needs, and because a test
 * can then count the rules a document produces without building a validator.
 */
export function collectDocumentRules(
  ctx: RuleBuildContext<MessageContextExtra>,
  document: unknown,
  bag: JsonSchemaBag,
  options: JsonSchemaOptions = {}
): readonly Rule[] {
  if (!isDraft07Schema(document)) throw new NotASchemaError(document);
  // Before any keyword is read, and in the same place the function front door
  // reads it: the dialect decides what the keywords below MEAN.
  assertSupportedDialect(document, options);
  const root: Draft07Schema = document;
  const scope = createDocumentScope(
    root,
    options.externalDocuments ?? NO_EXTERNAL_DOCUMENTS
  );
  // The seed's `chain` is a ChainBuildContext, whose three members a
  // RuleBuildContext already carries. Written inline because naming the type
  // would mean importing src/chain, which tier `extension` forbids.
  const seed = {
    bag,
    scope,
    chain: {
      fieldPath: ctx.fieldPath,
      declaredSiblingKeys: ctx.declaredSiblingKeys,
      config: ctx.config,
    },
  };
  const resolved = resolveSchemaNodeInScope(root, scope);
  const context = createStructuralContext(
    seed,
    resolved.node,
    [],
    resolved.scope
  );
  // The branch subject carries its own null policy, like every sub-schema
  // subject: collectSubSchemaRules puts it there. `judgesNull` on the plugin
  // gets null as far as this composite; that policy gets it the rest of the
  // way, into the document's own rules.
  return collectSubSchemaRules(resolved.node, context);
}

export const jsonSchemaPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    document: unknown,
    bag: JsonSchemaBag,
    options?: JsonSchemaOptions,
  ];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "jsonSchema",
  // The document decides whether null is allowed, so null has to reach it.
  judgesNull: true,
  method: "jsonSchema",
  slots: SCHEMA_SLOTS,
  build: (ctx, document, bag, options) =>
    composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [
        branch(
          SCHEMA_BRANCH_LABEL,
          collectDocumentRules(ctx, document, bag, options)
        ),
      ],
      combine: (runners) => (value, runContext) =>
        runners[0]?.run(value, runContext) ?? PASS,
      describe: () => "Value does not match the JSON Schema document",
      buildMessageContext: () => ({}),
    }),
});
