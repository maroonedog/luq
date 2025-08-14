import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringMax Plugin", () => {
  describe("基本動作", () => {
    test("最大長以下の文字列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().max(10))
        .build();

      const result = validator.validate({ name: "hello" });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("最大長を超える文字列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().max(5))
        .build();

      const result = validator.validate({ name: "hello world" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "name",
        code: "stringMax",
      });
    });

    test("境界値での動作確認", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().max(5))
        .build();

      // ちょうど5文字
      expect(validator.validate({ name: "abcde" }).valid).toBe(true);
      // 6文字（境界値+1）
      expect(validator.validate({ name: "abcdef" }).valid).toBe(false);
      // 4文字（境界値-1）
      expect(validator.validate({ name: "abcd" }).valid).toBe(true);
    });
  });

  describe("エッジケース", () => {
    test("空文字列の処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().max(10))
        .build();

      const result = validator.validate({ name: "" });
      expect(result.isValid()).toBe(true);
    });

    test("マルチバイト文字の処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().max(3))
        .build();

      // 3文字の日本語
      expect(validator.validate({ name: "あいう" }).valid).toBe(true);
      // 4文字の日本語
      expect(validator.validate({ name: "あいうえ" }).valid).toBe(false);
    });

    test("絵文字の処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().max(2))
        .build();

      // 2つの絵文字
      expect(validator.validate({ name: "😀😁" }).valid).toBe(true);
      // 3つの絵文字
      expect(validator.validate({ name: "😀😁😂" }).valid).toBe(false);
    });

    test("サロゲートペアの処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().max(2))
        .build();

      // サロゲートペアを含む文字列
      const surrogatePair = "𠮷野家"; // 𠮷は1文字だがlengthは2
      expect(validator.validate({ name: surrogatePair }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMaxPlugin)
        .for<{ name?: string }>()
        .v("name", (b) => b.string.optional().max(10))
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(true);
    });

    test("値が存在する場合は通常通りバリデーション", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMaxPlugin)
        .for<{ name?: string }>()
        .v("name", (b) => b.string.optional().max(5))
        .build();

      expect(validator.validate({ name: "hello" }).valid).toBe(true);
      expect(validator.validate({ name: "hello world" }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string.required().max(5, {
            messageFactory: () => "名前は5文字以内で入力してください",
          })
        )
        .build();

      const result = validator.validate({ name: "too long name" });
      expect(result.errors[0].message).toBe(
        "名前は5文字以内で入力してください"
      );
    });
  });

  describe("最大長0の特殊ケース", () => {
    test("最大長0は空文字列のみ許可する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().max(0))
        .build();

      expect(validator.validate({ name: "" }).valid).toBe(true);
      expect(validator.validate({ name: "a" }).valid).toBe(false);
    });
  });

  describe("非常に大きな最大長", () => {
    test("実用的な範囲の最大長で正常に動作する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ content: string }>()
        .v("content", (b) => b.string.required().max(1000000))
        .build();

      const longString = "a".repeat(100000);
      expect(validator.validate({ content: longString }).valid).toBe(true);

      const tooLongString = "a".repeat(1000001);
      expect(validator.validate({ content: tooLongString }).valid).toBe(false);
    });
  });
});
