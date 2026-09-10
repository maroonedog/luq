// ===========================================================================
// scripts/doc-examples/find-code-block-languages.ts
//
// Reads the code-block markup and maps each constant name to its language.
// The language is what decides whether an example is type-checked; the
// constant's name is not.
//
// A constant no code block references is an example nothing displays, so it is
// not checked. A call that omits the language is treated as typescript, which
// is the component's own default.
// ===========================================================================

/** The language the code-block component uses when none is given. */
export const DEFAULT_CODE_BLOCK_LANGUAGE = "typescript";

const CODE_BLOCK_ELEMENT = /<CodeBlock\b([\s\S]*?)\/>/g;
const CODE_PROPERTY = /\bcode=\{([A-Za-z_$][A-Za-z0-9_$]*)\}/;
const LANGUAGE_PROPERTY = /\blanguage="([A-Za-z0-9+-]*)"/;

/**
 * Constant name to language. One constant shown in two languages is not
 * expected; if it happens, the first wins, which can only widen what is
 * checked.
 */
export function findCodeBlockLanguages(
  text: string
): ReadonlyMap<string, string> {
  const languageByName = new Map<string, string>();
  CODE_BLOCK_ELEMENT.lastIndex = 0;
  let element = CODE_BLOCK_ELEMENT.exec(text);
  while (element !== null) {
    const attributes = element[1] ?? "";
    const codeProperty = CODE_PROPERTY.exec(attributes);
    if (codeProperty !== null) {
      const name = codeProperty[1] ?? "";
      const languageProperty = LANGUAGE_PROPERTY.exec(attributes);
      const language = (
        languageProperty?.[1] ?? DEFAULT_CODE_BLOCK_LANGUAGE
      ).toLowerCase();
      if (!languageByName.has(name)) languageByName.set(name, language);
    }
    element = CODE_BLOCK_ELEMENT.exec(text);
  }
  return languageByName;
}
