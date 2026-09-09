// ===========================================================================
// test/integration/partial-adoption.test.ts
//
// README と docs-site が「既存の型に部分的にパッチできる」と主張している。
// その主張を実行時に固定する。主張だけあってゲートが無いと、実装が変わった
// ときに黙って嘘になる — この種の誇張こそ、このリポジトリが 1.x から
// 引き継がないと決めたものである。
//
// 固定するのは4つ:
//   1. 未宣言のパスは READ すらされない (getter を仕込んで確かめる)
//   2. parse() は未宣言のフィールドをそのまま返す
//   3. pick() は1フィールドだけを判定する
//   4. 型定義には手を入れない (.for<T>() は T をそのまま受ける)
//
// 4つ目は型の話なので実行時テストには乗らない。test/type/ に置かれた
// 否定の型テスト群がその役目を持つ。ここでは 1-3 を見る。
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";

interface Order {
  id: string;
  customerNote: string;
  nested: { deep: number };
}

function buildPartialValidator() {
  return Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .for<Order>()
    .v("id", (b) => b.string.required().min(3))
    .build();
}

describe("a type may be covered one field at a time", () => {
  it("judges the declared field", () => {
    const validator = buildPartialValidator();
    expect(validator.validate({ id: "ab" } as Order).valid).toBe(false);
    expect(validator.validate({ id: "abc" } as Order).valid).toBe(true);
  });

  it("does not require the fields it was not given rules for", () => {
    // README: 「宣言していないパスは検証されず、必須にもならない」
    expect(buildPartialValidator().validate({ id: "abc" } as Order).valid).toBe(
      true
    );
  });

  it("does not even READ an undeclared field", () => {
    // 「読まれない」は「検証されない」より強い主張なので、強いほうを測る。
    // getter を踏んだら記録される。踏まなければ配列は空のまま。
    const touched: string[] = [];
    const subject = {
      id: "abc",
      get customerNote(): string {
        touched.push("customerNote");
        return "anything";
      },
      get nested(): { deep: number } {
        touched.push("nested");
        return { deep: 1 };
      },
    };

    buildPartialValidator().validate(subject as unknown as Order);

    expect(touched).toEqual([]);
  });

  it("hands undeclared fields back from parse() untouched", () => {
    const outcome = buildPartialValidator().parse({
      id: "abc",
      customerNote: "keep me",
      nested: { deep: 7 },
    });
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data.customerNote).toBe("keep me");
    expect(outcome.data.nested.deep).toBe(7);
  });
});

describe("pick() judges one field on its own", () => {
  it("takes the field's own value, not the whole subject", () => {
    const id = buildPartialValidator().pick("id");
    expect(id.validate("ab").valid).toBe(false);
    expect(id.validate("abc").valid).toBe(true);
  });

  it("ignores a sibling the caller did not pick", () => {
    const id = buildPartialValidator().pick("id");
    expect(id.validate("abc", { customerNote: "" } as Order).valid).toBe(true);
  });
});

describe("pickAll() judges a named subset", () => {
  it("reports only the paths it was asked for", () => {
    const subset = buildPartialValidator().pickAll(["id"]);
    const outcome = subset.validate({ id: "ab" } as Order);
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.every((issue) => issue.path === "id")).toBe(true);
  });
});
