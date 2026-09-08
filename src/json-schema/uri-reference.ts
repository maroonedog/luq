// ===========================================================================
// L8  src/json-schema/uri-reference.ts — `$id` と `$ref` の URI 演算。
//
// Draft-07 §8.2 の `$id` はベース URI を立て、`$ref` はその上で解決される。
// つまり `$ref` は「文書内のポインタ」ではなく **URI 参照** であり、
// 同じ文字列でも、どの `$id` の下に書かれたかで別の場所を指す。
//
// 解決は WHATWG URL に任せる。RFC 3986 §5.3 を手で書き直しても、
// パーセント符号化・ドットセグメント・スキーム相対 (`//host/x`) の三つで
// 必ずずれる — そして URL はブラウザにも Node にもある標準グローバルで、
// eval も new Function も使わない (check:no-dynamic-code が見ている)。
//
// ネットワークには**触れない**。ここにあるのは文字列演算だけで、
// 解決した URI をどう手に入れるかは呼び出し側の責任である
// (schema-registry.ts の externalDocuments)。スキーマが書いた URI で
// このプロセスがソケットを開くことは無い。
// ===========================================================================

/** A URI with its fragment split off. `resource` is what identifies a document. */
export interface SplitUri {
  readonly resource: string;
  /** Without the leading "#". Empty when the URI carries no fragment. */
  readonly fragment: string;
}

export function splitUri(uri: string): SplitUri {
  const hash = uri.indexOf("#");
  if (hash < 0) return { resource: uri, fragment: "" };
  return { resource: uri.slice(0, hash), fragment: uri.slice(hash + 1) };
}

// RFC 3986 §3.1: scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) ":".
// Scanned by code point rather than matched by a regex, because
// test/unit/json-schema/core/format-map.test.ts forbids a character class
// anywhere in this layer — 1.x grew a second and a third format table that
// way, and the rule that prevents it is worth more than the two lines it costs.
const COLON = 58;
const PLUS = 43;
const HYPHEN = 45;
const DOT = 46;

function isLetter(code: number): boolean {
  return (code > 64 && code < 91) || (code > 96 && code < 123);
}

function isDigit(code: number): boolean {
  return code > 47 && code < 58;
}

function isSchemeChar(code: number): boolean {
  return (
    isLetter(code) ||
    isDigit(code) ||
    code === PLUS ||
    code === HYPHEN ||
    code === DOT
  );
}

/** True when the reference names its own scheme, so no base is needed. */
function isAbsolute(reference: string): boolean {
  if (reference.length === 0 || !isLetter(reference.charCodeAt(0))) {
    return false;
  }
  for (let index = 1; index < reference.length; index += 1) {
    const code = reference.charCodeAt(index);
    if (code === COLON) return true;
    if (!isSchemeChar(code)) return false;
  }
  return false;
}

/**
 * `reference` resolved against `base`, both as written in the document.
 *
 * A base that is not itself absolute cannot resolve anything — that is the
 * document that declared no `$id`, and it is the common case — so the
 * reference is returned unchanged rather than guessed at. Callers then look
 * the reference up verbatim, which is exactly what a local `#/...` pointer
 * needs.
 */
export function resolveUriReference(base: string, reference: string): string {
  if (base === "" || !isAbsolute(base)) {
    return isAbsolute(reference) ? normalizeUri(reference) : reference;
  }
  try {
    return new URL(reference, base).href;
  } catch {
    return reference;
  }
}

/** The same normalisation resolution applies, for a URI used as a KEY. */
export function normalizeUri(uri: string): string {
  if (!isAbsolute(uri)) return uri;
  try {
    return new URL(uri).href;
  } catch {
    return uri;
  }
}

/**
 * The base URI in force inside a node that declares `$id`.
 *
 * `$id: "#name"` is an ANCHOR, not a base: §8.2.3 gives it a plain-name
 * fragment, and the base stays whatever it was. Treating it as a base would
 * silently move every `$ref` written next to it.
 */
export function nextBaseUri(base: string, id: string | undefined): string {
  if (id === undefined || id === "" || id.startsWith("#")) return base;
  return resolveUriReference(base, id);
}

/** The anchor `$id` declares, if it declares one: `"#name"` -> `"name"`. */
export function readAnchor(id: string | undefined): string | undefined {
  if (id === undefined || !id.startsWith("#") || id.length === 1) {
    return undefined;
  }
  const anchor = id.slice(1);
  // A pointer fragment is not an anchor; `#/a/b` names a location.
  return anchor.startsWith("/") ? undefined : anchor;
}
