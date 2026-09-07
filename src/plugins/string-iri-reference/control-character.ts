// ===========================================================================
// L7  src/plugins/string-iri-reference/control-character.ts
// The same code-point scan the IRI plugin uses. A plugin may not import a
// sibling plugin, and eight lines of arithmetic is not a second FORMAT rule.
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
