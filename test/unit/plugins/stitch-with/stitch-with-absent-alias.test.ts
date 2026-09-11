// What the bundle carries when an alias points at a value the root does not
// have.
//
// The alias stays a member of the bundle and holds undefined, so the sub-chain
// judges the absence itself. Dropping the member instead would hide the
// absence: a rule written about that alias would find nothing to object to.
import { Builder } from "../../../../src/index";
import { customPlugin } from "../../../../src/plugins/custom";
import { stitchWithPlugin } from "../../../../src/plugins/stitch-with";

interface Cart {
  total: number;
  coupon?: string;
}

function buildCouponReader() {
  return Builder()
    .use(customPlugin)
    .use(stitchWithPlugin)
    .for<Cart>()
    .v("total", (b) =>
      b.number.stitchWith({ code: "coupon" }, (f) =>
        f.object.custom(
          (bundle) => "code" in bundle && bundle.code === undefined
        )
      )
    )
    .build();
}

describe("stitchWith: an alias pointing at a value the root does not have", () => {
  it("keeps the alias in the bundle, holding undefined", () => {
    expect(buildCouponReader().validate({ total: 1 }).valid).toBe(true);
  });

  it("still rejects once the aliased value is there", () => {
    expect(
      buildCouponReader().validate({ total: 1, coupon: "SAVE" }).valid
    ).toBe(false);
  });
});
