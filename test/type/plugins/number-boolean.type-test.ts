// ===========================================================================
// test/type/plugins/number-boolean.type-test.ts
//
// EVERY assertion below is a CALL, not a declaration. A plugin declaration
// type-checks even when its argument tuple is wrong, because RuntimeArgs
// collapses markers on the way IN to build(); only a call site sees what the
// user actually has to type. Nothing here is allowed to be declaration-only.
// ===========================================================================
import { Builder } from "../../../src/index";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { numberMaxPlugin } from "../../../src/plugins/number-max";
import { numberRangePlugin } from "../../../src/plugins/number-range";
import { numberPositivePlugin } from "../../../src/plugins/number-positive";
import { numberNegativePlugin } from "../../../src/plugins/number-negative";
import { numberIntegerPlugin } from "../../../src/plugins/number-integer";
import { numberFinitePlugin } from "../../../src/plugins/number-finite";
import { numberMultipleOfPlugin } from "../../../src/plugins/number-multiple-of";
import { booleanTruthyPlugin } from "../../../src/plugins/boolean-truthy";
import { booleanFalsyPlugin } from "../../../src/plugins/boolean-falsy";

interface Reading {
  readonly celsius: number;
  readonly label: string;
  readonly accepted: boolean;
}

const nb = Builder()
  .use(numberMinPlugin)
  .use(numberMaxPlugin)
  .use(numberRangePlugin)
  .use(numberPositivePlugin)
  .use(numberNegativePlugin)
  .use(numberIntegerPlugin)
  .use(numberFinitePlugin)
  .use(numberMultipleOfPlugin)
  .use(booleanTruthyPlugin)
  .use(booleanFalsyPlugin)
  .for<Reading>();

// ==================== numberMin / numberMax (call site) ====================
nb.v("celsius", (b) => b.number.min(0).max(100));
nb.v("celsius", (b) => b.number.min(0, true).max(100, true));
nb.v("celsius", (b) => b.number.min(0, false, { code: "TOO_COLD" }));
nb.v("celsius", (b) =>
  b.number.min(0, true, {
    messageFactory: (context) =>
      `${context.path} ${String(context.min)} ${String(context.actual)} ${String(context.exclusive)}`,
  })
);

// @ts-expect-error the bound is a number, not a string
nb.v("celsius", (b) => b.number.min("0"));

// @ts-expect-error `exclusive` is a boolean flag, not a string
nb.v("celsius", (b) => b.number.min(0, "yes"));

// The trailing RuleOptions bag is FIXED by the chain contract, so `exclusive`
// is a declared positional argument and cannot travel inside the bag.
// @ts-expect-error `exclusive` is positional; the options bag has no such member
nb.v("celsius", (b) => b.number.min(0, { exclusive: true }));

nb.v("celsius", (b) =>
  b.number.min(0, false, {
    // @ts-expect-error numberMin's context has `min`, not `max`
    messageFactory: (context) => String(context.max),
  })
);

// @ts-expect-error numberMin serves the number slot only
nb.v("label", (b) => b.string.min(3));

// ==================== numberRange (call site) ==============================
nb.v("celsius", (b) => b.number.range(-40, 60));
nb.v("celsius", (b) =>
  b.number.range(-40, 60, {
    messageFactory: (context) =>
      `${String(context.min)}..${String(context.max)}:${String(context.actual)}`,
  })
);

// @ts-expect-error range needs BOTH bounds; one argument is not a range
nb.v("celsius", (b) => b.number.range(1));

// @ts-expect-error both bounds are numbers
nb.v("celsius", (b) => b.number.range(1, "10"));

// ==================== numberMultipleOf (call site) =========================
nb.v("celsius", (b) => b.number.multipleOf(0.5));
nb.v("celsius", (b) =>
  b.number.multipleOf(0.5, {
    messageFactory: (context) => String(context.divisor),
  })
);

// @ts-expect-error the divisor is required
nb.v("celsius", (b) => b.number.multipleOf());

// @ts-expect-error the divisor is a number, not a string
nb.v("celsius", (b) => b.number.multipleOf("0.5"));

// ==================== the argument-free number plugins =====================
nb.v("celsius", (b) => b.number.positive().integer().finite());
nb.v("celsius", (b) => b.number.negative({ severity: "warning" }));

// @ts-expect-error positive takes no value argument; only the options bag
nb.v("celsius", (b) => b.number.positive(1));

// @ts-expect-error `severity` is one of "error" | "warning" | "info"
nb.v("celsius", (b) => b.number.integer({ severity: "fatal" }));

// @ts-expect-error numberFinite serves the number slot, not the boolean one
nb.v("accepted", (b) => b.boolean.finite());

// ==================== booleanTruthy / booleanFalsy (call site) =============
nb.v("accepted", (b) => b.boolean.truthy());
nb.v("accepted", (b) => b.boolean.falsy({ code: "MUST_BE_FALSE" }));

// @ts-expect-error truthy takes no value argument; only the options bag
nb.v("accepted", (b) => b.boolean.truthy(true));

// @ts-expect-error booleanTruthy serves the boolean slot only
nb.v("celsius", (b) => b.number.truthy());

// @ts-expect-error the field is a boolean, so the number slot is a mismatch
nb.v("accepted", (b) => b.number.positive());
