// Pins that the locally declared Standard Schema types **do not disagree with
// the real spec**.
//
// Why this is needed. The types are declared here rather than taken from the
// spec package, which the spec explicitly permits. But a type test written
// against a local declaration **cannot detect that the spec moved**, and that
// is exactly what was missed once: validate's second parameter was left out,
// and since a function with fewer parameters is assignable to one with more,
// the test asserting conformance passed anyway.
//
// So the real spec package is read as a dev dependency and compared by
// assignment in both directions. No run-time dependency is added: it is types
// only, imported as types only.
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { toStandardSchema } from "../../../src/standard-schema/to-standard-schema";
import type {
  StandardSchemaIssue,
  StandardSchemaOptions,
  StandardSchemaPathSegment,
  StandardSchemaResult,
  StandardSchemaV1 as OurStandardSchemaV1,
} from "../../../src/standard-schema/standard-schema.types";
import type { Assert, Equals, Extends } from "../../support/config-model";

// ---- local declaration against the real one, assigned both ways -----------
// One direction alone misses either too wide or too narrow, whichever it is.

export type OursAcceptsTheirs = Assert<
  Extends<StandardSchemaV1, OurStandardSchemaV1>
>;
export type TheirsAcceptsOurs = Assert<
  Extends<OurStandardSchemaV1, StandardSchemaV1>
>;

// ---- the shape of each member --------------------------------------------

export type ResultMatches = Assert<
  Equals<StandardSchemaResult<number>, StandardSchemaV1.Result<number>>
>;

export type IssueMatches = Assert<
  Equals<StandardSchemaIssue, StandardSchemaV1.Issue>
>;

export type PathSegmentMatches = Assert<
  Equals<StandardSchemaPathSegment, StandardSchemaV1.PathSegment>
>;

export type OptionsMatches = Assert<
  Equals<StandardSchemaOptions, StandardSchemaV1.Options>
>;

// ---- what is actually produced satisfies the real spec -------------------

const schema = toStandardSchema(
  Builder()
    .use(requiredPlugin)
    .for<{ name: string }>()
    .v("name", (b) => b.string.required())
    .build()
);

/** A consumer takes `schema: StandardSchemaV1`. This is the real case. */
export type BuiltSchemaSatisfiesSpec = Assert<
  Extends<typeof schema, StandardSchemaV1>
>;

/** InferInput / InferOutput answer the same read from the real spec's side. */
export type InferInputAgrees = Assert<
  Equals<StandardSchemaV1.InferInput<typeof schema>, { name: string }>
>;
export type InferOutputAgrees = Assert<
  Equals<StandardSchemaV1.InferOutput<typeof schema>, { name: string }>
>;

// ---- that options is actually declared ------------------------------------
// A function with fewer parameters is assignable to one with more, so the
// assignment checks above cannot catch a missing options parameter. Passing
// one is what catches it.

schema["~standard"].validate({ name: "a" }, { libraryOptions: { any: 1 } });

// @ts-expect-error the second argument is Options, not an arbitrary value
schema["~standard"].validate({ name: "a" }, 42);
