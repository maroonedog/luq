// Pins that the Standard Schema v1 types have not drifted from the spec, and
// that InferInput / InferOutput come out as declared.
//
// The spec package is not a dependency, so nothing reports a drift. This is
// the only watch on it.
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { toStandardSchema } from "../../../src/standard-schema/to-standard-schema";
import type {
  InferStandardInput,
  InferStandardOutput,
  StandardSchemaV1,
} from "../../../src/standard-schema/standard-schema.types";
import type { Assert, Equals, Extends } from "../../support/config-model";

type Account = {
  name: string;
  age: number;
};

const accountSchema = toStandardSchema(
  Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .for<Account>()
    .v("name", (b) => b.string.required().min(3))
    .build()
);

// ---- the shape the spec asks for -----------------------------------------

/** A consumer takes `schema: StandardSchemaV1`. Not being assignable to that makes all of it pointless. */
export type AssignableToSpec = Assert<
  Extends<typeof accountSchema, StandardSchemaV1>
>;

export type VersionIsLiteralOne = Assert<
  Equals<(typeof accountSchema)["~standard"]["version"], 1>
>;

export type VendorIsString = Assert<
  Equals<(typeof accountSchema)["~standard"]["vendor"], string>
>;

// ---- Infer ---------------------------------------------------------------

/**
 * This is the claim itself. Other libraries infer the type from the schema,
 * so their InferInput is "the shape the schema accepts". Here the type given
 * to .for<T>() is carried through, so it equals the type the user wrote.
 */
export type InputIsTheDeclaredType = Assert<
  Equals<InferStandardInput<typeof accountSchema>, Account>
>;

export type OutputIsTheDeclaredType = Assert<
  Equals<InferStandardOutput<typeof accountSchema>, Account>
>;

// ---- Output changes when there is a transform ----------------------------

const trimmedSchema = toStandardSchema(
  Builder()
    .use(requiredPlugin)
    .use(transformPlugin)
    .for<{ name: string }>()
    .v("name", (b) => b.string.required().transform((value) => value.length))
    .build()
);

export type TransformKeepsInput = Assert<
  Equals<InferStandardInput<typeof trimmedSchema>, { name: string }>
>;

/**
 * Pins a KNOWN GAP: **Output currently equals Input.**
 *
 * At run time the transform applies and the field becomes a number, while the
 * type still says string. The cause is on the builder side, not the Standard
 * Schema side: build() does not pass the parsed type through, so it always
 * falls back to the declared one.
 *
 * Fixing that makes this assertion fail. That is deliberate — the failure is
 * the signal that it was fixed. Change the expectation then.
 */
export type TransformOutputIsNotTrackedYet = Assert<
  Equals<InferStandardOutput<typeof trimmedSchema>, { name: string }>
>;

// ---- what validate returns -----------------------------------------------

const outcome = accountSchema["~standard"].validate({});

/**
 * The spec permits both synchronous and asynchronous; this is always
 * synchronous. Let a Promise back into this type and every consumer has to
 * write an await and a narrowing.
 */
export type ValidateIsSynchronous = Assert<
  Equals<typeof outcome extends Promise<unknown> ? true : false, false>
>;

// value is readable on the success branch only.
if (!("issues" in outcome) || outcome.issues === undefined) {
  const value: Account = outcome.value;
  void value;
} else {
  // @ts-expect-error the failure branch has no value
  void outcome.value;
}

// ---- it is still usable as a Validator -----------------------------------

export type StillAValidator = Assert<
  Extends<typeof accountSchema, { validate: unknown; parse: unknown }>
>;
