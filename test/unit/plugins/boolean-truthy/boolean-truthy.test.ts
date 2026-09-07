import { Builder } from "../../../../src/index";
import { booleanTruthyPlugin } from "../../../../src/plugins/boolean-truthy";

type Flags = { readonly accepted: boolean };

const truthy = Builder()
  .use(booleanTruthyPlugin)
  .for<Flags>()
  .v("accepted", (b) => b.boolean.truthy())
  .build();

describe("booleanTruthy", () => {
  it("true を通す", () => {
    expect(truthy.validate({ accepted: true }).valid).toBe(true);
  });

  it("false を弾き、既定文言を出す", () => {
    const validationResult = truthy.validate({ accepted: false });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "accepted",
        code: "booleanTruthy",
        message: "Value must be truthy",
        severity: "error",
      },
    ]);
  });

  // 名前に反して JS の truthy 判定ではなく === true の厳密比較。強制変換もしない。
  it("boolean 以外は素通しする (欠損・null・非 boolean)", () => {
    const loose = truthy as unknown as {
      validate(input: unknown): { valid: boolean };
    };
    expect(loose.validate({}).valid).toBe(true);
    expect(loose.validate({ accepted: null }).valid).toBe(true);
    expect(loose.validate({ accepted: 0 }).valid).toBe(true);
    expect(loose.validate({ accepted: "" }).valid).toBe(true);
    expect(loose.validate({ accepted: 1 }).valid).toBe(true);
  });

  it("messageFactory で文言を差し替えられる", () => {
    const custom = Builder()
      .use(booleanTruthyPlugin)
      .for<Flags>()
      .v("accepted", (b) =>
        b.boolean.truthy({
          messageFactory: (context) => `${context.path} must be checked`,
        })
      )
      .build();
    expect(custom.validate({ accepted: false }).issues[0]?.message).toBe(
      "accepted must be checked"
    );
  });
});
