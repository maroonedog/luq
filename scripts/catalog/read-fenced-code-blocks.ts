const FENCE = /^```([A-Za-z0-9]*)\s*$/;
const TYPESCRIPT_LANGUAGES = new Set([
  "ts",
  "tsx",
  "typescript",
  "js",
  "jsx",
  "javascript",
]);

export interface FencedCodeBlock {
  readonly language: string;
  readonly startLine: number;
  readonly code: string;
}

/** Markdown のコードフェンスを取り出す。TypeScript/JavaScript のものだけ。 */
export function readFencedCodeBlocks(
  markdown: string
): readonly FencedCodeBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: FencedCodeBlock[] = [];
  let openedAt: number | null = null;
  let language = "";
  let body: string[] = [];
  lines.forEach((line, index) => {
    const fence = FENCE.exec(line);
    if (openedAt === null) {
      if (fence === null) return;
      openedAt = index + 1;
      language = (fence[1] ?? "").toLowerCase();
      body = [];
      return;
    }
    if (fence !== null && (fence[1] ?? "") === "") {
      if (TYPESCRIPT_LANGUAGES.has(language)) {
        blocks.push({ language, startLine: openedAt, code: body.join("\n") });
      }
      openedAt = null;
      return;
    }
    body.push(line);
  });
  return blocks;
}
