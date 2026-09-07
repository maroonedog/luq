// ===========================================================================
// L7  src/plugins/string-uri-reference/uri-reference.ts
// RFC 3986 URI-reference = URI / relative-ref, and unlike RFC 3987's
// IRI-reference it is ASCII ONLY: every character outside the reserved and
// unreserved sets must arrive percent-encoded. That difference is why this
// grammar exists instead of the format map pointing `uri-reference` at
// stringIriReference — an IRI-reference is a strict SUPERSET, so reusing it
// would have accepted values a URI-reference forbids.
//
// The empty string is a valid URI-reference (a same-document relative-ref).
// ===========================================================================
const BROKEN_PERCENT = /%(?![0-9A-Fa-f]{2})/;
const PERCENT_TRIPLET = /%[0-9A-Fa-f]{2}/g;
const SCHEME = /^[A-Za-z][A-Za-z0-9+\-.]*:/;
/** unreserved / sub-delims / ":" / "@" / "/" — the path character set. */
const PATH_CHARACTERS = /^[A-Za-z0-9\-._~!$&'()*+,;=:@/]*$/;
/** Path characters plus "?" — query and fragment may both carry it. */
const QUERY_CHARACTERS = /^[A-Za-z0-9\-._~!$&'()*+,;=:@/?]*$/;
/** Path characters plus "[" and "]" for an IPv6 literal host. */
const AUTHORITY_CHARACTERS = /^[A-Za-z0-9\-._~!$&'()*+,;=:@[\]]*$/;

interface UriParts {
  readonly beforeQuery: string;
  readonly query: string;
  readonly fragment: string;
}

function splitUriReference(value: string): UriParts {
  const hash = value.indexOf("#");
  const withoutFragment = hash < 0 ? value : value.slice(0, hash);
  const fragment = hash < 0 ? "" : value.slice(hash + 1);
  const mark = withoutFragment.indexOf("?");
  return {
    beforeQuery: mark < 0 ? withoutFragment : withoutFragment.slice(0, mark),
    query: mark < 0 ? "" : withoutFragment.slice(mark + 1),
    fragment,
  };
}

function isAllowed(component: string, allowed: RegExp): boolean {
  return allowed.test(component.replace(PERCENT_TRIPLET, ""));
}

/** `//authority/path…` — the authority ends at the first "/" after it. */
function isAuthorityAndPathAllowed(afterSlashes: string): boolean {
  const end = afterSlashes.indexOf("/");
  const authority = end < 0 ? afterSlashes : afterSlashes.slice(0, end);
  const path = end < 0 ? "" : afterSlashes.slice(end);
  return (
    isAllowed(authority, AUTHORITY_CHARACTERS) &&
    isAllowed(path, PATH_CHARACTERS)
  );
}

/** A relative path may not look like a scheme: its FIRST segment holds no ":". */
function isRelativeFirstSegmentSchemeFree(path: string): boolean {
  return !(path.split("/")[0] ?? "").includes(":");
}

function isHierarchicalPartAllowed(part: string): boolean {
  return part.startsWith("//")
    ? isAuthorityAndPathAllowed(part.slice(2))
    : isAllowed(part, PATH_CHARACTERS);
}

export function isUriReference(value: string): boolean {
  if (BROKEN_PERCENT.test(value)) return false;
  const parts = splitUriReference(value);
  if (!isAllowed(parts.query, QUERY_CHARACTERS)) return false;
  if (!isAllowed(parts.fragment, QUERY_CHARACTERS)) return false;
  const scheme = SCHEME.exec(parts.beforeQuery);
  if (scheme !== null) {
    return isHierarchicalPartAllowed(parts.beforeQuery.slice(scheme[0].length));
  }
  if (!isHierarchicalPartAllowed(parts.beforeQuery)) return false;
  return (
    parts.beforeQuery.startsWith("/") ||
    isRelativeFirstSegmentSchemeFree(parts.beforeQuery)
  );
}
