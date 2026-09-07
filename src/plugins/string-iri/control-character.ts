// ===========================================================================
// L7  src/plugins/string-iri/control-character.ts
// Scanned by code point rather than by a regex character class: a class
// containing raw control characters is unreadable in a diff and lint bans it.
// ===========================================================================
const HIGHEST_CONTROL_OR_SPACE = 0x20;
const DELETE_CHARACTER = 0x7f;

export function hasControlOrSpace(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code === undefined) continue;
    if (code <= HIGHEST_CONTROL_OR_SPACE || code === DELETE_CHARACTER) {
      return true;
    }
  }
  return false;
}
