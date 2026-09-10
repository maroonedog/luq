// Hand-written prose and usage examples for the plugin catalogue, keyed by the
// symbol the package exports. Everything mechanical — subpath, chain method,
// slots, tier, argument tuple — is read from the repository by
// generate-plugin-data.mjs and is NOT repeated here, so this file cannot
// disagree with the implementation about any of it.
//
// The generator fails if a catalogued symbol has no entry here, or if an entry
// here names a symbol the catalogue does not have.
//
// Every `example` below is compiled for real: `npm run verify-plugin-examples`
// gives each one its OWN builder, holding only the plugin plus the plugins its
// `uses` list names, and typechecks the lot against the repository's own src/.
// A chain that does not compile — or a `uses` list that is short by one plugin
// — fails the build.
//
//   declarations — lines of the example TypeScript type, verbatim
//   field        — the path passed to .v()
//   uses         — other plugin symbols the chain calls a method of
//   chain        — everything after `b.` inside .v()
//   imports      — extra import lines the chain needs, beyond the plugin itself
//   prelude      — extra top-level declarations the chain needs

/** @typedef {{ declarations: string[], field: string, uses: string[], chain: string, imports?: string[], prelude?: string[] }} PluginExample */
/** @typedef {{ description: string, example: PluginExample }} PluginCopy */

/** @type {Record<string, PluginCopy>} */
export const PLUGIN_COPY = {
  arrayContainsPlugin: {
    description:
      "At least one element satisfies the given element chain. Draft-07 `contains`, with optional `min` / `max` bounds for `minContains` / `maxContains`.",
    example: {
      declarations: ["tags: string[];"],
      field: "tags",
      uses: ["requiredPlugin", "stringMinPlugin"],
      chain: "array.required().contains((eb) => eb.string.min(2), { min: 1 })",
    },
  },
  arrayEachPlugin: {
    description:
      "Applies one element chain to every element. It reports a single issue for the array; declare `items[*]` with `.v()` when you want one issue per element.",
    example: {
      declarations: ["labels: string[];"],
      field: "labels",
      uses: ["requiredPlugin", "stringMinPlugin"],
      chain: "array.required().each((eb) => eb.string.min(1))",
    },
  },
  arrayIncludesPlugin: {
    description:
      "The array contains the given value. Membership is structural, so a value that came out of `JSON.parse` still matches.",
    example: {
      declarations: ["roles: string[];"],
      field: "roles",
      uses: ["requiredPlugin"],
      chain: 'array.required().includes("admin")',
    },
  },
  arrayMaxLengthPlugin: {
    description: "At most N elements. Draft-07 `maxItems`.",
    example: {
      declarations: ["photos: string[];"],
      field: "photos",
      uses: ["requiredPlugin"],
      chain: "array.required().maxLength(10)",
    },
  },
  arrayMinLengthPlugin: {
    description: "At least N elements. Draft-07 `minItems`.",
    example: {
      declarations: ["attachments: string[];"],
      field: "attachments",
      uses: ["requiredPlugin"],
      chain: "array.required().minLength(1)",
    },
  },
  arrayUniquePlugin: {
    description:
      "No two elements are equal. Equality is structural, so the same object shape twice is a duplicate. Draft-07 `uniqueItems`.",
    example: {
      declarations: ["skus: string[];"],
      field: "skus",
      uses: ["requiredPlugin"],
      chain: "array.required().unique()",
    },
  },
  booleanFalsyPlugin: {
    description: "The value must be `false`.",
    example: {
      declarations: ["archived: boolean;"],
      field: "archived",
      uses: ["requiredPlugin"],
      chain: "boolean.required().falsy()",
    },
  },
  booleanTruthyPlugin: {
    description:
      "The value must be `true` — the accept-the-terms checkbox rule.",
    example: {
      declarations: ["acceptedTerms: boolean;"],
      field: "acceptedTerms",
      uses: ["requiredPlugin"],
      chain: "boolean.required().truthy()",
    },
  },
  compareFieldPlugin: {
    description:
      "Compares this field with another declared path. Equality by default; pass a comparison function for anything else. The path is checked against your type at compile time.",
    example: {
      declarations: ["password: string;", "passwordConfirm: string;"],
      field: "passwordConfirm",
      uses: ["requiredPlugin"],
      chain: 'string.required().compareField("password")',
    },
  },
  conditionalSchemaPlugin: {
    description:
      "Draft-07 `if` / `then` / `else` as one three-branch rule: when the condition chain passes, `then` applies, otherwise `else` does. Both branches are optional.",
    example: {
      declarations: ["shipping: { method: string };"],
      field: "shipping",
      uses: ["requiredPlugin"],
      chain:
        "object.required().conditionalSchema((cb) => cb.object.required(), (tb) => tb.object.required())",
    },
  },
  customPlugin: {
    description:
      "An arbitrary predicate over the field's value. It runs exactly once and may return `{ valid, message }` to supply its own message.",
    example: {
      declarations: ["sku: string;"],
      field: "sku",
      uses: ["requiredPlugin"],
      chain: 'string.required().custom((value) => value.startsWith("SKU-"))',
    },
  },
  fromContextPlugin: {
    description:
      "Checks the field against the external context handed to `validate(value, { external })` — the read side of the async story. The plugin itself knows nothing about async.",
    example: {
      declarations: ["tenantId: string;"],
      field: "tenantId",
      uses: ["requiredPlugin"],
      chain:
        "string.required().fromContext({ check: (value, context) => ({ valid: value === context.tenantId }) })",
    },
  },
  jsonSchemaPlugin: {
    description:
      "Constrains one declared field by a JSON Schema document, and takes the plugin bag explicitly. It reaches root-level keywords `fromJsonSchema` cannot, such as `propertyNames` and `if` / `then` / `else` on the document root.",
    example: {
      declarations: ["payload: Record<string, unknown>;"],
      field: "payload",
      uses: ["requiredPlugin"],
      chain: "object.required().jsonSchema(PAYLOAD_SCHEMA, jsonSchemaBag)",
      imports: [
        'import { jsonSchemaBag } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";',
      ],
      prelude: [
        "const PAYLOAD_SCHEMA = {",
        '  type: "object",',
        '  properties: { kind: { type: "string", minLength: 1 } },',
        '  required: ["kind"],',
        "};",
      ],
    },
  },
  jsonSchemaFullFeaturePlugin: {
    description:
      "One import that covers a whole Draft-07 document. The same subpath exports `fromJsonSchema<T>(schema)`, which builds a validator with no builder chain at all.",
    example: {
      declarations: ["profile: { email: string };"],
      field: "profile",
      uses: ["requiredPlugin"],
      chain: "object.required().jsonSchemaFullFeature(PROFILE_SCHEMA)",
      prelude: [
        "const PROFILE_SCHEMA = {",
        '  type: "object",',
        '  properties: { email: { type: "string", format: "email" } },',
        '  required: ["email"],',
        "};",
      ],
    },
  },
  literalPlugin: {
    description:
      "Equality against one constant. Comparison is structural, so it matches values that came out of `JSON.parse`. Draft-07 `const`.",
    example: {
      declarations: ['kind: "person";'],
      field: "kind",
      uses: ["requiredPlugin"],
      chain: 'string.required().literal("person")',
    },
  },
  nullablePlugin: {
    description: "`null` is an accepted value for this field.",
    example: {
      declarations: ["deletedAt: string | null;"],
      field: "deletedAt",
      uses: [],
      chain: "string.nullable()",
    },
  },
  numberFinitePlugin: {
    description: "Rejects `NaN`, `Infinity` and `-Infinity`.",
    example: {
      declarations: ["ratio: number;"],
      field: "ratio",
      uses: ["requiredPlugin"],
      chain: "number.required().finite()",
    },
  },
  numberIntegerPlugin: {
    description: "The value has no fractional part. Draft-07 `integer`.",
    example: {
      declarations: ["quantity: number;"],
      field: "quantity",
      uses: ["requiredPlugin"],
      chain: "number.required().integer()",
    },
  },
  numberMaxPlugin: {
    description:
      "Upper bound. Pass `true` as the second argument for an exclusive bound. Draft-07 `maximum` / `exclusiveMaximum`.",
    example: {
      declarations: ["score: number;"],
      field: "score",
      uses: ["requiredPlugin"],
      chain: "number.required().max(100)",
    },
  },
  numberMinPlugin: {
    description:
      "Lower bound. Pass `true` as the second argument for an exclusive bound. Draft-07 `minimum` / `exclusiveMinimum`.",
    example: {
      declarations: ["age: number;"],
      field: "age",
      uses: ["requiredPlugin"],
      chain: "number.required().min(18)",
    },
  },
  numberMultipleOfPlugin: {
    description:
      "The value is an exact multiple of the divisor. Draft-07 `multipleOf`.",
    example: {
      declarations: ["cents: number;"],
      field: "cents",
      uses: ["requiredPlugin"],
      chain: "number.required().multipleOf(5)",
    },
  },
  numberNegativePlugin: {
    description: "Strictly less than zero.",
    example: {
      declarations: ["adjustment: number;"],
      field: "adjustment",
      uses: ["requiredPlugin"],
      chain: "number.required().negative()",
    },
  },
  numberPositivePlugin: {
    description: "Strictly greater than zero.",
    example: {
      declarations: ["price: number;"],
      field: "price",
      uses: ["requiredPlugin"],
      chain: "number.required().positive()",
    },
  },
  numberRangePlugin: {
    description: "Both bounds at once, inclusive.",
    example: {
      declarations: ["rating: number;"],
      field: "rating",
      uses: ["requiredPlugin"],
      chain: "number.required().range(1, 5)",
    },
  },
  objectPlugin: {
    description:
      "**Deprecated, and inert.** Entering `b.object` already checks that the value is a plain object, under the code `objectType`, so this rule answers PASS for everything. Drop the import and the `.object()` call: the field goes on rejecting arrays, `null` and primitives either way.",
    example: {
      declarations: ["settings: { theme: string };"],
      field: "settings",
      uses: ["requiredPlugin"],
      chain: "object.required()",
    },
  },
  objectAdditionalPropertiesPlugin: {
    description:
      "Draft-07's boolean `additionalProperties`. `false` forbids any key the schema did not declare; the optional second argument is a plain allow-list of extra key names.",
    example: {
      declarations: ["headers: Record<string, string>;"],
      field: "headers",
      uses: ["requiredPlugin"],
      chain: 'object.required().additionalProperties(false, ["traceId"])',
    },
  },
  objectAdditionalPropertiesSchemaPlugin: {
    description:
      "Draft-07's schema form of `additionalProperties`: every undeclared key's value must satisfy the sub-chain. Passing `false` forbids undeclared keys outright.",
    example: {
      declarations: ["attributes: Record<string, string>;"],
      field: "attributes",
      uses: ["requiredPlugin", "stringMinPlugin"],
      chain:
        "object.required().additionalPropertiesSchema((pb) => pb.string.required().min(1))",
    },
  },
  objectDependentRequiredPlugin: {
    description:
      "When a trigger key is present, the keys it lists must be present too. Draft-07 `dependentRequired`.",
    example: {
      declarations: [
        "payment: { card?: string; holder?: string; cvc?: string };",
      ],
      field: "payment",
      uses: ["requiredPlugin"],
      chain: 'object.required().dependentRequired({ card: ["holder", "cvc"] })',
    },
  },
  objectDependentSchemasPlugin: {
    description:
      "When a trigger key is present, the whole object must also satisfy that key's sub-chain. Draft-07 `dependentSchemas`.",
    example: {
      declarations: ["billing: { card?: string };"],
      field: "billing",
      uses: ["requiredPlugin", "objectMinPropertiesPlugin"],
      chain:
        "object.required().dependentSchemas({ card: (sb) => sb.object.required().minProperties(2) })",
    },
  },
  objectMaxPropertiesPlugin: {
    description: "At most N own keys. Draft-07 `maxProperties`.",
    example: {
      declarations: ["annotations: Record<string, string>;"],
      field: "annotations",
      uses: ["requiredPlugin"],
      chain: "object.required().maxProperties(16)",
    },
  },
  objectMinPropertiesPlugin: {
    description: "At least N own keys. Draft-07 `minProperties`.",
    example: {
      declarations: ["metadata: Record<string, string>;"],
      field: "metadata",
      uses: ["requiredPlugin"],
      chain: "object.required().minProperties(1)",
    },
  },
  objectPatternPropertiesPlugin: {
    description:
      "Every property whose key matches a regular expression must satisfy that pattern's sub-chain. Draft-07 `patternProperties`.",
    example: {
      declarations: ["tagged: Record<string, string>;"],
      field: "tagged",
      uses: ["requiredPlugin", "stringMinPlugin"],
      chain:
        'object.required().patternProperties({ "^env$": (pb) => pb.string.required().min(1) })',
    },
  },
  objectPropertyNamesPlugin: {
    description:
      "Constrains the object's KEYS with a string sub-chain — the subject is the key, never the value. Draft-07 `propertyNames`.",
    example: {
      declarations: ["counters: Record<string, number>;"],
      field: "counters",
      uses: ["requiredPlugin", "stringMinPlugin"],
      chain:
        "object.required().propertyNames((kb) => kb.string.required().min(2))",
    },
  },
  objectRecursivelyPlugin: {
    description:
      'Re-enters this field\'s own plan, on itself ("self") or on its elements ("element"), down to `maxDepth` (default 10). A cycle ends the descent silently.',
    example: {
      declarations: ["node: { name: string };"],
      field: "node",
      uses: ["requiredPlugin"],
      chain: 'object.required().recursively("self", { maxDepth: 4 })',
    },
  },
  oneOfPlugin: {
    description:
      "The value is one of a fixed list. Membership is structural. This is the value enum — not the `oneOf` composition keyword, which takes sub-schemas.",
    example: {
      declarations: ["plan: string;"],
      field: "plan",
      uses: ["requiredPlugin"],
      chain: 'string.required().oneOf(["free", "pro", "team"])',
    },
  },
  optionalPlugin: {
    description:
      "The field may be absent. `undefined` passes and no other rule on the field runs.",
    example: {
      declarations: ["middleName?: string;"],
      field: "middleName",
      uses: [],
      chain: "string.optional()",
    },
  },
  optionalIfPlugin: {
    description:
      "The field is optional only while the predicate holds, and required otherwise. The logical dual of `requiredIf`.",
    example: {
      declarations: ["isDraft: boolean;", "publishedAt?: string;"],
      field: "publishedAt",
      uses: [],
      chain: "string.optionalIf((root) => root.isDraft)",
    },
  },
  orFailPlugin: {
    description:
      "While the predicate holds, the field must carry no value at all, whatever that value would be — a deprecated field, or one a role forbids.",
    example: {
      declarations: ["isProduction: boolean;", "debugToken?: string;"],
      field: "debugToken",
      uses: [],
      chain: "string.orFail((root) => root.isProduction)",
    },
  },
  readOnlyPlugin: {
    description:
      "JSON Schema `readOnly` as an access check: on a write, the field must not be supplied.",
    example: {
      declarations: ["id: string;"],
      field: "id",
      uses: [],
      chain: "string.readOnly()",
    },
  },
  requiredPlugin: {
    description:
      "The field must be present. It narrows `null` out of the field's type as well as `undefined`.",
    example: {
      declarations: ["name: string;"],
      field: "name",
      uses: [],
      chain: "string.required()",
    },
  },
  requiredIfPlugin: {
    description:
      "The field is required only while the predicate holds. The predicate sees the whole root value, and inside an array path it also sees the element's context.",
    example: {
      declarations: ["wantsInvoice: boolean;", "vatNumber?: string;"],
      field: "vatNumber",
      uses: [],
      chain: "string.requiredIf((root) => root.wantsInvoice)",
    },
  },
  skipPlugin: {
    description:
      "Skips every rule on this field while the predicate holds. The polarity-inverted twin of `validateIf`.",
    example: {
      declarations: ["importing: boolean;", "slug: string;"],
      field: "slug",
      uses: ["requiredPlugin"],
      chain: "string.required().skip((root) => root.importing)",
    },
  },
  stitchPlugin: {
    description:
      "Checks this field against the values of other declared paths in one function. The paths are type-checked, and the check runs exactly once.",
    example: {
      declarations: ["price: number;", "quantity: number;", "total: number;"],
      field: "total",
      uses: ["requiredPlugin"],
      chain:
        'number.required().stitch(["price", "quantity"], (fieldValues, value) => ({ valid: typeof fieldValues.price === "number" && typeof fieldValues.quantity === "number" && value === fieldValues.price * fieldValues.quantity }))',
    },
  },
  stitchWithPlugin: {
    description:
      "EXPERIMENTAL. Cross-field validation over a TYPED bundle. Name the paths under aliases, then judge them together in one sub-chain. stitch hands the bundle over as Record<string, unknown>; here a misspelt member or a wrong type is a compile error.",
    example: {
      declarations: ["price: number;", "quantity: number;", "total: number;"],
      field: "total",
      uses: ["requiredPlugin", "customPlugin"],
      chain:
        'number.required().stitchWith({ sum: "total", cost: "price", count: "quantity" }, (f) => f.object.custom((b) => b.sum === b.cost * b.count))',
    },
  },
  stringAlphanumericPlugin: {
    description:
      "ASCII letters and digits only. The empty string fails; pass `true` to allow spaces.",
    example: {
      declarations: ["username: string;"],
      field: "username",
      uses: ["requiredPlugin"],
      chain: "string.required().alphanumeric()",
    },
  },
  stringBase64Plugin: {
    description:
      "The string looks like base64. Recognition only — nothing here decodes it, so there is no decoded value to inspect.",
    example: {
      declarations: ["blob: string;"],
      field: "blob",
      uses: ["requiredPlugin"],
      chain: "string.required().base64()",
    },
  },
  stringContentEncodingPlugin: {
    description:
      "The string is valid under the named encoding: `base64`, `base32`, `binary`, `7bit`, `8bit` or `quoted-printable`. Draft-07 `contentEncoding`.",
    example: {
      declarations: ["body: string;"],
      field: "body",
      uses: ["requiredPlugin"],
      chain: 'string.required().contentEncoding("base64")',
    },
  },
  stringContentMediaTypePlugin: {
    description:
      "The string parses as the named media type. Draft-07 `contentMediaType`.",
    example: {
      declarations: ["document: string;"],
      field: "document",
      uses: ["requiredPlugin"],
      chain: 'string.required().contentMediaType("application/json")',
    },
  },
  stringDatePlugin: {
    description: "An RFC 3339 full-date, `YYYY-MM-DD`. Draft-07 `date`.",
    example: {
      declarations: ["birthday: string;"],
      field: "birthday",
      uses: ["requiredPlugin"],
      chain: "string.required().date()",
    },
  },
  stringDatetimePlugin: {
    description: "An RFC 3339 date-time. Draft-07 `date-time`.",
    example: {
      declarations: ["createdAt: string;"],
      field: "createdAt",
      uses: ["requiredPlugin"],
      chain: "string.required().datetime()",
    },
  },
  stringDurationPlugin: {
    description: "An ISO 8601 duration. Draft-07 `duration`.",
    example: {
      declarations: ["ttl: string;"],
      field: "ttl",
      uses: ["requiredPlugin"],
      chain: "string.required().duration()",
    },
  },
  stringEmailPlugin: {
    description:
      "An email address. Pass `customRegex` to substitute your own grammar. Draft-07 `email`.",
    example: {
      declarations: ["email: string;"],
      field: "email",
      uses: ["requiredPlugin"],
      chain: "string.required().email()",
    },
  },
  stringEndsWithPlugin: {
    description:
      "The string ends with the suffix. An empty suffix always passes.",
    example: {
      declarations: ["fileName: string;"],
      field: "fileName",
      uses: ["requiredPlugin"],
      chain: 'string.required().endsWith(".json")',
    },
  },
  stringExactLengthPlugin: {
    description: "Exactly N UTF-16 code units.",
    example: {
      declarations: ["countryCode: string;"],
      field: "countryCode",
      uses: ["requiredPlugin"],
      chain: "string.required().exactLength(2)",
    },
  },
  stringHostnamePlugin: {
    description: "An RFC 1123 hostname. Draft-07 `hostname`.",
    example: {
      declarations: ["host: string;"],
      field: "host",
      uses: ["requiredPlugin"],
      chain: "string.required().hostname()",
    },
  },
  stringIdnEmailPlugin: {
    description: "An internationalised email address. Draft-07 `idn-email`.",
    example: {
      declarations: ["contact: string;"],
      field: "contact",
      uses: ["requiredPlugin"],
      chain: "string.required().idnEmail()",
    },
  },
  stringIdnHostnamePlugin: {
    description: "An internationalised hostname. Draft-07 `idn-hostname`.",
    example: {
      declarations: ["idnHost: string;"],
      field: "idnHost",
      uses: ["requiredPlugin"],
      chain: "string.required().idnHostname()",
    },
  },
  stringIpv4Plugin: {
    description: "A dotted-quad IPv4 address. Draft-07 `ipv4`.",
    example: {
      declarations: ["clientIp: string;"],
      field: "clientIp",
      uses: ["requiredPlugin"],
      chain: "string.required().ipv4()",
    },
  },
  stringIpv6Plugin: {
    description: "An IPv6 address. Draft-07 `ipv6`.",
    example: {
      declarations: ["gateway: string;"],
      field: "gateway",
      uses: ["requiredPlugin"],
      chain: "string.required().ipv6()",
    },
  },
  stringIriPlugin: {
    description: "An IRI (RFC 3987, deliberately approximate). Draft-07 `iri`.",
    example: {
      declarations: ["iri: string;"],
      field: "iri",
      uses: ["requiredPlugin"],
      chain: "string.required().iri()",
    },
  },
  stringIriReferencePlugin: {
    description:
      "An IRI reference, absolute or relative. Draft-07 `iri-reference`.",
    example: {
      declarations: ["iriRef: string;"],
      field: "iriRef",
      uses: ["requiredPlugin"],
      chain: "string.required().iriReference()",
    },
  },
  stringJsonPointerPlugin: {
    description: "An RFC 6901 JSON Pointer. Draft-07 `json-pointer`.",
    example: {
      declarations: ["pointer: string;"],
      field: "pointer",
      uses: ["requiredPlugin"],
      chain: "string.required().jsonPointer()",
    },
  },
  stringMaxPlugin: {
    description:
      "At most N UTF-16 code units. `max: 0` permits only the empty string. Draft-07 `maxLength`.",
    example: {
      declarations: ["bio: string;"],
      field: "bio",
      uses: ["requiredPlugin"],
      chain: "string.required().max(500)",
    },
  },
  stringMinPlugin: {
    description:
      "At least N UTF-16 code units, so an astral character counts as two. Draft-07 `minLength`.",
    example: {
      declarations: ["title: string;"],
      field: "title",
      uses: ["requiredPlugin"],
      chain: "string.required().min(3)",
    },
  },
  stringPatternPlugin: {
    description: "The string matches a `RegExp`.",
    example: {
      declarations: ["phone: string;"],
      field: "phone",
      uses: ["requiredPlugin"],
      chain: "string.required().pattern(/^\\d{3}-\\d{4}$/)",
    },
  },
  stringRegexPlugin: {
    description:
      "The string is itself a valid regular expression. Draft-07 `regex`.",
    example: {
      declarations: ["filter: string;"],
      field: "filter",
      uses: ["requiredPlugin"],
      chain: "string.required().regex()",
    },
  },
  stringRelativeJsonPointerPlugin: {
    description: "A relative JSON Pointer. Draft-07 `relative-json-pointer`.",
    example: {
      declarations: ["relativePointer: string;"],
      field: "relativePointer",
      uses: ["requiredPlugin"],
      chain: "string.required().relativeJsonPointer()",
    },
  },
  stringStartsWithPlugin: {
    description:
      "The string starts with the prefix. An empty prefix always passes.",
    example: {
      declarations: ["orderId: string;"],
      field: "orderId",
      uses: ["requiredPlugin"],
      chain: 'string.required().startsWith("ORD-")',
    },
  },
  stringTimePlugin: {
    description: "An RFC 3339 full-time. Draft-07 `time`.",
    example: {
      declarations: ["opensAt: string;"],
      field: "opensAt",
      uses: ["requiredPlugin"],
      chain: "string.required().time()",
    },
  },
  stringUriReferencePlugin: {
    description:
      "A URI reference, absolute or relative. Draft-07 `uri-reference`.",
    example: {
      declarations: ["href: string;"],
      field: "href",
      uses: ["requiredPlugin"],
      chain: "string.required().uriReference()",
    },
  },
  stringUriTemplatePlugin: {
    description: "An RFC 6570 URI template. Draft-07 `uri-template`.",
    example: {
      declarations: ["template: string;"],
      field: "template",
      uses: ["requiredPlugin"],
      chain: "string.required().uriTemplate()",
    },
  },
  stringUrlPlugin: {
    description:
      "An absolute URL, and the single home of the Draft-07 `uri` format.",
    example: {
      declarations: ["website: string;"],
      field: "website",
      uses: ["requiredPlugin"],
      chain: "string.required().url()",
    },
  },
  transformPlugin: {
    description:
      "Maps the value to a new one. Transforms run LAST and only in `parse()` — `validate()` gives you back the original value.",
    example: {
      declarations: ["note: string;"],
      field: "note",
      uses: ["requiredPlugin"],
      chain: "string.required().transform((value) => value.trim())",
    },
  },
  tupleBuilderPlugin: {
    description:
      "One chain per tuple position, plus an optional chain for the rest. Each position is typed by the tuple member it sits on.",
    example: {
      declarations: ["point: [number, number];"],
      field: "point",
      uses: ["requiredPlugin", "numberMinPlugin"],
      chain:
        "tuple.required().builder([(eb) => eb.number.min(0), (eb) => eb.number.min(0)])",
    },
  },
  unionGuardPlugin: {
    description:
      "A type guard plus the rules that apply to the branch it narrows to. Every member of the union must be covered before `build()` is offered.",
    example: {
      declarations: ["shape: Circle | Square;"],
      field: "shape",
      uses: ["requiredPlugin"],
      chain:
        "union.required().guard(isCircle, (gb) => gb.object.required()).guard(isSquare, (gb) => gb.object.required())",
      prelude: [
        'type Circle = { kind: "circle"; r: number };',
        'type Square = { kind: "square"; side: number };',
        "const isCircle = (value: Circle | Square): value is Circle =>",
        '  value.kind === "circle";',
        "const isSquare = (value: Circle | Square): value is Square =>",
        '  value.kind === "square";',
      ],
    },
  },
  uuidPlugin: {
    description: "A UUID. Pass a version, or a list of versions, to narrow it.",
    example: {
      declarations: ["requestId: string;"],
      field: "requestId",
      uses: ["requiredPlugin"],
      chain: "string.required().uuid(4)",
    },
  },
  validateIfPlugin: {
    description:
      "Runs this field's rules only while the predicate holds. Where the call sits in the chain is irrelevant — the engine asks every gate before it runs any rule.",
    example: {
      declarations: ["hasProfile: boolean;", "displayName: string;"],
      field: "displayName",
      uses: ["requiredPlugin", "stringMinPlugin"],
      chain: "string.required().min(2).validateIf((root) => root.hasProfile)",
    },
  },
  writeOnlyPlugin: {
    description:
      "JSON Schema `writeOnly` as an access check: on a read, the field must not be returned.",
    example: {
      declarations: ["token: string;"],
      field: "token",
      uses: [],
      chain: "string.writeOnly()",
    },
  },
};
