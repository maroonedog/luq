// ===========================================================================
// L10 src/standard-schema/standard-schema.types.ts
//
// Declares the Standard Schema v1 types here rather than depending on the
// spec package. The spec explicitly permits inlining, being types only, and a
// dependency would add an entry to every user's node_modules for nothing.
// Type tests pin the shape against the spec so it cannot drift.
//
// This is the outermost layer because it is a view laid over the validator and
// nothing in the core imports it. The import direction runs inwards only.
// ===========================================================================

/** The spec's StandardSchemaV1, carrying Input and Output as types. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaProps<Input, Output>;
}

export interface StandardSchemaProps<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
    options?: StandardSchemaOptions | undefined
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  /**
   * Absent at run time. The spec defines it as a type-only member, and it is
   * what InferInput / InferOutput read.
   */
  readonly types?: StandardSchemaTypes<Input, Output> | undefined;
}

export interface StandardSchemaTypes<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

export type StandardSchemaResult<Output> =
  | StandardSchemaSuccess<Output>
  | StandardSchemaFailure;

export interface StandardSchemaSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface StandardSchemaFailure {
  readonly issues: readonly StandardSchemaIssue[];
}

/**
 * The spec makes path optional; it is always present here, with an issue on
 * the root carrying the empty list. That keeps "omitted" distinguishable from
 * "points at the root" on the consuming side.
 */
export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?:
    | readonly (PropertyKey | StandardSchemaPathSegment)[]
    | undefined;
}

export interface StandardSchemaPathSegment {
  readonly key: PropertyKey;
}

export type InferStandardInput<Schema extends StandardSchemaV1> = NonNullable<
  Schema["~standard"]["types"]
>["input"];

export type InferStandardOutput<Schema extends StandardSchemaV1> = NonNullable<
  Schema["~standard"]["types"]
>["output"];

/**
 * validate's second parameter, declared because the spec defines it.
 * libraryOptions is the per-vendor extension point, and none is defined yet.
 */
export interface StandardSchemaOptions {
  readonly libraryOptions?: Record<string, unknown> | undefined;
}
