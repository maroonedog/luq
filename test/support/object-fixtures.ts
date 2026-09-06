// ===========================================================================
// test/plugins/object-fixtures.ts — the model and the bag the property-plugin
// and composition fixtures share. Nothing here asserts; it exists so the call
// sites in the sibling files stay the only thing being read.
// ===========================================================================
import { Builder } from "../../src/builder/field-builder.types";
import {
  optionalPlugin,
  requiredPlugin,
} from "../../src/plugins/presence-plugins";
import {
  numberMinPlugin,
  stringMinPlugin,
} from "../../src/plugins/check-plugins";
import { conditionalSchemaPlugin } from "../../src/plugins/conditional-schema";
import { objectPatternPropertiesPlugin } from "../../src/plugins/object/pattern-properties";
import { objectPropertyNamesPlugin } from "../../src/plugins/object/property-names";
import { objectAdditionalPropertiesPlugin } from "../../src/plugins/object/additional-properties";
import { objectAdditionalPropertiesSchemaPlugin } from "../../src/plugins/object/additional-properties-schema";
import { objectDependentSchemasPlugin } from "../../src/plugins/object/dependent-schemas";
import { oneOfSchemaPlugin } from "../../src/plugins/composition/one-of-schema";
import { oneOfPlugin } from "../../src/plugins/value/one-of";

export type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Assert<T extends true> = T;

/** A string-valued map: PropertyValueOf<Labels> is `string`. */
export interface Labels {
  readonly env: string;
  readonly tier: string;
}
/** A number-valued map: PropertyValueOf<Metrics> is `number`. */
export interface Metrics {
  readonly hits: number;
  readonly misses: number;
}
export interface Account {
  readonly id: string;
  readonly plan: string;
  readonly labels: Labels;
  readonly metrics: Metrics;
}

export const ab = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(conditionalSchemaPlugin)
  .use(objectPatternPropertiesPlugin)
  .use(objectPropertyNamesPlugin)
  .use(objectAdditionalPropertiesPlugin)
  .use(objectAdditionalPropertiesSchemaPlugin)
  .use(objectDependentSchemasPlugin)
  .use(oneOfSchemaPlugin)
  .use(oneOfPlugin)
  .for<Account>();
