// ===========================================================================
// L8  src/json-schema/unsupported-dialect-error.ts
//
// The third refusal, and the only one with no keyword to hang on.
// UnsupportedKeywordError refuses a keyword NAME; MalformedSchemaError refuses
// a keyword VALUE. Both need the document to write something recognisable, and
// there is one divergence that writes nothing at all:
//
//     {"$schema": "https://json-schema.org/draft/2020-12/schema",
//      "$defs": {"name": {"type": "string"}},
//      "properties": {"nick": {"$ref": "#/$defs/name", "minLength": 5}}}
//
// Every keyword there is a Draft-07 keyword spelled the Draft-07 way, so the
// keyword table sees nothing to refuse. The meaning is not Draft-07: §8.3 has
// `$ref` REPLACE the object it appears in, and from 2019-09 on `$ref` is an
// ordinary applicator whose siblings are applied. Read as Draft-07 the document
// above builds a validator that accepts `{"nick":"ab"}` — the `minLength` is
// gone, silently, and nothing in the result says a constraint went missing.
// `$schema` is the only signal the document offers, so it is the one read.
//
// It stays a separate class from the other two, neither extending the other,
// for the reason written in malformed-schema-error.ts: each answers a different
// question. "Luq cannot honour this keyword", "this document is not valid
// Draft-07", and now "this document is not Draft-07 AT ALL" are three distinct
// facts, and a caller catching one must not silently catch another.
// ===========================================================================

/** The dialect this library implements, in the spelling the draft publishes. */
export const DRAFT07_DIALECT_URI = "http://json-schema.org/draft-07/schema#";

/**
 * Raised when a document's root `$schema` names a dialect Luq does not
 * implement. Thrown at build time, before a validator that would read the
 * document under the wrong dialect's rules can exist.
 *
 * `reason` follows the convention the other two refusals use: a sentence
 * fragment with no terminal punctuation, saying what the dialect does that
 * Draft-07 does not, so that two refusals from two different dialects read as
 * one library rather than as two unrelated messages.
 */
export class UnsupportedDialectError extends Error {
  /** The `$schema` value the document wrote, verbatim. */
  readonly declared: string;

  /** The dialect Luq reads every document under. */
  readonly implemented: string = DRAFT07_DIALECT_URI;

  /** What that dialect does differently, or that it is unrecognised. */
  readonly reason: string;

  constructor(declared: string, reason: string) {
    super(
      `JSON Schema dialect "${declared}" is not supported: ${reason}. Luq ` +
        `implements Draft-07 (${DRAFT07_DIALECT_URI}) and would read this ` +
        "document under Draft-07 rules, which can enforce less than it " +
        "states. Convert the document to Draft-07, or pass " +
        "`{ assumeDraft07: true }` to take the Draft-07 reading deliberately."
    );
    this.name = "UnsupportedDialectError";
    this.declared = declared;
    this.reason = reason;
    // Without this, `instanceof` fails when the package is compiled to ES5.
    Object.setPrototypeOf(this, UnsupportedDialectError.prototype);
  }
}
