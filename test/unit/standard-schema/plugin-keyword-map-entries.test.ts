// ===========================================================================
// What every entry of the keyword table actually emits.
//
// The sibling suite checks that each KEY names a real plugin. Nothing checked
// what the VALUES produce, and it showed: of the table's entries, most were
// never once called by a test. A format name typed as "datetime" instead of
// "date-time", or minItems written where maxItems was meant, would have
// travelled into other people's schemas unremarked.
//
// Two things are pinned here that a per-case test cannot pin on its own.
//
// Completeness: the expectations below are compared against the table's own
// keys, so an entry added without an expectation fails this suite. Coverage
// that has to be maintained by hand stops being maintained.
//
// Agreement with the reader: every `format` this table writes is checked
// against the vocabulary the conversion direction accepts. A writer emitting a
// name the reader would reject means one document meaning two things.
// ===========================================================================
import { PLUGIN_KEYWORDS } from "../../../src/standard-schema/plugin-keyword-map";
import { listFormatNames } from "../../../src/json-schema/format-map";

/**
 * One row per table entry: the arguments a chain call would carry, and the
 * fragment that must come back.
 *
 * `null` is the table's way of saying "this declaration adds no keyword",
 * which is true of presence and of the calls that feed the type decision.
 */
const EXPECTED: Readonly<
  Record<string, { args: readonly unknown[]; keywords: unknown }>
> = {
  // strings
  stringMin: { args: [3], keywords: { minLength: 3 } },
  stringMax: { args: [9], keywords: { maxLength: 9 } },
  stringExactLength: { args: [4], keywords: { minLength: 4, maxLength: 4 } },
  stringPattern: { args: [/^a.c$/], keywords: { pattern: "^a.c$" } },
  stringContentEncoding: {
    args: ["base64"],
    keywords: { contentEncoding: "base64" },
  },
  stringContentMediaType: {
    args: ["application/json"],
    keywords: { contentMediaType: "application/json" },
  },

  // formats
  stringDatetime: { args: [], keywords: { format: "date-time" } },
  stringDate: { args: [], keywords: { format: "date" } },
  stringTime: { args: [], keywords: { format: "time" } },
  stringDuration: { args: [], keywords: { format: "duration" } },
  stringEmail: { args: [], keywords: { format: "email" } },
  stringIdnEmail: { args: [], keywords: { format: "idn-email" } },
  stringHostname: { args: [], keywords: { format: "hostname" } },
  stringIdnHostname: { args: [], keywords: { format: "idn-hostname" } },
  stringIpv4: { args: [], keywords: { format: "ipv4" } },
  stringIpv6: { args: [], keywords: { format: "ipv6" } },
  // `url` is not a registered format name; the writer picks the registered one.
  stringUrl: { args: [], keywords: { format: "uri" } },
  stringUriReference: { args: [], keywords: { format: "uri-reference" } },
  stringIri: { args: [], keywords: { format: "iri" } },
  stringIriReference: { args: [], keywords: { format: "iri-reference" } },
  stringUriTemplate: { args: [], keywords: { format: "uri-template" } },
  stringJsonPointer: { args: [], keywords: { format: "json-pointer" } },
  stringRelativeJsonPointer: {
    args: [],
    keywords: { format: "relative-json-pointer" },
  },
  stringRegex: { args: [], keywords: { format: "regex" } },
  uuid: { args: [], keywords: { format: "uuid" } },

  // numbers
  numberMin: { args: [5], keywords: { minimum: 5 } },
  numberMax: { args: [5], keywords: { maximum: 5 } },
  numberMultipleOf: { args: [3], keywords: { multipleOf: 3 } },
  numberRange: { args: [1, 9], keywords: { minimum: 1, maximum: 9 } },
  numberPositive: { args: [], keywords: { exclusiveMinimum: 0 } },
  numberNegative: { args: [], keywords: { exclusiveMaximum: 0 } },

  // arrays
  arrayMinLength: { args: [2], keywords: { minItems: 2 } },
  arrayMaxLength: { args: [7], keywords: { maxItems: 7 } },
  arrayUnique: { args: [], keywords: { uniqueItems: true } },

  // values
  literal: { args: ["fixed"], keywords: { const: "fixed" } },
  oneOf: { args: [["a", "b"]], keywords: { enum: ["a", "b"] } },

  // settled by type or presence
  numberInteger: { args: [], keywords: null },
  required: { args: [], keywords: null },
  optional: { args: [], keywords: null },
  nullable: { args: [], keywords: null },
  skip: { args: [], keywords: null },
};

describe("every entry of the keyword table", () => {
  it("has an expectation, and expects nothing the table does not have", () => {
    // Without this the suite below silently stops covering an entry the day
    // someone adds one, which is how the table got here in the first place.
    expect(Object.keys(EXPECTED).sort()).toEqual(
      Object.keys(PLUGIN_KEYWORDS).sort()
    );
  });

  it.each(Object.entries(EXPECTED))(
    "%s emits what it claims",
    (name, { args, keywords }) => {
      expect(PLUGIN_KEYWORDS[name]?.(args)).toEqual(keywords);
    }
  );
});

describe("agreement with the reading direction", () => {
  it("writes only format names the conversion accepts", () => {
    const readable = new Set<string>(listFormatNames());
    const written = Object.entries(EXPECTED)
      .map(([name, { args }]) => {
        const emitted = PLUGIN_KEYWORDS[name]?.(args);
        const format = (emitted as { format?: unknown } | null)?.format;
        return typeof format === "string" ? { name, format } : undefined;
      })
      .filter(
        (entry): entry is { name: string; format: string } =>
          entry !== undefined
      );

    // A guard on the guard: if this found nothing, the assertion below would
    // pass while checking no format at all.
    expect(written.length).toBeGreaterThan(15);

    const unreadable = written.filter((entry) => !readable.has(entry.format));
    expect(unreadable).toEqual([]);
  });
});

describe("a declaration the table cannot express", () => {
  it("does not silently narrow a flagged pattern", () => {
    // Draft-07's `pattern` is an ECMA-262 SOURCE string; flags cannot be
    // spelled there. Emitting the source alone changes what the schema means
    // — `/^a.c$/i` accepts "ABC" and `{"pattern":"^a.c$"}` does not — so this
    // is unwritable rather than something to narrow quietly.
    expect(PLUGIN_KEYWORDS["stringPattern"]?.([/^a.c$/i])).toBeUndefined();
    expect(PLUGIN_KEYWORDS["stringPattern"]?.([/^a$/m])).toBeUndefined();
  });

  it("does not silently drop a pattern given as a string", () => {
    // `null` means "adds no keyword and that is correct", which is true of
    // presence. A constraint that cannot be expressed is a different answer,
    // and answering `null` here would drop it with no trace.
    expect(PLUGIN_KEYWORDS["stringPattern"]?.(["^a$"])).toBeUndefined();
  });

  it("does not silently drop a oneOf whose argument is not a list", () => {
    expect(PLUGIN_KEYWORDS["oneOf"]?.(["a"])).toBeUndefined();
  });
});
