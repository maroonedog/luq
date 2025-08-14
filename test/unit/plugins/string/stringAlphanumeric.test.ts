import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringAlphanumericPlugin } from "../../../../src/core/plugin/stringAlphanumeric";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringAlphanumeric Plugin", () => {
  describe("基本動作", () => {
    test("英数字のみの文字列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().alphanumeric())
        .build();

      // 有効な英数字文字列
      expect(validator.validate({ code: "abc123" }).valid).toBe(true);
      expect(validator.validate({ code: "ABC123" }).valid).toBe(true);
      expect(validator.validate({ code: "123456" }).valid).toBe(true);
      expect(validator.validate({ code: "abcdef" }).valid).toBe(true);
      expect(validator.validate({ code: "ABCDEF" }).valid).toBe(true);
      expect(validator.validate({ code: "a1b2c3" }).valid).toBe(true);
      expect(validator.validate({ code: "0" }).valid).toBe(true);
      expect(validator.validate({ code: "z" }).valid).toBe(true);
    });

    test("英数字以外を含む文字列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().alphanumeric())
        .build();

      const invalidStrings = [
        "abc 123", // スペース
        "abc-123", // ハイフン
        "abc_123", // アンダースコア
        "abc.123", // ピリオド
        "abc@123", // @記号
        "abc!123", // 感嘆符
        "abc#123", // シャープ
        "abc$123", // ドル記号
        "abc%123", // パーセント
        "abc&123", // アンパサンド
        "abc*123", // アスタリスク
        "abc+123", // プラス
        "abc=123", // イコール
        "abc/123", // スラッシュ
        "abc\\123", // バックスラッシュ
        "abc(123)", // 括弧
        "abc[123]", // 角括弧
        "abc{123}", // 波括弧
        "abc<123>", // 山括弧
        "abc,123", // カンマ
        "abc;123", // セミコロン
        "abc:123", // コロン
        "abc'123", // シングルクォート
        'abc"123', // ダブルクォート
        "あいう123", // 日本語
        "中文123", // 中国語
        "한글123", // 韓国語
        "café", // アクセント文字
        "naïve", // ウムラウト
        "", // 空文字列
      ];

      invalidStrings.forEach((str) => {
        const result = validator.validate({ code: str });
        expect(result.isValid()).toBe(false);
        expect(result.errors[0]).toMatchObject({
          path: "code",
          code: "stringAlphanumeric",
        });
      });
    });
  });

  describe("エッジケース", () => {
    test("空文字列の扱い", () => {
      // Test with required - should fail with "required" error
      const validatorWithRequired = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().alphanumeric())
        .build();

      const resultWithRequired = validatorWithRequired.validate({ code: "" });
      expect(resultWithRequired.valid).toBe(false);
      expect(resultWithRequired.errors[0].code).toBe("required");

      // Test without required - should fail with "stringAlphanumeric" error
      const validator = Builder()
        .use(stringAlphanumericPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.alphanumeric())
        .build();

      const result = validator.validate({ code: "" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("stringAlphanumeric");
    });

    test("数字のみの文字列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().alphanumeric())
        .build();

      expect(validator.validate({ code: "0123456789" }).valid).toBe(true);
    });

    test("文字のみの文字列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().alphanumeric())
        .build();

      expect(
        validator.validate({ code: "abcdefghijklmnopqrstuvwxyz" }).valid
      ).toBe(true);
      expect(
        validator.validate({ code: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" }).valid
      ).toBe(true);
    });

    test("非ASCII文字を含む場合", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().alphanumeric())
        .build();

      // 絵文字
      expect(validator.validate({ code: "abc😀123" }).valid).toBe(false);
      // 特殊記号
      expect(validator.validate({ code: "abc™123" }).valid).toBe(false);
      // 数学記号
      expect(validator.validate({ code: "abc∑123" }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("長さ制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<{ productCode: string }>()
        .v("productCode", (b) =>
          b.string.required().alphanumeric().min(4).max(10)
        )
        .build();

      // 有効: 英数字かつ長さが4-10
      expect(validator.validate({ productCode: "ABC123" }).valid).toBe(true);
      expect(validator.validate({ productCode: "1234" }).valid).toBe(true);
      expect(validator.validate({ productCode: "ABCD1234EF" }).valid).toBe(
        true
      );

      // 無効: 短すぎる
      expect(validator.validate({ productCode: "A1" }).valid).toBe(false);

      // 無効: 長すぎる
      expect(validator.validate({ productCode: "ABCDEFGHIJK123" }).valid).toBe(
        false
      );

      // 無効: 英数字以外を含む
      expect(validator.validate({ productCode: "ABC-123" }).valid).toBe(false);
    });

    test("パターンとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .use(stringPatternPlugin)
        .for<{ serial: string }>()
        .v("serial", (b) =>
          b.string
            .required()
            .alphanumeric()
            .pattern(/^[A-Z]{2}\d{4}$/)
        ) // 大文字2文字 + 数字4文字
        .build();

      // 有効: 英数字かつパターンに一致
      expect(validator.validate({ serial: "AB1234" }).valid).toBe(true);
      expect(validator.validate({ serial: "XY9999" }).valid).toBe(true);

      // 無効: パターンに一致しない
      expect(validator.validate({ serial: "ab1234" }).valid).toBe(false); // 小文字
      expect(validator.validate({ serial: "ABC123" }).valid).toBe(false); // 形式が違う
      expect(validator.validate({ serial: "123456" }).valid).toBe(false); // 数字のみ
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ code?: string }>()
        .v("code", (b) => b.string.optional().alphanumeric())
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ code: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は英数字検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ code?: string }>()
        .v("code", (b) => b.string.optional().alphanumeric())
        .build();

      expect(validator.validate({ code: "ABC123" }).valid).toBe(true);
      expect(validator.validate({ code: "ABC-123" }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("デフォルトエラーメッセージを確認", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ userId: string }>()
        .v("userId", (b) => b.string.required().alphanumeric())
        .build();

      const result = validator.validate({ userId: "user-123" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("stringAlphanumeric");
    });

    test("スペースありのバリデーション", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().alphanumeric(true))
        .build();

      expect(validator.validate({ name: "John Doe 123" }).valid).toBe(true);
      expect(validator.validate({ name: "John-Doe" }).valid).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("商品コードのバリデーション", () => {
      interface Product {
        sku: string;
        batchCode?: string;
        serialNumber: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringAlphanumericPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(stringPatternPlugin)
        .for<Product>()
        .v("sku", (b) => b.string.required().alphanumeric().min(8).max(12))
        .v("batchCode", (b) =>
          b.string
            .optional()
            .alphanumeric()
            .pattern(/^[A-Z]\d{6}$/)
        )
        .v("serialNumber", (b) => b.string.required().alphanumeric().min(10))
        .build();

      // 有効な商品
      const validProduct = {
        sku: "PROD123456",
        batchCode: "A123456",
        serialNumber: "SN1234567890",
      };
      expect(validator.validate(validProduct).valid).toBe(true);

      // 無効な商品
      const invalidProduct = {
        sku: "PROD-123456", // ハイフンが含まれる
        batchCode: "a123456", // 小文字で始まる
        serialNumber: "SN-12345", // ハイフンが含まれ、短すぎる
      };
      const result = validator.validate(invalidProduct);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    test("ユーザー名のバリデーション", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringAlphanumericPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<{ username: string }>()
        .v("username", (b) => b.string.required().alphanumeric().min(3).max(20))
        .build();

      // 有効なユーザー名
      expect(validator.validate({ username: "user123" }).valid).toBe(true);
      expect(validator.validate({ username: "JohnDoe2024" }).valid).toBe(true);

      // 無効なユーザー名
      expect(validator.validate({ username: "user_123" }).valid).toBe(false); // アンダースコア
      expect(validator.validate({ username: "user@domain" }).valid).toBe(false); // @記号
      expect(validator.validate({ username: "ab" }).valid).toBe(false); // 短すぎる
    });
  });
});

// 必要なimportを追加
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
