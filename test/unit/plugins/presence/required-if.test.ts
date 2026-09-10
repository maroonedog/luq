// How requiredIf actually behaves. The condition receives the root, and for
// an array element the item context as well.
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

/** A way in for inputs the types cannot construct, null among them. */
function validateRaw(input: Record<string, unknown>) {
  return validateOrder.validate(input as unknown as Order);
}

describe("requiredIf: evaluating the condition", () => {
  it("accepts an empty string when the condition is false", () => {
    expect(validate({ needsBilling: false, billingCode: "" }).valid).toBe(true);
  });

  it("rejects an empty string when the condition is true", () => {
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

  it("accepts a present value even when the condition is true", () => {
    expect(validate({ needsBilling: true, billingCode: "BC-1" }).valid).toBe(
      true
    );
  });

  it("hands the condition the whole root object", () => {
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

// A previous release declared the condition's second parameter and never
// passed it, so the feature was documented and did nothing.
describe("requiredIf: the array element context actually arrives", () => {
  const validateLines = Builder()
    .use(requiredIfPlugin)
    .for<Order>()
    .v("lines[*].serial", (b) =>
      b.string.requiredIf(
        (_root, item) => item !== undefined && item.index === 1
      )
    )
    .build();

  it("makes only the element at index 1 required", () => {
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

  it("points item.item at the element and item.array at the array", () => {
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
  it("honours options.code and options.messageFactory", () => {
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

// requiredIf is a conditional presence rule, not a check. A check only sees
// values that already passed the presence gate, so as a check it could never
// observe a missing value or a null at all. This is the evidence for that fix.
describe("requiredIf: a true condition rejects missing, null and empty alike", () => {
  it("rejects a missing value", () => {
    const result = validate({ needsBilling: true });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toEqual([
      {
        path: "billingCode",
        code: "requiredIf",
        message: "Field is required when condition is met",
        severity: "error",
      },
    ]);
  });

  it("rejects null", () => {
    const result = validateRaw({ needsBilling: true, billingCode: null });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["requiredIf"]);
  });

  it("rejects the empty string", () => {
    expect(validate({ needsBilling: true, billingCode: "" }).valid).toBe(false);
  });

  it("accepts a present value", () => {
    expect(validate({ needsBilling: true, billingCode: "BC-1" }).valid).toBe(
      true
    );
  });
});

describe("requiredIf: a false condition accepts missing and null", () => {
  it("accepts a missing value", () => {
    expect(validate({ needsBilling: false }).valid).toBe(true);
  });

  it("accepts null", () => {
    expect(validateRaw({ needsBilling: false, billingCode: null }).valid).toBe(
      true
    );
  });
});

// With a false condition requiredIf holds no opinion, and whatever presence
// the field declared for itself applies unchanged.
describe("requiredIf: layered over the field's own presence", () => {
  const validator = Builder()
    .use(requiredIfPlugin)
    .use(requiredPlugin)
    .for<Order>()
    .v("billingCode", (b) =>
      b.string.required().requiredIf((root) => root.needsBilling)
    )
    .build();

  it("still lets .required() catch a missing value when the condition is false", () => {
    const result = validator.validate({ needsBilling: false } as Order);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("required");
  });

  it("reports under requiredIf's own code when the condition is true", () => {
    const result = validator.validate({ needsBilling: true } as Order);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("requiredIf");
  });
});

describe("requiredIf: decides absence per array element", () => {
  const validateLines = Builder()
    .use(requiredIfPlugin)
    .for<Order>()
    .v("lines[*].serial", (b) =>
      b.string.requiredIf((_root, item) => item?.index === 1)
    )
    .build();

  it("blames only the element at index 1 for being absent", () => {
    const result = validateLines.validate(
      {
        needsBilling: false,
        billingCode: "x",
        lines: [{ kind: "a" }, { kind: "b" }],
      } as unknown as Order,
      { abortEarly: false }
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "lines[1].serial",
    ]);
  });
});
