// ===========================================================================
// L1  src/path/reserved-segment.ts
// The prototype-pollution gate for the ONE path grammar, plus the error every
// path-shaped rejection throws.
//
// PathSyntaxError lives here, not in parse-field-path.ts, because this module
// is the first thing that throws it and parse-field-path.ts imports this one.
// Putting the class the other way round would make the two files mutually
// dependent for no gain.
// ===========================================================================

/** Segment names that reach `Object.prototype` and must never be walked,
 *  written, or vivified. `fromJsonSchema` derives segments verbatim from
 *  untrusted schema property names, so this list is a security boundary, not a
 *  style preference. */
export const RESERVED_SEGMENTS: readonly string[] = Object.freeze([
  "__proto__",
  "constructor",
  "prototype",
]);

/** Thrown at BUILD time for every malformed or unsafe path. A declared rule
 *  must either execute or fail loudly; the legacy silent `return () => null`
 *  turned a typo into a rule that never ran. */
export class PathSyntaxError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`Invalid field path ${JSON.stringify(path)}: ${reason}`);
    this.name = "PathSyntaxError";
    this.path = path;
  }
}

export function isReservedSegment(key: string): boolean {
  return RESERVED_SEGMENTS.includes(key);
}

/**
 * The single definition of "this string may be used as one path segment".
 *
 * `source` is the whole path (or the origin, for a key that has not been
 * joined into a path yet) and appears in the message so a regression names the
 * offender.
 *
 * A key containing `.` is rejected rather than escaped: the grammar splits on
 * `.` and has no escape syntax, so such a key would silently mean something
 * else. Rejecting is the only honest option, and it is the reason this
 * function is exported — the JSON Schema converter must call it on raw
 * property names BEFORE joining them into a path, where the dot is still
 * visible as its own key.
 */
export function assertDeclarableKey(key: string, source: string): void {
  if (key === "") {
    throw new PathSyntaxError(source, "a path segment must not be empty");
  }
  if (key.includes(".")) {
    throw new PathSyntaxError(
      source,
      `the key ${JSON.stringify(key)} contains "." and cannot be expressed; ` +
        'the grammar splits on "." and defines no escape'
    );
  }
  if (key.includes("[") || key.includes("]")) {
    throw new PathSyntaxError(
      source,
      `the key ${JSON.stringify(key)} contains a bracket; "[*]" is the only ` +
        "bracket form and it must trail a key"
    );
  }
  if (isReservedSegment(key)) {
    throw new PathSyntaxError(
      source,
      `${JSON.stringify(key)} is a reserved segment (prototype pollution)`
    );
  }
}
