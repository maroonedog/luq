// Shared fixture model + builder for the residual-4 call-site tests.
import { Builder } from "../../src/builder/field-builder.types";
import {
  nullablePlugin,
  optionalPlugin,
  requiredPlugin,
} from "../../src/plugins/presence-plugins";
import {
  compareFieldPlugin,
  numberMinPlugin,
  stringMinPlugin,
  transformPlugin,
} from "../../src/plugins/check-plugins";
import {
  externalFlagPlugin,
  stringTruthyPlugin,
} from "../../src/plugins/config-plugins";

export interface Address {
  readonly street: string;
  readonly zip?: string;
}

export interface Account {
  readonly name: string;
  readonly nick?: string;
  readonly age: number;
  readonly tags: string[];
  readonly address: Address;
  readonly when: Date;
  readonly flag: boolean;
  /** The JSON Schema `type: ["string","number"]` case refine* exists for. */
  readonly mixed: string | number;
}

export const accountBuilder = Builder()
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(nullablePlugin)
  .use(transformPlugin)
  .use(compareFieldPlugin)
  .use(stringTruthyPlugin)
  .use(externalFlagPlugin)
  .withConfig({ trimStrings: true, toBooleanTruthyValues: ["yes", "on"] })
  .for<Account>();

export const accountValidator = accountBuilder
  .v("name", (b) => b.string.required().min(1))
  .v("age", (b) => b.number.required().min(0))
  .build();

export type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Assert<T extends true> = T;
export type Extends<A, B> = [A] extends [B] ? true : false;
