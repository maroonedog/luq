/**
 * Replaces the value of exactly one top-level member of a JSON text, moving
 * no other byte — so package.json keeps its formatting and its key order.
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
    throw new Error(`the JSON has no member "${memberName}".`);
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
      `the value of "${memberName}" is neither an object nor an array.`
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
  throw new Error(`the value of "${memberName}" is not closed.`);
}

function escapeForRegExp(text: string): string {
  return text.replace(/[-.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Renders a value the way JSON.stringify does, fitting the given indent. */
export function renderJsonValue(value: unknown, indentLevel: number): string {
  const rendered = JSON.stringify(value, null, 2);
  const pad = "  ".repeat(indentLevel);
  return rendered.split("\n").join(`\n${pad}`);
}
