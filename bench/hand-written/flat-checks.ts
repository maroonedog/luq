// ===========================================================================
// bench/hand-written/flat-checks.ts
//
// THE REFERENCE, and it is deliberately unfair to Luq. Each function is the
// fastest honest thing a developer would write by hand for that exact shape:
// no plan, no issue objects, no path strings, no options — a boolean and an
// early return. It therefore measures the FLOOR of the work, and the ratio
// luq_ops / reference_ops says how much the generic engine costs on top of it.
//
// This is what CI gates on. An absolute ops/sec gate on a shared runner flakes
// unconditionally because the runner's speed is not ours to control; a ratio
// measured back to back in the SAME process cancels the machine out, because a
// runner that halves Luq's throughput halves the reference's too.
//
// "Fastest honest thing" is the operative word. A reference that checks LESS
// than the shape declares is not a floor, it is a discount. The e-mail pattern
// below used to be `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, which cost 34 ns/call
// against the plugin's 51, so a third of the multiField ratio was the two
// sides validating different languages. It is now the plugin's own pattern,
// copied verbatim; the values in MULTI_FIELD_REJECTED are the ones that tell
// the two apart, so the agreement check fails if this copy ever drifts.
// ===========================================================================

/** Verbatim copy of DEFAULT_EMAIL in src/plugins/string-email/string-email.ts. */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9]([a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export { EMAIL_PATTERN };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { isRecord };

/** Mirrors singleFieldShape: name is a required string of at least 3 chars. */
export function checkSingleField(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const name = value["name"];
  if (typeof name !== "string") return false;
  if (name.length < 3) return false;
  return true;
}

/**
 * Mirrors multiFieldShape (1.x's "simple"): name 3..50, email by pattern,
 * age 18..120, all three required.
 */
export function checkMultiField(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const name = value["name"];
  if (typeof name !== "string") return false;
  if (name.length < 3 || name.length > 50) return false;

  const email = value["email"];
  if (typeof email !== "string") return false;
  if (!EMAIL_PATTERN.test(email)) return false;

  const age = value["age"];
  if (typeof age !== "number") return false;
  if (age < 18 || age > 120) return false;

  return true;
}
