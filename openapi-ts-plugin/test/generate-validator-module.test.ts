// 生成器のテスト。
//
// 一番大事なのは「出た文字列が期待どおりか」ではなく「出たコードが本当に
// コンパイルして動くか」なので、最後にそれを見る。文字列だけを見ていると、
// 綺麗な文字列を出す壊れた生成器を作れてしまう。
import { generateValidatorModule } from "../src/generate/generate-validator-module";
import type { Draft07Schema } from "../../src/json-schema/draft07.types";

const ORDER_SCHEMA: Draft07Schema = {
  type: "object",
  required: ["id", "customer"],
  properties: {
    id: { type: "string", format: "uuid" },
    customer: {
      type: "object",
      required: ["email"],
      properties: {
        name: { type: "string", minLength: 2, maxLength: 50 },
        email: { type: "string", format: "email" },
      },
    },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["sku"],
        properties: {
          sku: { type: "string", pattern: "^SKU-" },
          quantity: { type: "integer", minimum: 1 },
        },
      },
    },
  },
};

function generate(schema: Draft07Schema = ORDER_SCHEMA) {
  return generateValidatorModule(schema, {
    validatorName: "validateOrder",
    typeExpression: "Order",
  });
}

describe("generateValidatorModule", () => {
  it("Builder の連鎖を出す", () => {
    const { source } = generate();
    expect(source).toContain("export const validateOrder = Builder()");
    expect(source).toContain(".for<Order>()");
    expect(source).toContain(".build();");
  });

  it("required なフィールドは required、そうでなければ optional", () => {
    const { source } = generate();
    expect(source).toContain('.v("id", (b) => b.string.required()');
    expect(source).toContain('.v("customer.name", (b) => b.string.optional()');
  });

  it("祖先がすべて必須なネストした required は required になる", () => {
    // customer はルートの required にあるので、customer.email は
    // 「親ごと不在」にならない。したがって .required() が実行時と一致する。
    const { source } = generate();
    expect(source).toContain('.v("customer.email", (b) => b.string.required()');
  });

  it("祖先が必須でなければ optional にし、理由を報告する", () => {
    // 実行時 (declare-required-properties.ts) は required をオブジェクト側の
    // 規則にしている。子に .required() を書くと親ごと不在のときに誤って落ち、
    // Draft-07 の「存在する値にしかサブスキーマを適用しない」に反する。
    const { source, skipped } = generateValidatorModule(
      {
        type: "object",
        properties: {
          profile: {
            type: "object",
            required: ["nickname"],
            properties: { nickname: { type: "string" } },
          },
        },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    expect(source).toContain('.v("profile.nickname", (b) => b.string.optional()');
    const reported = skipped.find(
      (entry) => entry.path === "profile.nickname" && entry.keyword === "required"
    );
    expect(reported?.reason).toContain("親ごと不在");
  });

  it("format をメソッドに落とす", () => {
    const { source } = generate();
    expect(source).toContain(".uuid()");
    expect(source).toContain(".email()");
  });

  it("数値・文字列・配列の制約をメソッドに落とす", () => {
    const { source } = generate();
    expect(source).toContain(".min(2)");
    expect(source).toContain(".max(50)");
    expect(source).toContain('.pattern("^SKU-")');
    expect(source).toContain(".min(1)");
    expect(source).toContain(".minLength(1)");
  });

  it("配列要素はワイルドカードのパスになる", () => {
    const { source } = generate();
    expect(source).toContain('.v("items[*].sku"');
    expect(source).toContain('.v("items[*].quantity"');
  });

  it("integer は number スロットに寄せる", () => {
    const { source } = generate();
    expect(source).toContain('.v("items[*].quantity", (b) => b.number');
  });

  it("使ったプラグインだけを import して use する", () => {
    const { source, pluginExports } = generate();
    for (const name of pluginExports) {
      expect(source).toContain(`import { ${name} } from`);
      expect(source).toContain(`.use(${name})`);
    }
    // 使っていないものは入らない。ここが緩むと生成物が全部入りになる。
    expect(source).not.toContain("stringIpv4Plugin");
    expect(source).not.toContain("arrayUniquePlugin");
  });

  it("import は @maroonedog/luq のサブパスから引く", () => {
    const { source } = generate();
    expect(source).toContain('from "@maroonedog/luq/plugins/required"');
    expect(source).toContain('from "@maroonedog/luq/plugins/stringEmail"');
    expect(source).not.toContain('from "@maroonedog/luq/plugins"');
  });

  it("キーワードの順序が変わっても出力は変わらない", () => {
    // スキーマの書き方で差分がノイズになるのを防ぐ。
    const reordered: Draft07Schema = {
      properties: (ORDER_SCHEMA as { properties: unknown }).properties,
      required: ["id", "customer"],
      type: "object",
    } as Draft07Schema;
    expect(generate(reordered).source).toBe(generate().source);
  });

  it("同じ入力なら同じ出力（冪等）", () => {
    expect(generate().source).toBe(generate().source);
  });
});

describe("落としたキーワードを黙らせない", () => {
  it("対応が無いキーワードを skipped で返す", () => {
    const { skipped } = generateValidatorModule(
      {
        type: "object",
        properties: { name: { type: "string", contentEncoding: "base64" } },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    const encodings = skipped.filter((entry) => entry.keyword === "contentEncoding");
    expect(encodings).toHaveLength(1);
    expect(encodings[0]?.reason).toContain("対応するチェーンメソッドが無い");
  });

  it("落としたものを生成物のコメントにも書く", () => {
    const { source } = generateValidatorModule(
      {
        type: "object",
        properties: { name: { type: "string", contentEncoding: "base64" } },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    expect(source).toContain("規則にしなかったキーワード");
    expect(source).toContain("contentEncoding");
  });

  it("注釈キーワードは落とすが、理由は「検証しない」と書く", () => {
    const { skipped } = generateValidatorModule(
      {
        type: "object",
        properties: { name: { type: "string", description: "the name" } },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    const described = skipped.find((entry) => entry.keyword === "description");
    expect(described?.reason).toContain("検証しない");
  });

  it("uniqueItems: false は制約として出さない", () => {
    const { source, skipped } = generateValidatorModule(
      {
        type: "object",
        properties: { tags: { type: "array", uniqueItems: false } },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    expect(source).not.toContain(".unique()");
    expect(skipped.some((entry) => entry.keyword === "uniqueItems")).toBe(true);
  });
});
