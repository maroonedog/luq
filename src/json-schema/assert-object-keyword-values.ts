// ===========================================================================
// L8  src/json-schema/assert-object-keyword-values.ts — the meta-schema check
// on the VALUES of the object-family keywords: `required`, `properties`,
// `additionalProperties`, `patternProperties`, `propertyNames` and
// `dependencies`.
//
// They live together because they fail together: every one is read in a place
// that trusts the declared type, and untyped JSON reaches all six. `required:
// "name"` is iterated as a string and declares one phantom child per
// CHARACTER; `properties: {a: null}` is read for a pointer; the remaining four
// take the sub-schema route with a value that is not a schema at all, and the
// walker finds no keys on a primitive, so it yields a branch holding no rules.
//
// That last outcome is the SILENT one, and it is the one that matters most: a
// document saying "no extra properties", or "every key beginning with a_ holds
// a string", compiles to a validator that accepts everything. It is what a
// config service serialising booleans as strings produces, and what a
// hand-edited document with a quoted sub-schema produces. The loud failures
// are loud in the wrong place — a raw TypeError read off null somewhere deep
// in the walker, naming neither the keyword nor the document.
//
// Refusal is therefore always at BUILD time, and every well-formed shape is
// untouched: a name list, a map of schemas (including the §4.4 boolean form),
// a single schema, and — under `dependencies` — either a schema or an array of
// property names, which §6.5.7 makes equally lawful under the same key.
// ===========================================================================
import { isPlainObject, isStringArray } from "../types";
import { isDraft07Schema } from "./draft07.types";
import { MalformedSchemaError, SCHEMA_FORMS } from "./malformed-schema-error";

/**
 * `required` is an array of property names (§6.5.3), and whatever the document
 * put there is refused when it is anything else.
 *
 * UNIQUENESS IS NOT ENFORCED, although the meta-schema's `stringArray` asks
 * for it. A repeated name asks for nothing the single name does not — the
 * property is required either way, so the verdict is identical — and this
 * check exists to stop a validator enforcing LESS than its document, not to
 * lint a document that is enforced exactly as written. Refusing a duplicate
 * would reject working schemas for no gain in correctness.
 */
export function assertRequiredIsNameList(value: unknown): void {
  if (value === undefined || isStringArray(value)) return;
  throw new MalformedSchemaError(
    "required",
    "the value must be an array of property names",
    value
  );
}

/**
 * `properties` and `patternProperties` differ only in what their KEYS mean, so
 * they are checked the same way: the map itself, then every member of it, and
 * the offending key named in the reason so the message points at one entry
 * rather than at a map that may hold a dozen. `dependencies` is not routed
 * through here — §6.5.7 gives its members a second lawful form, which is a
 * different member check and a different sentence.
 *
 * `mapReason` is the keyword's own, because "an object mapping property names
 * to schemas" and "an object mapping regular expressions to schemas" are the
 * only part of the requirement the two keywords do not share.
 */
function assertSchemaMap(
  keyword: string,
  mapReason: string,
  value: unknown
): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    throw new MalformedSchemaError(keyword, mapReason, value);
  }
  for (const [key, member] of Object.entries(value)) {
    if (isDraft07Schema(member)) continue;
    throw new MalformedSchemaError(
      keyword,
      `the schema under "${key}" ${SCHEMA_FORMS}`,
      member
    );
  }
}

/**
 * `properties` maps property names to schemas (§6.5.4), and a schema is an
 * object or a boolean; the map itself and every member of it are refused when
 * they are not. The key is named in the reason so the message points at the
 * offending node rather than at the whole document.
 */
export function assertPropertiesIsSchemaMap(value: unknown): void {
  assertSchemaMap(
    "properties",
    "the value must be an object mapping property names to schemas",
    value
  );
}

/**
 * `additionalProperties` is a schema, and §4.4 makes a boolean one (§6.5.6).
 * Both of those forms pass through unchanged; only a value the meta-schema
 * already forbids — a string, a number, an array, null — is refused.
 */
export function assertAdditionalPropertiesIsSchema(value: unknown): void {
  if (value === undefined || isDraft07Schema(value)) return;
  throw new MalformedSchemaError(
    "additionalProperties",
    `the value ${SCHEMA_FORMS}`,
    value
  );
}

/**
 * `patternProperties` maps regular expressions to schemas (§6.5.5). The map
 * itself and every member of it are refused when they are not schemas, and the
 * pattern is named in the reason so the message points at the one offending
 * entry rather than at a map that may hold a dozen.
 *
 * THE KEYS ARE DELIBERATELY NOT COMPILED HERE, although Draft-07 says each
 * SHOULD be a valid ECMA-262 pattern. A key that will not compile is not the
 * failure this module exists to stop: the plugin compiles every key while
 * building its rule, so such a key already kills the build, loudly, before any
 * validator exists — it is a SyntaxError rather than a typed refusal, but
 * nothing is silently under-enforced. Compiling one here as well would put a
 * SECOND `new RegExp` in the converter, which holds exactly one — the `pattern`
 * keyword's, over the document's own source string — so that regex
 * construction and its flag handling stay in a single place.
 */
export function assertPatternPropertiesIsSchemaMap(value: unknown): void {
  assertSchemaMap(
    "patternProperties",
    "the value must be an object mapping regular expressions to schemas",
    value
  );
}

/**
 * `propertyNames` is ONE schema, applied to every property name (§6.5.8), and
 * §4.4 makes a boolean one. An ARRAY is the shape of a schema list and is not
 * itself a schema, so it is refused along with every primitive. An object
 * stands whatever keywords it carries, because §4.3 has a schema ignore the
 * keywords it does not recognise rather than be invalid for holding them.
 */
export function assertPropertyNamesIsSchema(value: unknown): void {
  if (value === undefined || isDraft07Schema(value)) return;
  throw new MalformedSchemaError(
    "propertyNames",
    `the value ${SCHEMA_FORMS}`,
    value
  );
}

/**
 * `dependencies` maps a property name to what its presence demands (§6.5.7),
 * and the draft gives that two equally lawful forms under the same key: an
 * ARRAY of property names, which makes those names required alongside it, or a
 * SCHEMA the whole instance must then satisfy. Both are kept; only a value
 * that is neither is refused, and the key is named so the message points at
 * the one offending entry rather than at the whole map.
 */
export function assertDependenciesIsSchemaOrNameListMap(value: unknown): void {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    throw new MalformedSchemaError(
      "dependencies",
      "the value must be an object mapping property names to schemas or to " +
        "arrays of property names",
      value
    );
  }
  for (const [key, dependency] of Object.entries(value)) {
    if (isStringArray(dependency) || isDraft07Schema(dependency)) continue;
    throw new MalformedSchemaError(
      "dependencies",
      `the dependency under "${key}" ${SCHEMA_FORMS}, or an array of ` +
        "property names",
      dependency
    );
  }
}
