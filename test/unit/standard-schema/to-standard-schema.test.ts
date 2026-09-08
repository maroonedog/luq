import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { toStandardSchema } from "../../../src/standard-schema/to-standard-schema";

type Account = {
  name: string;
  age: number;
};

type Order = {
  items: { sku: string }[];
};

function buildAccountSchema() {
  return toStandardSchema(
    Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<Account>()
      .v("name", (b) => b.string.required().min(3))
      .v("age", (b) => b.number.required().min(18))
      .build()
  );
}

describe("toStandardSchema", () => {
  it("仕様の props をすべて持つ", () => {
    const schema = buildAccountSchema();
    expect(schema["~standard"].version).toBe(1);
    expect(schema["~standard"].vendor).toBe("luq");
    expect(typeof schema["~standard"].validate).toBe("function");
  });

  it("元の Validator のメンバーが残る", () => {
    // 片方のためにもう片方を諦めなくてよい、という約束。
    const schema = buildAccountSchema();
    for (const member of ["validate", "parse", "pick", "pickAll"] as const) {
      expect(typeof schema[member]).toBe("function");
    }
  });

  it("有効な値は { value } を返す", () => {
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "John",
      age: 25,
    });
    expect(outcome).toEqual({ value: { name: "John", age: 25 } });
  });

  it("成功時に issues を持たない", () => {
    // 仕様の SuccessResult は issues?: undefined。消費側は issues の有無で分岐する。
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "John",
      age: 25,
    });
    expect("issues" in outcome && outcome.issues !== undefined).toBe(false);
  });

  it("無効な値は issues を返し value を持たない", () => {
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "Jo",
      age: 25,
    });
    expect("value" in outcome).toBe(false);
    if ("issues" in outcome && outcome.issues !== undefined) {
      expect(outcome.issues.length).toBeGreaterThan(0);
    }
  });

  it("path が配列に開かれる", () => {
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "Jo",
      age: 25,
    });
    if (!("issues" in outcome) || outcome.issues === undefined) {
      throw new Error("issues が返っていない");
    }
    expect(outcome.issues[0]?.path).toEqual(["name"]);
  });

  it("message が入る", () => {
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "Jo",
      age: 25,
    });
    if (!("issues" in outcome) || outcome.issues === undefined) {
      throw new Error("issues が返っていない");
    }
    expect(typeof outcome.issues[0]?.message).toBe("string");
    expect(outcome.issues[0]?.message.length).toBeGreaterThan(0);
  });

  it("全フィールドの違反を返す（abortEarly を効かせない）", () => {
    // Luq の既定は最初のフィールドで打ち切るが、この入口はフォームが消費するので
    // 全件返す。1件ずつ出すと「直したら次が出る」UX になる。
    const outcome = buildAccountSchema()["~standard"].validate({
      name: "Jo",
      age: 3,
    });
    if (!("issues" in outcome) || outcome.issues === undefined) {
      throw new Error("issues が返っていない");
    }
    const paths = outcome.issues.map((issue) => JSON.stringify(issue.path));
    expect(paths).toContain(JSON.stringify(["name"]));
    expect(paths).toContain(JSON.stringify(["age"]));
  });

  it("配列要素の path が実インデックスの number になる", () => {
    const schema = toStandardSchema(
      Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Order>()
        .v("items[*].sku", (b) => b.string.required().min(5))
        .build()
    );
    const outcome = schema["~standard"].validate({
      items: [{ sku: "PROD-1" }, { sku: "X" }],
    });
    if (!("issues" in outcome) || outcome.issues === undefined) {
      throw new Error("issues が返っていない");
    }
    expect(outcome.issues.map((issue) => issue.path)).toContainEqual([
      "items",
      1,
      "sku",
    ]);
  });

  it("value は transform 適用後の値（validate ではなく parse を呼んでいる）", () => {
    // ここが validate() 呼び出しに戻ると、transform が無かったことになる。
    const schema = toStandardSchema(
      Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string.required().transform((value) => value.trim())
        )
        .build()
    );
    const outcome = schema["~standard"].validate({ name: "  John  " });
    expect(outcome).toEqual({ value: { name: "John" } });
  });

  it("入力オブジェクトを変更しない", () => {
    const input = { name: "  John  " };
    const snapshot = JSON.stringify(input);
    const schema = toStandardSchema(
      Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string.required().transform((value) => value.trim())
        )
        .build()
    );
    schema["~standard"].validate(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("types は実行時に存在しない（型を運ぶだけのメンバー）", () => {
    const schema = buildAccountSchema();
    expect(schema["~standard"].types).toBeUndefined();
  });
});
