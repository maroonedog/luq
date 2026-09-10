// How stitchWith behaves at run time. It is EXPERIMENTAL.
//
// The point of it is bringing several fields into **one judgement**, so that
// is what gets checked: something like `total === price * quantity`, which
// cannot be written one field at a time, written in one method.
//
// That the types hold is pinned by the corresponding type test.
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
    // The judgement is not split per field, so whichever value moves, the
    // same single judgement is redone. That is the difference from listing a
    // rule per alias.
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
    // Why it goes through aliases: keyed by path strings, "user.name" would
    // be read as a path and looked for inside the flat bundle, where it is not.
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
    // total itself declares only required, so once the bundle passes, its own
    // value is not questioned.
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
    // Up to build() it is a declaration; build() lowers it. Validation only
    // reads what was lowered, so the callback has no second call.
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
