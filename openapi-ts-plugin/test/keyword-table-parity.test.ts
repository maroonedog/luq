// ===========================================================================
// openapi-ts-plugin/test/keyword-table-parity.test.ts
//
// The generator holds its own keyword table because it answers a different
// question from the library's: "what source do we emit" rather than "which
// rule does this build at run time". Two tables over the same vocabulary drift
// apart the moment one is extended and the other is not.
//
// What is pinned here is not that the two tables MATCH — the generator emits
// calls for fewer keywords than the conversion supports, and says so. It is
// the property that makes that safe: a keyword the generator cannot express
// comes back as a SkippedKeyword instead of vanishing. A validator that
// quietly checks less than the document says is the failure this suite exists
// to prevent, and it would otherwise arrive as a silently smaller table.
// ===========================================================================
import { listDraft07Keywords } from "@maroonedog/luq/schema-tooling";
import {
  BOUND_KEYWORDS,
  BOUND_FORMATS,
  STRUCTURAL_KEYWORDS,
} from "../src/generate/keyword-to-chain-call";
import { generateValidatorModule } from "../src/generate/generate-validator-module";
import type { Draft07SchemaObject } from "@maroonedog/luq/schema-tooling";

/**
 * Keywords the generator knows that Draft-07 does not have. They are OpenAPI
 * 3.0's own, and the generator meets them because an OpenAPI component schema
 * is what a caller hands it. Each is listed so that a keyword appearing here
 * by accident — a typo, or one invented in the table — is a failure.
 */
const OPENAPI_ONLY: Readonly<Record<string, string>> = {
  nullable: "OpenAPI 3.0's stand-in for a null type member",
  example: "OpenAPI 3.0's annotation; Draft-07 spells it `examples`",
  deprecated: "OpenAPI 3.0's annotation on a schema",
};

/** A one-field document carrying `keyword`, enough to see how it is treated. */
function schemaWith(keyword: string): Draft07SchemaObject {
  const VALUES: Readonly<Record<string, unknown>> = {
    items: { type: "string" },
    additionalItems: false,
    contains: { type: "string" },
    properties: { inner: { type: "string" } },
    patternProperties: { "^a": { type: "string" } },
    propertyNames: { minLength: 1 },
    dependencies: { inner: ["other"] },
    required: ["inner"],
    if: { minLength: 1 },
    then: { minLength: 2 },
    else: { minLength: 3 },
    not: { minLength: 1 },
    allOf: [{ minLength: 1 }],
    anyOf: [{ minLength: 1 }],
    oneOf: [{ minLength: 1 }],
    enum: ["a"],
    const: "a",
    type: "string",
    format: "email",
    definitions: { thing: { type: "string" } },
    $ref: "#/definitions/thing",
  };
  const value = VALUES[keyword] ?? 1;
  return {
    type: "object",
    // Carried on every probe so the `$ref` one has something to resolve to.
    definitions: { thing: { type: "string" } },
    properties: { field: { [keyword]: value } },
  };
}

describe("the generator's keyword table against the library's", () => {
  const library = new Set<string>(listDraft07Keywords());

  it("invents no keyword: everything it names is Draft-07's or OpenAPI's", () => {
    const unaccounted = [...BOUND_KEYWORDS, ...STRUCTURAL_KEYWORDS].filter(
      (keyword) => !library.has(keyword) && OPENAPI_ONLY[keyword] === undefined
    );
    // Naming them is the point: a bare "expected true" tells the next person
    // nothing about which keyword drifted.
    expect(unaccounted.sort()).toEqual([]);
  });

  it("every OpenAPI-only keyword it claims has a written reason", () => {
    for (const [keyword, reason] of Object.entries(OPENAPI_ONLY)) {
      expect(reason.length).toBeGreaterThan(0);
      expect(library.has(keyword)).toBe(false);
    }
  });

  /**
   * `$ref` is CONSUMED rather than handled: the flattening step substitutes
   * the target before the generator sees a node, so it can neither emit a call
   * for it nor report it skipped. It is the one keyword that legitimately
   * leaves no trace, and naming it here is what keeps that a decision rather
   * than a hole.
   */
  const CONSUMED_BEFORE_THE_GENERATOR = new Set(["$ref"]);

  it("accounts for every Draft-07 keyword, emitting a call or reporting it", () => {
    const vanished: string[] = [];
    for (const keyword of library) {
      if (CONSUMED_BEFORE_THE_GENERATOR.has(keyword)) continue;
      const { source, skipped } = generateValidatorModule(schemaWith(keyword), {
        validatorName: "v",
        typeExpression: "T",
      });
      const reported = skipped.some((entry) => entry.keyword === keyword);
      // `format` produces its call through the format table rather than the
      // keyword table, so a probe carrying it must be read from the source.
      const emitted =
        (BOUND_KEYWORDS.includes(keyword) || keyword === "format") &&
        /\.v\("field"[^\n]*\.\w+\(/.test(source);
      if (!reported && !emitted) vanished.push(keyword);
    }
    expect(vanished.sort()).toEqual([]);
  });

  it("binds each format exactly once", () => {
    expect(BOUND_FORMATS.length).toBeGreaterThan(0);
    expect(new Set(BOUND_FORMATS).size).toBe(BOUND_FORMATS.length);
  });
});
