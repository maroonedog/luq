// ===========================================================================
// scripts/doc-examples/find-template-literal-constants.ts
//
// Extracts `const xExample = ` plus a template literal from Astro
// frontmatter. Every code example on the site is written that way, and the
// markup only references it, so this is the one place an example is defined.
//
// The literal is not cut with a regular expression, because examples contain
// `${...}` interpolation and escaped backticks — a message-factory example is
// exactly that. The closing position is found by walking from the opening
// backtick one character at a time.
// ===========================================================================

/** One template-literal constant in the frontmatter. `startLine` is 1-based. */
export interface TemplateLiteralConstant {
  readonly name: string;
  readonly startLine: number;
  readonly code: string;
  /**
   * Whether it holds an unescaped `${`. If it does, the code is only settled
   * at build time and cannot be statically type-checked.
   */
  readonly hasInterpolation: boolean;
}

const DECLARATION = /^const ([A-Za-z_$][A-Za-z0-9_$]*) = `/gm;

/** Skips over the inside of `${`, counting nested braces and template literals. */
function skipInterpolation(text: string, openBraceIndex: number): number {
  let depth = 0;
  let index = openBraceIndex;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") {
      index = skipTemplateLiteral(text, index);
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return text.length;
}

/** Takes the opening backtick's position, returns the one past the closing backtick. */
function skipTemplateLiteral(text: string, openIndex: number): number {
  let index = openIndex + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") return index + 1;
    if (character === "$" && text[index + 1] === "{") {
      index = skipInterpolation(text, index + 1);
      continue;
    }
    index += 1;
  }
  return text.length;
}

const SINGLE_CHARACTER_ESCAPES: Readonly<Record<string, string>> = {
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
};

/**
 * Turns the escapes written in the source back into the characters they
 * produce at run time. Without this the extracted code keeps its backslashes
 * and the type check fails on an invalid character — a failure that has
 * nothing to do with the example. An unknown escape becoming the character
 * itself follows the JavaScript rule.
 */
export function unescapeTemplateLiteral(source: string): string {
  let unescaped = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? "";
    if (character !== "\\") {
      unescaped += character;
      index += 1;
      continue;
    }
    const escaped = source[index + 1] ?? "";
    unescaped += SINGLE_CHARACTER_ESCAPES[escaped] ?? escaped;
    index += 2;
  }
  return unescaped;
}

/** Skips escapes, looking only for whether a raw `${` is present. */
export function hasUnescapedInterpolation(rawBody: string): boolean {
  let index = 0;
  while (index < rawBody.length) {
    if (rawBody[index] === "\\") {
      index += 2;
      continue;
    }
    if (rawBody[index] === "$" && rawBody[index + 1] === "{") return true;
    index += 1;
  }
  return false;
}

function countLinesBefore(text: string, index: number): number {
  let lines = 1;
  for (let position = 0; position < index; position += 1) {
    if (text[position] === "\n") lines += 1;
  }
  return lines;
}

/**
 * Collects every `const NAME = ` plus backtick at the start of a line. Only
 * at the start of a line, because the target is declarations directly in the
 * frontmatter; an indented one inside a function is not collected.
 */
export function findTemplateLiteralConstants(
  text: string
): readonly TemplateLiteralConstant[] {
  const found: TemplateLiteralConstant[] = [];
  DECLARATION.lastIndex = 0;
  let match = DECLARATION.exec(text);
  while (match !== null) {
    const name = match[1] ?? "";
    const openIndex = match.index + match[0].length - 1;
    const endIndex = skipTemplateLiteral(text, openIndex);
    const rawBody = text.slice(
      openIndex + 1,
      Math.max(openIndex + 1, endIndex - 1)
    );
    found.push({
      name,
      startLine: countLinesBefore(text, match.index),
      code: unescapeTemplateLiteral(rawBody),
      hasInterpolation: hasUnescapedInterpolation(rawBody),
    });
    DECLARATION.lastIndex = endIndex;
    match = DECLARATION.exec(text);
  }
  return found;
}
