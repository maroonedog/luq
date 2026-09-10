// ===========================================================================
// test/type/plugins/relational.type-test.ts
// Type fixtures from the caller's side. The defects a declaration cannot show
// — an argument marker with the wrong subject, a path type that is not
// actually applied, a transform's output type failing to propagate — surface
// only here. Each wrong argument is shown being refused.
// ===========================================================================
import { Builder } from "../../../src/index";
import { compareFieldPlugin } from "../../../src/plugins/compare-field/index";
import { stitchPlugin } from "../../../src/plugins/stitch/index";
import { transformPlugin } from "../../../src/plugins/transform/index";
import { fromContextPlugin } from "../../../src/plugins/from-context/index";
import { readOnlyPlugin } from "../../../src/plugins/read-only/index";
import { writeOnlyPlugin } from "../../../src/plugins/write-only/index";
import type {
  StitchFieldValues,
  StitchFieldsOf,
} from "../../../src/plugins/stitch/index";

interface Invoice {
  readonly id: string;
  readonly password: string;
  readonly confirm: string;
  readonly price: number;
  readonly quantity: number;
  readonly total: number;
  readonly token: string;
  readonly note: string;
  readonly pair: readonly [string, number];
  readonly customer: { readonly tier: string };
}

const rb = Builder()
  .use(compareFieldPlugin)
  .use(stitchPlugin)
  .use(transformPlugin)
  .use(fromContextPlugin)
  .use(readOnlyPlugin)
  .use(writeOnlyPlugin)
  .for<Invoice>();

// ============ compareField: a tuple mixing marker kinds ====================
// A field reference resolves to a path of the model; what follows is a plain
// comparison function.
rb.v("confirm", (b) => b.string.compareField("password"));
rb.v("confirm", (b) => b.string.compareField("customer.tier"));
rb.v("total", (b) =>
  b.number.compareField("price", (value, target) => value === target)
);
// @ts-expect-error the first argument must be a path that exists on the model
rb.v("confirm", (b) => b.string.compareField("nope"));
// @ts-expect-error the second argument is a comparison function, not a string
rb.v("confirm", (b) => b.string.compareField("password", "eq"));
// @ts-expect-error compareField does not permit the any slot
rb.v("confirm", (b) => b.any.compareField("password"));

// ==================== stitch =============================================
// The plain call form: the values are unknown, so they get narrowed first.
rb.v("total", (b) =>
  b.number.stitch(["price", "quantity"], (values, value) => ({
    valid: values["price"] !== undefined && value !== undefined,
  }))
);
// The type assembled from the declared paths, narrowed by a caller's guard.
type PriceAndQuantity = StitchFieldsOf<Invoice, ["price", "quantity"]>;
const isPriceAndQuantity = (
  values: StitchFieldValues
): values is PriceAndQuantity =>
  typeof values["price"] === "number" && typeof values["quantity"] === "number";
rb.v("total", (b) =>
  b.number.stitch(["price", "quantity"], (values, value) =>
    isPriceAndQuantity(values)
      ? { valid: value === values.price * values.quantity }
      : { valid: false }
  )
);
// @ts-expect-error a declared path must be a path of the model
rb.v("total", (b) => b.number.stitch(["nope"], () => ({ valid: true })));
// @ts-expect-error check returns { valid, message? }, not a boolean
rb.v("total", (b) => b.number.stitch(["price"], () => true));

// ============ transform: the output type propagates along the chain ========
rb.v("note", (b) => b.string.transform((value) => value.trim()));
// The later step sees the earlier step's output type; toFixed being available is the proof.
rb.v("note", (b) =>
  b.string
    .transform((value) => value.length)
    .transform((length) => length.toFixed(2))
);
// @ts-expect-error the input is a string, so a map declared over number does not fit
rb.v("note", (b) => b.string.transform((value: number) => value));
rb.v("note", (b) =>
  b.string
    .transform((v) => v.length)
    // @ts-expect-error after the transform it is a number, which has no trim()
    .transform((n) => n.trim())
);

// ==================== fromContext ========================================
rb.v("password", (b) =>
  b.string.fromContext({
    check: (value, context) => ({ valid: context["taken"] !== value }),
    required: true,
  })
);
// @ts-expect-error check is a required option
rb.v("password", (b) => b.string.fromContext({ required: true }));
rb.v("password", (b) =>
  b.string.fromContext({
    check: () => ({ valid: true }),
    // @ts-expect-error an unrecognised option is not accepted
    retries: 3,
  })
);

// ============ readOnly / writeOnly: two separate symbols ==================
rb.v("id", (b) => b.string.readOnly());
rb.v("token", (b) => b.string.writeOnly());
rb.v("id", (b) => b.string.readOnly({ code: "READ_ONLY" }));
// @ts-expect-error the only argument is RuleOptions; there are no positional ones
rb.v("id", (b) => b.string.readOnly("write"));
rb.v("price", (b) => b.number.writeOnly());
// @ts-expect-error readOnly and writeOnly do not permit the tuple slot
rb.v("pair", (b) => b.tuple.writeOnly());

// The builder reaches its end, meaning no .v() returned an error object.
export const invoiceValidator = rb.build();
