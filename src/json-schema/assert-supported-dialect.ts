// ===========================================================================
// L8  src/json-schema/assert-supported-dialect.ts — the DIALECT gate, read
// once at the document root before any keyword is.
//
// WHY A DEFAULT REFUSAL AND NOT A DIVERGENCE DETECTOR. Refusing only documents
// that actually USE something 2019-09 changed sounds more precise and is the
// worse trade. The divergences are not all spellable as keyword names: `$ref`
// gains siblings, `format` and the two `content*` keywords stop asserting by
// default, and 2020-12 moves the tuple form of `items` to `prefixItems`. A
// detector would therefore have to carry a second semantic model of two
// dialects this library does not implement, and every case it fails to think
// of is a SILENT wrong answer — which is the exact failure this file exists to
// stop. The `$ref`-sibling case was itself invisible until it was hunted for.
// `$schema` is the document's own statement of what it means, so that is what
// is read.
//
// WHAT THE DEFAULT COSTS, and why the opt-out exists. A newer `$schema` over a
// body that happens to be Draft-07-compatible builds correctly today, and
// people copy the newest `$schema` line into documents that use nothing new.
// Refusing outright would break those. `assumeDraft07` gives them a one-word
// fix that is written at the CALL SITE, in the caller's own source, where a
// reviewer reads it — so the reading is a stated decision rather than a silent
// default. There is no way to get the wrong answer without having written the
// word down.
//
// A document with NO `$schema` is untouched. That is most real documents and
// all 929 cases of the conformance corpus, and it is not a guess about the
// dialect: nothing was declared, so nothing contradicts Draft-07.
//
// THE ROOT ONLY. `externalDocuments` is a map the caller loads, and the suite's
// own map holds 37 documents across four dialects of which a given case follows
// two or three; refusing at registration would refuse documents nothing reads.
// A `$schema` deeper in a document is likewise not the document's dialect.
// ===========================================================================
import { isPlainObject } from "../types";
import { MalformedSchemaError } from "./malformed-schema-error";
import { UnsupportedDialectError } from "./unsupported-dialect-error";

/**
 * What the caller may say about the dialect. `JsonSchemaOptions` extends this,
 * so the chain method and the conversion function offer the same word.
 */
export interface DialectOptions {
  /**
   * Read the document under Draft-07 rules whatever its `$schema` declares.
   *
   * The reading it buys is Draft-07's, exactly: `$ref` replaces the node it
   * sits in, `format` asserts, and an array under `items` is the tuple form.
   * A 2019-09 or 2020-12 document that relies on any of those meaning what the
   * NEWER draft says will be enforced as less, or as something else, than it
   * states.
   */
  readonly assumeDraft07?: boolean | undefined;
}

/**
 * Comparable form of a meta-schema URI: case folded, scheme dropped, and a
 * trailing "#" or "/" removed.
 *
 * The scheme is dropped because the two families disagree about it — Draft-07
 * publishes `http://json-schema.org/draft-07/schema#` and 2020-12 publishes
 * `https://json-schema.org/draft/2020-12/schema` — and a document that writes
 * `https` for the first or `http` for the second is naming the same dialect,
 * not a different one. Matching the published string exactly would make the
 * gate depend on which of two equally common spellings a document picked.
 */
function normaliseDialectUri(uri: string): string {
  return uri
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[#/]+$/, "");
}

const DRAFT07_NORMALISED = normaliseDialectUri(
  "http://json-schema.org/draft-07/schema#"
);

/**
 * The released dialects Luq recognises the NAME of and does not implement,
 * each with what it does that Draft-07 does not. They are written out so that
 * "this is a dialect we know and did not build" and "we have never heard of
 * this URI" stay different answers — the same distinction NON_DRAFT07_KEYWORDS
 * draws between an out-of-dialect keyword and an invented one.
 */
export const NON_DRAFT07_DIALECTS: Readonly<Record<string, string>> =
  Object.freeze({
    "json-schema.org/schema":
      "the unversioned alias, which names whichever draft the site publishes " +
      "as current rather than a fixed one",
    "json-schema.org/draft-03/schema":
      "Draft-03, which spells `required` as a boolean on each property",
    "json-schema.org/draft-04/schema":
      "Draft-04, whose `exclusiveMaximum` is a boolean modifier, not a bound",
    "json-schema.org/draft-06/schema":
      "Draft-06, which has no `$comment` and reads `$ref` the Draft-07 way",
    "json-schema.org/draft/2019-09/schema":
      "2019-09, where `$ref` is an ordinary applicator and its siblings are " +
      "applied, and `format` asserts nothing unless the vocabulary asks",
    "json-schema.org/draft/2020-12/schema":
      "2020-12, where `$ref` siblings are applied, the tuple form of `items` " +
      "is spelled `prefixItems`, and `format` asserts nothing by default",
  });

const UNRECOGNISED_DIALECT =
  "a meta-schema Luq has no reading for, so what its keywords mean is unknown";

const DIALECT_VALUE_REASON = "the value must be a URI string";

/**
 * Reads the root `$schema` and refuses a dialect Luq does not implement.
 *
 * Called at both front doors, immediately after "is this a schema at all" and
 * before any keyword is read, so no validator that enforces less than its
 * document states can be reached by either route.
 *
 * A non-string `$schema` is a malformed VALUE rather than an unimplemented
 * dialect — the meta-schema types it as a string — so it goes to the class that
 * answers that question, and it is refused under the opt-out too: the opt-out
 * says "read this dialect as Draft-07", and a number names no dialect.
 */
export function assertSupportedDialect(
  document: unknown,
  options: DialectOptions
): void {
  // Read off an untyped object rather than through `Draft07SchemaObject`,
  // which types `$schema` as a string: the document is whatever JSON.parse
  // produced, and a `$schema` that is not a string is exactly what this has to
  // be able to see. The §4.4 boolean form and every non-object fall out here,
  // declaring no dialect.
  if (!isPlainObject(document)) return;
  const declared = document["$schema"];
  if (declared === undefined) return;
  if (typeof declared !== "string") {
    throw new MalformedSchemaError("$schema", DIALECT_VALUE_REASON, declared);
  }
  const normalised = normaliseDialectUri(declared);
  if (normalised === DRAFT07_NORMALISED) return;
  if (options.assumeDraft07 === true) return;
  throw new UnsupportedDialectError(
    declared,
    NON_DRAFT07_DIALECTS[normalised] ?? UNRECOGNISED_DIALECT
  );
}
