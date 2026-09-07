// ===========================================================================
// test/type/json-schema/keyword-binding.type-test.ts
// Every negative directive below is a MUTATION SITE: delete the comment and the
// build must fail with the quoted reason. TS2578 (unused directive) is a CI
// failure, so a gate that stops working is reported as loudly as a broken one.
// ===========================================================================
import { bindKeyword } from "../../../src/json-schema/bind-keyword";
import {
  applyKeywordBinding,
  type ConverterChain,
} from "../../../src/json-schema/apply-keyword-binding";
import type {
  BindableMethod,
  BoundMethod,
} from "../../../src/json-schema/json-schema-bag.types";
import type { KeywordBinding } from "../../../src/json-schema/keyword-binding.types";
import { arrayEachPlugin } from "../../../src/plugins/array-each";
import { conditionalSchemaPlugin } from "../../../src/plugins/conditional-schema";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { arrayMinLengthPlugin } from "../../../src/plugins/array-min-length";
import { stringPatternPlugin } from "../../../src/plugins/string-pattern";
import type { IsMarkerFree } from "../../../src/plugin-kit/marker.types";
import type { FieldRef } from "../../../src/plugin-kit/marker.types";
import type { JsonSchemaPlugin } from "../../../src/json-schema/json-schema-bag.types";
import { minItemsBinding } from "../../../src/json-schema/keyword-map-array";
import { minLengthBinding } from "../../../src/json-schema/keyword-map-string";
import type { ElementChain } from "../../../src/plugin-kit/marker.types";
import type { FieldChain } from "../../../src/chain/field-chain.types";
import type { OpenState } from "../../../src/chain/chain-state.types";
import type { JsonSchemaBag } from "../../../src/json-schema/json-schema-bag.types";
import { oneOfPlugin } from "../../../src/plugins/one-of";
import { objectAdditionalPropertiesPlugin } from "../../../src/plugins/object-additional-properties";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;

// ---------------------------------------------------- 1. the C2 regression --
// Draft-07 spells it "minItems". The chain method is "minLength". Writing the
// KEYWORD where the METHOD belongs is what the legacy converter did, and it is
// now a type error instead of a constraint that silently disappears.
bindKeyword(
  "array",
  // @ts-expect-error "minItems" is not a method on the array chain
  "minItems",
  arrayMinLengthPlugin,
  (v: number) => [v] as const
);
bindKeyword(
  "array",
  // @ts-expect-error and a typo is caught by the same gate
  "minItemz",
  arrayMinLengthPlugin,
  (v: number) => [v] as const
);
// the spelled-correctly form is the one in the shipped table
export type MinItemsUsesMinLength = Assert<
  Equals<typeof minItemsBinding.method, "minLength">
>;
export type MinItemsNamesItsPlugin = Assert<
  Equals<typeof minItemsBinding.pluginName, "arrayMinLength">
>;

// ------------------------------------- 2. the literal cannot drift from the
// plugin: the method name and the plugin object must agree.
// @ts-expect-error stringMinPlugin declares method "min", not "max"
bindKeyword("string", "max", stringMinPlugin, (v: number) => [v] as const);
// @ts-expect-error stringPatternPlugin declares method "pattern", not "min"
bindKeyword("string", "min", stringPatternPlugin, (v: string) => [v] as const);

// ------------------------------------------------------- 3. slot agreement --
// @ts-expect-error stringMinPlugin has no "number" slot
bindKeyword("number", "min", stringMinPlugin, (v: number) => [v] as const);

// ------------------------------------------- 4. markers are not JSON values --
// A sub-schema becomes a sub-CHAIN, and no toArguments can produce one from a
// JSON value. MarkerFreeArgs resolves to `never`, so the callback cannot exist.
bindKeyword(
  "array",
  "each",
  arrayEachPlugin,
  // @ts-expect-error arrayEach takes an ElementChain marker
  (v: readonly unknown[]) => [v] as const
);
bindKeyword(
  "object",
  "conditionalSchema",
  conditionalSchemaPlugin,
  // @ts-expect-error conditionalSchema's if/then/else are ElementChain markers
  (v: unknown) => [v] as const
);
// The SHARP form of the same gate: even a callback that hands back a genuine
// ElementChain is rejected, so the failure above is the marker rule and not an
// accidental argument-type mismatch. (Mutation M4 flips exactly this line.)
declare const someElementChain: ElementChain;
bindKeyword(
  "array",
  "each",
  arrayEachPlugin,
  // @ts-expect-error MarkerFreeArgs<readonly [ElementChain]> is never
  (_v: unknown) => [someElementChain] as const
);
// ... but both ARE reachable on a hand-written chain. That is the distinction.
export type EachIsOnChain = Assert<Extends<"each", BoundMethod<"array">>>;
export type EachIsNotBindable = Assert<
  Equals<Extends<"each", BindableMethod<"array">>, false>
>;
export type ConverterChainHidesEach = Assert<
  Equals<Extends<"each", keyof ConverterChain<"array">>, false>
>;
export type ConverterChainShowsMinLength = Assert<
  Extends<"minLength", keyof ConverterChain<"array">>
>;

// --------------------------------------------------- 5. the argument tuple --
bindKeyword(
  "array",
  "minLength",
  arrayMinLengthPlugin,
  // @ts-expect-error arrayMinLength takes exactly one number
  (v: number) => [v, v] as const
);
bindKeyword(
  "array",
  "minLength",
  arrayMinLengthPlugin,
  // @ts-expect-error arrayMinLength takes a number, not a string
  (v: number) => [String(v)] as const
);

// ------------------------------------------- 6. hand-written binding types --
export type GoodHandWritten = KeywordBinding<
  "array",
  "minLength",
  "arrayMinLength",
  readonly [min: number],
  number
>;
export type BadHandWritten = KeywordBinding<
  "array",
  // @ts-expect-error "minItems" is not assignable to keyof SlotPlugins<JsonSchemaBag, "array">
  "minItems",
  "arrayMinLength",
  readonly [number],
  number
>;

// ------------------------------------------------------ 7. the call site ----
declare const arrayChain: ConverterChain<"array">;
const afterMinItems = applyKeywordBinding(arrayChain, minItemsBinding, 2);
export type AppliedStaysAChain = Assert<
  Equals<typeof afterMinItems, ConverterChain<"array">>
>;
// @ts-expect-error minItems carries a number in a Draft-07 document, not a boolean
applyKeywordBinding(arrayChain, minItemsBinding, true);
// @ts-expect-error a string binding cannot be applied to the array chain
applyKeywordBinding(arrayChain, minLengthBinding, 2);

// ------------------------- 8. the payoff: the REAL chain satisfies the slice --
// If this stops holding, the converter is driving something that is not the
// chain users write by hand, and the two engines have split again.
type RealArrayChain = FieldChain<
  JsonSchemaBag,
  "array",
  { readonly tags: readonly string[] },
  readonly string[],
  OpenState
>;
export type RealChainDrivesConverter = Assert<
  Extends<RealArrayChain, ConverterChain<"array">>
>;
declare const realChain: RealArrayChain;
export const appliedToRealChain: ConverterChain<"array"> = applyKeywordBinding(
  realChain,
  minItemsBinding,
  2
);

// ------------------- 9. IsMarkerFree separates schema-drivable plugins ------
// Carried over from the superseded test/json-schema.type-test.ts, which tested
// the three-argument bindKeyword this file replaced.
export type PlainIsFree = Assert<
  Equals<IsMarkerFree<readonly [min: number]>, true>
>;
export type FieldRefIsNotFree = Assert<
  Equals<IsMarkerFree<readonly [other: FieldRef]>, false>
>;
export type ElementChainIsNotFree = Assert<
  Equals<IsMarkerFree<readonly [element: ElementChain]>, false>
>;
export type OptionalMarkerIsNotFree = Assert<
  Equals<IsMarkerFree<readonly [a: number, b?: ElementChain]>, false>
>;
/** There is no syntactic position in which to type a bare keyword name. */
export type NoBareMethodNames = Assert<
  Equals<Extract<BindableMethod<"array">, "minItems">, never>
>;
declare const someSchemaPlugin: JsonSchemaPlugin;
export type SchemaPluginIsMarkerFree = Assert<
  Equals<
    IsMarkerFree<NonNullable<typeof someSchemaPlugin.signature>["args"]>,
    true
  >
>;

// ------------ 10. the one keyword the COMPOSED tree could not keep bound ---
// `oneOf` types its allowed list against the field (SelfValue), so it carries
// a marker and cannot be bound. additionalProperties CAN be bound now that the
// boolean form is a separate marker-free plugin from the schema form.
bindKeyword(
  "string",
  "oneOf",
  oneOfPlugin,
  // @ts-expect-error the single oneOf plugin takes readonly SelfValue[], a marker
  (v: readonly unknown[]) => [v] as const
);
export type OneOfIsOnChain = Assert<Extends<"oneOf", BoundMethod<"string">>>;
export type OneOfIsNotBindable = Assert<
  Equals<Extends<"oneOf", BindableMethod<"string">>, false>
>;
/**
 * POSITIVE: the boolean form binds. This call is the gate itself — if the
 * plugin ever regrows a marker argument, MarkerFreeArgs collapses to `never`
 * and this line stops compiling.
 */
export const additionalPropertiesBooleanBinds = bindKeyword(
  "object",
  "additionalProperties",
  objectAdditionalPropertiesPlugin,
  (v: boolean) => [v] as const
);
export type AdditionalPropertiesIsOnChain = Assert<
  Extends<"additionalProperties", BoundMethod<"object">>
>;
/** The boolean form is marker-free, so the compile-time gate applies to it. */
export type AdditionalPropertiesIsBindable = Assert<
  Extends<"additionalProperties", BindableMethod<"object">>
>;
/** The schema form carries a PropertyValueChain, so it stays unbindable. */
export type AdditionalPropertiesSchemaIsNotBindable = Assert<
  Equals<Extends<"additionalPropertiesSchema", BindableMethod<"object">>, false>
>;
