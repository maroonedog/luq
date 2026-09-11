// What the bundle carries when a declared path names a value the root does
// not have.
//
// The path stays a key of the bundle and holds undefined, so the check judges
// the absence itself. Leaving the key out instead would hide it: a check
// written about that path would find nothing to object to.
import { Builder } from "../../../../src/index";
import { stitchPlugin } from "../../../../src/plugins/stitch/index";

interface Cart {
  total: number;
  coupon?: string;
}

function buildCouponReader() {
  return Builder()
    .use(stitchPlugin)
    .for<Cart>()
    .v("total", (b) =>
      b.number.stitch(["coupon"], (fieldValues) => ({
        valid: "coupon" in fieldValues && fieldValues.coupon === undefined,
        message: "coupon is not an absent key of the bundle",
      }))
    )
    .build();
}

describe("stitch: a declared path the root does not have", () => {
  it("keeps the path as a key of the bundle, holding undefined", () => {
    expect(buildCouponReader().validate({ total: 1 }).valid).toBe(true);
  });

  it("still rejects once the declared value is there", () => {
    expect(
      buildCouponReader().validate({ total: 1, coupon: "SAVE" }).valid
    ).toBe(false);
  });
});
