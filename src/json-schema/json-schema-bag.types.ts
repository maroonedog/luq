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
import { requiredPlugin } from "../plugins/presence-plugins";
import {
  compareFieldPlugin,
  numberMinPlugin,
  stringMinPlugin,
} from "../plugins/check-plugins";
import { arrayEachPlugin } from "../plugins/array-each";
import { conditionalSchemaPlugin } from "../plugins/conditional-schema";
import { arrayMaxLengthPlugin } from "../plugins/array/max-length";
import { arrayMinLengthPlugin } from "../plugins/array/min-length";
import { arrayUniquePlugin } from "../plugins/array/unique";
import { numberMaxPlugin } from "../plugins/number/max";
import { stringFormatPlugin } from "../plugins/string/format";
import { stringMaxPlugin } from "../plugins/string/max-length";
import { stringPatternPlugin } from "../plugins/string/pattern";
import { literalPlugin } from "../plugins/value-plugins";
import { oneOfPlugin } from "../plugins/value/one-of";
import { objectAdditionalPropertiesPlugin } from "../plugins/object/additional-properties";
import { objectPatternPropertiesPlugin } from "../plugins/object/pattern-properties";
import { objectPropertyNamesPlugin } from "../plugins/object/property-names";

/** The concrete bag `jsonSchemaFullFeature` installs. See the note above. */
export type JsonSchemaBag = {
  readonly required: typeof requiredPlugin;
  readonly stringMin: typeof stringMinPlugin;
  readonly stringMax: typeof stringMaxPlugin;
  readonly stringPattern: typeof stringPatternPlugin;
  readonly stringFormat: typeof stringFormatPlugin;
  readonly numberMin: typeof numberMinPlugin;
  readonly numberMax: typeof numberMaxPlugin;
  readonly arrayMinLength: typeof arrayMinLengthPlugin;
  readonly arrayMaxLength: typeof arrayMaxLengthPlugin;
  readonly arrayUnique: typeof arrayUniquePlugin;
  readonly literal: typeof literalPlugin;
  // Marker-carrying members: reachable from a hand-written chain, NEVER from a
  // keyword binding. They are the plugins the structural keywords drive.
  readonly oneOf: typeof oneOfPlugin;
  readonly objectAdditionalProperties: typeof objectAdditionalPropertiesPlugin;
  readonly objectPatternProperties: typeof objectPatternPropertiesPlugin;
  readonly objectPropertyNames: typeof objectPropertyNamesPlugin;
  readonly arrayEach: typeof arrayEachPlugin;
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
