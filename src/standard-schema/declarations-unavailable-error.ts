// ===========================================================================
// L10 src/standard-schema/declarations-unavailable-error.ts
//
// "Nothing was declared" and "what was declared is not known" are different
// answers, and only one of them can be written out.
//
// Collapsing them into an empty list produces a schema that permits everything
// and looks entirely confident about it. This refusal exists to stop that.
//
// It outranks the unrepresentable policy: `omit` is permission to drop a
// declaration that cannot be written, not permission to write without knowing
// what was declared.
// ===========================================================================

export class DeclarationsUnavailableError extends Error {
  constructor(readonly fieldPath?: string) {
    super(
      (fieldPath === undefined
        ? "This validator carries no declarations"
        : `"${fieldPath}" carries no declarations`) +
        ", so no JSON Schema can be emitted from it. Two things cause " +
        "this. A validator from fromJsonSchema() was assembled from rules " +
        "directly and never went through the builder chain. Otherwise the " +
        'build() ran before "@maroonedog/luq/standard-schema" was loaded — ' +
        "import it from the module that builds the validator, or from one " +
        "evaluated before it."
    );
    this.name = "DeclarationsUnavailableError";
  }
}
