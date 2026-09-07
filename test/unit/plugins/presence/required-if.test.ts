// requiredIf の実挙動。条件は root と、配列要素なら ArrayItemContext を受け取る。
import { Builder } from "../../../../src/index";
import { requiredIfPlugin } from "../../../../src/plugins/required-if";
import { requiredPlugin } from "../../../../src/plugins/required";

type Order = {
  needsBilling: boolean;
  billingCode: string;
  lines: { kind: string; serial: string }[];
};

const validateOrder = Builder()
  .use(requiredIfPlugin)
  .for<Order>()
  .v("billingCode", (b) =>
    b.string.requiredIf((root) => root.needsBilling === true)
  )
  .build();

function validate(input: Partial<Order>) {
  return validateOrder.validate(input as Order);
}

describe("requiredIf: 条件の評価", () => {
  it("条件が偽なら空文字を通す", () => {
    expect(validate({ needsBilling: false, billingCode: "" }).valid).toBe(true);
  });

  it("条件が真で値が空文字なら弾く", () => {
    const result = validate({ needsBilling: true, billingCode: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "billingCode",
      code: "requiredIf",
      message: "Field is required when condition is met",
      severity: "error",
    });
  });

  it("条件が真でも値があれば通す", () => {
    expect(validate({ needsBilling: true, billingCode: "BC-1" }).valid).toBe(
      true
    );
  });

  it("条件関数には root オブジェクト全体が渡る", () => {
    const seen: unknown[] = [];
    const validator = Builder()
      .use(requiredIfPlugin)
      .for<Order>()
      .v("billingCode", (b) =>
        b.string.requiredIf((root) => {
          seen.push(root);
          return false;
        })
      )
      .build();
    const input = { needsBilling: false, billingCode: "x", lines: [] };
    validator.validate(input);
    expect(seen).toEqual([input]);
  });
});

// 旧実装は条件関数の第2引数 ArrayContext を宣言しながら一度も渡していなかった
// (legacy-spec/plugin-catalog-relational.md「宣言されているが機能していない」)。
describe("requiredIf: 配列要素の文脈が実際に届く", () => {
  const validateLines = Builder()
    .use(requiredIfPlugin)
    .for<Order>()
    .v("lines[*].serial", (b) =>
      b.string.requiredIf(
        (_root, item) => item !== undefined && item.index === 1
      )
    )
    .build();

  it("index 1 の要素だけが必須になる", () => {
    const result = validateLines.validate(
      {
        needsBilling: false,
        billingCode: "x",
        lines: [
          { kind: "a", serial: "" },
          { kind: "b", serial: "" },
        ],
      },
      { abortEarly: false }
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "lines[1].serial",
    ]);
  });

  it("item.item / item.array が要素と配列そのものを指す", () => {
    const captured: { index: number; item: unknown; length: number }[] = [];
    const validator = Builder()
      .use(requiredIfPlugin)
      .for<Order>()
      .v("lines[*].serial", (b) =>
        b.string.requiredIf((_root, item) => {
          if (item !== undefined) {
            captured.push({
              index: item.index,
              item: item.item,
              length: item.array.length,
            });
          }
          return false;
        })
      )
      .build();
    validator.validate({
      needsBilling: false,
      billingCode: "x",
      lines: [{ kind: "a", serial: "s" }],
    });
    expect(captured).toEqual([
      { index: 0, item: { kind: "a", serial: "s" }, length: 1 },
    ]);
  });
});

describe("requiredIf: options", () => {
  it("options.code と options.messageFactory を尊重する", () => {
    const validator = Builder()
      .use(requiredIfPlugin)
      .for<Order>()
      .v("billingCode", (b) =>
        b.string.requiredIf((root) => root.needsBilling, {
          code: "BILLING_REQUIRED",
          messageFactory: (context) =>
            `${context.path} condition=${String(context.condition)}`,
        })
      )
      .build();
    const result = validator.validate({
      needsBilling: true,
      billingCode: "",
      lines: [],
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("BILLING_REQUIRED");
    expect(result.issues[0]?.message).toBe("billingCode condition=true");
  });
});

// 既知のエンジン制約 (報告済み): CheckRule は undefined / null を一度も見ない。
// runField は presence 判定で先に打ち切るため、値が「無い」ケースは
// フィールド自身の presence ポリシー (.required() / .optional()) が決める。
describe("requiredIf: 値が存在しない場合はフィールドの presence が決める", () => {
  it("presence 宣言が無いフィールドでは欠損を捕まえられない", () => {
    expect(validate({ needsBilling: true }).valid).toBe(true);
  });

  it(".required() を併記すれば欠損は required が捕まえる", () => {
    const validator = Builder()
      .use(requiredIfPlugin)
      .use(requiredPlugin)
      .for<Order>()
      .v("billingCode", (b) =>
        b.string.required().requiredIf((root) => root.needsBilling)
      )
      .build();
    const result = validator.validate({ needsBilling: true } as Order);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("required");
  });
});
