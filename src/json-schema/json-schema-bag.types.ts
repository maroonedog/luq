// ===========================================================================
// L8  src/json-schema/json-schema-bag.types.ts
//
// LAYERING: this file is L8. It may import L7 plugin ENTRIES and L3 chain
// types, and nothing above it may import it. The plugin-isolation checker must
// therefore NOT treat src/json-schema/** as a plugin directory; only
// src/json-schema/extensions/** holds plugins (CONTRADICTION A-14).
//
// WHY `type` AND NOT `interface` (measured, not guessed):
//   `interface JsonSchemaBag extends PluginBag` inherits PluginBag's string
//   index signature, so `keyof SlotPlugins<JsonSchemaBag, S>` collapses to
//   `string` and EVERY method name type-checks again — the silent duck-typing
//   this whole layer exists to kill (`chain.minItems && chain.minItems(n)`).
//   `interface JsonSchemaBag { ... }` without `extends` fails the
//   `B extends PluginBag` constraint instead, because an interface gets no
//   implicit index signature. A `type` alias to an object literal type gets the
//   implicit index signature AND keeps its keys finite, so it is the only form
//   that both satisfies the constraint and keeps `BoundMethod<S>` a literal
//   union. Do not "tidy" this into an interface.
// ===========================================================================
import type { TypeName } from "../types";
import type { IsMarkerFree } from "../plugin-kit/marker.types";
import type {
  PluginArgs,
  PluginDefinition,
  PluginSignature,
} from "../plugin-kit/plugin-definition";
import type { SlotPlugins } from "../chain/plugin-bag.types";
import { requiredPlugin } from "../plugins/required";
import { compareFieldPlugin } from "../plugins/compare-field";
import { numberMinPlugin } from "../plugins/number-min";
import { stringMinPlugin } from "../plugins/string-min";
import { arrayEachPlugin } from "../plugins/array-each";
import { conditionalSchemaPlugin } from "../plugins/conditional-schema";
import { arrayMaxLengthPlugin } from "../plugins/array-max-length";
import { arrayMinLengthPlugin } from "../plugins/array-min-length";
import { arrayUniquePlugin } from "../plugins/array-unique";
import { numberMaxPlugin } from "../plugins/number-max";
import { stringMaxPlugin } from "../plugins/string-max";
import { stringPatternPlugin } from "../plugins/string-pattern";
import { literalPlugin } from "../plugins/literal";
import { oneOfPlugin } from "../plugins/one-of";
import { objectAdditionalPropertiesPlugin } from "../plugins/object-additional-properties";
import { objectPatternPropertiesPlugin } from "../plugins/object-pattern-properties";
import { objectPropertyNamesPlugin } from "../plugins/object-property-names";
import { numberIntegerPlugin } from "../plugins/number-integer";
import { numberMultipleOfPlugin } from "../plugins/number-multiple-of";
import { objectMinPropertiesPlugin } from "../plugins/object-min-properties";
import { objectMaxPropertiesPlugin } from "../plugins/object-max-properties";
import { objectAdditionalPropertiesSchemaPlugin } from "../plugins/object-additional-properties";
import { objectDependentRequiredPlugin } from "../plugins/object-dependent-required";
import { objectDependentSchemasPlugin } from "../plugins/object-dependent-schemas";
import { arrayContainsPlugin } from "../plugins/array-contains";
import { tupleBuilderPlugin } from "../plugins/tuple-builder";
import { optionalPlugin } from "../plugins/optional";
import { nullablePlugin } from "../plugins/nullable";
import { stringContentEncodingPlugin } from "../plugins/string-content-encoding";
import { stringContentMediaTypePlugin } from "../plugins/string-content-media-type";
import { stringDatePlugin } from "../plugins/string-date";
import { stringDatetimePlugin } from "../plugins/string-datetime";
import { stringDurationPlugin } from "../plugins/string-duration";
import { stringEmailPlugin } from "../plugins/string-email";
import { stringHostnamePlugin } from "../plugins/string-hostname";
import { stringIdnEmailPlugin } from "../plugins/string-idn-email";
import { stringIdnHostnamePlugin } from "../plugins/string-idn-hostname";
import { stringIpv4Plugin } from "../plugins/string-ipv4";
import { stringIpv6Plugin } from "../plugins/string-ipv6";
import { stringIriPlugin } from "../plugins/string-iri";
import { stringIriReferencePlugin } from "../plugins/string-iri-reference";
import { stringJsonPointerPlugin } from "../plugins/string-json-pointer";
import { stringRelativeJsonPointerPlugin } from "../plugins/string-relative-json-pointer";
import { stringTimePlugin } from "../plugins/string-time";
import { stringUriTemplatePlugin } from "../plugins/string-uri-template";
import { stringUrlPlugin } from "../plugins/string-url";
import { stringRegexPlugin } from "../plugins/string-regex";
import { stringUriReferencePlugin } from "../plugins/string-uri-reference";
import { uuidPlugin } from "../plugins/uuid";

/** The concrete bag `jsonSchemaFullFeature` installs. See the note above. */
export type JsonSchemaBag = {
  readonly required: typeof requiredPlugin;
  readonly optional: typeof optionalPlugin;
  readonly nullable: typeof nullablePlugin;
  readonly literal: typeof literalPlugin;
  readonly stringMin: typeof stringMinPlugin;
  readonly stringMax: typeof stringMaxPlugin;
  readonly stringPattern: typeof stringPatternPlugin;
  readonly stringContentEncoding: typeof stringContentEncodingPlugin;
  readonly stringContentMediaType: typeof stringContentMediaTypePlugin;
  readonly numberMin: typeof numberMinPlugin;
  readonly numberMax: typeof numberMaxPlugin;
  readonly numberInteger: typeof numberIntegerPlugin;
  readonly numberMultipleOf: typeof numberMultipleOfPlugin;
  readonly arrayMinLength: typeof arrayMinLengthPlugin;
  readonly arrayMaxLength: typeof arrayMaxLengthPlugin;
  readonly arrayUnique: typeof arrayUniquePlugin;
  readonly objectMinProperties: typeof objectMinPropertiesPlugin;
  readonly objectMaxProperties: typeof objectMaxPropertiesPlugin;
  // The twenty `format` plugins. The format map binds every one of them and
  // nothing else in src re-implements their grammars (verified by grep).
  readonly stringDate: typeof stringDatePlugin;
  readonly stringDatetime: typeof stringDatetimePlugin;
  readonly stringTime: typeof stringTimePlugin;
  readonly stringDuration: typeof stringDurationPlugin;
  readonly stringEmail: typeof stringEmailPlugin;
  readonly stringHostname: typeof stringHostnamePlugin;
  readonly stringIdnEmail: typeof stringIdnEmailPlugin;
  readonly stringIdnHostname: typeof stringIdnHostnamePlugin;
  readonly stringRegex: typeof stringRegexPlugin;
  readonly stringUriReference: typeof stringUriReferencePlugin;
  readonly stringIpv4: typeof stringIpv4Plugin;
  readonly stringIpv6: typeof stringIpv6Plugin;
  readonly stringUrl: typeof stringUrlPlugin;
  readonly stringIri: typeof stringIriPlugin;
  readonly stringIriReference: typeof stringIriReferencePlugin;
  readonly stringUriTemplate: typeof stringUriTemplatePlugin;
  readonly stringJsonPointer: typeof stringJsonPointerPlugin;
  readonly stringRelativeJsonPointer: typeof stringRelativeJsonPointerPlugin;
  readonly uuid: typeof uuidPlugin;
  // Marker-carrying members: reachable from a hand-written chain, NEVER from a
  // keyword binding. They are the plugins the structural keywords drive.
  readonly oneOf: typeof oneOfPlugin;
  readonly objectAdditionalProperties: typeof objectAdditionalPropertiesPlugin;
  readonly objectAdditionalPropertiesSchema: typeof objectAdditionalPropertiesSchemaPlugin;
  readonly objectPatternProperties: typeof objectPatternPropertiesPlugin;
  readonly objectPropertyNames: typeof objectPropertyNamesPlugin;
  readonly objectDependentRequired: typeof objectDependentRequiredPlugin;
  readonly objectDependentSchemas: typeof objectDependentSchemasPlugin;
  readonly arrayEach: typeof arrayEachPlugin;
  readonly arrayContains: typeof arrayContainsPlugin;
  readonly tupleBuilder: typeof tupleBuilderPlugin;
  readonly conditionalSchema: typeof conditionalSchemaPlugin;
  readonly compareField: typeof compareFieldPlugin;
};

/** Every method name reachable on the bag's chain for slot S. */
export type BoundMethod<S extends TypeName> = keyof SlotPlugins<
  JsonSchemaBag,
  S
> &
  string;

/** A total lookup: a direct index would be TS2536 under a generic S. */
export type BoundPlugin<S extends TypeName, M> =
  SlotPlugins<JsonSchemaBag, S> extends infer Slot
    ? M extends keyof Slot
      ? Slot[M]
      : never
    : never;

export type NameOf<P> = P extends { readonly name: infer N extends string }
  ? N
  : never;

/** PluginArgs re-stated so it satisfies a `readonly unknown[]` constraint. */
export type ArgsOf<P> =
  PluginArgs<P> extends infer A extends readonly unknown[] ? A : never;

/** Marker-freeness is expressed through IsMarkerFree, which lives beside the
 *  marker registry, so a new marker cannot silently widen it. */
export type MarkerFreePlugin<P> =
  P extends PluginDefinition<
    string,
    string,
    readonly TypeName[],
    infer Sig extends PluginSignature
  >
    ? IsMarkerFree<Sig["args"]> extends true
      ? P
      : never
    : never;

export type JsonSchemaPlugin = MarkerFreePlugin<
  JsonSchemaBag[keyof JsonSchemaBag]
>;

/** An argument tuple a JSON document can supply: `never` when it carries a marker. */
export type MarkerFreeArgs<A extends readonly unknown[]> =
  IsMarkerFree<A> extends true ? A : never;

/** The methods of slot S a keyword may bind to: reachable AND marker-free. */
export type BindableMethod<S extends TypeName> = {
  [M in BoundMethod<S>]: [MarkerFreePlugin<BoundPlugin<S, M>>] extends [never]
    ? never
    : M;
}[BoundMethod<S>];
