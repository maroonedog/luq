import { readFencedCodeBlocks } from "../../../../scripts/catalog/read-fenced-code-blocks";

const FENCE = "```";

describe("readFencedCodeBlocks", () => {
  it("extracts the TypeScript fences and no others", () => {
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

  it("accepts the language aliases", () => {
    const markdown = ["typescript", "tsx", "js", "javascript", "jsx"]
      .map((language) =>
        [`${FENCE}${language}`, "const a = 1;", FENCE].join("\n")
      )
      .join("\n");
    expect(readFencedCodeBlocks(markdown)).toHaveLength(5);
  });

  it("reports the start line 1-based", () => {
    const markdown = ["intro", "", `${FENCE}ts`, "const a = 1;", FENCE].join(
      "\n"
    );
    expect(readFencedCodeBlocks(markdown)[0]?.startLine).toBe(3);
  });

  it("ignores a fence that is never closed", () => {
    const markdown = [`${FENCE}ts`, "const a = 1;"].join("\n");
    expect(readFencedCodeBlocks(markdown)).toEqual([]);
  });

  it("works with CRLF", () => {
    const markdown = [`${FENCE}ts`, "const a = 1;", FENCE].join("\r\n");
    expect(readFencedCodeBlocks(markdown)[0]?.code).toBe("const a = 1;");
  });
});
