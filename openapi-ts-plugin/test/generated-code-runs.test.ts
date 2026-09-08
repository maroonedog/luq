// 生成器の本番テスト。
//
// 「文字列が期待どおりか」は前のファイルで見た。ここで見るのは
// **出したコードが本当にコンパイルして、本当に検証するか**。
// これが無いと、綺麗な文字列を出す壊れた生成器を作れてしまう。
//
// 生成物を一時ファイルに書き、本物の tsc に通し、本物の ts-node で実行する。
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { generateValidatorModule } from "../src/generate/generate-validator-module";
import type { Draft07Schema } from "../../src/json-schema/draft07.types";

const REPOSITORY_ROOT = join(__dirname, "..", "..");
const TSC = join(REPOSITORY_ROOT, "node_modules", "typescript", "bin", "tsc");

const SCHEMA: Draft07Schema = {
  type: "object",
  required: ["id", "customer"],
  properties: {
    id: { type: "string", format: "uuid" },
    customer: {
      type: "object",
      required: ["email"],
      properties: {
        name: { type: "string", minLength: 2 },
        email: { type: "string", format: "email" },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { sku: { type: "string", minLength: 3 } },
      },
    },
  },
};

/** 生成物が参照する型。実際は openapi-typescript が書くもの。 */
const TYPE_SOURCE = `export type Order = {
  id: string;
  customer: { name?: string; email: string };
  items?: { sku?: string }[];
};
`;

/** サブパス名 (stringMin) からディレクトリ名 (string-min) へ。 */
function toDirectoryName(subpathName: string): string {
  return subpathName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * 生成物の import 元を、公開サブパスからリポジトリの src へ向け直す。
 * 一時ディレクトリからは "@maroonedog/luq" を解決できないため。
 * **書き換えるのは import 元だけで、生成されたチェーンには一切触れない。**
 * 公開時は package.json の exports がこの対応を吸収する。
 */
function rewireToSource(source: string): string {
  const root = REPOSITORY_ROOT.split("\\").join("/");
  return source
    .split('"@maroonedog/luq/plugins/')
    .join(`"${root}/src/plugins/`)
    .split('"@maroonedog/luq"')
    .join(`"${root}/src/index"`)
    .replace(
      /\/src\/plugins\/([A-Za-z]+)"/g,
      (_whole, name: string) => `/src/plugins/${toDirectoryName(name)}"`
    );
}

function withGeneratedProject<T>(
  run: (directory: string, generated: string) => T
): T {
  const directory = mkdtempSync(join(tmpdir(), "luq-codegen-"));
  try {
    const { source } = generateValidatorModule(SCHEMA, {
      validatorName: "validateOrder",
      typeExpression: "Order",
      typeImport: 'import type { Order } from "./order-type";',
    });
    const rewired = rewireToSource(source);
    writeFileSync(join(directory, "order-type.ts"), TYPE_SOURCE, "utf8");
    writeFileSync(join(directory, "validator.ts"), rewired, "utf8");
    return run(directory, rewired);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("生成したコードは本当にコンパイルする", () => {
  it("tsc --strict を通る", () => {
    withGeneratedProject((directory) => {
      const output = execFileSync(
        process.execPath,
        [
          TSC,
          "--noEmit",
          "--strict",
          "--target",
          "ES2020",
          "--moduleResolution",
          "bundler",
          "--module",
          "ESNext",
          "--skipLibCheck",
          join(directory, "validator.ts"),
        ],
        { encoding: "utf8", cwd: REPOSITORY_ROOT, stdio: ["ignore", "pipe", "pipe"] }
      );
      expect(output.trim()).toBe("");
    });
  }, 120_000);
});

describe("生成したコードは本当に検証する", () => {
  it("有効な値を通し、無効な値を落とす", () => {
    // 生成物をそのまま実行する。チェーンの組み立てが間違っていれば
    // ここで例外になるか、判定が合わない。
    const { source } = generateValidatorModule(SCHEMA, {
      validatorName: "validateOrder",
      typeExpression: "Record<string, unknown>",
    });

    const directory = mkdtempSync(join(tmpdir(), "luq-codegen-run-"));
    try {
      const resolved = rewireToSource(source);
      const entry = join(directory, "run.ts");
      writeFileSync(
        entry,
        `${resolved}\nconst good = validateOrder.validate({ id: "3f2b1c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d", customer: { email: "a@b.co" } });\n` +
          `const bad = validateOrder.validate({ id: "not-a-uuid", customer: { email: "nope" } }, { abortEarly: false });\n` +
          `console.log(JSON.stringify({ good: good.valid, bad: bad.valid, paths: bad.valid ? [] : bad.issues.map((i) => i.path).sort() }));\n`,
        "utf8"
      );
      const output = execFileSync(
        process.execPath,
        [
          join(REPOSITORY_ROOT, "node_modules", "ts-node", "dist", "bin.js"),
          "--transpile-only",
          "--compiler-options",
          JSON.stringify({ module: "commonjs", target: "ES2020", esModuleInterop: true }),
          entry,
        ],
        { encoding: "utf8", cwd: REPOSITORY_ROOT, stdio: ["ignore", "pipe", "pipe"] }
      );
      const verdict = JSON.parse(output.trim()) as {
        good: boolean;
        bad: boolean;
        paths: string[];
      };
      expect(verdict.good).toBe(true);
      expect(verdict.bad).toBe(false);
      expect(verdict.paths).toContain("id");
      expect(verdict.paths).toContain("customer.email");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
