import type { AnyPlugin } from "../../../src/plugin-kit/plugin-definition";
import type { Rule } from "../../../src/plugin-kit/compiled-rule";
import type { RuntimeArgs } from "../../../src/plugin-kit/runtime-args.types";
import type {
  ElementChain,
  FieldRef,
} from "../../../src/plugin-kit/marker.types";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";
import { compareFieldPlugin } from "../../../src/plugins/compare-field";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { arrayContainsPlugin } from "../../../src/plugins/array-contains";
import { objectRecursivelyPlugin } from "../../../src/plugins/object-recursively";
import { unionGuardPlugin } from "../../../src/plugins/union-guard";
import { conditionalSchemaAsDesignedPlugin } from "../../support/conditional-schema-as-designed";
import { tupleBuilderPlugin } from "../../../src/plugins/tuple-builder";
import { stitchPlugin } from "../../../src/plugins/stitch";
import { validateIfPlugin } from "../../../src/plugins/validate-if";
import { compareToRootPlugin } from "../../support/probe-marker-plugins";
import type { Equals, Expect } from "../../support/model";

/** A1: every rule kind and every marker family lands in AnyPlugin with NO cast. */
export const ALL_PLUGINS: readonly AnyPlugin[] = [
  requiredPlugin,
  optionalPlugin,
  nullablePlugin,
  stringMinPlugin,
  numberMinPlugin,
  compareFieldPlugin,
  transformPlugin,
  arrayContainsPlugin,
  unionGuardPlugin,
  conditionalSchemaAsDesignedPlugin,
  objectRecursivelyPlugin,
  tupleBuilderPlugin,
  validateIfPlugin,
  compareToRootPlugin,
  stitchPlugin,
];

/** The chain node calls build with no cast. */
export function buildRule(
  plugin: AnyPlugin,
  ctx: Parameters<AnyPlugin["build"]>[0],
  resolvedArgs: readonly unknown[]
): Rule {
  return plugin.build(ctx, ...resolvedArgs);
}

// ---- A2: build() sees RUNTIME arguments -----------------------------------
export type FieldRefBecomesString = Expect<
  Equals<RuntimeArgs<readonly [other: FieldRef]>, readonly [other: string]>
>;
export type ElementChainBecomesRules = Expect<
  Equals<
    RuntimeArgs<readonly [element: ElementChain]>,
    readonly [element: readonly Rule[]]
  >
>;
/** CONTRADICTION A-4: an optional marker argument keeps `| undefined`. */
export type OptionalMarkerStaysOptional = Expect<
  Equals<
    RuntimeArgs<readonly [a: ElementChain, b?: ElementChain]>,
    readonly [a: readonly Rule[], b?: readonly Rule[]]
  >
>;
/** CONTRADICTION A-5: a plain tuple argument stays a TUPLE. */
export type TupleStaysTuple = Expect<
  Equals<
    RuntimeArgs<readonly [a: number, b: string]>,
    readonly [a: number, b: string]
  >
>;
/** An ARRAY of markers is descended into element-wise. */
export type MarkerArrayResolves = Expect<
  Equals<
    RuntimeArgs<readonly [positions: readonly ElementChain[]]>,
    readonly [positions: readonly (readonly Rule[])[]]
  >
>;
/** AnyPlugin's own args resolve to the erased shape the chain passes. */
export type AnyPluginArgsAreUnknown = Expect<
  Equals<RuntimeArgs<readonly unknown[]>, readonly unknown[]>
>;
