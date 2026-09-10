// ===========================================================================
// The `./plugins/jsonSchema` chain method.
//
// The point of every test here is the contrast with `fromJsonSchema`: the
// FUNCTION distributes a document over declared paths and refuses a root
// keyword that has no field, while the METHOD has a field and therefore
// reaches the whole document. Both routes are exercised on the same schema so
// the difference is a measured fact rather than a claim in a comment.
// ===========================================================================
import { Builder } from "../../../../../src/index";
import {
  collectDocumentRules,
  jsonSchemaPlugin,
} from "../../../../../src/json-schema/extensions/json-schema";
import { jsonSchemaBag } from "../../../../../src/json-schema/extensions/json-schema-full-feature";
import {
  NotASchemaError,
  UnsupportedKeywordError,
  fromJsonSchema,
} from "../../../../../src/json-schema";
import { optionalPlugin } from "../../../../../src/plugins/optional";
import { DEFAULT_GLOBAL_CONFIG } from "../../../../../src/types/global-config";
import type { RuleBuildContext } from "../../../../../src/plugin-kit/rule-build-context";

function buildValidator(document: unknown) {
  return Builder()
    .use(jsonSchemaPlugin)
    .for<{ instance: unknown }>()
    .v("instance", (b) => b.any.jsonSchema(document, jsonSchemaBag))
    .build();
}

function isValid(document: unknown, instance: unknown): boolean {
  return buildValidator(document).validate({ instance }).valid;
}

const BUILD_CONTEXT: RuleBuildContext = {
  pluginName: "jsonSchema",
  code: "jsonSchema",
  severity: "error",
  config: DEFAULT_GLOBAL_CONFIG,
  fieldPath: "instance",
  declaredSiblingKeys: [],
};

describe("jsonSchemaPlugin identity", () => {
  it("names itself and its method distinctly from the full-feature bundle", () => {
    expect(jsonSchemaPlugin.name).toBe("jsonSchema");
    expect(jsonSchemaPlugin.method).toBe("jsonSchema");
  });

  it("serves every slot, because a document constrains any value", () => {
    expect([...jsonSchemaPlugin.slots].sort()).toEqual([
      "any",
      "array",
      "boolean",
      "date",
      "number",
      "object",
      "string",
      "tuple",
      "union",
    ]);
  });
});

describe("the method judges the value", () => {
  it("applies a scalar keyword", () => {
    expect(isValid({ type: "string", minLength: 3 }, "ab")).toBe(false);
    expect(isValid({ type: "string", minLength: 3 }, "abc")).toBe(true);
  });

  it("applies a nested property schema", () => {
    const document = {
      type: "object",
      properties: { name: { type: "string", minLength: 2 } },
      required: ["name"],
    };
    expect(isValid(document, { name: "jo" })).toBe(true);
    expect(isValid(document, { name: "j" })).toBe(false);
    expect(isValid(document, {})).toBe(false);
  });

  it("applies an array element schema", () => {
    const document = { type: "array", items: { type: "number" } };
    expect(isValid(document, [1, 2])).toBe(true);
    expect(isValid(document, [1, "two"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ROOT KEYWORDS, THROUGH BOTH DOORS. Each of these keywords sits on the ROOT.
// Step 25 refused them through fromJsonSchema (1.x dropped them in silence);
// the stage-27 gate made ROOT_PATH declarable, so the FUNCTION now enforces
// them too. Every row asserts the same two verdicts through the method AND
// through the function, so a regression in either route fails here.
//
// Every document below constrains an OBJECT, because `fromJsonSchema` is
// object-rooted by construction (`Validator<T extends object>`) — the scalar
// forms of the same keywords are covered under "the method judges the value".
// ---------------------------------------------------------------------------
describe("root keywords both routes now enforce", () => {
  const rootOnly: readonly [
    string,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
  ][] = [
    ["minProperties", { minProperties: 2 }, { a: 1, b: 2 }, { a: 1 }],
    ["maxProperties", { maxProperties: 1 }, { a: 1 }, { a: 1, b: 2 }],
    [
      "additionalProperties",
      { properties: { a: { type: "number" } }, additionalProperties: false },
      { a: 1 },
      { a: 1, b: 2 },
    ],
    [
      "propertyNames",
      { propertyNames: { maxLength: 2 } },
      { ab: 1 },
      { abc: 1 },
    ],
    [
      "patternProperties",
      { patternProperties: { "^s_": { type: "string" } } },
      { s_a: "x" },
      { s_a: 1 },
    ],
    [
      "anyOf",
      { anyOf: [{ minProperties: 2 }, { maxProperties: 0 }] },
      { a: 1, b: 2 },
      { a: 1 },
    ],
    [
      "oneOf",
      { oneOf: [{ minProperties: 1 }, { maxProperties: 3 }] },
      {},
      { a: 1 },
    ],
    ["not", { not: { minProperties: 1 } }, {}, { a: 1 }],
    [
      "if/then",
      { if: { minProperties: 1 }, then: { maxProperties: 1 } },
      { a: 1 },
      { a: 1, b: 2 },
    ],
    ["dependencies", { dependencies: { a: ["b"] } }, { a: 1, b: 2 }, { a: 1 }],
  ];

  it.each(rootOnly)(
    "%s: the method and the function agree",
    (_name, document, accepted, rejected) => {
      expect(isValid(document, accepted)).toBe(true);
      expect(isValid(document, rejected)).toBe(false);
      const validator = fromJsonSchema(jsonSchemaBag, document);
      expect(validator.validate(accepted).valid).toBe(true);
      expect(validator.validate(rejected).valid).toBe(false);
    }
  );
});

describe("$ref resolves against the document under test", () => {
  it("follows a local pointer into definitions", () => {
    const document = {
      definitions: { small: { type: "number", maximum: 3 } },
      properties: { n: { $ref: "#/definitions/small" } },
    };
    expect(isValid(document, { n: 2 })).toBe(true);
    expect(isValid(document, { n: 9 })).toBe(false);
  });
});

describe("build-time refusals stay build-time", () => {
  it("throws NotASchemaError for a value that is not a schema", () => {
    expect(() => buildValidator(42)).toThrow(NotASchemaError);
    expect(() =>
      collectDocumentRules(BUILD_CONTEXT, null, jsonSchemaBag)
    ).toThrow(NotASchemaError);
  });

  // `regex` used to be the example here: it threw at BUILD time because no
  // plugin existed. It is bound now, so the refusal is proved on the keyword
  // that still has no way to check its value. The branch has to stay
  // reachable — it is what stops an uncheckable value from passing silently.
  it("throws UnsupportedKeywordError for a value it cannot check", () => {
    expect(() =>
      buildValidator({ type: "string", contentEncoding: "uuencode" })
    ).toThrow(UnsupportedKeywordError);
  });

  it("now BUILDS the four formats that used to refuse to convert", () => {
    for (const format of [
      "idn-email",
      "idn-hostname",
      "uri-reference",
      "regex",
    ]) {
      expect(() => buildValidator({ type: "string", format })).not.toThrow();
    }
  });

  it("accepts an unknown format silently, as Draft-07 §7.2 requires", () => {
    expect(isValid({ type: "string", format: "not-a-real-format" }, "x")).toBe(
      true
    );
  });
});

describe("collectDocumentRules", () => {
  it("returns one rule list for the whole document", () => {
    const rules = collectDocumentRules(
      BUILD_CONTEXT,
      { type: "string", minLength: 2, maxLength: 4 },
      jsonSchemaBag
    );
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((rule) => typeof rule.kind === "string")).toBe(true);
  });

  it("forbids nothing for an empty document", () => {
    // What is checked is that nothing is forbidden, not that there are zero
    // rules. Even an empty document carries one rule stating the null policy —
    // without it presence disposes of null first and whatever the document
    // says about null never arrives — and that one rule forbids nothing. So
    // the verdict is what gets checked, rather than a count.
    const rules = collectDocumentRules(BUILD_CONTEXT, {}, jsonSchemaBag);
    expect(rules.every((rule) => rule.kind === "presence")).toBe(true);
    for (const value of [null, 0, "", false, [], {}, "x"]) {
      expect(isValid({}, value)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The document decides about null.
//
// Two things make that work. The plugin declares `judgesNull`, so null reaches
// this composite at all, and the document's own rule list carries its own null
// policy, so null reaches inside the composite too.
//
// Looking at `type` alone is not enough: `false`, `{"not":{}}` and an `enum`
// without null in it all forbid null while saying nothing about `type`.
// ---------------------------------------------------------------------------
describe("null is decided by the document", () => {
  it("rejects null on its own, with no help from the field", () => {
    expect(isValid({ type: "string" }, null)).toBe(false);
  });

  it("accepts null when the document permits it", () => {
    expect(isValid({ type: ["string", "null"] }, null)).toBe(true);
    expect(isValid({}, null)).toBe(true);
  });

  it("rejects null through a keyword that never mentions type", () => {
    expect(isValid({ not: {} }, null)).toBe(false);
    expect(isValid({ enum: [1, "a"] }, null)).toBe(false);
  });

  it("still rejects null once the field declares .optional()", () => {
    const validator = Builder()
      .use(optionalPlugin)
      .use(jsonSchemaPlugin)
      .for<{ instance: unknown }>()
      .v("instance", (b) =>
        b.any.optional().jsonSchema({ type: "string" }, jsonSchemaBag)
      )
      .build();
    expect(validator.validate({ instance: null }).valid).toBe(false);
    expect(validator.validate({ instance: "x" }).valid).toBe(true);
  });
});
