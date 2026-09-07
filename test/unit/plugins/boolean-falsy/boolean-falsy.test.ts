import { Builder } from "../../../../src/index";
import { booleanFalsyPlugin } from "../../../../src/plugins/boolean-falsy";

type Flags = { readonly archived: boolean };

const falsy = Builder()
  .use(booleanFalsyPlugin)
  .for<Flags>()
  .v("archived", (b) => b.boolean.falsy())
  .build();

describe("booleanFalsy", () => {
  it("false を通す", () => {
    expect(falsy.validate({ archived: false }).valid).toBe(true);
  });

  it("true を弾き、既定文言を出す", () => {
    const validationResult = falsy.validate({ archived: true });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "archived",
        code: "booleanFalsy",
        message: "Value must be falsy",
        severity: "error",
      },
    ]);
  });

  // 旧実装で実測済みの振る舞い: null / undefined / 欠損はすべて通る。
  it("boolean 以外は素通しする", () => {
    const loose = falsy as unknown as {
      validate(input: unknown): { valid: boolean };
    };
    expect(loose.validate({}).valid).toBe(true);
    expect(loose.validate({ archived: null }).valid).toBe(true);
    expect(loose.validate({ archived: 1 }).valid).toBe(true);
    expect(loose.validate({ archived: "yes" }).valid).toBe(true);
  });

  it("severity はオプションで下げられる", () => {
    const warning = Builder()
      .use(booleanFalsyPlugin)
      .for<Flags>()
      .v("archived", (b) => b.boolean.falsy({ severity: "warning" }))
      .build();
    expect(warning.validate({ archived: true }).issues[0]?.severity).toBe(
      "warning"
    );
  });
});
