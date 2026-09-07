// ===========================================================================
// L7  src/plugins/string-content-media-type/media-type-checks.ts
// What a media type can be recognised from its TEXT alone.
//
// 1.x also sniffed magic bytes for image/png, image/jpeg, image/gif and
// application/pdf by decoding base64 through Buffer (Node) or atob (browser).
// That is environment-dependent, wrong for any non-Latin1 payload, and far
// outside a schema validator's job, so it is gone: this table recognises text.
// Structured-suffix rules (+json, +xml) and the text/* family stay, because
// they are RULES, not the "anything unknown passes" fallback that 1.x used.
// ===========================================================================
export type MediaTypeCheck = (value: string) => boolean;

const HTML_ELEMENT = /<\/?[a-z][\s\S]*>/i;
const XML_DECLARATION = /^\s*<\?xml[\s\S]*\?>/;
const XML_ROOT = /^\s*<[a-zA-Z_][a-zA-Z0-9_.-]*[\s\S]*>/;
const SVG_ELEMENT = /<svg[^>]*>[\s\S]*<\/svg>/i;

function isJsonText(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function isXmlText(value: string): boolean {
  return XML_DECLARATION.test(value) || XML_ROOT.test(value);
}

function acceptsAnyText(): boolean {
  return true;
}

const EXACT_CHECKS: ReadonlyMap<string, MediaTypeCheck> = new Map<
  string,
  MediaTypeCheck
>([
  ["application/json", isJsonText],
  ["application/xml", isXmlText],
  ["text/xml", isXmlText],
  ["text/html", (value) => HTML_ELEMENT.test(value)],
  ["image/svg+xml", (value) => SVG_ELEMENT.test(value)],
  ["text/plain", acceptsAnyText],
  ["text/css", acceptsAnyText],
  ["text/javascript", acceptsAnyText],
]);

/** undefined means "nothing in src can check this" — the caller must refuse. */
export function findMediaTypeCheck(
  mediaType: string
): MediaTypeCheck | undefined {
  const normalized = mediaType.toLowerCase();
  const exact = EXACT_CHECKS.get(normalized);
  if (exact !== undefined) return exact;
  if (normalized.endsWith("+json")) return isJsonText;
  if (normalized.endsWith("+xml")) return isXmlText;
  if (normalized.startsWith("text/")) return acceptsAnyText;
  return undefined;
}
