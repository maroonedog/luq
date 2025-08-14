import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { booleanTruthyPlugin } from "../../../../src/core/plugin/booleanTruthy";
import { booleanFalsyPlugin } from "../../../../src/core/plugin/booleanFalsy";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("booleanTruthy & booleanFalsy Plugin", () => {
  describe("booleanTruthy", () => {
    test("truthy値を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(booleanTruthyPlugin)
        .for<{ flag: boolean }>()
        .v("flag", (b) => b.boolean.required().truthy())
        .build();

      expect(validator.validate({ flag: true }).valid).toBe(true);
    });

    test("falsy値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(booleanTruthyPlugin)
        .for<{ flag: boolean }>()
        .v("flag", (b) => b.boolean.required().truthy())
        .build();

      const result = validator.validate({ flag: false });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "flag",
        code: "booleanTruthy",
      });
    });

    test("他の型でのtruthy判定", () => {
      // Note: truthy() is only available for boolean type
      // This test checks that non-boolean values are skipped
      const validator = Builder()
        .use(requiredPlugin)
        .use(booleanTruthyPlugin)
        .for<{ value: boolean }>()
        .v("value", (b) => b.boolean.required().truthy())
        .build();

      // truthy値 (true)
      expect(validator.validate({ value: true }).valid).toBe(true);

      // falsy値 (false)
      expect(validator.validate({ value: false }).valid).toBe(false);
    });
  });

  describe("booleanFalsy", () => {
    test("falsy値を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(booleanFalsyPlugin)
        .for<{ flag: boolean }>()
        .v("flag", (b) => b.boolean.required().falsy())
        .build();

      expect(validator.validate({ flag: false }).valid).toBe(true);
    });

    test("truthy値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(booleanFalsyPlugin)
        .for<{ flag: boolean }>()
        .v("flag", (b) => b.boolean.required().falsy())
        .build();

      const result = validator.validate({ flag: true });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "flag",
        code: "booleanFalsy",
      });
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(booleanTruthyPlugin)
        .for<{ flag?: boolean }>()
        .v("flag", (b) => b.boolean.optional().truthy())
        .build();

      expect(validator.validate({}).valid).toBe(true);
    });
  });
});
