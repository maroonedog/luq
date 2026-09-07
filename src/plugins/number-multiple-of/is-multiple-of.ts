// ===========================================================================
// L7  src/plugins/number-multiple-of/is-multiple-of.ts
//
// THE LEGACY BUG THIS FILE EXISTS TO KILL: 1.x wrote `value % divisor === 0`.
// In binary floating point 0.3 % 0.1 is 0.09999999999999998, so
// .multipleOf(0.1) REJECTED 0.3 — a value JSON Schema says is valid.
//
// The fix is scaled-integer comparison: shift BOTH operands by the larger of
// their decimal-place counts, round to integers, and take the integer modulo.
// The shift must use the MAXIMUM of the two counts, never the divisor's alone —
// scaling 0.35 by 10 rounds it to 4 and would wrongly accept it as a multiple
// of 0.1. Beyond the safe-integer range the scaling itself would lie, so the
// quotient fallback takes over there.
// ===========================================================================

/** Past this many decimal places 10**exponent stops being exact. */
const MAX_EXACT_SCALE_EXPONENT = 15;

/** How far the quotient may sit from a whole number in the fallback path. */
const QUOTIENT_TOLERANCE = 1e-9;

function countFractionDigits(text: string): number {
  const pointIndex = text.indexOf(".");
  return pointIndex < 0 ? 0 : text.length - pointIndex - 1;
}

/** Decimal places in the SHORTEST round-tripping spelling of `value`. */
export function countDecimalPlaces(value: number): number {
  const text = String(value);
  const exponentIndex = text.indexOf("e");
  if (exponentIndex < 0) return countFractionDigits(text);
  const exponent = Number(text.slice(exponentIndex + 1));
  const mantissaDigits = countFractionDigits(text.slice(0, exponentIndex));
  return Math.max(mantissaDigits - exponent, 0);
}

function isNearWholeQuotient(value: number, divisor: number): boolean {
  const quotient = value / divisor;
  return Math.abs(quotient - Math.round(quotient)) < QUOTIENT_TOLERANCE;
}

/**
 * `divisor` must already be finite and non-zero; number-multiple-of.ts rejects
 * anything else at build time so this stays a pure numeric predicate.
 */
export function isMultipleOf(value: number, divisor: number): boolean {
  if (!Number.isFinite(value)) return false;
  const exponent = Math.max(
    countDecimalPlaces(value),
    countDecimalPlaces(divisor)
  );
  if (exponent > MAX_EXACT_SCALE_EXPONENT) {
    return isNearWholeQuotient(value, divisor);
  }
  const scale = 10 ** exponent;
  const scaledValue = Math.round(value * scale);
  const scaledDivisor = Math.round(divisor * scale);
  if (scaledDivisor === 0) return isNearWholeQuotient(value, divisor);
  if (!Number.isSafeInteger(scaledValue)) {
    return isNearWholeQuotient(value, divisor);
  }
  return scaledValue % scaledDivisor === 0;
}
