// 公開 Builder を通した required の実挙動。宣言ではなく検証結果を見る。
import { Builder } from "../../../../src/index";
import { requiredPlugin } from "../../../../src/plugins/required";
import { nullablePlugin } from "../../../../src/plugins/nullable";
import { optionalPlugin } from "../../../../src/plugins/optional";

type Shape = {
  text: string;
  count: number;
  flag: boolean;
  list: string[];
  nested: Record<string, string>;
};

const validateText = Builder()
  .use(requiredPlugin)
  .for<Shape>()
  .v("text", (b) => b.string.required())
  .build();

function issuesOf(input: Partial<Shape>): readonly string[] {
  const result = validateText.validate(input as Shape);
  return result.valid ? [] : result.issues.map((issue) => issue.code);
}

describe("required: 欠損の定義", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["空文字", ""],
  ])("%s を拒否する", (_label, value) => {
    expect(issuesOf({ text: value as string })).toEqual(["required"]);
  });

  it("キーそのものが無い場合も拒否する", () => {
    expect(issuesOf({})).toEqual(["required"]);
  });

  it("空白のみの文字列は「値がある」として通す", () => {
    expect(issuesOf({ text: " " })).toEqual([]);
  });
});

describe("required: falsy でも値は値", () => {
  const validateAll = Builder()
    .use(requiredPlugin)
    .for<Shape>()
    .v("count", (b) => b.number.required())
    .v("flag", (b) => b.boolean.required())
    .v("list", (b) => b.array.required())
    .v("nested", (b) => b.object.required())
    .build();

  it("0 / false / [] / {} を全て通す", () => {
    const result = validateAll.validate({
      text: "x",
      count: 0,
      flag: false,
      list: [],
      nested: {},
    } as Shape);
    expect(result.valid).toBe(true);
  });
});

describe("required: code とメッセージ", () => {
  it("既定 code はプラグイン名、既定メッセージは `<path> is required`", () => {
    const result = validateText.validate({} as Shape);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "text",
      code: "required",
      message: "text is required",
      severity: "error",
    });
  });

  it("options.code と options.messageFactory を尊重する", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<Shape>()
      .v("text", (b) =>
        b.string.required({
          code: "TEXT_MISSING",
          messageFactory: (context) => `${context.path}/${context.code} 必須`,
        })
      )
      .build();
    const result = validator.validate({} as Shape);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("TEXT_MISSING");
    expect(result.issues[0]?.message).toBe("text/TEXT_MISSING 必須");
  });

  // severity だけが妥当性を決める。warning は issue として出るが値は棄却しない。
  it("options.severity を尊重する", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<Shape>()
      .v("text", (b) => b.string.required({ severity: "warning" }))
      .build();
    const result = validator.validate({} as Shape);
    expect(result.valid).toBe(true);
    expect(result.issues.map((issue) => issue.severity)).toEqual(["warning"]);
  });
});

describe("presence の合成は順序に依存しない", () => {
  function build(order: "required-first" | "nullable-first") {
    return Builder()
      .use(requiredPlugin)
      .use(nullablePlugin)
      .use(optionalPlugin)
      .for<Shape>()
      .v("text", (b) =>
        order === "required-first"
          ? b.string.required().nullable()
          : b.string.nullable().required()
      )
      .build();
  }

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["空文字", ""],
    ["値あり", "abc"],
  ])("%s の判定が両方の並びで一致する", (_label, value) => {
    const first = build("required-first").validate({ text: value } as Shape);
    const second = build("nullable-first").validate({ text: value } as Shape);
    expect(second.valid).toBe(first.valid);
  });

  it("required().nullable() は null を許し undefined を拒否する", () => {
    const validator = build("required-first");
    expect(validator.validate({ text: null } as unknown as Shape).valid).toBe(
      true
    );
    expect(validator.validate({} as Shape).valid).toBe(false);
  });
});
