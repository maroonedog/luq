// stitch は1つだけ。旧実装の3実装 (stitch / stitch-typed / stitchSimple) が
// 提供していた呼び出し形を、この1つが実際に受けて動くことを確かめる。
import { Builder } from "../../../../src/index";
import { stitchPlugin } from "../../../../src/plugins/stitch/index";
import type {
  StitchFieldValues,
  StitchFieldsOf,
} from "../../../../src/plugins/stitch/index";

interface Order {
  price: number;
  quantity: number;
  total: number;
  customer: { tier: string };
  note: string;
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    price: 100,
    quantity: 3,
    total: 300,
    customer: { tier: "gold" },
    note: "",
    ...overrides,
  };
}

/** PickPaths が組み立てる型に、呼び出し側のガードで絞る (alternative 2)。 */
type PriceAndQuantity = StitchFieldsOf<Order, ["price", "quantity"]>;

function isPriceAndQuantity(
  values: StitchFieldValues
): values is PriceAndQuantity {
  return (
    typeof values["price"] === "number" &&
    typeof values["quantity"] === "number"
  );
}

describe("stitch: 宣言したパスの値が束ねて渡る", () => {
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("total", (b) =>
      b.number.stitch(["price", "quantity"], (values, value) => {
        if (!isPriceAndQuantity(values)) {
          return { valid: false, message: "price と quantity が数値ではない" };
        }
        const expected = values.price * values.quantity;
        return {
          valid: value === expected,
          message: `Expected ${expected}, got ${String(value)}`,
        };
      })
    )
    .build();

  it("計算が合えば通る", () => {
    expect(validator.validate(makeOrder()).valid).toBe(true);
  });

  it("合わなければ落ち、check が返した message がそのまま出る", () => {
    const result = validator.validate(makeOrder({ total: 42 }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.path).toBe("total");
    expect(result.issues[0]?.code).toBe("stitch");
    expect(result.issues[0]?.message).toBe("Expected 300, got 42");
  });

  it("ガードが弾く形の入力でもエンジンは落ちない", () => {
    const result = validator.validate({
      ...makeOrder(),
      price: "100",
    } as unknown as Order);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("price と quantity が数値ではない");
  });
});

describe("stitch: 型を持たない素の呼び出し形 (旧 stitchSimple 相当)", () => {
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("note", (b) =>
      b.string.stitch(["customer.tier"], (values) => ({
        valid: values["customer.tier"] === "gold",
      }))
    )
    .build();

  it("ドット記法のパスをキーにして値を受け取る", () => {
    expect(validator.validate(makeOrder()).valid).toBe(true);
  });

  it("message を返さなければ既定メッセージが path 付きで出る", () => {
    const result = validator.validate(
      makeOrder({ customer: { tier: "free" } })
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe(
      "Cross-field validation failed for note"
    );
  });
});

describe("stitch: 検証関数は1回しか呼ばれない", () => {
  let calls = 0;
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("total", (b) =>
      b.number.stitch(["price"], () => {
        calls += 1;
        return { valid: false, message: "だめ" };
      })
    )
    .build();

  it("メッセージ生成のために再実行しない (旧実装は2回呼んでいた)", () => {
    calls = 0;
    const result = validator.validate(makeOrder());
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("だめ");
    expect(calls).toBe(1);
  });
});

describe("stitch: messageFactory に fields / fieldValues / message が渡る", () => {
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("total", (b) =>
      b.number.stitch(
        ["price", "quantity"],
        () => ({ valid: false, message: "内側のメッセージ" }),
        {
          code: "TOTAL_MISMATCH",
          messageFactory: (msgCtx) =>
            `${msgCtx.fields.join("+")}=${String(
              msgCtx.fieldValues["price"]
            )},${String(msgCtx.fieldValues["quantity"])} (${String(
              msgCtx.message
            )})`,
        }
      )
    )
    .build();

  it("code を上書きし、宣言パスとその値を文脈として受け取る", () => {
    const result = validator.validate(makeOrder());
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("TOTAL_MISMATCH");
    expect(result.issues[0]?.message).toBe(
      "price+quantity=100,3 (内側のメッセージ)"
    );
  });
});

describe("stitch: ルートは常に渡る", () => {
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("note", (b) =>
      b.string.stitch([], (values, value, root) => ({
        valid:
          typeof root === "object" &&
          root !== null &&
          Object.keys(values).length === 0 &&
          value === "",
      }))
    )
    .build();

  it("パスを1つも宣言しなくても root と自値は渡る", () => {
    expect(validator.validate(makeOrder()).valid).toBe(true);
  });
});
