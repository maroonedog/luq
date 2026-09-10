// There is exactly one stitch. This confirms that the single implementation
// really accepts and runs every call form the three it replaced offered.
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

/** The assembled bundle type, narrowed by a guard on the caller's side. */
type PriceAndQuantity = StitchFieldsOf<Order, ["price", "quantity"]>;

function isPriceAndQuantity(
  values: StitchFieldValues
): values is PriceAndQuantity {
  return (
    typeof values["price"] === "number" &&
    typeof values["quantity"] === "number"
  );
}

describe("stitch: the declared paths' values arrive bundled", () => {
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("total", (b) =>
      b.number.stitch(["price", "quantity"], (values, value) => {
        if (!isPriceAndQuantity(values)) {
          return {
            valid: false,
            message: "price and quantity are not numbers",
          };
        }
        const expected = values.price * values.quantity;
        return {
          valid: value === expected,
          message: `Expected ${expected}, got ${String(value)}`,
        };
      })
    )
    .build();

  it("passes when the arithmetic works out", () => {
    expect(validator.validate(makeOrder()).valid).toBe(true);
  });

  it("fails when it does not, reporting check's own message verbatim", () => {
    const result = validator.validate(makeOrder({ total: 42 }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.path).toBe("total");
    expect(result.issues[0]?.code).toBe("stitch");
    expect(result.issues[0]?.message).toBe("Expected 300, got 42");
  });

  it("does not crash the engine on input the guard rejects", () => {
    const result = validator.validate({
      ...makeOrder(),
      price: "100",
    } as unknown as Order);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe(
      "price and quantity are not numbers"
    );
  });
});

describe("stitch: the plain, untyped call form", () => {
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("note", (b) =>
      b.string.stitch(["customer.tier"], (values) => ({
        valid: values["customer.tier"] === "gold",
      }))
    )
    .build();

  it("receives the values keyed by their dotted paths", () => {
    expect(validator.validate(makeOrder()).valid).toBe(true);
  });

  it("falls back to the default message, with the path, when none is returned", () => {
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

describe("stitch: the check runs exactly once", () => {
  let calls = 0;
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("total", (b) =>
      b.number.stitch(["price"], () => {
        calls += 1;
        return { valid: false, message: "no good" };
      })
    )
    .build();

  it("does not re-run it to build the message, which a previous release did", () => {
    calls = 0;
    const result = validator.validate(makeOrder());
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("no good");
    expect(calls).toBe(1);
  });
});

describe("stitch: messageFactory receives the fields, their values and the message", () => {
  const validator = Builder()
    .use(stitchPlugin)
    .for<Order>()
    .v("total", (b) =>
      b.number.stitch(
        ["price", "quantity"],
        () => ({ valid: false, message: "the inner message" }),
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

  it("overrides the code and receives the declared paths and values as context", () => {
    const result = validator.validate(makeOrder());
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("TOTAL_MISMATCH");
    expect(result.issues[0]?.message).toBe(
      "price+quantity=100,3 (the inner message)"
    );
  });
});

describe("stitch: the root is always passed", () => {
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

  it("passes the root and the field's own value even with no path declared", () => {
    expect(validator.validate(makeOrder()).valid).toBe(true);
  });
});
