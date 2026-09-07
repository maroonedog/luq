// ===========================================================================
// test/type/plugins/tuple-union-plugins.type-test.ts
// tupleBuilder and unionGuard at the CALL site.
//
// unionGuard is the one plugin whose signature the CHAIN synthesises rather
// than resolves: `out: GuardOut` turns it into
// `(condition: value is X, define: chain over X)` and narrows the state by X.
// The last block proves the narrowing is real by building a validator whose
// union is fully covered.
// ===========================================================================
import { cb } from "../../support/collection-fixtures";
import { isCat, isDog } from "../../support/model";

// ==================== tupleBuilder (positional ElementChain list) ==========
cb.v("scores", (b) => b.tuple.builder([(eb) => eb.number.atLeast(0)]));
cb.v("scores", (b) =>
  b.tuple.builder([(eb) => eb.number.atLeast(0), (eb) => eb.number.atLeast(1)])
);
// The optional REST chain: one more sub-chain after the position list.
cb.v("scores", (b) =>
  b.tuple.builder([(eb) => eb.number.atLeast(0)], (eb) => eb.number.atLeast(2))
);
cb.v("tags", (b) => b.tuple.builder([(eb) => eb.string.minChars(2)]));
cb.v("scores", (b) =>
  // @ts-expect-error a position of `scores` is a number, so the string slot is a mismatch
  b.tuple.builder([(eb) => eb.string.minChars(2)])
);
cb.v("scores", (b) =>
  b.tuple.builder(
    [(eb) => eb.number.atLeast(0)],
    // @ts-expect-error the rest chain sees the same element type as a position
    (eb) => eb.string.minChars(2)
  )
);
// @ts-expect-error the positions arrive as a LIST, not as separate arguments
cb.v("scores", (b) => b.tuple.builder((eb) => eb.number.atLeast(0)));
// @ts-expect-error tuple methods are not on the array slot
cb.v("scores", (b) => b.array.builder([(eb) => eb.number.atLeast(0)]));

// ==================== unionGuard ===========================================
cb.v("pet", (b) =>
  b.union
    .guard(isCat, (sb) => sb.object.minProperties(2))
    .guard(isDog, (sb) => sb.object.minProperties(2))
);
cb.v("pet", (b) =>
  b.union.guard(isCat, (sb) =>
    // @ts-expect-error a Cat is an object, so the string slot is a mismatch
    sb.string.minChars(1)
  )
);
// @ts-expect-error guard needs the sub-chain as well as the predicate
cb.v("pet", (b) => b.union.guard(isCat));

// The union is covered by the two guards, so the builder terminates.
export const petValidator = cb
  .v("pet", (b) =>
    b.union
      .guard(isCat, (sb) => sb.object.minProperties(2))
      .guard(isDog, (sb) => sb.object.minProperties(2))
  )
  .build();
