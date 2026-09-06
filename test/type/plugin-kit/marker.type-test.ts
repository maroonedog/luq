// ===========================================================================
// test/type/plugin-kit/marker-registry.type-test.ts
// WHY TWO NEW MARKERS WERE UNAVOIDABLE, as type equalities rather than prose.
// ElementOf answers a question about arrays and returns `never` for an object;
// `never` makes SlotAccepts false for all nine slots, so every slot on the
// sub-builder becomes SlotTypeMismatch. Present<TValue,TState> is the object
// itself, so it cannot reach a property value either, and nothing at all can
// reach a property KEY.
// ===========================================================================
import type { ElementOf } from "../../../src/path/element-of.types";
import type { PropertyValueOf } from "../../../src/path/property-value-of.types";
import type {
  IsMarkerFree,
  NarrowedChain,
  PropertyKeyChain,
  PropertyValueChain,
} from "../../../src/plugin-kit/marker.types";
import type { PluginArgs } from "../../../src/plugin-kit/plugin-definition";
import type { RuntimeArgs } from "../../../src/plugin-kit/runtime-args.types";
import type { Rule } from "../../../src/plugin-kit/compiled-rule";
import type {
  Assert,
  Equals,
  Labels,
  Metrics,
} from "../../support/object-fixtures";
import { objectPatternPropertiesPlugin } from "../../../src/plugins/object/pattern-properties";
import { objectDependentSchemasPlugin } from "../../../src/plugins/object/dependent-schemas";
import { oneOfSchemaPlugin } from "../../../src/plugins/composition/one-of-schema";
import { oneOfPlugin } from "../../../src/plugins/value/one-of";

export type ElementOfObjectIsNever = Assert<Equals<ElementOf<Labels>, never>>;
export type PropertyValueOfLabels = Assert<
  Equals<PropertyValueOf<Labels>, string>
>;
export type PropertyValueOfMetrics = Assert<
  Equals<PropertyValueOf<Metrics>, number>
>;
export type PropertyValueOfArrayIsNever = Assert<
  Equals<PropertyValueOf<readonly string[]>, never>
>;
export type PropertyValueOfOpaqueIsNever = Assert<
  Equals<PropertyValueOf<Date>, never>
>;
export type PropertyValueOfUnknownIsUnknown = Assert<
  Equals<PropertyValueOf<unknown>, unknown>
>;

// Both new markers erase to plain rule lists in build(), INCLUDING inside a
// keyed record -- the container the array recursion never reached.
export type RuntimePropertyValueRecord = Assert<
  Equals<
    RuntimeArgs<readonly [Readonly<Record<string, PropertyValueChain>>]>,
    readonly [Readonly<Record<string, readonly Rule[]>>]
  >
>;
export type RuntimeNarrowedRecord = Assert<
  Equals<
    RuntimeArgs<readonly [Readonly<Record<string, NarrowedChain>>]>,
    readonly [Readonly<Record<string, readonly Rule[]>>]
  >
>;
export type RuntimePropertyKey = Assert<
  Equals<RuntimeArgs<readonly [PropertyKeyChain]>, readonly [readonly Rule[]]>
>;
/** An ordinary options bag must pass through the record recursion untouched. */
export type RuntimeLeavesOptionsBagAlone = Assert<
  Equals<
    RuntimeArgs<readonly [{ readonly maxDepth?: number }]>,
    readonly [{ readonly maxDepth?: number }]
  >
>;

// A marker hidden inside a record or a list must NOT read as marker-free, or
// the JSON Schema layer would bind the DECLARED tuple as if it were the runtime
// one. Every one of these was `true` under the shallow IsMarkerFree.
export type PatternPropertiesIsNotBindable = Assert<
  Equals<IsMarkerFree<PluginArgs<typeof objectPatternPropertiesPlugin>>, false>
>;
export type DependentSchemasIsNotBindable = Assert<
  Equals<IsMarkerFree<PluginArgs<typeof objectDependentSchemasPlugin>>, false>
>;
export type OneOfSchemaIsNotBindable = Assert<
  Equals<IsMarkerFree<PluginArgs<typeof oneOfSchemaPlugin>>, false>
>;
export type OneOfEnumIsNotBindable = Assert<
  Equals<IsMarkerFree<PluginArgs<typeof oneOfPlugin>>, false>
>;
/** ...while a genuinely marker-free tuple still reads as bindable. */
export type PlainTupleStaysBindable = Assert<
  Equals<
    IsMarkerFree<
      readonly [min: number, options?: { readonly maxDepth?: number }]
    >,
    true
  >
>;
