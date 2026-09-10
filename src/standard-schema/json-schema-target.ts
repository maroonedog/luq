// ===========================================================================
// L10 src/standard-schema/json-schema-target.ts
//
// Takes the spec's `target` and admits only what is actually supported.
//
// The spec says to throw on an unsupported target, and it is right to: writing
// draft-07 silently when 2020-12 was asked for hands the caller a document
// they will read under the wrong rules.
//
// Two are supported, draft-2020-12 and draft-07 — the two the spec names as
// widely used and strongly recommends implementing. openapi-3.0 descends from
// draft-04 and is a different lineage, so it is not admitted on a guess.
//
// Across the vocabulary currently emitted, the two differ only in `$schema`:
// every keyword written today is spelled and means the same in both. Tuples
// would differ, and are not emitted. This is where the branch goes if that
// changes.
// ===========================================================================

/** The supported targets, and the `$schema` each one announces. */
const SCHEMA_URI: Readonly<Record<string, string>> = Object.freeze({
  "draft-2020-12": "https://json-schema.org/draft/2020-12/schema",
  "draft-07": "http://json-schema.org/draft-07/schema#",
});

export class UnsupportedJsonSchemaTargetError extends Error {
  constructor(readonly target: string) {
    super(
      `Luq does not emit JSON Schema for the target "${target}". ` +
        `Supported targets: ${Object.keys(SCHEMA_URI).join(", ")}.`
    );
    this.name = "UnsupportedJsonSchemaTargetError";
  }
}

/** Returns the `$schema` for a supported target; throws for anything else. */
export function resolveJsonSchemaTarget(target: string): string {
  const schemaUri = SCHEMA_URI[target];
  if (schemaUri === undefined) {
    throw new UnsupportedJsonSchemaTargetError(target);
  }
  return schemaUri;
}
