// ===========================================================================
// L7  src/plugins/string-ipv6/ipv6-address.ts
// The RFC 4291 address grammar, read structurally instead of as one 20-branch
// alternation. 1.x had that alternation here and, in the JSON Schema table, a
// rival rule that returned TRUE for anything containing "::" — so ":::::" and
// "gg::1" both validated. Splitting on "::" and counting groups is what makes
// those two answers impossible to disagree again.
// ===========================================================================
const HEX_GROUP = /^[0-9a-fA-F]{1,4}$/;
const DECIMAL_OCTET = /^(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$/;

const TOTAL_GROUPS = 8;

/** The trailing dotted-quad form of ::ffff:192.0.2.1 — 2 groups' worth. */
function isDottedQuadTail(part: string): boolean {
  const octets = part.split(".");
  if (octets.length !== 4) return false;
  return octets.every((octet) => DECIMAL_OCTET.test(octet));
}

function splitGroups(half: string): readonly string[] {
  return half.length === 0 ? [] : half.split(":");
}

/** Group count, or null when a group is malformed or empty. */
function countGroups(
  parts: readonly string[],
  allowDottedQuadTail: boolean
): number | null {
  let total = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === undefined || part.length === 0) return null;
    if (part.includes(".")) {
      const isTail = allowDottedQuadTail && index === parts.length - 1;
      if (!isTail || !isDottedQuadTail(part)) return null;
      total += 2;
      continue;
    }
    if (!HEX_GROUP.test(part)) return null;
    total += 1;
  }
  return total;
}

function hasValidGroups(address: string): boolean {
  const halves = address.split("::");
  const head = halves[0] ?? "";
  if (halves.length === 1) {
    return countGroups(splitGroups(head), true) === TOTAL_GROUPS;
  }
  if (halves.length > 2) return false;
  const tail = halves[1] ?? "";
  const left = countGroups(splitGroups(head), false);
  const right = countGroups(splitGroups(tail), true);
  if (left === null || right === null) return false;
  // "::" must stand for at least one omitted group.
  return left + right < TOTAL_GROUPS;
}

/** Accepts the RFC 6874 zone suffix (fe80::1%eth0), as 1.x did. */
export function isIpv6Address(value: string): boolean {
  const zoned = value.split("%");
  if (zoned.length > 2) return false;
  const zone = zoned[1];
  if (zone !== undefined && zone.length === 0) return false;
  return hasValidGroups(zoned[0] ?? "");
}
