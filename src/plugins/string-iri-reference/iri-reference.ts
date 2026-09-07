// ===========================================================================
// L7  src/plugins/string-iri-reference/iri-reference.ts
// RFC 3987 IRI-reference = IRI | relative-reference. 1.x's reading, kept:
// the EMPTY STRING is valid (a same-document reference), control characters
// and spaces are rejected in the part BEFORE any "?" or "#", and a bare path
// is accepted only when its first segment carries no ":" — otherwise it would
// be indistinguishable from a scheme.
// ===========================================================================
import { hasControlOrSpace } from "./control-character";

const ABSOLUTE_IRI = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** Everything up to the first "?" or "#", whichever comes first. */
function readPathPart(value: string): string {
  const markers = [value.indexOf("?"), value.indexOf("#")].filter(
    (index) => index >= 0
  );
  return markers.length === 0 ? value : value.slice(0, Math.min(...markers));
}

function isFirstSegmentSchemeFree(value: string): boolean {
  const first = value.split("/")[0] ?? "";
  return !first.includes(":");
}

export function isIriReference(value: string): boolean {
  if (value.length === 0) return true;
  if (hasControlOrSpace(readPathPart(value))) return false;
  if (value.startsWith("//")) return !value.slice(2).includes("//");
  if (value.startsWith("/")) return true;
  if (value.startsWith("./") || value.startsWith("../")) return true;
  if (value.startsWith("?") || value.startsWith("#")) return true;
  if (ABSOLUTE_IRI.test(value)) return true;
  return isFirstSegmentSchemeFree(value);
}
