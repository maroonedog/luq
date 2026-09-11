// What stitchWith reads when the alias map is not a mapping.
//
// The map is the only thing that decides which paths are read, so one this
// plugin cannot enumerate as alias-to-path contributes NO aliases: the bundle
// handed to the sub-chain is empty and the surrounding schema keeps working.
// A list of paths is the shape a caller reaches for by mistake, and its
// indices must not become aliases named "0" and "1".
import { Builder } from "../../../../src/index";
import { customPlugin } from "../../../../src/plugins/custom";
import { stitchWithPlugin } from "../../../../src/plugins/stitch-with";

interface Order {
  total: number;
  price: number;
  quantity: number;
}

/** The chain narrows the map's values to the paths this model actually has. */
type OrderAliasMap = Readonly<Record<string, keyof Order>>;

const ORDER: Order = { total: 100, price: 10, quantity: 10 };

/** The type says "alias -> path"; a JavaScript caller can still pass a list. */
const PATH_LIST = ["price", "quantity"] as unknown as OrderAliasMap;

function aliasesReported(aliasMap: OrderAliasMap): readonly string[] {
  const validator = Builder()
    .use(customPlugin)
    .use(stitchWithPlugin)
    .for<Order>()
    .v("total", (b) =>
      b.number.stitchWith(aliasMap, (f) => f.object.custom(() => false), {
        messageFactory: (context) => context.aliases.join(","),
      })
    )
    .build();
  const rejection = validator.validate(ORDER);
  expect(rejection.valid).toBe(false);
  return rejection.issues.map((issue) => issue.message);
}

describe("stitchWith: an alias map that is not a mapping", () => {
  it("declares no aliases, rather than numbering the list", () => {
    expect(aliasesReported(PATH_LIST)).toEqual([""]);
  });

  it("still declares the aliases of a real mapping", () => {
    expect(aliasesReported({ cost: "price", count: "quantity" })).toEqual([
      "cost,count",
    ]);
  });
});
