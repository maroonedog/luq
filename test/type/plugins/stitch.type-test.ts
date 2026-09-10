// That the bundle `stitch` receives is typed.
//
// Why this file exists: the set of paths is known at the declaration, so the
// bundle's contents are knowable too. While it was flattened to
// `Readonly<Record<string, unknown>>`, all three of the following compiled —
// a misspelling, a mistaken type, and a path that does not exist.
//
// The negatives are pinned with expect-error directives. An unused one is
// itself an error, so the type check passing is the proof they still fail.
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { stitchPlugin } from "../../../src/plugins/stitch";
import type { StitchCheck } from "../../../src/plugins/stitch";

interface Order {
  total: number;
  price: number;
  quantity: number;
  user: { name: string };
}

const kit = Builder().use(requiredPlugin).use(stitchPlugin);

// ---- POSITIVE: the bundle members, the value and the root are all typed --
export const crossField = kit
  .for<Order>()
  .v("total", (b) =>
    b.number.required().stitch(["price", "quantity"], (f, value, root) => ({
      valid: value === f.price * f.quantity && root.total === value,
    }))
  )
  .build();

// A dotted path is read with brackets. Inside the predicate this is plain
// property access with nothing to do with the path parser, so no alias is
// needed.
export const nested = kit
  .for<Order>()
  .v("total", (b) =>
    b.number.stitch(["user.name"], (f) => ({
      valid: f["user.name"].length > 2,
    }))
  )
  .build();

// ---- non-breaking: a predicate taking the bundle as a Record still works -
// A function with a wider parameter is assignable to a narrower expectation,
// so existing calls do not break.
const legacyCheck: StitchCheck = (fieldValues, value) => ({
  valid: typeof fieldValues["price"] === "number" && typeof value === "number",
});
export const legacy = kit
  .for<Order>()
  .v("total", (b) => b.number.stitch(["price"], legacyCheck))
  .build();

// ---- NEGATIVE 1: an undeclared path is not in the bundle -----------------
kit.for<Order>().v("total", (b) =>
  b.number.stitch(["price"], (f) => ({
    // @ts-expect-error only "price" was declared
    valid: f.quantity > 0,
  }))
);

// ---- NEGATIVE 2: the members keep their types ----------------------------
kit.for<Order>().v("total", (b) =>
  b.number.stitch(["price"], (f) => ({
    // @ts-expect-error price is a number and has no string method
    valid: f.price.toUpperCase() === "X",
  }))
);

// ---- NEGATIVE 3: a path not on the root cannot be declared ---------------
kit.for<Order>().v("total", (b) =>
  b.number.stitch(
    // @ts-expect-error "nope" is not a path of Order
    ["nope"],
    () => ({ valid: true })
  )
);
