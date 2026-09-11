// custom takes an arbitrary predicate. Neither the mutable closure nor the
// double execution a previous release had is carried over.
import { Builder } from "../../../../src/index";
import { customPlugin } from "../../../../src/plugins/custom";

type Item = { sku: string; qty: number };

describe("custom", () => {
  it("passes on true and rejects on false with the default message", () => {
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

  it("uses the message from a { valid, message } answer", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) =>
        b.string.custom((value) =>
          value.startsWith("SKU-")
            ? true
            : { valid: false, message: `${value} does not start with SKU-` }
        )
      )
      .build();
    const result = validator.validate({ sku: "X", qty: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("X does not start with SKU-");
  });

  // A previous release wrote the message back into a mutable closure
  // variable, so using one validator twice kept the first message.
  it("keeps no message from a previous use of the same validator", () => {
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

  // A previous release called the predicate twice: once to judge and once to
  // build the message.
  it("calls the predicate once per value", () => {
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

  it("treats a thrown predicate as a failure without crashing the validation", () => {
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

  it("falls back to the default message when the answer carries none", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) => b.string.custom((value) => ({ valid: value === "ok" })))
      .build();
    const result = validator.validate({ sku: "no", qty: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("sku custom validation failed");
  });

  it("reports what a predicate threw when it was not an Error", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) =>
        b.string.custom(() => {
          throw "the pricing table is offline";
        })
      )
      .build();
    const result = validator.validate({ sku: "a", qty: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("the pricing table is offline");
  });

  // Stringifying an object gives "[object Object]", which tells a reader less
  // than the field's own default does.
  it("falls back to the default message when a predicate throws an object", () => {
    const validator = Builder()
      .use(customPlugin)
      .for<Item>()
      .v("sku", (b) =>
        b.string.custom(() => {
          throw { status: 503 };
        })
      )
      .build();
    const result = validator.validate({ sku: "a", qty: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("sku custom validation failed");
  });

  it("honours options.code and options.messageFactory", () => {
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
