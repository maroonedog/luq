// ===========================================================================
// test/type/plugins/array-plugins.type-test.ts
//
// Every assertion here is a CALL, not a declaration. RuntimeArgs collapses
// every sub-chain marker to `readonly Rule[]`, so a plugin declared with the
// WRONG marker still type-checks on its own; only a call site can tell
// ElementChain from NarrowedChain. That is the defect this file exists to
// catch for arrayContains and arrayEach.
// ===========================================================================
import { cb } from "../../support/collection-fixtures";

// ==================== arrayMinLength / arrayMaxLength ======================
cb.v("tags", (b) => b.array.present().minLength(1));
cb.v("tags", (b) => b.array.present().maxLength(10));
cb.v("scores", (b) => b.array.minLength(1).maxLength(3));
// @ts-expect-error the bound is a number, not a string
cb.v("tags", (b) => b.array.minLength("1"));
// @ts-expect-error the bound is a number, not a string
cb.v("tags", (b) => b.array.maxLength("10"));
// The trailing RuleOptions bag is accepted, and its context is the plugin's.
cb.v("tags", (b) => b.array.minLength(1, { code: "TOO_FEW_TAGS" }));
cb.v("tags", (b) =>
  b.array.minLength(1, {
    messageFactory: (context) => `${context.path}: ${String(context.min)}`,
  })
);
cb.v("tags", (b) =>
  // @ts-expect-error `min` is on the context; `nope` is not
  b.array.minLength(1, { messageFactory: (context) => String(context.nope) })
);

// ==================== arrayUnique ==========================================
cb.v("tags", (b) => b.array.unique());
// @ts-expect-error unique takes no positional argument
cb.v("tags", (b) => b.array.unique(1));

// ==================== arrayIncludes ========================================
// The element stays `unknown`: the marker registry has no "one element of the
// subject" ARGUMENT marker, so a wrong-typed element cannot be rejected here.
// What the call site DOES pin down is the arity.
cb.v("tags", (b) => b.array.includes("urgent"));
cb.v("scores", (b) => b.array.includes(42));
// @ts-expect-error the element is required
cb.v("tags", (b) => b.array.includes());

// ==================== arrayContains (ElementChain) =========================
// The sub-chain's subject is ONE ELEMENT: string for tags, number for scores.
cb.v("tags", (b) => b.array.contains((eb) => eb.string.minChars(3)));
cb.v("scores", (b) => b.array.contains((eb) => eb.number.atLeast(60)));
cb.v("scores", (b) =>
  b.array.contains((eb) => eb.number.atLeast(60), { min: 2 })
);
cb.v("scores", (b) =>
  b.array.contains((eb) => eb.number.atLeast(60), { min: 1, max: 3 })
);
cb.v("tags", (b) =>
  // @ts-expect-error an element of `tags` is a string, so the number slot is a mismatch
  b.array.contains((eb) => eb.number.atLeast(3))
);
cb.v("scores", (b) =>
  // @ts-expect-error the bounds are numbers
  b.array.contains((eb) => eb.number.atLeast(60), { min: "2" })
);
// @ts-expect-error contains takes a sub-chain, not a plain value
cb.v("tags", (b) => b.array.contains("urgent"));

// ==================== arrayEach (ElementChain) =============================
cb.v("tags", (b) => b.array.each((eb) => eb.string.minChars(1)));
cb.v("items", (b) => b.array.each((eb) => eb.object.minProperties(2)));
// A two-dimensional array: one `each` peels exactly one dimension.
cb.v("matrix", (b) => b.array.each((eb) => eb.array.minLength(1)));
cb.v("tags", (b) =>
  // @ts-expect-error an element of `tags` is a string, not an object
  b.array.each((eb) => eb.object.minProperties(1))
);
// @ts-expect-error each takes a sub-chain, not a rule list
cb.v("tags", (b) => b.array.each([]));

// ==================== slot gating ==========================================
// @ts-expect-error minLength is an array/tuple method; `name` is a string field
cb.v("name", (b) => b.string.minLength(1));
