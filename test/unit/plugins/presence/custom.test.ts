// custom は任意述語。旧実装の可変クロージャと二重実行をどちらも持ち込まない。
import { Builder } from "../../../../src/index";
import { customPlugin } from "../../../../src/plugins/custom";

type Item = { sku: string; qty: number };

describe("custom", () => {
  it("true を返せば通し、false なら既定メッセージで弾く", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) => b.string.custom((value) => value.startsWith("SKU-")))
      .build();
    expect(validator.validate({ sku: "SKU-1", qty: 1 }).valid).toBe(true);
    const result = validator.validate({ sku: "X", qty: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "sku",
      code: "custom",
      message: "sku custom validation failed",
      severity: "error",
    });
  });

  it("{ valid, message } を返せばその message が使われる", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) =>
        b.string.custom((value) =>
          value.startsWith("SKU-")
            ? true
            : { valid: false, message: `${value} は SKU- で始まらない` }
        )
      )
      .build();
    const result = validator.validate({ sku: "X", qty: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("X は SKU- で始まらない");
  });

  // 旧実装は message を可変クロージャ変数 dynamicMessage に書き戻していたため、
  // 同じ validator を2回使うと前回の message が残った。
  it("同じ validator を続けて使っても前回の message が残らない", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) =>
        b.string.custom((value) =>
          value === "ok" ? true : { valid: false, message: `bad:${value}` }
        )
      )
      .build();
    const first = validator.validate({ sku: "a", qty: 1 });
    const second = validator.validate({ sku: "b", qty: 1 });
    expect(first.valid).toBe(false);
    expect(second.valid).toBe(false);
    if (first.valid || second.valid) return;
    expect(first.issues[0]?.message).toBe("bad:a");
    expect(second.issues[0]?.message).toBe("bad:b");
  });

  // 旧実装は判定に1回、メッセージ生成にもう1回、述語を呼んでいた。
  it("述語は1つの値につき1回だけ呼ばれる", () => {
    let calls = 0;
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) =>
        b.string.custom(() => {
          calls += 1;
          return { valid: false, message: "no" };
        })
      )
      .build();
    validator.validate({ sku: "a", qty: 1 });
    expect(calls).toBe(1);
  });

  it("述語が例外を投げたら失敗として扱い、検証は落ちない", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) =>
        b.string.custom(() => {
          throw new Error("boom");
        })
      )
      .build();
    const result = validator.validate({ sku: "a", qty: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("boom");
  });

  it("options.code と options.messageFactory を尊重する", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("qty", (b) =>
        b.number.custom((value) => value > 0, {
          code: "QTY_POSITIVE",
          messageFactory: (context) =>
            `${context.path}=${String(context.value)}`,
        })
      )
      .build();
    const result = validator.validate({ sku: "a", qty: 0 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("QTY_POSITIVE");
    expect(result.issues[0]?.message).toBe("qty=0");
  });
});
