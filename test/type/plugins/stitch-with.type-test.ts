// The types of stitchWith, which is EXPERIMENTAL.
//
// What is checked here is the reason the plugin exists. stitch hands the
// cross-field bundle over as `Readonly<Record<string, unknown>>`, so the type
// says nothing about its contents: misspell a member, mistake its type, and it
// still compiles. Here the bundle is assembled from a mapping and typed.
//
// The negatives are pinned with expect-error directives. An unused one is
// itself an error, so the type check passing is the proof they still fail.
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { customPlugin } from "../../../src/plugins/custom";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stitchWithPlugin } from "../../../src/plugins/stitch-with";

interface Order {
  total: number;
  price: number;
  quantity: number;
  user: { name: string };
}

const kit = Builder()
  .use(requiredPlugin)
  .use(customPlugin)
  .use(numberMinPlugin)
  .use(stitchWithPlugin);

// ---- POSITIVE: several fields come together in one judgement -------------
export const crossField = kit
  .for<Order>()
  .v("total", (b) =>
    b.number
      .required()
      .stitchWith({ sum: "total", cost: "price", count: "quantity" }, (f) =>
        f.object.custom((bundle) => bundle.sum === bundle.cost * bundle.count)
      )
  )
  .build();

// A nested path sits under an alias. Keyed by path strings, `"user.name"`
// would be read as a path and this form would be unwritable.
export const nested = kit
  .for<Order>()
  .v("total", (b) =>
    b.number.stitchWith({ customer: "user.name" }, (f) =>
      f.object.custom((bundle) => bundle.customer.length >= 3)
    )
  )
  .build();

// ---- NEGATIVE 1: a path not on the root cannot go in the table -----------
kit.for<Order>().v("total", (b) =>
  b.number.stitchWith(
    // @ts-expect-error "nope" is not a path of Order
    { cost: "nope" },
    (f) => f.object.custom(() => true)
  )
);

// ---- NEGATIVE 2: an undeclared alias is not in the bundle ----------------
kit.for<Order>().v("total", (b) =>
  b.number.stitchWith({ cost: "price" }, (f) =>
    f.object.custom(
      (bundle) =>
        // @ts-expect-error the bundle has no "typo"
        bundle.typo > 0
    )
  )
);

// ---- NEGATIVE 3: the bundle members keep their types ---------------------
// This is where it differs from stitch, whose bundle is unknown and lets this
// mistake compile.
kit.for<Order>().v("total", (b) =>
  b.number.stitchWith({ cost: "price" }, (f) =>
    f.object.custom(
      (bundle) =>
        // @ts-expect-error cost is a number and has no string method
        bundle.cost.toUpperCase() === "X"
    )
  )
);
