// ===========================================================================
// bench/hand-written/nested-checks.ts — the reference for nestedShape.
// Four fields at depth 2-3, reached by property access rather than by a path
// string, which is precisely the advantage a hand-written validator has and
// the reason the ratio on this shape is worth gating on separately.
// ===========================================================================
import { isRecord } from "./flat-checks";

const COUNTRY_PATTERN = /^[A-Z]{2}$/;

export function checkNested(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const customer = value["customer"];
  if (!isRecord(customer)) return false;

  const name = customer["name"];
  if (typeof name !== "string") return false;
  if (name.length < 2 || name.length > 80) return false;

  const address = customer["address"];
  if (!isRecord(address)) return false;

  const country = address["country"];
  if (typeof country !== "string") return false;
  if (!COUNTRY_PATTERN.test(country)) return false;

  const zip = address["zip"];
  if (typeof zip !== "string") return false;
  if (zip.length < 3 || zip.length > 10) return false;

  const city = address["city"];
  if (typeof city !== "string") return false;
  if (city.length < 1) return false;

  return true;
}
