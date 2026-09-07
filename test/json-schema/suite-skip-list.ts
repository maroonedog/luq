// ===========================================================================
// test/json-schema/suite-skip-list.ts — THE ONLY PERMITTED EXCLUSION from the
// JSON-Schema-Test-Suite corpus.
//
// TYPED DATA, NEVER JSON. Every entry has to name a `cause` from a closed
// union, a `reason` a reviewer can read, and an `expiresWith` naming the thing
// that must exist before the entry may be deleted — and all three are enforced
// by the compiler, not by a review convention: `cause` and `expiresWith` are
// string-literal unions, `reason` is a required property, and a missing or
// misspelled one is a type error rather than a silently ignored field.
//
// WHAT STOPS THIS LIST FROM ROTTING: `findStaleSkips()` in
// test/integration/json-schema-suite.test.ts runs every skipped case anyway
// and FAILS the build when one of them passes. A skip is therefore an
// assertion that the case still fails, not a place to hide a regression. The
// published pass rate in docs/json-schema-conformance.md counts skipped cases
// as FAILURES; skipping changes what the build reports, never the number.
// ===========================================================================

/**
 * Why a case is excluded. Closed: a new kind of failure has to be named here
 * before it can be skipped, which is what makes the list reviewable.
 */
export type SuiteSkipCause =
  | "external-ref"
  | "ref-pointer-escaping"
  | "ref-identifier-scope"
  | "ref-chain"
  | "boolean-sub-schema"
  | "null-not-observable"
  | "sibling-keyword-interaction"
  | "code-point-string-length"
  | "tuple-items"
  | "reserved-path-segment";

/**
 * WHAT MUST EXIST before the entry may be deleted. `feature:` names conversion
 * work and `decision:` names an entry that is only removable if a recorded
 * decision is reversed (the reserved-segment refusal is deliberate, so its
 * entries are the ones expected to outlive the rest).
 *
 * The `plugin:` arm is GONE, and so are the `unsupported-format` and
 * `structural-equality` causes: every entry they carried has been deleted
 * because the thing it waited for now exists. A dead name here is an
 * invitation to re-skip under an old excuse, so the union shrinks with the
 * list.
 */
export type SuiteSkipExpiry =
  | "feature:external-ref-loader"
  | "feature:json-pointer-escaping"
  | "feature:ref-identifier-scope"
  | "feature:ref-chain-resolution"
  | "feature:boolean-sub-schema"
  | "feature:document-driven-presence"
  | "feature:additional-properties-with-patterns"
  | "feature:code-point-string-length"
  | "feature:tuple-items-and-additional-items"
  | "decision:reserved-path-segments";

export interface SuiteSkip {
  /** File name under tests/draft7, e.g. "ref.json". */
  readonly file: string;
  /** The group's `description`. */
  readonly group: string;
  /** One case's `description`. ABSENT means the whole group. */
  readonly test?: string;
  readonly cause: SuiteSkipCause;
  readonly reason: string;
  readonly expiresWith: SuiteSkipExpiry;
}

export const SUITE_SKIPS: readonly SuiteSkip[] = [
  {
    file: "additionalProperties.json",
    group: "additionalProperties being false does not allow other properties",
    test: "patternProperties are not additional properties",
    cause: "sibling-keyword-interaction",
    reason:
      "objectAdditionalProperties takes a NAME LIST (the schema's own `properties` keys), so a key that is additional only because no patternProperties regex matched it cannot be expressed.",
    expiresWith: "feature:additional-properties-with-patterns",
  },
  {
    file: "additionalProperties.json",
    group: "non-ASCII pattern with additionalProperties",
    test: "matching the pattern is valid",
    cause: "sibling-keyword-interaction",
    reason:
      "objectAdditionalProperties takes a NAME LIST (the schema's own `properties` keys), so a key that is additional only because no patternProperties regex matched it cannot be expressed.",
    expiresWith: "feature:additional-properties-with-patterns",
  },
  {
    file: "boolean_schema.json",
    group: "boolean schema 'false'",
    test: "null is invalid",
    cause: "null-not-observable",
    reason:
      "decide-presence settles null before any check runs, so no composite rule can reject it; only a presence policy can, and the document has no way to declare one here.",
    expiresWith: "feature:document-driven-presence",
  },
  {
    file: "definitions.json",
    group: "validate definition against metaschema",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://json-schema.org/draft-07/schema#`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "enum.json",
    group: "heterogeneous enum validation",
    test: "something else is invalid",
    cause: "null-not-observable",
    reason:
      "the case's data is `null`, and the enum does not list it. Structural equality (src/plugin-kit/is-json-value-equal.ts) fixed the other 16 enum/const cases; this one never reaches a check, because decide-presence settles null first and `permitsNull` reads only `type`.",
    expiresWith: "feature:document-driven-presence",
  },
  {
    file: "items.json",
    group: "items and subitems",
    test: "too many sub-items",
    cause: "tuple-items",
    reason:
      "the tuple form of `items` is converted as a composite rather than through tupleBuilder, and `additionalItems` is consumed without a rule, so per-position schemas and the extra-element bound are not enforced.",
    expiresWith: "feature:tuple-items-and-additional-items",
  },
  {
    file: "items.json",
    group: "items and subitems",
    test: "wrong item",
    cause: "tuple-items",
    reason:
      "the tuple form of `items` is converted as a composite rather than through tupleBuilder, and `additionalItems` is consumed without a rule, so per-position schemas and the extra-element bound are not enforced.",
    expiresWith: "feature:tuple-items-and-additional-items",
  },
  {
    file: "items.json",
    group: "items and subitems",
    test: "wrong sub-item",
    cause: "tuple-items",
    reason:
      "the tuple form of `items` is converted as a composite rather than through tupleBuilder, and `additionalItems` is consumed without a rule, so per-position schemas and the extra-element bound are not enforced.",
    expiresWith: "feature:tuple-items-and-additional-items",
  },
  {
    file: "maxLength.json",
    group: "maxLength validation",
    test: "two graphemes is long enough",
    cause: "code-point-string-length",
    reason:
      "stringMin/stringMax measure String.prototype.length, which counts UTF-16 code units; Draft-07 counts code points, so a surrogate pair counts twice.",
    expiresWith: "feature:code-point-string-length",
  },
  {
    file: "minLength.json",
    group: "minLength validation",
    test: "one grapheme is not long enough",
    cause: "code-point-string-length",
    reason:
      "stringMin/stringMax measure String.prototype.length, which counts UTF-16 code units; Draft-07 counts code points, so a surrogate pair counts twice.",
    expiresWith: "feature:code-point-string-length",
  },
  {
    file: "not.json",
    group: "forbid everything with empty schema",
    test: "null is invalid",
    cause: "null-not-observable",
    reason:
      "decide-presence settles null before any check runs, so no composite rule can reject it; only a presence policy can, and the document has no way to declare one here.",
    expiresWith: "feature:document-driven-presence",
  },
  {
    file: "not.json",
    group: "forbid everything with boolean schema true",
    test: "null is invalid",
    cause: "null-not-observable",
    reason:
      "decide-presence settles null before any check runs, so no composite rule can reject it; only a presence policy can, and the document has no way to declare one here.",
    expiresWith: "feature:document-driven-presence",
  },
  {
    file: "patternProperties.json",
    group: "regexes are not anchored by default and are case sensitive",
    test: "recognized members are accounted for",
    cause: "null-not-observable",
    reason:
      "decide-presence settles null before any check runs, so no composite rule can reject it; only a presence policy can, and the document has no way to declare one here.",
    expiresWith: "feature:document-driven-presence",
  },
  {
    file: "properties.json",
    group: "properties, patternProperties, additionalProperties interaction",
    test: "patternProperty validates nonproperty",
    cause: "sibling-keyword-interaction",
    reason:
      "objectAdditionalProperties takes a NAME LIST (the schema's own `properties` keys), so a key that is additional only because no patternProperties regex matched it cannot be expressed.",
    expiresWith: "feature:additional-properties-with-patterns",
  },
  {
    file: "properties.json",
    group: "properties whose names are Javascript object property names",
    cause: "reserved-path-segment",
    reason:
      'parse-field-path refuses "__proto__" as a declared segment (prototype pollution). The refusal is deliberate and the suite requires the key to be validatable.',
    expiresWith: "decision:reserved-path-segments",
  },
  {
    file: "ref.json",
    group: "relative pointer ref to array",
    test: "mismatch array",
    cause: "tuple-items",
    reason:
      "the tuple form of `items` is converted as a composite rather than through tupleBuilder, and `additionalItems` is consumed without a rule, so per-position schemas and the extra-element bound are not enforced.",
    expiresWith: "feature:tuple-items-and-additional-items",
  },
  {
    file: "ref.json",
    group: "escaped pointer ref",
    cause: "ref-pointer-escaping",
    reason:
      'readRefPointer splits `#/definitions/percent%25field` on "/" without %-decoding or ~-unescaping, so the segment is looked up under its encoded spelling.',
    expiresWith: "feature:json-pointer-escaping",
  },
  {
    file: "ref.json",
    group: "nested refs",
    test: "nested ref invalid",
    cause: "ref-chain",
    reason:
      "$ref -> $ref -> schema: the second hop is resolved as a node but its rules are not collected, so only the first hop constrains the value.",
    expiresWith: "feature:ref-chain-resolution",
  },
  {
    file: "ref.json",
    group: "$ref prevents a sibling $id from changing the base uri",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `foo.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "remote ref, containing refs itself",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://json-schema.org/draft-07/schema#`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "$ref to boolean schema false",
    cause: "boolean-sub-schema",
    reason:
      "the boolean form `false` behind a $ref resolves to an empty schema object rather than to a rule that rejects everything.",
    expiresWith: "feature:boolean-sub-schema",
  },
  {
    file: "ref.json",
    group: "Recursive references between schemas",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `node`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "refs with quote",
    cause: "ref-pointer-escaping",
    reason:
      'readRefPointer splits `#/definitions/foo%22bar` on "/" without %-decoding or ~-unescaping, so the segment is looked up under its encoded spelling.',
    expiresWith: "feature:json-pointer-escaping",
  },
  {
    file: "ref.json",
    group: "Location-independent identifier",
    test: "mismatch",
    cause: "ref-identifier-scope",
    reason:
      "resolve-ref walks JSON Pointers only. `$id` establishes no base URI and `#foo` names no anchor, so a location-independent identifier does not resolve.",
    expiresWith: "feature:ref-identifier-scope",
  },
  {
    file: "ref.json",
    group: "Reference an anchor with a non-relative URI",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `https://example.com/schema-with-anchor#foo`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "Location-independent identifier with base URI change in subschema",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://localhost:1234/nested.json#foo`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "refs with relative uris and defs",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `schema-relative-uri-defs2.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "relative refs with absolute uris and defs",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `schema-refs-absolute-uris-defs2.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group:
      "$id must be resolved against nearest parent, not just immediate parent",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://example.com/b/d.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "simple URN base URI with $ref via the URN",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `urn:uuid:deadbeef-1234-ffff-ffff-4321feebdaed`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "URN base URI with URN and JSON pointer ref",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `urn:uuid:deadbeef-1234-0000-0000-4321feebdaed#/definitions/bar`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "URN base URI with URN and anchor ref",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `urn:uuid:deadbeef-1234-ff00-00ff-4321feebdaed#something`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "ref to if",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://example.com/ref/if`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "ref to then",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://example.com/ref/then`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "ref to else",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://example.com/ref/else`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "ref with absolute-path-reference",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `/absref/foobar.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "ref.json",
    group: "$id with file URI still resolves pointers - *nix",
    test: "non-number is invalid",
    cause: "ref-identifier-scope",
    reason:
      "resolve-ref walks JSON Pointers only. `$id` establishes no base URI and `#foo` names no anchor, so a location-independent identifier does not resolve.",
    expiresWith: "feature:ref-identifier-scope",
  },
  {
    file: "ref.json",
    group: "$id with file URI still resolves pointers - windows",
    test: "non-number is invalid",
    cause: "ref-identifier-scope",
    reason:
      "resolve-ref walks JSON Pointers only. `$id` establishes no base URI and `#foo` names no anchor, so a location-independent identifier does not resolve.",
    expiresWith: "feature:ref-identifier-scope",
  },
  {
    file: "ref.json",
    group: "empty tokens in $ref json-pointer",
    test: "non-number is invalid",
    cause: "ref-pointer-escaping",
    reason:
      'the JSON pointer contains empty tokens ("#/definitions//definitions/"), which the segment walk collapses instead of treating as a real empty key.',
    expiresWith: "feature:json-pointer-escaping",
  },
  {
    file: "refRemote.json",
    group: "remote ref",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://localhost:1234/integer.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "fragment within remote ref",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://localhost:1234/draft7/subSchemas.json#/definitions/integer`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "ref within remote ref",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://localhost:1234/draft7/subSchemas.json#/definitions/refToInteger`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "base URI change",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `folderInteger.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "base URI change - change folder",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `folderInteger.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "base URI change - change folder in subschema",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `folderInteger.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "root ref in remote ref",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `draft7/name.json#/definitions/orNull`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "remote ref with ref to definitions",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `draft7/ref-and-definitions.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "Location-independent identifier in remote ref",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://localhost:1234/draft7/locationIndependentIdentifier.json#/definitions/refToInteger`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "retrieved nested refs resolve relative to their URI not $id",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `nested/foo-ref-string.json`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "refRemote.json",
    group: "$ref to $ref finds location-independent $id",
    cause: "external-ref",
    reason:
      "resolve-ref refuses `http://localhost:1234/draft7/detached-ref.json#/definitions/foo`: it leaves the document, and Luq has no schema loader. The suite serves these over localhost:1234.",
    expiresWith: "feature:external-ref-loader",
  },
  {
    file: "required.json",
    group:
      "required properties whose names are Javascript object property names",
    cause: "reserved-path-segment",
    reason:
      'parse-field-path refuses "__proto__" as a declared segment (prototype pollution). The refusal is deliberate and the suite requires the key to be validatable.',
    expiresWith: "decision:reserved-path-segments",
  },
  {
    file: "uniqueItems.json",
    group: "uniqueItems with an array of items and additionalItems=false",
    test: "extra items are invalid even if unique",
    cause: "tuple-items",
    reason:
      "the tuple form of `items` is converted as a composite rather than through tupleBuilder, and `additionalItems` is consumed without a rule, so per-position schemas and the extra-element bound are not enforced.",
    expiresWith: "feature:tuple-items-and-additional-items",
  },
  {
    file: "uniqueItems.json",
    group: "uniqueItems=false with an array of items and additionalItems=false",
    test: "extra items are invalid even if unique",
    cause: "tuple-items",
    reason:
      "the tuple form of `items` is converted as a composite rather than through tupleBuilder, and `additionalItems` is consumed without a rule, so per-position schemas and the extra-element bound are not enforced.",
    expiresWith: "feature:tuple-items-and-additional-items",
  },
];

/** True when this exact case is excluded, or its whole group is. */
export function findSuiteSkip(
  file: string,
  group: string,
  test: string
): SuiteSkip | undefined {
  return SUITE_SKIPS.find(
    (skip) =>
      skip.file === file &&
      skip.group === group &&
      (skip.test === undefined || skip.test === test)
  );
}
