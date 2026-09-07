// ===========================================================================
// scripts/doc-examples/find-code-block-languages.ts
//
// `<CodeBlock code={xExample} language="bash" />` を読み、定数名から言語への
// 対応を作る。型検査の対象を決めるのはこの言語であって、定数の名前ではない。
//
// 対応の無い定数（どの CodeBlock からも参照されていないもの）は表示されない
// コード例なので、検査対象にしない。language を省いた呼び出しは CodeBlock の
// 既定値と同じ typescript として扱う（docs-site/src/components/CodeBlock.astro）。
// ===========================================================================

/** CodeBlock が language を省かれたときに使う既定値。 */
export const DEFAULT_CODE_BLOCK_LANGUAGE = "typescript";

const CODE_BLOCK_ELEMENT = /<CodeBlock\b([\s\S]*?)\/>/g;
const CODE_PROPERTY = /\bcode=\{([A-Za-z_$][A-Za-z0-9_$]*)\}/;
const LANGUAGE_PROPERTY = /\blanguage="([A-Za-z0-9+-]*)"/;

/**
 * 定数名 -> 言語。同じ定数が2箇所で違う言語で表示されることは無い前提だが、
 * 起きたときは最初の1つを採る（検査対象が増える方向にしか効かない）。
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
