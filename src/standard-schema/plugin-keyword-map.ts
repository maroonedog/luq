// ===========================================================================
// L10 src/standard-schema/plugin-keyword-map.ts
//
// "This plugin, called with these arguments, means this JSON Schema keyword."
// The reading direction of keyword-map-*.ts, reusing the correspondence those
// files already settled rather than inventing a second one.
//
// Plugin names are written as STRINGS. Importing the plugins themselves would
// drag every one of them into the bundle of anyone who emits a schema, which
// does not fit "you only ship what you used". A test cross-checks each string
// against the real `plugin.name`, so the names cannot drift without the cost.
//
// A plugin that is not listed here cannot be written out. A plugin the user
// wrote themselves is never listed, so it never can. That is a consequence of
// the design rather than an oversight, and it surfaces as
// UnrepresentableRuleError instead of being hidden.
// ===========================================================================

/** A keyword fragment made from the arguments; null means type or presence handles it. */
export type ToKeywords = (
  args: readonly unknown[]
) => Record<string, unknown> | null;

const numberAt = (args: readonly unknown[], index: number): number =>
  typeof args[index] === "number" ? args[index] : Number.NaN;

/**
 * A second argument makes `.min(n)` exclusive. The same boundary the
 * reading direction draws when it maps `exclusiveMinimum`.
 */
const boundOf =
  (inclusive: string, exclusive: string): ToKeywords =>
  (args) => ({
    [args[1] === true ? exclusive : inclusive]: numberAt(args, 0),
  });

/** A format with no arguments: the name is the `format` value verbatim. */
const format =
  (name: string): ToKeywords =>
  () => ({ format: name });

export const PLUGIN_KEYWORDS: Readonly<Record<string, ToKeywords>> =
  Object.freeze({
    // --- strings ----------------------------------------------------------
    stringMin: (args) => ({ minLength: numberAt(args, 0) }),
    stringMax: (args) => ({ maxLength: numberAt(args, 0) }),
    stringExactLength: (args) => ({
      minLength: numberAt(args, 0),
      maxLength: numberAt(args, 0),
    }),
    // Draft-07's `pattern` is an ECMA-262 SOURCE string. Flags cannot be
    // spelled there, and dropping them changes the meaning, so a flagged
    // RegExp counts as unwritable rather than being silently narrowed.
    stringPattern: (args) =>
      args[0] instanceof RegExp ? { pattern: args[0].source } : null,
    stringContentEncoding: (args) => ({ contentEncoding: args[0] }),
    stringContentMediaType: (args) => ({ contentMediaType: args[0] }),

    // --- formats (names taken verbatim from the format map) ---------------
    stringDatetime: format("date-time"),
    stringDate: format("date"),
    stringTime: format("time"),
    stringDuration: format("duration"),
    stringEmail: format("email"),
    stringIdnEmail: format("idn-email"),
    stringHostname: format("hostname"),
    stringIdnHostname: format("idn-hostname"),
    stringIpv4: format("ipv4"),
    stringIpv6: format("ipv6"),
    // `url` is not a registered JSON Schema format name. Both spellings map
    // to this plugin on the reading side, but a writer has to pick one, so it
    // picks the registered `uri`.
    stringUrl: format("uri"),
    stringUriReference: format("uri-reference"),
    stringIri: format("iri"),
    stringIriReference: format("iri-reference"),
    stringUriTemplate: format("uri-template"),
    stringJsonPointer: format("json-pointer"),
    stringRelativeJsonPointer: format("relative-json-pointer"),
    stringRegex: format("regex"),
    uuid: format("uuid"),

    // --- numbers ----------------------------------------------------------
    numberMin: boundOf("minimum", "exclusiveMinimum"),
    numberMax: boundOf("maximum", "exclusiveMaximum"),
    numberMultipleOf: (args) => ({ multipleOf: numberAt(args, 0) }),
    numberRange: (args) => ({
      minimum: numberAt(args, 0),
      maximum: numberAt(args, 1),
    }),
    numberPositive: () => ({ exclusiveMinimum: 0 }),
    numberNegative: () => ({ exclusiveMaximum: 0 }),

    // --- arrays -----------------------------------------------------------
    arrayMinLength: (args) => ({ minItems: numberAt(args, 0) }),
    arrayMaxLength: (args) => ({ maxItems: numberAt(args, 0) }),
    arrayUnique: () => ({ uniqueItems: true }),

    // --- values -----------------------------------------------------------
    literal: (args) => ({ const: args[0] }),
    oneOf: (args) => (Array.isArray(args[0]) ? { enum: args[0] } : null),

    // --- handled by type or presence, adding no keyword -------------------
    // numberInteger becomes `type: "integer"`, so it feeds the type decision.
    numberInteger: () => null,
    required: () => null,
    optional: () => null,
    nullable: () => null,
    // Changes the order things run in, not the set of accepted values.
    skip: () => null,
  });
