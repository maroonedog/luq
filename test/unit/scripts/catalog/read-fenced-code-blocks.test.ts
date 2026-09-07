import { readFencedCodeBlocks } from "../../../../scripts/catalog/read-fenced-code-blocks";

const FENCE = "```";

describe("readFencedCodeBlocks", () => {
  it("TypeScript のフェンスだけを取り出す", () => {
    const markdown = [
      "# title",
      `${FENCE}ts`,
      'import { Builder } from "@maroonedog/luq";',
      FENCE,
      `${FENCE}bash`,
      "npm install",
      FENCE,
      `${FENCE}json`,
      '{ "a": 1 }',
      FENCE,
    ].join("\n");
    const blocks = readFencedCodeBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.language).toBe("ts");
    expect(blocks[0]?.code).toBe('import { Builder } from "@maroonedog/luq";');
  });

  it("言語エイリアスを認める", () => {
    const markdown = ["typescript", "tsx", "js", "javascript", "jsx"]
      .map((language) =>
        [`${FENCE}${language}`, "const a = 1;", FENCE].join("\n")
      )
      .join("\n");
    expect(readFencedCodeBlocks(markdown)).toHaveLength(5);
  });

  it("開始行を1始まりで報告する", () => {
    const markdown = ["intro", "", `${FENCE}ts`, "const a = 1;", FENCE].join(
      "\n"
    );
    expect(readFencedCodeBlocks(markdown)[0]?.startLine).toBe(3);
  });

  it("閉じていないフェンスは無視する", () => {
    const markdown = [`${FENCE}ts`, "const a = 1;"].join("\n");
    expect(readFencedCodeBlocks(markdown)).toEqual([]);
  });

  it("CRLF でも動く", () => {
    const markdown = [`${FENCE}ts`, "const a = 1;", FENCE].join("\r\n");
    expect(readFencedCodeBlocks(markdown)[0]?.code).toBe("const a = 1;");
  });
});
