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

/**
 * Keys that share a name with something on `Object.prototype`.
 *
 * **This is no longer a deny list.** Refusing these in a declared path was
 * over-broad: only writing is dangerous, and of the three only "__proto__"
 * really is.
 *
 *   reading  own properties only, checked with hasOwnProperty.call, so the
 *            prototype chain is never walked to begin with
 *   writing  `target[key] = value` on "__proto__" invokes the ACCESSOR on
 *            Object.prototype: it creates no own property and swaps the
 *            prototype instead. "constructor" and "prototype" are data
 *            properties, so assigning them only makes an own property and
 *            pollutes nothing
 *
 * Writing through defineProperty instead of assignment closes that route.
 * Refusing by name became unnecessary, which is what allows a schema like
 * `{ "properties": { "__proto__": ... } }` to be validated at all.
 *
 * The list stays. Tests use it to name the keys they check Object.prototype
 * against.
 */
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
  // Reserved segments are deliberately NOT refused here. See RESERVED_SEGMENTS.
}
