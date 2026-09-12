// ===========================================================================
// L8  src/json-schema/malformed-schema-error.ts
//
// UnsupportedKeywordError refuses a keyword NAME Luq cannot honour. This
// refuses a keyword VALUE the Draft-07 meta-schema does not allow, which until
// it is refused does not fail — it quietly enforces less than the document
// says. `{"type":"strig"}` drops the unknown name, so the type check vanishes
// and the field starts accepting null; `{"pattern":{"source":"^SKU-"}}` reaches
// the regex constructor as a stringified object and compiles to one matching
// almost anything; `{"additionalProperties":"false"}` loses the closed-object
// guarantee; `{"required":"name"}` builds and then throws a raw TypeError
// inside validate() on the first request. A validator that silently drops a
// constraint is worse than one that refuses the schema, so the refusal is a
// typed error carrying the keyword, what the meta-schema requires, and a
// rendering of what was found instead.
//
// The two refusals stay separate classes, neither extending the other, because
// they answer different questions: "Luq cannot honour this keyword" versus
// "this document is not valid Draft-07". The first is a limit of the library
// and the second is a bug in the document; a caller catching one must not
// silently catch the other.
// ===========================================================================

/**
 * The two shapes §4.4 lets a schema take, worded once. Several keywords take a
 * schema as their value — `properties` members, `additionalProperties`, every
 * position of the tuple form of `items` — and each is read by a different
 * module; sharing the phrase is what stops the same refusal being explained
 * three different ways to the same caller.
 *
 * It is a fragment, so it composes: "the value ", `the schema under "a" `.
 */
export const SCHEMA_FORMS = "must be an object or a boolean";

/**
 * How much of the offending value a message may carry. A schema node is
 * arbitrarily large, and an error whose message is a megabyte long is unusable
 * in a log line.
 */
const RECEIVED_MAX_LENGTH = 80;

const TRUNCATION_MARKER = "...";

/**
 * Renders an untrusted schema value for a message, in at most
 * RECEIVED_MAX_LENGTH characters. The value comes from the same document that
 * is already known to be malformed, so nothing about it can be assumed: it may
 * be circular, hold a bigint, or be large enough to drown the message.
 * Rendering must never be the thing that throws.
 */
export function renderReceivedValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "function") return "[function]";
  if (typeof value === "symbol") return "[symbol]";
  return truncate(renderJson(value));
}

/**
 * JSON.stringify throws on a circular reference and on a bigint anywhere in
 * the value, and returns undefined for a value it has no encoding for at all.
 * Both outcomes become a description of the shape rather than a failure.
 */
function renderJson(value: unknown): string {
  try {
    const rendered = JSON.stringify(value);
    return rendered === undefined ? describeUnrenderable(value) : rendered;
  } catch {
    return describeUnrenderable(value);
  }
}

function describeUnrenderable(value: unknown): string {
  return Array.isArray(value)
    ? "[unrenderable array]"
    : `[unrenderable ${typeof value}]`;
}

function truncate(rendered: string): string {
  if (rendered.length <= RECEIVED_MAX_LENGTH) return rendered;
  const kept = RECEIVED_MAX_LENGTH - TRUNCATION_MARKER.length;
  return `${rendered.slice(0, kept)}${TRUNCATION_MARKER}`;
}

/**
 * Raised when a keyword's value violates the Draft-07 meta-schema. Thrown at
 * build time, before a validator that would enforce less than the document
 * states can exist.
 */
export class MalformedSchemaError extends Error {
  /** The keyword whose value is malformed, for instance "type". */
  readonly keyword: string;

  /**
   * What the meta-schema REQUIRES, written as a sentence fragment with no
   * terminal punctuation — the message supplies it. Every keyword phrases it
   * the same way, "<the thing> must be <the shape>", so that a caller reading
   * two refusals from two different keywords reads one library rather than
   * three; what was found instead is carried separately, in `received`.
   */
  readonly reason: string;

  /** The offending value, rendered short and safe by renderReceivedValue. */
  readonly received: string;

  constructor(keyword: string, reason: string, value: unknown) {
    const received = renderReceivedValue(value);
    super(
      `JSON Schema keyword "${keyword}" has a value the Draft-07 meta-schema ` +
        `does not allow: ${reason}. Received: ${received}.`
    );
    this.name = "MalformedSchemaError";
    this.keyword = keyword;
    this.reason = reason;
    this.received = received;
    // Without this, `instanceof` fails when the package is compiled to ES5.
    Object.setPrototypeOf(this, MalformedSchemaError.prototype);
  }
}
