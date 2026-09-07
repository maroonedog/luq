// このカテゴリの6プラグインを1つの Builder に載せて、利用者が書くとおりに動かす。
// 1つでもメソッド名が衝突していれば use() の時点で落ちる。
import { Builder } from "../../../../src/index";
import { compareFieldPlugin } from "../../../../src/plugins/compare-field/index";
import { stitchPlugin } from "../../../../src/plugins/stitch/index";
import { transformPlugin } from "../../../../src/plugins/transform/index";
import { fromContextPlugin } from "../../../../src/plugins/from-context/index";
import { readOnlyPlugin } from "../../../../src/plugins/read-only/index";
import { writeOnlyPlugin } from "../../../../src/plugins/write-only/index";

interface Invoice {
  id: string;
  password: string;
  confirm: string;
  price: number;
  quantity: number;
  total: number;
  token: string;
  note: string;
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    password: "hunter2",
    confirm: "hunter2",
    price: 10,
    quantity: 4,
    total: 40,
    token: "t",
    note: "  hi  ",
    ...overrides,
  };
}

const validator = Builder()
  .use(compareFieldPlugin)
  .use(stitchPlugin)
  .use(transformPlugin)
  .use(fromContextPlugin)
  .use(readOnlyPlugin)
  .use(writeOnlyPlugin)
  .for<Invoice>()
  .v("id", (b) => b.string.readOnly())
  .v("token", (b) => b.string.writeOnly())
  .v("confirm", (b) => b.string.compareField("password"))
  .v("total", (b) =>
    b.number.stitch(["price", "quantity"], (values, value) => {
      const price = values["price"];
      const quantity = values["quantity"];
      const expected =
        typeof price === "number" && typeof quantity === "number"
          ? price * quantity
          : Number.NaN;
      return {
        valid: value === expected,
        message: `total must be ${expected}`,
      };
    })
  )
  .v("note", (b) => b.string.transform((value) => value.trim()))
  .v("password", (b) =>
    b.string.fromContext({
      check: (value, context) => ({
        valid: context["weakPasswords"] !== value,
        message: "password is known to be weak",
      }),
    })
  )
  .build();

describe("relational カテゴリ: 6プラグインが同時に載る", () => {
  it("すべて満たす入力は通る", () => {
    expect(validator.validate(makeInvoice()).valid).toBe(true);
  });

  it("それぞれの違反がそれぞれの path で出る", () => {
    const result = validator.validate(
      makeInvoice({ confirm: "no", total: 1 }),
      { abortEarly: false }
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.path).sort()).toEqual([
      "confirm",
      "total",
    ]);
  });

  it("external は同じ1本の経路で全プラグインに届く", () => {
    const result = validator.validate(makeInvoice(), {
      abortEarly: false,
      external: {
        operation: "read",
        isUpdate: true,
        weakPasswords: "hunter2",
      },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    // 読み出しなので writeOnly の token が落ち、readOnly の id は通る。
    expect(result.issues.map((issue) => issue.path).sort()).toEqual([
      "password",
      "token",
    ]);
  });
});

describe("relational カテゴリ: 実行順序は1つだけ", () => {
  it("validate は変換しない / parse だけが変換する", () => {
    const input = makeInvoice();
    const validated = validator.validate(input);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;
    expect(validated.data).toEqual(input);

    const parsed = validator.parse(input);
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.data).toEqual(makeInvoice({ note: "hi" }));
  });

  it("検証が落ちた parse は変換結果を返さない", () => {
    const parsed = validator.parse(makeInvoice({ confirm: "no" }));
    expect(parsed.valid).toBe(false);
  });
});
