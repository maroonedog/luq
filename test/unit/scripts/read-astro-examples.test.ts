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

/** Writes one .astro file, reads it, and cleans up. */
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
  it("turns escaped backticks and dollars back into their characters", () => {
    expect(unescapeTemplateLiteral("a \\` b \\${x} c")).toBe("a ` b ${x} c");
  });

  it("keeps an escaped backslash-n literal and makes a lone \\n a newline", () => {
    expect(unescapeTemplateLiteral("\\\\n")).toBe("\\n");
    expect(unescapeTemplateLiteral("\\n")).toBe("\n");
  });

  it("turns an unknown escape into the character itself, as JavaScript does", () => {
    expect(unescapeTemplateLiteral("\\d")).toBe("d");
  });
});

describe("hasUnescapedInterpolation", () => {
  it("does not treat an escaped ${ as interpolation", () => {
    expect(hasUnescapedInterpolation("\\${issue.path}")).toBe(false);
  });

  it("treats a raw ${ as interpolation", () => {
    expect(hasUnescapedInterpolation("import { ${symbol} } from 'x';")).toBe(
      true
    );
  });
});

describe("findTemplateLiteralConstants", () => {
  it("extracts a declaration's name, start line and contents", () => {
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

  it("does not close on a backtick inside an interpolation", () => {
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
  it("reads the language from a code block that states one", () => {
    const languages = findCodeBlockLanguages(
      '<CodeBlock code={install} language="bash" />'
    );
    expect(languages.get("install")).toBe("bash");
  });

  it("falls back to the component's default when none is stated", () => {
    const languages = findCodeBlockLanguages("<CodeBlock code={shown} />");
    expect(languages.get("shown")).toBe(DEFAULT_CODE_BLOCK_LANGUAGE);
  });
});

describe("readAstroExampleDirectives", () => {
  const lines = [
    "// luq-example: with base — uses the previous block",
    "// luq-example: must-fail — this must not compile",
    "const example = 1;",
  ];

  it("reads the directives stacked above a declaration together", () => {
    const directives = readAstroExampleDirectives(lines, 3);
    expect(directives.expectation).toBe("must-fail");
    expect(directives.preludeNames).toEqual(["base"]);
    expect(directives.problems).toEqual([]);
  });

  it("makes a directive with no reason a violation", () => {
    const directives = readAstroExampleDirectives(
      ["// luq-example: skip", "const example = 1;"],
      2
    );
    expect(directives.problems.map((one) => one.kind)).toEqual([
      "directiveWithoutReason",
    ]);
  });

  it("makes an unknown word a violation", () => {
    const directives = readAstroExampleDirectives(
      [
        "// luq-example: maybe — for no particular reason",
        "const example = 1;",
      ],
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

  it("checks only the constants displayed as typescript", () => {
    const scan = readOne(
      page(
        "const shown = " + BACKTICK + "const a = 1;" + BACKTICK + ";",
        "const command = " + BACKTICK + "npm install" + BACKTICK + ";",
        "const hidden = " + BACKTICK + "const b = 2;" + BACKTICK + ";"
      )
    );
    expect(scan.examples.map((one) => one.code)).toEqual(["const a = 1;"]);
  });

  it("prepends the named constant's code and records how many lines that was", () => {
    const scan = readOne(
      page(
        "const base = " + BACKTICK + "const a = 1;" + BACKTICK + ";",
        "// luq-example: with base — reads the a declared in the previous block",
        "const shown = " + BACKTICK + "const b = a;" + BACKTICK + ";"
      )
    );
    const withPrelude = scan.examples.find((one) => one.code.includes("b = a"));
    expect(withPrelude?.code).toBe("const a = 1;\nconst b = a;");
    expect(withPrelude?.preludeLineCount).toBe(2);
  });

  it("makes with naming a constant that does not exist a violation", () => {
    const scan = readOne(
      page(
        "// luq-example: with missing — a constant that does not exist",
        "const shown = " + BACKTICK + "const b = 2;" + BACKTICK + ";"
      )
    );
    expect(scan.examples).toEqual([]);
    expect(scan.violations.map((one) => one.kind)).toEqual([
      "unknownDirective",
    ]);
  });

  it("skips an example containing interpolation, directive or not", () => {
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
