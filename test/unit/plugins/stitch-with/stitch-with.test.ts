// EXPERIMENTAL な stitchWith の実行時の振る舞い。
//
// これはクロスフィールド検証のためのメソッドである。核は「複数のフィールドを
// **1つの判定** にまとめる」ことなので、ここで見るのはまさにそこ:
// `total === price * quantity` のような、1フィールドずつでは書けない判定が
// 1メソッドで書けること。
//
// 型が効いていることは test/type/plugins/stitch-with.type-test.ts が固定する。
import { Builder } from "../../../../src/index";
import { requiredPlugin } from "../../../../src/plugins/required";
import { customPlugin } from "../../../../src/plugins/custom";
import { numberMinPlugin } from "../../../../src/plugins/number-min";
import { stitchWithPlugin } from "../../../../src/plugins/stitch-with";

interface Order {
  total: number;
  price: number;
  quantity: number;
  user: { name: string };
}

const valid: Order = {
  total: 100,
  price: 10,
  quantity: 10,
  user: { name: "abc" },
};

function buildTotalValidator() {
  return Builder()
    .use(requiredPlugin)
    .use(customPlugin)
    .use(stitchWithPlugin)
    .for<Order>()
    .v("total", (b) =>
      b.number
        .required()
        .stitchWith({ sum: "total", cost: "price", count: "quantity" }, (f) =>
          f.object.custom((bundle) => bundle.sum === bundle.cost * bundle.count)
        )
    )
    .build();
}

describe("one method, several fields, one judgement", () => {
  it("accepts when the cross-field relation holds", () => {
    expect(buildTotalValidator().validate(valid).valid).toBe(true);
  });

  it("rejects when it does not", () => {
    expect(buildTotalValidator().validate({ ...valid, total: 99 }).valid).toBe(
      false
    );
  });

  it("sees a change in ANY of the stitched fields", () => {
    // 判定はフィールドごとに分かれていないので、どれが動いても同じ1つの
    // 判定がやり直される。ここが「別名ごとに規則を並べる」形との違い。
    const validator = buildTotalValidator();
    expect(validator.validate({ ...valid, price: 11 }).valid).toBe(false);
    expect(validator.validate({ ...valid, quantity: 11 }).valid).toBe(false);
    expect(
      validator.validate({ ...valid, total: 121, quantity: 11, price: 11 })
        .valid
    ).toBe(true);
  });

  it("reports the issue on the field the rule was declared on", () => {
    const outcome = buildTotalValidator().validate({ ...valid, total: 99 });
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.issues.map((issue) => issue.path)).toEqual(["total"]);
    expect(outcome.issues.map((issue) => issue.code)).toEqual(["stitchWith"]);
  });
});

describe("the bundle is read from the root, by path", () => {
  it("reads a NESTED path under its alias", () => {
    // 別名を経由する理由。束をパス文字列でキーしていたら "user.name" が
    // パスとして解釈され、平たい束の中を探しに行って見つからない。
    const validator = Builder()
      .use(requiredPlugin)
      .use(customPlugin)
      .use(stitchWithPlugin)
      .for<Order>()
      .v("total", (b) =>
        b.number.stitchWith({ customer: "user.name" }, (f) =>
          f.object.custom((bundle) => bundle.customer.length >= 3)
        )
      )
      .build();

    expect(validator.validate(valid).valid).toBe(true);
    expect(validator.validate({ ...valid, user: { name: "ab" } }).valid).toBe(
      false
    );
  });

  it("does not judge the subject's own value", () => {
    // total 自身には required しか無いので、束が通れば total の値は問われない。
    const validator = Builder()
      .use(requiredPlugin)
      .use(customPlugin)
      .use(stitchWithPlugin)
      .for<Order>()
      .v("total", (b) =>
        b.number
          .required()
          .stitchWith({ cost: "price" }, (f) =>
            f.object.custom((bundle) => bundle.cost > 0)
          )
      )
      .build();

    expect(validator.validate({ ...valid, total: -999 }).valid).toBe(true);
  });
});

describe("the sub-chain is resolved once, at build time", () => {
  it("does not re-run the callback per validation", () => {
    // build() までは宣言 (オブジェクト) で、build() が IR に落とす。実行時は
    // その IR を読むだけなので、利用者の callback は二度目が存在しない。
    let calls = 0;
    const validator = Builder()
      .use(requiredPlugin)
      .use(numberMinPlugin)
      .use(stitchWithPlugin)
      .for<Order>()
      .v("total", (b) =>
        b.number.stitchWith({ cost: "price" }, (f) => {
          calls += 1;
          return f.object;
        })
      )
      .build();

    validator.validate(valid);
    validator.validate(valid);

    expect(calls).toBe(1);
  });
});
