// ===========================================================================
// L8 (tier `extension`)
// src/json-schema/extensions/json-schema-full-feature/json-schema-full-feature.ts
// `./plugins/jsonSchemaFullFeature` — the flagship one-import path.
//
// ONE IMPLEMENTATION, TWO FRONT DOORS. The rule this plugin builds is built by
// `jsonSchemaPlugin.build`, reached through the sibling subpath's ENTRY file —
// the only import a tier-`extension` plugin may make of another plugin. The
// difference between the two subpaths is the BAG and nothing else: this one
// ships all forty-five plugins, the other takes the caller's.
//
// WHY THE METHOD IS NOT ALSO CALLED `jsonSchema`: attach-slot-methods refuses
// two plugins claiming one method on one slot, and scripts/check-plugin-
// uniqueness.ts refuses it across the whole catalogue. 1.x let both bundles
// claim `.fromJsonSchema` and relied on registration order to pick a winner;
// here they are two distinct methods, and a builder may hold both.
//
// `fromJsonSchema(schema)` below is the documented one-import route (README
// line 75 in 1.x). It is the step-25 function with this bundle's bag already
// applied, so there is no second conversion path — only a shorter call.
// ===========================================================================
import { definePlugin } from "../../../plugin-kit/plugin-definition";
import type { MessageContextExtra, TypeName } from "../../../types";
import type { Unchanged } from "../../../plugin-kit/marker.types";
import { jsonSchemaPlugin } from "../json-schema";
import type { JsonSchemaOptions } from "../json-schema";
import { fromJsonSchema as convertWithBag } from "../../index";
import type { DialectOptions } from "../../index";
import type { GlobalConfig } from "../../../types/global-config";
import { jsonSchemaBag } from "./bundled-plugins";

/** The same nine slots the sibling serves: a document constrains any value. */
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

export const jsonSchemaFullFeaturePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [document: unknown, options?: JsonSchemaOptions];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "jsonSchemaFullFeature",
  // The document decides whether null is allowed, so null has to reach it.
  judgesNull: true,
  method: "jsonSchemaFullFeature",
  slots: SCHEMA_SLOTS,
  build: (ctx, document, options) =>
    jsonSchemaPlugin.build(ctx, document, jsonSchemaBag, options),
});

/**
 * The documented one-import route:
 *
 *     import { fromJsonSchema } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";
 *     const validator = fromJsonSchema<User>(schema);
 *
 * `T` defaults to `Record<string, unknown>`, never `any`, and under the default
 * NO declared path is checked — see build-from-schema.ts, which owns that
 * escape hatch and its single overload.
 *
 * THE INPUT LIMIT IS DRAFT-07. A document whose root `$schema` names 2019-09 or
 * 2020-12 is refused with an `UnsupportedDialectError` rather than read as
 * Draft-07, because the dialects disagree about what unchanged keywords mean;
 * a document with no `$schema` is read as Draft-07 as before. Pass
 * `{ assumeDraft07: true }` as the third argument to take the Draft-07 reading
 * deliberately. build-from-schema.ts states the divergence in full.
 *
 * The return type is INFERRED rather than written: naming `Validator<T>` would
 * mean importing src/builder, which tier `extension` forbids. The inferred type
 * is that same `Validator<T>` and the type test asserts it.
 */
export function fromJsonSchema<T extends object = Record<string, unknown>>(
  schema: unknown,
  config?: GlobalConfig,
  options?: DialectOptions
) {
  return convertWithBag<T>(jsonSchemaBag, schema, config, options);
}
