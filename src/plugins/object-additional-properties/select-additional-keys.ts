// ===========================================================================
// L7  src/plugins/object-additional-properties/select-additional-keys.ts
//
// Which keys count as "additional". Used by both the boolean form and the
// schema form.
//
// Draft-07 §6.5.4 defines them as the keys matched by neither `properties`
// nor `patternProperties`. Miss the patterns and
// `{"patternProperties":{"^v":{}},"additionalProperties":false}` wrongly
// rejects {"vroom":2}.
// ===========================================================================

/**
 * Patterns are compiled once, at build time, matching the design where
 * validation only runs what was already assembled. Compiling per key would
 * cost O(keys × patterns) compilations on every call.
 *
 * A broken pattern is ignored rather than fatal. Draft-07 asks for ECMA-262
 * regular expressions and real documents arrive with dialect differences;
 * having that one pattern match nothing beats refusing the whole build.
 */
export function compilePatterns(
  patterns: readonly string[] | undefined
): readonly RegExp[] {
  if (patterns === undefined || patterns.length === 0) return Object.freeze([]);
  const compiled: RegExp[] = [];
  for (const pattern of patterns) {
    try {
      compiled.push(new RegExp(pattern, "u"));
    } catch {
      try {
        // Some real patterns fail only under "u". Try again without it.
        compiled.push(new RegExp(pattern));
      } catch {
        // Failing both ways, treat this pattern as matching nothing.
      }
    }
  }
  return Object.freeze(compiled);
}

/**
 * Returns the keys matched by neither a declared name nor any pattern,
 * preserving the input's enumeration order so issue output stays stable.
 */
export function selectAdditionalKeys(
  value: Readonly<Record<string, unknown>>,
  known: ReadonlySet<string>,
  patterns: readonly RegExp[]
): readonly string[] {
  return Object.keys(value).filter(
    (key) => !known.has(key) && !patterns.some((pattern) => pattern.test(key))
  );
}
