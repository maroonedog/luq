// orFail は否定的ゲート: 条件が真なら値に関わらず失敗させる。
import { Builder } from "../../../../src/index";
import { orFailPlugin } from "../../../../src/plugins/or-fail";

type Payload = { env: string; debugToken: string };

const validatePayload = Builder()
  .use(orFailPlugin)
  .for<Payload>()
  .v("debugToken", (b) => b.string.orFail((root) => root.env === "production"))
  .build();

describe("orFail", () => {
  it("条件が真なら値があるだけで失敗する", () => {
    const result = validatePayload.validate({
      env: "production",
      debugToken: "t",
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "debugToken",
      code: "orFail",
      message: "Validation failed",
      severity: "error",
    });
  });

  it("条件が偽なら何もしない", () => {
    expect(
      validatePayload.validate({ env: "dev", debugToken: "t" }).valid
    ).toBe(true);
  });

  it("値の中身は一切見ない", () => {
    expect(
      validatePayload.validate({ env: "production", debugToken: "" }).valid
    ).toBe(false);
  });

  it("options.messageFactory で固定文言を差し替えられる", () => {
    const validator = Builder()
      .use(orFailPlugin)
      .for<Payload>()
      .v("debugToken", (b) =>
        b.string.orFail((root) => root.env === "production", {
          code: "DEBUG_FIELD_FORBIDDEN",
          messageFactory: (context) => `${context.path} は本番で使えません`,
        })
      )
      .build();
    const result = validator.validate({ env: "production", debugToken: "t" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("DEBUG_FIELD_FORBIDDEN");
    expect(result.issues[0]?.message).toBe("debugToken は本番で使えません");
  });
});
