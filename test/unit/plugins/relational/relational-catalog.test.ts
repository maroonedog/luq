// Puts this category's six plugins on one Builder and runs it the way a user
// writes it. One colliding method name fails at use().
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

describe("the relational category: all six load together", () => {
  it("accepts input satisfying all of them", () => {
    expect(validator.validate(makeInvoice()).valid).toBe(true);
  });

  it("reports each violation at its own path", () => {
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

  it("delivers the external context to every plugin by one route", () => {
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
    // Being a read, the writeOnly field fails and the readOnly one passes.
    expect(result.issues.map((issue) => issue.path).sort()).toEqual([
      "password",
      "token",
    ]);
  });
});

describe("the relational category: there is only one execution order", () => {
  it("has validate transform nothing and parse transform", () => {
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

  it("returns no transformed result from a parse that failed validation", () => {
    const parsed = validator.parse(makeInvoice({ confirm: "no" }));
    expect(parsed.valid).toBe(false);
  });
});
