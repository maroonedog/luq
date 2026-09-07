// GENERATED FILE — do not edit by hand.
// Written by: npm run generate-plugin-data (docs-site/scripts/generate-plugin-data.mjs)
//
// Subpath, symbol, chain method, slots and tier are read from
// docs/guide/plugin-reference.md (itself generated from the built package and
// gated by `npm run check:docs`), cross-checked against
// config/plugin-catalog.lock.json. The declared argument tuple is read off the
// plugin's own source. Descriptions and examples come from
// docs-site/scripts/plugin-copy.mjs, and every example in this file is
// typechecked against src/ by docs-site/scripts/verify-plugin-examples.mjs.

export interface PluginParameter {
  readonly name: string;
  readonly type: string;
  readonly optional: boolean;
}

export interface PluginExample {
  /** Lines of the example TypeScript type, verbatim. */
  readonly declarations: readonly string[];
  /** The path passed to `.v()`. */
  readonly field: string;
  /** Other plugin symbols the chain calls a method of. */
  readonly uses: readonly string[];
  /** Everything after `b.` inside `.v()`. */
  readonly chain: string;
  /** Import lines the chain needs beyond the plugin itself. */
  readonly imports: readonly string[];
  /** Top-level declarations the chain needs. */
  readonly prelude: readonly string[];
}

export interface PluginInfo {
  /** camelCase subpath name, e.g. "stringMin". */
  readonly name: string;
  /** Exported symbol, e.g. "stringMinPlugin". */
  readonly symbol: string;
  /** Full import specifier. */
  readonly subpath: string;
  /** Chain method the plugin adds, without parentheses. */
  readonly method: string;
  /** Field types the method may be called on. */
  readonly slots: readonly string[];
  readonly tier: "isolated" | "extension";
  readonly parameters: readonly PluginParameter[];
  readonly description: string;
  readonly example: PluginExample;
}

/** Every field type a plugin may be offered on. */
export const PLUGIN_SLOTS = ["string","number","boolean","date","array","tuple","object","union","any"] as const;

/** 77 plugin objects across 76 subpaths. */
export const plugins: readonly PluginInfo[] = [
  {
    "name": "arrayContains",
    "symbol": "arrayContainsPlugin",
    "subpath": "@maroonedog/luq/plugins/arrayContains",
    "method": "contains",
    "slots": [
      "array",
      "tuple"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "element",
        "type": "ElementChain",
        "optional": false
      },
      {
        "name": "bounds",
        "type": "ArrayContainsBounds",
        "optional": true
      }
    ],
    "description": "At least one element satisfies the given element chain. Draft-07 `contains`, with optional `min` / `max` bounds for `minContains` / `maxContains`.",
    "example": {
      "declarations": [
        "tags: string[];"
      ],
      "field": "tags",
      "uses": [
        "requiredPlugin",
        "stringMinPlugin"
      ],
      "chain": "array.required().contains((eb) => eb.string.min(2), { min: 1 })",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "arrayEach",
    "symbol": "arrayEachPlugin",
    "subpath": "@maroonedog/luq/plugins/arrayEach",
    "method": "each",
    "slots": [
      "array",
      "tuple"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "element",
        "type": "ElementChain",
        "optional": false
      }
    ],
    "description": "Applies one element chain to every element. It reports a single issue for the array; declare `items[*]` with `.v()` when you want one issue per element.",
    "example": {
      "declarations": [
        "labels: string[];"
      ],
      "field": "labels",
      "uses": [
        "requiredPlugin",
        "stringMinPlugin"
      ],
      "chain": "array.required().each((eb) => eb.string.min(1))",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "arrayIncludes",
    "symbol": "arrayIncludesPlugin",
    "subpath": "@maroonedog/luq/plugins/arrayIncludes",
    "method": "includes",
    "slots": [
      "array",
      "tuple"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "element",
        "type": "unknown",
        "optional": false
      }
    ],
    "description": "The array contains the given value. Membership is structural, so a value that came out of `JSON.parse` still matches.",
    "example": {
      "declarations": [
        "roles: string[];"
      ],
      "field": "roles",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "array.required().includes(\"admin\")",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "arrayMaxLength",
    "symbol": "arrayMaxLengthPlugin",
    "subpath": "@maroonedog/luq/plugins/arrayMaxLength",
    "method": "maxLength",
    "slots": [
      "array",
      "tuple"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "max",
        "type": "number",
        "optional": false
      }
    ],
    "description": "At most N elements. Draft-07 `maxItems`.",
    "example": {
      "declarations": [
        "photos: string[];"
      ],
      "field": "photos",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "array.required().maxLength(10)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "arrayMinLength",
    "symbol": "arrayMinLengthPlugin",
    "subpath": "@maroonedog/luq/plugins/arrayMinLength",
    "method": "minLength",
    "slots": [
      "array",
      "tuple"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "min",
        "type": "number",
        "optional": false
      }
    ],
    "description": "At least N elements. Draft-07 `minItems`.",
    "example": {
      "declarations": [
        "attachments: string[];"
      ],
      "field": "attachments",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "array.required().minLength(1)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "arrayUnique",
    "symbol": "arrayUniquePlugin",
    "subpath": "@maroonedog/luq/plugins/arrayUnique",
    "method": "unique",
    "slots": [
      "array",
      "tuple"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "No two elements are equal. Equality is structural, so the same object shape twice is a duplicate. Draft-07 `uniqueItems`.",
    "example": {
      "declarations": [
        "skus: string[];"
      ],
      "field": "skus",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "array.required().unique()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "booleanFalsy",
    "symbol": "booleanFalsyPlugin",
    "subpath": "@maroonedog/luq/plugins/booleanFalsy",
    "method": "falsy",
    "slots": [
      "boolean"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "The value must be `false`.",
    "example": {
      "declarations": [
        "archived: boolean;"
      ],
      "field": "archived",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "boolean.required().falsy()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "booleanTruthy",
    "symbol": "booleanTruthyPlugin",
    "subpath": "@maroonedog/luq/plugins/booleanTruthy",
    "method": "truthy",
    "slots": [
      "boolean"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "The value must be `true` — the accept-the-terms checkbox rule.",
    "example": {
      "declarations": [
        "acceptedTerms: boolean;"
      ],
      "field": "acceptedTerms",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "boolean.required().truthy()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "compareField",
    "symbol": "compareFieldPlugin",
    "subpath": "@maroonedog/luq/plugins/compareField",
    "method": "compareField",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "object",
      "array",
      "tuple",
      "union"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "other",
        "type": "FieldRef",
        "optional": false
      },
      {
        "name": "compare",
        "type": "CompareFieldValues",
        "optional": true
      }
    ],
    "description": "Compares this field with another declared path. Equality by default; pass a comparison function for anything else. The path is checked against your type at compile time.",
    "example": {
      "declarations": [
        "password: string;",
        "passwordConfirm: string;"
      ],
      "field": "passwordConfirm",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().compareField(\"password\")",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "conditionalSchema",
    "symbol": "conditionalSchemaPlugin",
    "subpath": "@maroonedog/luq/plugins/conditionalSchema",
    "method": "conditionalSchema",
    "slots": [
      "object",
      "array",
      "string",
      "number",
      "boolean"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "condition",
        "type": "NarrowedChain",
        "optional": false
      },
      {
        "name": "then",
        "type": "NarrowedChain",
        "optional": true
      },
      {
        "name": "otherwise",
        "type": "NarrowedChain",
        "optional": true
      }
    ],
    "description": "Draft-07 `if` / `then` / `else` as one three-branch rule: when the condition chain passes, `then` applies, otherwise `else` does. Both branches are optional.",
    "example": {
      "declarations": [
        "shipping: { method: string };"
      ],
      "field": "shipping",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().conditionalSchema((cb) => cb.object.required(), (tb) => tb.object.required())",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "custom",
    "symbol": "customPlugin",
    "subpath": "@maroonedog/luq/plugins/custom",
    "method": "custom",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "validate",
        "type": "SelfReader<CustomOutcome>",
        "optional": false
      }
    ],
    "description": "An arbitrary predicate over the field's value. It runs exactly once and may return `{ valid, message }` to supply its own message.",
    "example": {
      "declarations": [
        "sku: string;"
      ],
      "field": "sku",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().custom((value) => value.startsWith(\"SKU-\"))",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "fromContext",
    "symbol": "fromContextPlugin",
    "subpath": "@maroonedog/luq/plugins/fromContext",
    "method": "fromContext",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "object",
      "array",
      "tuple",
      "union"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "options",
        "type": "FromContextOptions",
        "optional": false
      }
    ],
    "description": "Checks the field against the external context handed to `validate(value, { external })` — the read side of the async story. The plugin itself knows nothing about async.",
    "example": {
      "declarations": [
        "tenantId: string;"
      ],
      "field": "tenantId",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().fromContext({ check: (value, context) => ({ valid: value === context.tenantId }) })",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "jsonSchema",
    "symbol": "jsonSchemaPlugin",
    "subpath": "@maroonedog/luq/plugins/jsonSchema",
    "method": "jsonSchema",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "extension",
    "parameters": [
      {
        "name": "document",
        "type": "unknown",
        "optional": false
      },
      {
        "name": "bag",
        "type": "JsonSchemaBag",
        "optional": false
      }
    ],
    "description": "Constrains one declared field by a JSON Schema document, and takes the plugin bag explicitly. It reaches root-level keywords `fromJsonSchema` cannot, such as `propertyNames` and `if` / `then` / `else` on the document root.",
    "example": {
      "declarations": [
        "payload: Record<string, unknown>;"
      ],
      "field": "payload",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().jsonSchema(PAYLOAD_SCHEMA, jsonSchemaBag)",
      "imports": [
        "import { jsonSchemaBag } from \"@maroonedog/luq/plugins/jsonSchemaFullFeature\";"
      ],
      "prelude": [
        "const PAYLOAD_SCHEMA = {",
        "  type: \"object\",",
        "  properties: { kind: { type: \"string\", minLength: 1 } },",
        "  required: [\"kind\"],",
        "};"
      ]
    }
  },
  {
    "name": "jsonSchemaFullFeature",
    "symbol": "jsonSchemaFullFeaturePlugin",
    "subpath": "@maroonedog/luq/plugins/jsonSchemaFullFeature",
    "method": "jsonSchemaFullFeature",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "extension",
    "parameters": [
      {
        "name": "document",
        "type": "unknown",
        "optional": false
      }
    ],
    "description": "One import that covers a whole Draft-07 document. The same subpath exports `fromJsonSchema<T>(schema)`, which builds a validator with no builder chain at all.",
    "example": {
      "declarations": [
        "profile: { email: string };"
      ],
      "field": "profile",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().jsonSchemaFullFeature(PROFILE_SCHEMA)",
      "imports": [],
      "prelude": [
        "const PROFILE_SCHEMA = {",
        "  type: \"object\",",
        "  properties: { email: { type: \"string\", format: \"email\" } },",
        "  required: [\"email\"],",
        "};"
      ]
    }
  },
  {
    "name": "literal",
    "symbol": "literalPlugin",
    "subpath": "@maroonedog/luq/plugins/literal",
    "method": "literal",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "expected",
        "type": "unknown",
        "optional": false
      }
    ],
    "description": "Equality against one constant. Comparison is structural, so it matches values that came out of `JSON.parse`. Draft-07 `const`.",
    "example": {
      "declarations": [
        "kind: \"person\";"
      ],
      "field": "kind",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().literal(\"person\")",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "nullable",
    "symbol": "nullablePlugin",
    "subpath": "@maroonedog/luq/plugins/nullable",
    "method": "nullable",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "`null` is an accepted value for this field.",
    "example": {
      "declarations": [
        "deletedAt: string | null;"
      ],
      "field": "deletedAt",
      "uses": [],
      "chain": "string.nullable()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "numberFinite",
    "symbol": "numberFinitePlugin",
    "subpath": "@maroonedog/luq/plugins/numberFinite",
    "method": "finite",
    "slots": [
      "number"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "Rejects `NaN`, `Infinity` and `-Infinity`.",
    "example": {
      "declarations": [
        "ratio: number;"
      ],
      "field": "ratio",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().finite()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "numberInteger",
    "symbol": "numberIntegerPlugin",
    "subpath": "@maroonedog/luq/plugins/numberInteger",
    "method": "integer",
    "slots": [
      "number"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "The value has no fractional part. Draft-07 `integer`.",
    "example": {
      "declarations": [
        "quantity: number;"
      ],
      "field": "quantity",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().integer()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "numberMax",
    "symbol": "numberMaxPlugin",
    "subpath": "@maroonedog/luq/plugins/numberMax",
    "method": "max",
    "slots": [
      "number"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "max",
        "type": "number",
        "optional": false
      },
      {
        "name": "exclusive",
        "type": "boolean",
        "optional": true
      }
    ],
    "description": "Upper bound. Pass `true` as the second argument for an exclusive bound. Draft-07 `maximum` / `exclusiveMaximum`.",
    "example": {
      "declarations": [
        "score: number;"
      ],
      "field": "score",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().max(100)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "numberMin",
    "symbol": "numberMinPlugin",
    "subpath": "@maroonedog/luq/plugins/numberMin",
    "method": "min",
    "slots": [
      "number"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "min",
        "type": "number",
        "optional": false
      },
      {
        "name": "exclusive",
        "type": "boolean",
        "optional": true
      }
    ],
    "description": "Lower bound. Pass `true` as the second argument for an exclusive bound. Draft-07 `minimum` / `exclusiveMinimum`.",
    "example": {
      "declarations": [
        "age: number;"
      ],
      "field": "age",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().min(18)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "numberMultipleOf",
    "symbol": "numberMultipleOfPlugin",
    "subpath": "@maroonedog/luq/plugins/numberMultipleOf",
    "method": "multipleOf",
    "slots": [
      "number"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "divisor",
        "type": "number",
        "optional": false
      }
    ],
    "description": "The value is an exact multiple of the divisor. Draft-07 `multipleOf`.",
    "example": {
      "declarations": [
        "cents: number;"
      ],
      "field": "cents",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().multipleOf(5)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "numberNegative",
    "symbol": "numberNegativePlugin",
    "subpath": "@maroonedog/luq/plugins/numberNegative",
    "method": "negative",
    "slots": [
      "number"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "Strictly less than zero.",
    "example": {
      "declarations": [
        "adjustment: number;"
      ],
      "field": "adjustment",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().negative()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "numberPositive",
    "symbol": "numberPositivePlugin",
    "subpath": "@maroonedog/luq/plugins/numberPositive",
    "method": "positive",
    "slots": [
      "number"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "Strictly greater than zero.",
    "example": {
      "declarations": [
        "price: number;"
      ],
      "field": "price",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().positive()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "numberRange",
    "symbol": "numberRangePlugin",
    "subpath": "@maroonedog/luq/plugins/numberRange",
    "method": "range",
    "slots": [
      "number"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "min",
        "type": "number",
        "optional": false
      },
      {
        "name": "max",
        "type": "number",
        "optional": false
      }
    ],
    "description": "Both bounds at once, inclusive.",
    "example": {
      "declarations": [
        "rating: number;"
      ],
      "field": "rating",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().range(1, 5)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "object",
    "symbol": "objectPlugin",
    "subpath": "@maroonedog/luq/plugins/object",
    "method": "object",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "Declares the field as an object slot, so the object rules can be chained onto it.",
    "example": {
      "declarations": [
        "settings: { theme: string };"
      ],
      "field": "settings",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().object()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectAdditionalProperties",
    "symbol": "objectAdditionalPropertiesPlugin",
    "subpath": "@maroonedog/luq/plugins/objectAdditionalProperties",
    "method": "additionalProperties",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "allowed",
        "type": "boolean",
        "optional": false
      },
      {
        "name": "allowedProperties",
        "type": "readonly string[]",
        "optional": true
      }
    ],
    "description": "Draft-07's boolean `additionalProperties`. `false` forbids any key the schema did not declare; the optional second argument is a plain allow-list of extra key names.",
    "example": {
      "declarations": [
        "headers: Record<string, string>;"
      ],
      "field": "headers",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().additionalProperties(false, [\"traceId\"])",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectAdditionalProperties",
    "symbol": "objectAdditionalPropertiesSchemaPlugin",
    "subpath": "@maroonedog/luq/plugins/objectAdditionalProperties",
    "method": "additionalPropertiesSchema",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "schema",
        "type": "PropertyValueChain",
        "optional": false
      },
      {
        "name": "allowedProperties",
        "type": "readonly string[]",
        "optional": true
      }
    ],
    "description": "Draft-07's schema form of `additionalProperties`: every undeclared key's value must satisfy the sub-chain. Passing `false` forbids undeclared keys outright.",
    "example": {
      "declarations": [
        "attributes: Record<string, string>;"
      ],
      "field": "attributes",
      "uses": [
        "requiredPlugin",
        "stringMinPlugin"
      ],
      "chain": "object.required().additionalPropertiesSchema((pb) => pb.string.required().min(1))",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectDependentRequired",
    "symbol": "objectDependentRequiredPlugin",
    "subpath": "@maroonedog/luq/plugins/objectDependentRequired",
    "method": "dependentRequired",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "dependencies",
        "type": "Readonly<Record<string, readonly string[]>>",
        "optional": false
      }
    ],
    "description": "When a trigger key is present, the keys it lists must be present too. Draft-07 `dependentRequired`.",
    "example": {
      "declarations": [
        "payment: { card?: string; holder?: string; cvc?: string };"
      ],
      "field": "payment",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().dependentRequired({ card: [\"holder\", \"cvc\"] })",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectDependentSchemas",
    "symbol": "objectDependentSchemasPlugin",
    "subpath": "@maroonedog/luq/plugins/objectDependentSchemas",
    "method": "dependentSchemas",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "schemas",
        "type": "Readonly<Record<string, NarrowedChain>>",
        "optional": false
      }
    ],
    "description": "When a trigger key is present, the whole object must also satisfy that key's sub-chain. Draft-07 `dependentSchemas`.",
    "example": {
      "declarations": [
        "billing: { card?: string };"
      ],
      "field": "billing",
      "uses": [
        "requiredPlugin",
        "objectMinPropertiesPlugin"
      ],
      "chain": "object.required().dependentSchemas({ card: (sb) => sb.object.required().minProperties(2) })",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectMaxProperties",
    "symbol": "objectMaxPropertiesPlugin",
    "subpath": "@maroonedog/luq/plugins/objectMaxProperties",
    "method": "maxProperties",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "max",
        "type": "number",
        "optional": false
      }
    ],
    "description": "At most N own keys. Draft-07 `maxProperties`.",
    "example": {
      "declarations": [
        "annotations: Record<string, string>;"
      ],
      "field": "annotations",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().maxProperties(16)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectMinProperties",
    "symbol": "objectMinPropertiesPlugin",
    "subpath": "@maroonedog/luq/plugins/objectMinProperties",
    "method": "minProperties",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "min",
        "type": "number",
        "optional": false
      }
    ],
    "description": "At least N own keys. Draft-07 `minProperties`.",
    "example": {
      "declarations": [
        "metadata: Record<string, string>;"
      ],
      "field": "metadata",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().minProperties(1)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectPatternProperties",
    "symbol": "objectPatternPropertiesPlugin",
    "subpath": "@maroonedog/luq/plugins/objectPatternProperties",
    "method": "patternProperties",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "patterns",
        "type": "Readonly<Record<string, PropertyValueChain>>",
        "optional": false
      }
    ],
    "description": "Every property whose key matches a regular expression must satisfy that pattern's sub-chain. Draft-07 `patternProperties`.",
    "example": {
      "declarations": [
        "tagged: Record<string, string>;"
      ],
      "field": "tagged",
      "uses": [
        "requiredPlugin",
        "stringMinPlugin"
      ],
      "chain": "object.required().patternProperties({ \"^env$\": (pb) => pb.string.required().min(1) })",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectPropertyNames",
    "symbol": "objectPropertyNamesPlugin",
    "subpath": "@maroonedog/luq/plugins/objectPropertyNames",
    "method": "propertyNames",
    "slots": [
      "object"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "define",
        "type": "PropertyKeyChain",
        "optional": false
      }
    ],
    "description": "Constrains the object's KEYS with a string sub-chain — the subject is the key, never the value. Draft-07 `propertyNames`.",
    "example": {
      "declarations": [
        "counters: Record<string, number>;"
      ],
      "field": "counters",
      "uses": [
        "requiredPlugin",
        "stringMinPlugin"
      ],
      "chain": "object.required().propertyNames((kb) => kb.string.required().min(2))",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "objectRecursively",
    "symbol": "objectRecursivelyPlugin",
    "subpath": "@maroonedog/luq/plugins/objectRecursively",
    "method": "recursively",
    "slots": [
      "object",
      "array"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "target",
        "type": "RecursionTarget",
        "optional": false
      },
      {
        "name": "options",
        "type": "RecursivelyOptions",
        "optional": true
      }
    ],
    "description": "Re-enters this field's own plan, on itself (\"self\") or on its elements (\"element\"), down to `maxDepth` (default 10). A cycle ends the descent silently.",
    "example": {
      "declarations": [
        "node: { name: string };"
      ],
      "field": "node",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "object.required().recursively(\"self\", { maxDepth: 4 })",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "oneOf",
    "symbol": "oneOfPlugin",
    "subpath": "@maroonedog/luq/plugins/oneOf",
    "method": "oneOf",
    "slots": [
      "string",
      "number",
      "boolean"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "allowed",
        "type": "readonly SelfValue[]",
        "optional": false
      }
    ],
    "description": "The value is one of a fixed list. Membership is structural. This is the value enum — not the `oneOf` composition keyword, which takes sub-schemas.",
    "example": {
      "declarations": [
        "plan: string;"
      ],
      "field": "plan",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().oneOf([\"free\", \"pro\", \"team\"])",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "optional",
    "symbol": "optionalPlugin",
    "subpath": "@maroonedog/luq/plugins/optional",
    "method": "optional",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "The field may be absent. `undefined` passes and no other rule on the field runs.",
    "example": {
      "declarations": [
        "middleName?: string;"
      ],
      "field": "middleName",
      "uses": [],
      "chain": "string.optional()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "optionalIf",
    "symbol": "optionalIfPlugin",
    "subpath": "@maroonedog/luq/plugins/optionalIf",
    "method": "optionalIf",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "when",
        "type": "RootPredicate",
        "optional": false
      }
    ],
    "description": "The field is optional only while the predicate holds, and required otherwise. The logical dual of `requiredIf`.",
    "example": {
      "declarations": [
        "isDraft: boolean;",
        "publishedAt?: string;"
      ],
      "field": "publishedAt",
      "uses": [],
      "chain": "string.optionalIf((root) => root.isDraft)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "orFail",
    "symbol": "orFailPlugin",
    "subpath": "@maroonedog/luq/plugins/orFail",
    "method": "orFail",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "when",
        "type": "RootPredicate",
        "optional": false
      }
    ],
    "description": "While the predicate holds, the field must carry no value at all, whatever that value would be — a deprecated field, or one a role forbids.",
    "example": {
      "declarations": [
        "isProduction: boolean;",
        "debugToken?: string;"
      ],
      "field": "debugToken",
      "uses": [],
      "chain": "string.orFail((root) => root.isProduction)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "readOnly",
    "symbol": "readOnlyPlugin",
    "subpath": "@maroonedog/luq/plugins/readOnly",
    "method": "readOnly",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "object"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "JSON Schema `readOnly` as an access check: on a write, the field must not be supplied.",
    "example": {
      "declarations": [
        "id: string;"
      ],
      "field": "id",
      "uses": [],
      "chain": "string.readOnly()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "required",
    "symbol": "requiredPlugin",
    "subpath": "@maroonedog/luq/plugins/required",
    "method": "required",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "The field must be present. It narrows `null` out of the field's type as well as `undefined`.",
    "example": {
      "declarations": [
        "name: string;"
      ],
      "field": "name",
      "uses": [],
      "chain": "string.required()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "requiredIf",
    "symbol": "requiredIfPlugin",
    "subpath": "@maroonedog/luq/plugins/requiredIf",
    "method": "requiredIf",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "when",
        "type": "RootPredicate",
        "optional": false
      }
    ],
    "description": "The field is required only while the predicate holds. The predicate sees the whole root value, and inside an array path it also sees the element's context.",
    "example": {
      "declarations": [
        "wantsInvoice: boolean;",
        "vatNumber?: string;"
      ],
      "field": "vatNumber",
      "uses": [],
      "chain": "string.requiredIf((root) => root.wantsInvoice)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "skip",
    "symbol": "skipPlugin",
    "subpath": "@maroonedog/luq/plugins/skip",
    "method": "skip",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "when",
        "type": "RootPredicate",
        "optional": false
      }
    ],
    "description": "Skips every rule on this field while the predicate holds. The polarity-inverted twin of `validateIf`.",
    "example": {
      "declarations": [
        "importing: boolean;",
        "slug: string;"
      ],
      "field": "slug",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().skip((root) => root.importing)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stitch",
    "symbol": "stitchPlugin",
    "subpath": "@maroonedog/luq/plugins/stitch",
    "method": "stitch",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "object",
      "array",
      "tuple",
      "union"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "fields",
        "type": "FieldRefs",
        "optional": false
      },
      {
        "name": "check",
        "type": "StitchCheck",
        "optional": false
      }
    ],
    "description": "Checks this field against the values of other declared paths in one function. The paths are type-checked, and the check runs exactly once.",
    "example": {
      "declarations": [
        "price: number;",
        "quantity: number;",
        "total: number;"
      ],
      "field": "total",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "number.required().stitch([\"price\", \"quantity\"], (fieldValues, value) => ({ valid: typeof fieldValues.price === \"number\" && typeof fieldValues.quantity === \"number\" && value === fieldValues.price * fieldValues.quantity }))",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringAlphanumeric",
    "symbol": "stringAlphanumericPlugin",
    "subpath": "@maroonedog/luq/plugins/stringAlphanumeric",
    "method": "alphanumeric",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "allowSpaces",
        "type": "boolean",
        "optional": true
      }
    ],
    "description": "ASCII letters and digits only. The empty string fails; pass `true` to allow spaces.",
    "example": {
      "declarations": [
        "username: string;"
      ],
      "field": "username",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().alphanumeric()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringBase64",
    "symbol": "stringBase64Plugin",
    "subpath": "@maroonedog/luq/plugins/stringBase64",
    "method": "base64",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "options",
        "type": "Base64FormatOptions",
        "optional": true
      }
    ],
    "description": "The string looks like base64. Recognition only — nothing here decodes it, so there is no decoded value to inspect.",
    "example": {
      "declarations": [
        "blob: string;"
      ],
      "field": "blob",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().base64()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringContentEncoding",
    "symbol": "stringContentEncodingPlugin",
    "subpath": "@maroonedog/luq/plugins/stringContentEncoding",
    "method": "contentEncoding",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "encoding",
        "type": "ContentEncodingName",
        "optional": false
      }
    ],
    "description": "The string is valid under the named encoding: `base64`, `base32`, `binary`, `7bit`, `8bit` or `quoted-printable`. Draft-07 `contentEncoding`.",
    "example": {
      "declarations": [
        "body: string;"
      ],
      "field": "body",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().contentEncoding(\"base64\")",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringContentMediaType",
    "symbol": "stringContentMediaTypePlugin",
    "subpath": "@maroonedog/luq/plugins/stringContentMediaType",
    "method": "contentMediaType",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "mediaType",
        "type": "string",
        "optional": false
      }
    ],
    "description": "The string parses as the named media type. Draft-07 `contentMediaType`.",
    "example": {
      "declarations": [
        "document: string;"
      ],
      "field": "document",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().contentMediaType(\"application/json\")",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringDate",
    "symbol": "stringDatePlugin",
    "subpath": "@maroonedog/luq/plugins/stringDate",
    "method": "date",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An RFC 3339 full-date, `YYYY-MM-DD`. Draft-07 `date`.",
    "example": {
      "declarations": [
        "birthday: string;"
      ],
      "field": "birthday",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().date()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringDatetime",
    "symbol": "stringDatetimePlugin",
    "subpath": "@maroonedog/luq/plugins/stringDatetime",
    "method": "datetime",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "options",
        "type": "DatetimeFormatOptions",
        "optional": true
      }
    ],
    "description": "An RFC 3339 date-time. Draft-07 `date-time`.",
    "example": {
      "declarations": [
        "createdAt: string;"
      ],
      "field": "createdAt",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().datetime()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringDuration",
    "symbol": "stringDurationPlugin",
    "subpath": "@maroonedog/luq/plugins/stringDuration",
    "method": "duration",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An ISO 8601 duration. Draft-07 `duration`.",
    "example": {
      "declarations": [
        "ttl: string;"
      ],
      "field": "ttl",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().duration()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringEmail",
    "symbol": "stringEmailPlugin",
    "subpath": "@maroonedog/luq/plugins/stringEmail",
    "method": "email",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "options",
        "type": "EmailFormatOptions",
        "optional": true
      }
    ],
    "description": "An email address. Pass `customRegex` to substitute your own grammar. Draft-07 `email`.",
    "example": {
      "declarations": [
        "email: string;"
      ],
      "field": "email",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().email()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringEndsWith",
    "symbol": "stringEndsWithPlugin",
    "subpath": "@maroonedog/luq/plugins/stringEndsWith",
    "method": "endsWith",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "suffix",
        "type": "string",
        "optional": false
      }
    ],
    "description": "The string ends with the suffix. An empty suffix always passes.",
    "example": {
      "declarations": [
        "fileName: string;"
      ],
      "field": "fileName",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().endsWith(\".json\")",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringExactLength",
    "symbol": "stringExactLengthPlugin",
    "subpath": "@maroonedog/luq/plugins/stringExactLength",
    "method": "exactLength",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "expected",
        "type": "number",
        "optional": false
      }
    ],
    "description": "Exactly N UTF-16 code units.",
    "example": {
      "declarations": [
        "countryCode: string;"
      ],
      "field": "countryCode",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().exactLength(2)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringHostname",
    "symbol": "stringHostnamePlugin",
    "subpath": "@maroonedog/luq/plugins/stringHostname",
    "method": "hostname",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An RFC 1123 hostname. Draft-07 `hostname`.",
    "example": {
      "declarations": [
        "host: string;"
      ],
      "field": "host",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().hostname()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringIdnEmail",
    "symbol": "stringIdnEmailPlugin",
    "subpath": "@maroonedog/luq/plugins/stringIdnEmail",
    "method": "idnEmail",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An internationalised email address. Draft-07 `idn-email`.",
    "example": {
      "declarations": [
        "contact: string;"
      ],
      "field": "contact",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().idnEmail()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringIdnHostname",
    "symbol": "stringIdnHostnamePlugin",
    "subpath": "@maroonedog/luq/plugins/stringIdnHostname",
    "method": "idnHostname",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An internationalised hostname. Draft-07 `idn-hostname`.",
    "example": {
      "declarations": [
        "idnHost: string;"
      ],
      "field": "idnHost",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().idnHostname()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringIpv4",
    "symbol": "stringIpv4Plugin",
    "subpath": "@maroonedog/luq/plugins/stringIpv4",
    "method": "ipv4",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "A dotted-quad IPv4 address. Draft-07 `ipv4`.",
    "example": {
      "declarations": [
        "clientIp: string;"
      ],
      "field": "clientIp",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().ipv4()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringIpv6",
    "symbol": "stringIpv6Plugin",
    "subpath": "@maroonedog/luq/plugins/stringIpv6",
    "method": "ipv6",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An IPv6 address. Draft-07 `ipv6`.",
    "example": {
      "declarations": [
        "gateway: string;"
      ],
      "field": "gateway",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().ipv6()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringIri",
    "symbol": "stringIriPlugin",
    "subpath": "@maroonedog/luq/plugins/stringIri",
    "method": "iri",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An IRI (RFC 3987, deliberately approximate). Draft-07 `iri`.",
    "example": {
      "declarations": [
        "iri: string;"
      ],
      "field": "iri",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().iri()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringIriReference",
    "symbol": "stringIriReferencePlugin",
    "subpath": "@maroonedog/luq/plugins/stringIriReference",
    "method": "iriReference",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An IRI reference, absolute or relative. Draft-07 `iri-reference`.",
    "example": {
      "declarations": [
        "iriRef: string;"
      ],
      "field": "iriRef",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().iriReference()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringJsonPointer",
    "symbol": "stringJsonPointerPlugin",
    "subpath": "@maroonedog/luq/plugins/stringJsonPointer",
    "method": "jsonPointer",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An RFC 6901 JSON Pointer. Draft-07 `json-pointer`.",
    "example": {
      "declarations": [
        "pointer: string;"
      ],
      "field": "pointer",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().jsonPointer()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringMax",
    "symbol": "stringMaxPlugin",
    "subpath": "@maroonedog/luq/plugins/stringMax",
    "method": "max",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "max",
        "type": "number",
        "optional": false
      }
    ],
    "description": "At most N UTF-16 code units. `max: 0` permits only the empty string. Draft-07 `maxLength`.",
    "example": {
      "declarations": [
        "bio: string;"
      ],
      "field": "bio",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().max(500)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringMin",
    "symbol": "stringMinPlugin",
    "subpath": "@maroonedog/luq/plugins/stringMin",
    "method": "min",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "min",
        "type": "number",
        "optional": false
      }
    ],
    "description": "At least N UTF-16 code units, so an astral character counts as two. Draft-07 `minLength`.",
    "example": {
      "declarations": [
        "title: string;"
      ],
      "field": "title",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().min(3)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringPattern",
    "symbol": "stringPatternPlugin",
    "subpath": "@maroonedog/luq/plugins/stringPattern",
    "method": "pattern",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "pattern",
        "type": "RegExp",
        "optional": false
      }
    ],
    "description": "The string matches a `RegExp`.",
    "example": {
      "declarations": [
        "phone: string;"
      ],
      "field": "phone",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().pattern(/^\\d{3}-\\d{4}$/)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringRegex",
    "symbol": "stringRegexPlugin",
    "subpath": "@maroonedog/luq/plugins/stringRegex",
    "method": "regex",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "The string is itself a valid regular expression. Draft-07 `regex`.",
    "example": {
      "declarations": [
        "filter: string;"
      ],
      "field": "filter",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().regex()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringRelativeJsonPointer",
    "symbol": "stringRelativeJsonPointerPlugin",
    "subpath": "@maroonedog/luq/plugins/stringRelativeJsonPointer",
    "method": "relativeJsonPointer",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "A relative JSON Pointer. Draft-07 `relative-json-pointer`.",
    "example": {
      "declarations": [
        "relativePointer: string;"
      ],
      "field": "relativePointer",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().relativeJsonPointer()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringStartsWith",
    "symbol": "stringStartsWithPlugin",
    "subpath": "@maroonedog/luq/plugins/stringStartsWith",
    "method": "startsWith",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "prefix",
        "type": "string",
        "optional": false
      }
    ],
    "description": "The string starts with the prefix. An empty prefix always passes.",
    "example": {
      "declarations": [
        "orderId: string;"
      ],
      "field": "orderId",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().startsWith(\"ORD-\")",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringTime",
    "symbol": "stringTimePlugin",
    "subpath": "@maroonedog/luq/plugins/stringTime",
    "method": "time",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "options",
        "type": "TimeFormatOptions",
        "optional": true
      }
    ],
    "description": "An RFC 3339 full-time. Draft-07 `time`.",
    "example": {
      "declarations": [
        "opensAt: string;"
      ],
      "field": "opensAt",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().time()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringUriReference",
    "symbol": "stringUriReferencePlugin",
    "subpath": "@maroonedog/luq/plugins/stringUriReference",
    "method": "uriReference",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "A URI reference, absolute or relative. Draft-07 `uri-reference`.",
    "example": {
      "declarations": [
        "href: string;"
      ],
      "field": "href",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().uriReference()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringUriTemplate",
    "symbol": "stringUriTemplatePlugin",
    "subpath": "@maroonedog/luq/plugins/stringUriTemplate",
    "method": "uriTemplate",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "An RFC 6570 URI template. Draft-07 `uri-template`.",
    "example": {
      "declarations": [
        "template: string;"
      ],
      "field": "template",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().uriTemplate()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "stringUrl",
    "symbol": "stringUrlPlugin",
    "subpath": "@maroonedog/luq/plugins/stringUrl",
    "method": "url",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "options",
        "type": "UrlFormatOptions",
        "optional": true
      }
    ],
    "description": "An absolute URL, and the single home of the Draft-07 `uri` format.",
    "example": {
      "declarations": [
        "website: string;"
      ],
      "field": "website",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().url()",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "transform",
    "symbol": "transformPlugin",
    "subpath": "@maroonedog/luq/plugins/transform",
    "method": "transform",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "object",
      "union"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "map",
        "type": "SelfReader<unknown>",
        "optional": false
      }
    ],
    "description": "Maps the value to a new one. Transforms run LAST and only in `parse()` — `validate()` gives you back the original value.",
    "example": {
      "declarations": [
        "note: string;"
      ],
      "field": "note",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().transform((value) => value.trim())",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "tupleBuilder",
    "symbol": "tupleBuilderPlugin",
    "subpath": "@maroonedog/luq/plugins/tupleBuilder",
    "method": "builder",
    "slots": [
      "tuple"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "positions",
        "type": "readonly ElementChain[]",
        "optional": false
      },
      {
        "name": "rest",
        "type": "ElementChain",
        "optional": true
      }
    ],
    "description": "One chain per tuple position, plus an optional chain for the rest. Each position is typed by the tuple member it sits on.",
    "example": {
      "declarations": [
        "point: [number, number];"
      ],
      "field": "point",
      "uses": [
        "requiredPlugin",
        "numberMinPlugin"
      ],
      "chain": "tuple.required().builder([(eb) => eb.number.min(0), (eb) => eb.number.min(0)])",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "unionGuard",
    "symbol": "unionGuardPlugin",
    "subpath": "@maroonedog/luq/plugins/unionGuard",
    "method": "guard",
    "slots": [
      "union"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "condition",
        "type": "SelfGuard",
        "optional": false
      },
      {
        "name": "define",
        "type": "NarrowedChain",
        "optional": false
      }
    ],
    "description": "A type guard plus the rules that apply to the branch it narrows to. Every member of the union must be covered before `build()` is offered.",
    "example": {
      "declarations": [
        "shape: Circle | Square;"
      ],
      "field": "shape",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "union.required().guard(isCircle, (gb) => gb.object.required()).guard(isSquare, (gb) => gb.object.required())",
      "imports": [],
      "prelude": [
        "type Circle = { kind: \"circle\"; r: number };",
        "type Square = { kind: \"square\"; side: number };",
        "const isCircle = (value: Circle | Square): value is Circle =>",
        "  value.kind === \"circle\";",
        "const isSquare = (value: Circle | Square): value is Square =>",
        "  value.kind === \"square\";"
      ]
    }
  },
  {
    "name": "uuid",
    "symbol": "uuidPlugin",
    "subpath": "@maroonedog/luq/plugins/uuid",
    "method": "uuid",
    "slots": [
      "string"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "version",
        "type": "UuidVersion | readonly UuidVersion[]",
        "optional": true
      }
    ],
    "description": "A UUID. Pass a version, or a list of versions, to narrow it.",
    "example": {
      "declarations": [
        "requestId: string;"
      ],
      "field": "requestId",
      "uses": [
        "requiredPlugin"
      ],
      "chain": "string.required().uuid(4)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "validateIf",
    "symbol": "validateIfPlugin",
    "subpath": "@maroonedog/luq/plugins/validateIf",
    "method": "validateIf",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "tuple",
      "object",
      "union",
      "any"
    ],
    "tier": "isolated",
    "parameters": [
      {
        "name": "when",
        "type": "RootPredicate",
        "optional": false
      }
    ],
    "description": "Runs this field's rules only while the predicate holds. Where the call sits in the chain is irrelevant — the engine asks every gate before it runs any rule.",
    "example": {
      "declarations": [
        "hasProfile: boolean;",
        "displayName: string;"
      ],
      "field": "displayName",
      "uses": [
        "requiredPlugin",
        "stringMinPlugin"
      ],
      "chain": "string.required().min(2).validateIf((root) => root.hasProfile)",
      "imports": [],
      "prelude": []
    }
  },
  {
    "name": "writeOnly",
    "symbol": "writeOnlyPlugin",
    "subpath": "@maroonedog/luq/plugins/writeOnly",
    "method": "writeOnly",
    "slots": [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "object"
    ],
    "tier": "isolated",
    "parameters": [],
    "description": "JSON Schema `writeOnly` as an access check: on a read, the field must not be returned.",
    "example": {
      "declarations": [
        "token: string;"
      ],
      "field": "token",
      "uses": [],
      "chain": "string.writeOnly()",
      "imports": [],
      "prelude": []
    }
  }
];

export const pluginObjectCount = 77;
export const pluginSubpathCount = 76;
