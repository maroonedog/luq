// ===========================================================================
// L4  src/compile/declared-child-keys.ts
// Fills RuleBuildContext.declaredSiblingKeys.
//
// The index is derived from the declared PATH STRINGS and from nothing else:
// no value is inspected, no plugin is consulted, and no plugin is known by
// name. objectAdditionalProperties defaults to this list, and an explicit
// `allowedProperties` argument wins over it.
//
// Every array is FROZEN. `readonly` is erased at run time, and an unfrozen
// shared array was in fact mutated by a plugin's build() in the proof, which
// silently changed what a LATER field considered a declared key.
// ===========================================================================
import { parseFieldPath } from "../path/parse-field-path";

/** The parent path of a top-level declaration. Not a legal declared path. */
export const ROOT_PATH = "";

const NO_KEYS: readonly string[] = Object.freeze([]);

/** Answers "which child object keys were declared directly under this path". */
export type DeclaredChildKeysReader = (parentPath: string) => readonly string[];

/**
 * Every path is parsed by the ONE parser, so a malformed declaration is
 * rejected here at build time rather than producing an empty key list that a
 * plugin would then read as "this object declares nothing".
 *
 * Ancestors count. `user.profile.name` alone declares `profile` under `user`
 * and `name` under `user.profile`, because both facts are visible in the
 * string. A wildcard contributes no key: the members of `items[*]` have an
 * index, not a name, which is exactly what leafKeyOf's null means.
 */
export function indexDeclaredChildKeys(
  paths: readonly string[]
): DeclaredChildKeysReader {
  const keysByParent = new Map<string, string[]>();
  for (const path of paths) recordDeclaredPath(path, keysByParent);
  const frozen = new Map<string, readonly string[]>();
  for (const [parentPath, keys] of keysByParent) {
    frozen.set(parentPath, Object.freeze(keys.slice()));
  }
  return (parentPath) => frozen.get(parentPath) ?? NO_KEYS;
}

/**
 * ROOT_PATH is the SUBJECT itself, not a child of anything, so it contributes
 * no key — and it must not reach the parser, which refuses the empty string.
 * Asking `childKeysOf(ROOT_PATH)` still answers the top-level declared keys,
 * which is what a root-level `additionalProperties: false` needs.
 */
function recordDeclaredPath(path: string, into: Map<string, string[]>): void {
  if (path === ROOT_PATH) return;
  let prefix = ROOT_PATH;
  for (const segment of parseFieldPath(path)) {
    if (segment.kind === "each") {
      prefix += "[*]";
      continue;
    }
    appendChildKey(into, prefix, segment.key);
    prefix = prefix === ROOT_PATH ? segment.key : `${prefix}.${segment.key}`;
  }
}

/** First declaration wins on order; a repeated key is recorded once. */
function appendChildKey(
  into: Map<string, string[]>,
  parentPath: string,
  key: string
): void {
  const declared = into.get(parentPath);
  if (declared === undefined) {
    into.set(parentPath, [key]);
    return;
  }
  if (!declared.includes(key)) declared.push(key);
}
