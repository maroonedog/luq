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
// ===========================================================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
