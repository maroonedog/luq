/**
 * JSON テキストのトップレベルメンバ1件の値だけを差し替える。
 * 他のバイトは1文字も動かさない (package.json の整形や項目順を壊さないため)。
 */
export function spliceJsonMember(
  sourceText: string,
  memberName: string,
  replacementValue: string
): string {
  const keyPattern = new RegExp(
    `"${escapeForRegExp(memberName)}"[ \\t\\r\\n]*:[ \\t\\r\\n]*`
  );
  const keyMatch = keyPattern.exec(sourceText);
  if (keyMatch === null) {
    throw new Error(`JSON にメンバ "${memberName}" がありません。`);
  }
  const valueStart = keyMatch.index + keyMatch[0].length;
  const valueEnd = findValueEnd(sourceText, valueStart, memberName);
  return (
    sourceText.slice(0, valueStart) +
    replacementValue +
    sourceText.slice(valueEnd)
  );
}

function findValueEnd(
  sourceText: string,
  valueStart: number,
  memberName: string
): number {
  const opener = sourceText[valueStart];
  if (opener !== "{" && opener !== "[") {
    throw new Error(
      `メンバ "${memberName}" の値がオブジェクトでも配列でもありません。`
    );
  }
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = valueStart; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === opener) depth += 1;
    else if (character === closer) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  throw new Error(`メンバ "${memberName}" の値が閉じていません。`);
}

function escapeForRegExp(text: string): string {
  return text.replace(/[-.*+?^${}()|[\]\\]/g, "\\$&");
}

/** JSON.stringify と同じ整形で、指定インデントの中に収まる値テキストを作る。 */
export function renderJsonValue(value: unknown, indentLevel: number): string {
  const rendered = JSON.stringify(value, null, 2);
  const pad = "  ".repeat(indentLevel);
  return rendered.split("\n").join(`\n${pad}`);
}
