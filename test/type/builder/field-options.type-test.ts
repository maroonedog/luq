// ===========================================================================
// `.v()`'s third argument, and the ROOT subpath.
// The default is typed by ValueAtPath<T, K>, which is the only reason a typo in
// a default value is a compile error rather than a value the rules then reject
// at run time.
// ===========================================================================
import { Builder } from "../../../src/index";
import type { FieldOptions, Validator } from "../../../src/index";
import {
  numberMinPlugin,
  stringMinPlugin,
} from "../../../src/plugins/check-plugins";
import {
  optionalPlugin,
  requiredPlugin,
} from "../../../src/plugins/presence-plugins";
import type { MissingFieldsError } from "../../../src/builder/field-builder.types";
import type { Equals, Expect } from "../../support/model";

interface Profile {
  readonly language: string;
  readonly retries: number;
  readonly nested: { readonly depth: number };
}

const kit = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin);

// ---- the option object is typed by the field it is declared on ------------
export const withDefaults = kit
  .for<Profile>()
  .v("language", (b) => b.string.required().min(2), { default: "en" })
  .v("retries", (b) => b.number.required().min(0), {
    default: (root) => (root === null ? 0 : 3),
    applyDefaultToNull: false,
  })
  .v("nested.depth", (b) => b.number.required().min(0), { default: 1 })
  .build();

export type BuildStillReturnsValidator = Expect<
  Equals<typeof withDefaults, Validator<Profile>>
>;

// NEGATIVE: a default of the wrong type is a compile error, not a run-time issue.
kit
  .for<Profile>()
  // @ts-expect-error `language` is a string; 1 is not a string default
  .v("language", (b) => b.string.required().min(2), { default: 1 });

kit
  .for<Profile>()
  // @ts-expect-error the factory must return the field's own type
  .v("retries", (b) => b.number.required().min(0), { default: () => "three" });

kit.for<Profile>().v(
  "retries",
  (b) => b.number.required().min(0),
  // @ts-expect-error applyDefaultToNull is a boolean
  { applyDefaultToNull: "no" }
);

kit
  .for<Profile>()
  // @ts-expect-error there is no such field option; a typo must not be silent
  .v("retries", (b) => b.number.required().min(0), { defaultValue: 3 });

// ---- the option type itself ----------------------------------------------
export type DefaultAcceptsBothForms = Expect<
  Equals<
    FieldOptions<string>["default"],
    string | ((root: unknown) => string) | undefined
  >
>;

// ---- .strict() fails with an ERROR OBJECT, never with `never` -------------
type StrictFailure = ReturnType<ReturnType<typeof kit.for<Profile>>["strict"]>;
export type StrictFailureIsNotNever = Expect<
  Equals<[StrictFailure] extends [never] ? true : false, false>
>;
export type StrictFailureNamesEveryLeaf = Expect<
  Equals<
    StrictFailure,
    MissingFieldsError<"language" | "retries" | "nested.depth">
  >
>;

// NEGATIVE: the error object has no build(), so the chain stops there.
kit
  .for<Profile>()
  .v("language", (b) => b.string.required().min(2))
  .strict()
  // @ts-expect-error .strict() returned MissingFieldsError, which has no build()
  .build();
