import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  findCodeBlockLanguages,
  DEFAULT_CODE_BLOCK_LANGUAGE,
} from "../../../scripts/doc-examples/find-code-block-languages";
import {
  findTemplateLiteralConstants,
  hasUnescapedInterpolation,
  unescapeTemplateLiteral,
} from "../../../scripts/doc-examples/find-template-literal-constants";
import { readAstroExampleDirectives } from "../../../scripts/doc-examples/read-astro-directives";
import { readAstroExamples } from "../../../scripts/doc-examples/read-astro-examples";

const BACKTICK = "`";

/** 1つの .astro を書いて読み、後片付けする。 */
function withAstroFile<T>(body: string, read: (root: string) => T): T {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "luq-astro-examples-"));
  try {
    fs.writeFileSync(path.join(root, "page.astro"), body, "utf8");
    return read(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function readOne(body: string) {
  return withAstroFile(body, (root) =>
    readAstroExamples(root, path.join(root, "page.astro"))
  );
}

describe("unescapeTemplateLiteral", () => {
  it("backtick と $ のエスケープを実行時の文字に戻す", () => {
    expect(unescapeTemplateLiteral("a \\` b \\${x} c")).toBe("a ` b ${x} c");
  });

  it("\\\\n は backslash + n のまま、単独の \\n は改行になる", () => {
    expect(unescapeTemplateLiteral("\\\\n")).toBe("\\n");
    expect(unescapeTemplateLiteral("\\n")).toBe("\n");
  });

  it("未知のエスケープは文字そのものになる (JavaScript の規則)", () => {
    expect(unescapeTemplateLiteral("\\d")).toBe("d");
  });
});

describe("hasUnescapedInterpolation", () => {
  it("エスケープされた ${ は補間ではない", () => {
    expect(hasUnescapedInterpolation("\\${issue.path}")).toBe(false);
  });

  it("生の ${ は補間である", () => {
    expect(hasUnescapedInterpolation("import { ${symbol} } from 'x';")).toBe(
      true
    );
  });
});

describe("findTemplateLiteralConstants", () => {
  it("宣言の名前・開始行・中身を取り出す", () => {
    const source = ["const first = " + BACKTICK + "a", "b" + BACKTICK + ";"];
    const found = findTemplateLiteralConstants(source.join("\n"));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      name: "first",
      startLine: 1,
      code: "a\nb",
      hasInterpolation: false,
    });
  });

  it("補間の内側の backtick で閉じたことにしない", () => {
    const source =
      "const a = " +
      BACKTICK +
      "x${ " +
      BACKTICK +
      "inner" +
      BACKTICK +
      " }y" +
      BACKTICK +
      ";\nconst b = " +
      BACKTICK +
      "z" +
      BACKTICK +
      ";";
    const found = findTemplateLiteralConstants(source);
    expect(found.map((one) => one.name)).toEqual(["a", "b"]);
    expect(found[0]?.hasInterpolation).toBe(true);
    expect(found[1]?.code).toBe("z");
  });
});

describe("findCodeBlockLanguages", () => {
  it("language を書いた CodeBlock からその言語を読む", () => {
    const languages = findCodeBlockLanguages(
      '<CodeBlock code={install} language="bash" />'
    );
    expect(languages.get("install")).toBe("bash");
  });

  it("language 省略時は CodeBlock の既定値になる", () => {
    const languages = findCodeBlockLanguages("<CodeBlock code={shown} />");
    expect(languages.get("shown")).toBe(DEFAULT_CODE_BLOCK_LANGUAGE);
  });
});

describe("readAstroExampleDirectives", () => {
  const lines = [
    "// luq-example: with base — 前のブロックを使う",
    "// luq-example: must-fail — 通ってはならない",
    "const example = 1;",
  ];

  it("宣言の上に積んだディレクティブをまとめて読む", () => {
    const directives = readAstroExampleDirectives(lines, 3);
    expect(directives.expectation).toBe("must-fail");
    expect(directives.preludeNames).toEqual(["base"]);
    expect(directives.problems).toEqual([]);
  });

  it("理由の無いディレクティブは違反になる", () => {
    const directives = readAstroExampleDirectives(
      ["// luq-example: skip", "const example = 1;"],
      2
    );
    expect(directives.problems.map((one) => one.kind)).toEqual([
      "directiveWithoutReason",
    ]);
  });

  it("未知の語は違反になる", () => {
    const directives = readAstroExampleDirectives(
      ["// luq-example: maybe — なんとなく", "const example = 1;"],
      2
    );
    expect(directives.problems.map((one) => one.kind)).toEqual([
      "unknownDirective",
    ]);
  });
});

describe("readAstroExamples", () => {
  function page(...frontmatterLines: readonly string[]): string {
    return [
      "---",
      ...frontmatterLines,
      "---",
      '<CodeBlock code={shown} language="typescript" />',
      '<CodeBlock code={command} language="bash" />',
      '<CodeBlock code={base} language="typescript" />',
      "",
    ].join("\n");
  }

  it("typescript として表示される定数だけを検査対象にする", () => {
    const scan = readOne(
      page(
        "const shown = " + BACKTICK + "const a = 1;" + BACKTICK + ";",
        "const command = " + BACKTICK + "npm install" + BACKTICK + ";",
        "const hidden = " + BACKTICK + "const b = 2;" + BACKTICK + ";"
      )
    );
    expect(scan.examples.map((one) => one.code)).toEqual(["const a = 1;"]);
  });

  it("with は指した定数のコードを前置きし、その行数を記録する", () => {
    const scan = readOne(
      page(
        "const base = " + BACKTICK + "const a = 1;" + BACKTICK + ";",
        "// luq-example: with base — 前のブロックで宣言した a を読む",
        "const shown = " + BACKTICK + "const b = a;" + BACKTICK + ";"
      )
    );
    const withPrelude = scan.examples.find((one) => one.code.includes("b = a"));
    expect(withPrelude?.code).toBe("const a = 1;\nconst b = a;");
    expect(withPrelude?.preludeLineCount).toBe(2);
  });

  it("with が存在しない定数を指したら違反になる", () => {
    const scan = readOne(
      page(
        "// luq-example: with missing — 存在しない定数",
        "const shown = " + BACKTICK + "const b = 2;" + BACKTICK + ";"
      )
    );
    expect(scan.examples).toEqual([]);
    expect(scan.violations.map((one) => one.kind)).toEqual([
      "unknownDirective",
    ]);
  });

  it("補間を含む例はディレクティブ無しでも skip になる", () => {
    const scan = readOne(
      page(
        "const shown = " +
          BACKTICK +
          "import { ${name} } from 'x';" +
          BACKTICK +
          ";"
      )
    );
    expect(scan.examples.map((one) => one.expectation)).toEqual(["skip"]);
  });
});
