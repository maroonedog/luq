import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { orFailPlugin } from "../../../../src/core/plugin/orFail";

describe("orFail Plugin - Simple Tests", () => {
  describe("基本動作", () => {
    test("条件がfalseの場合は検証を通す", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ type: string; value: string }>()
        .v("type", (b) => b.string)
        .v("value", (b) =>
          b.string.orFail((allValues) => allValues.type === "restricted")
        )
        .build();

      // 条件がfalseなので検証成功
      const result = validator.validate({ type: "normal", value: "test" });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("条件がtrueの場合は検証を失敗させる", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ type: string; value: string }>()
        .v("type", (b) => b.string)
        .v("value", (b) =>
          b.string.orFail((allValues) => allValues.type === "restricted")
        )
        .build();

      // 条件がtrueなので検証失敗
      const result = validator.validate({ type: "restricted", value: "test" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "validation_error",
      });
    });

    test("常にfalseの条件では成功", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ value: string }>()
        .v("value", (b) => b.string.orFail(() => false))
        .build();

      // 条件が常にfalseなので成功
      const result = validator.validate({ value: "test" });
      expect(result.isValid()).toBe(true);
    });
  });

  describe("カスタムエラーコード", () => {
    test("カスタムエラーコードの設定", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ restricted: boolean; data: string }>()
        .v("data", (b) =>
          b.string.orFail((allValues) => allValues.restricted, {
            code: "ACCESS_DENIED",
          } as any)
        )
        .build();

      const result = validator.validate({ restricted: true, data: "test" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("ACCESS_DENIED");
    });
  });
});
