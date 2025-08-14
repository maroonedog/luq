import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { unionGuardPlugin } from "../../../../src/core/plugin/unionGuard";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { objectPlugin } from "../../../../src/core/plugin/object";
import { createFieldContext } from "../../../../src/core/builder/context/field-context";

describe("unionGuard Plugin", () => {
  describe("基本動作", () => {
    test("string | number のユニオン型", () => {
      const validator = Builder()
        .use(unionGuardPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ value: any }>()
        .v("value", (b) =>
          b.union
            .guard(
              (v): v is string => typeof v === "string",
              (b) => b.string.min(3)
            )
            .guard(
              (v): v is number => typeof v === "number",
              (b) => b.number.min(0)
            )
        )
        .build();

      // 文字列の場合
      expect(validator.validate({ value: "abc" }).valid).toBe(true);
      expect(validator.validate({ value: "ab" }).valid).toBe(false);

      // 数値の場合
      expect(validator.validate({ value: 10 }).valid).toBe(true);
      expect(validator.validate({ value: -5 }).valid).toBe(false);

      // どちらでもない場合
      expect(validator.validate({ value: true }).valid).toBe(false);
      expect(validator.validate({ value: null }).valid).toBe(false);
    });
  });

  describe("T | T[] パターン", () => {
    test("string | string[] のユニオン型", () => {
      const validator = Builder()
        .use(unionGuardPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ value: any }>()
        .v("value", (b) =>
          b.union
            .guard(
              (v): v is string => typeof v === "string",
              (b) => b.string.required().min(2)
            )
            .guard(
              (v): v is string[] => Array.isArray(v),
              (b) => b.array.required().minLength(1)
            )
        )
        .build();

      // 文字列の場合
      expect(validator.validate({ value: "hello" }).valid).toBe(true);
      expect(validator.validate({ value: "h" }).valid).toBe(false);
      expect(validator.validate({ value: "" }).valid).toBe(false);

      // 配列の場合
      expect(validator.validate({ value: ["a", "b"] }).valid).toBe(true);
      expect(validator.validate({ value: ["single"] }).valid).toBe(true);
      expect(validator.validate({ value: [] }).valid).toBe(false);

      // どちらでもない場合
      expect(validator.validate({ value: 123 }).valid).toBe(false);
      expect(validator.validate({ value: null }).valid).toBe(false);
      expect(validator.validate({ value: undefined }).valid).toBe(false);
    });

    test("number | number[] のユニオン型", () => {
      const validator = Builder()
        .use(unionGuardPlugin)
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ value: any }>()
        .v("value", (b) =>
          b.union
            .guard(
              (v): v is number => typeof v === "number",
              (b) => b.number.required().min(0)
            )
            .guard(
              (v): v is number[] =>
                Array.isArray(v) && v.every((item) => typeof item === "number"),
              (b) => b.array.required().minLength(2)
            )
        )
        .build();

      // 数値の場合
      expect(validator.validate({ value: 10 }).valid).toBe(true);
      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: -5 }).valid).toBe(false);

      // 配列の場合
      expect(validator.validate({ value: [1, 2, 3] }).valid).toBe(true);
      expect(validator.validate({ value: [0, -5] }).valid).toBe(true);
      expect(validator.validate({ value: [1] }).valid).toBe(false);
      expect(validator.validate({ value: [] }).valid).toBe(false);

      // どちらでもない場合
      expect(validator.validate({ value: "string" }).valid).toBe(false);
      expect(validator.validate({ value: null }).valid).toBe(false);
    });

    test("オブジェクト | オブジェクト[] のユニオン型", () => {
      type Item = { id: string; name: string };
      type ItemOrItems = Item | Item[];

      const validator = Builder()
        .use(unionGuardPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ value: any }>()
        .v("value", (b) =>
          b.union
            .guard(
              (v): v is Item =>
                typeof v === "object" &&
                v !== null &&
                !Array.isArray(v) &&
                "id" in v,
              (b) => b.object.required()
            )
            .guard(
              (v): v is Item[] => Array.isArray(v),
              (b) => b.array.required().minLength(1)
            )
        )
        .build();

      // 単一オブジェクトの場合
      expect(
        validator.validate({ value: { id: "1", name: "Item 1" } }).valid
      ).toBe(true);

      // 配列の場合
      expect(
        validator.validate({
          value: [
            { id: "1", name: "Item 1" },
            { id: "2", name: "Item 2" },
          ],
        }).valid
      ).toBe(true);
      expect(validator.validate({ value: [] }).valid).toBe(false);

      // どちらでもない場合
      expect(validator.validate({ value: "string" }).valid).toBe(false);
      expect(validator.validate({ value: 123 }).valid).toBe(false);
      expect(validator.validate({ value: null }).valid).toBe(false);
    });
  });

  describe("複雑なユニオン型", () => {
    test("3つ以上の型のユニオン", () => {
      const validator = Builder()
        .use(unionGuardPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ value: any }>()
        .v("value", (b) =>
          b.union
            .guard(
              (v): v is string => typeof v === "string",
              (b) => b.string.required().min(2)
            )
            .guard(
              (v): v is number => typeof v === "number",
              (b) => b.number.required().min(0)
            )
            .guard(
              (v): v is boolean => typeof v === "boolean",
              (b) => b.boolean.required()
            )
        )
        .build();

      // 文字列
      expect(validator.validate({ value: "hello" }).valid).toBe(true);
      expect(validator.validate({ value: "h" }).valid).toBe(false);

      // 数値
      expect(validator.validate({ value: 10 }).valid).toBe(true);
      expect(validator.validate({ value: -5 }).valid).toBe(false);

      // ブール値
      expect(validator.validate({ value: true }).valid).toBe(true);
      expect(validator.validate({ value: false }).valid).toBe(true);

      // どれでもない場合
      expect(validator.validate({ value: null }).valid).toBe(false);
      expect(validator.validate({ value: undefined }).valid).toBe(false);
      expect(validator.validate({ value: [] }).valid).toBe(false);
    });

    test("ネストしたユニオン型", () => {
      type Response =
        | { status: "success"; data: string }
        | { status: "error"; message: string }
        | { status: "pending" };

      const validator = Builder()
        .use(unionGuardPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ response: any }>()
        .v("response", (b) =>
          b.union
            .guard(
              (v): v is { status: "success"; data: string } =>
                typeof v === "object" &&
                v !== null &&
                "status" in v &&
                v.status === "success",
              (b) => b.object.required()
            )
            .guard(
              (v): v is { status: "error"; message: string } =>
                typeof v === "object" &&
                v !== null &&
                "status" in v &&
                v.status === "error",
              (b) => b.object.required()
            )
            .guard(
              (v): v is { status: "pending" } =>
                typeof v === "object" &&
                v !== null &&
                "status" in v &&
                v.status === "pending",
              (b) => b.object.required()
            )
        )
        .build();

      // 成功ケース
      expect(
        validator.validate({ response: { status: "success", data: "result" } })
          .valid
      ).toBe(true);

      // エラーケース
      expect(
        validator.validate({
          response: { status: "error", message: "Something went wrong" },
        }).valid
      ).toBe(true);

      // ペンディングケース
      expect(
        validator.validate({ response: { status: "pending" } }).valid
      ).toBe(true);

      // 無効なケース
      expect(
        validator.validate({ response: { status: "unknown" } }).valid
      ).toBe(false);
      expect(validator.validate({ response: null }).valid).toBe(false);
    });
  });

  describe("エラーケース", () => {
    test("どのガードにもマッチしない場合", () => {
      const validator = Builder()
        .use(unionGuardPlugin)
        .for<{ value: any }>()
        .v("value", (b) =>
          b.union
            .guard(
              (v): v is string => typeof v === "string",
              (b) => b.string
            )
            .guard(
              (v): v is number => typeof v === "number",
              (b) => b.number
            )
        )
        .build();

      const result = validator.validate({ value: [] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("unionGuard");
    });

    test("空のガード", () => {
      const validator = Builder()
        .use(unionGuardPlugin)
        .for<{ value: any }>()
        .v("value", (b) => {
          // Call guard with no arguments to ensure the composer is initialized
          const unionBuilder = b.union as any;
          // Return the union builder without any guards
          return unionBuilder;
        })
        .build();

      expect(validator.validate({ value: "anything" }).valid).toBe(false);
      expect(validator.validate({ value: 123 }).valid).toBe(false);
      expect(validator.validate({ value: null }).valid).toBe(false);
    });
  });
});
