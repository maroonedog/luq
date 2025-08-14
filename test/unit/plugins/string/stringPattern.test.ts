import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringPattern Plugin", () => {
  describe("基本動作", () => {
    test("パターンにマッチする文字列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().pattern(/^[A-Z]{3}-\d{3}$/))
        .build();

      const result = validator.validate({ code: "ABC-123" });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("パターンにマッチしない文字列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().pattern(/^[A-Z]{3}-\d{3}$/))
        .build();

      const result = validator.validate({ code: "abc-123" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "code",
        code: "stringPattern",
      });
    });
  });

  describe("様々なパターンでのテスト", () => {
    test("メールアドレスパターン", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ email: string }>()
        .v("email", (b) =>
          b.string.required().pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
        )
        .build();

      expect(validator.validate({ email: "test@example.com" }).valid).toBe(
        true
      );
      expect(validator.validate({ email: "invalid.email" }).valid).toBe(false);
    });

    test("電話番号パターン", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ phone: string }>()
        .v("phone", (b) => b.string.required().pattern(/^\d{3}-\d{4}-\d{4}$/))
        .build();

      expect(validator.validate({ phone: "090-1234-5678" }).valid).toBe(true);
      expect(validator.validate({ phone: "09012345678" }).valid).toBe(false);
    });

    test("URLパターン", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ url: string }>()
        .v("url", (b) => b.string.required().pattern(/^https?:\/\/.+/))
        .build();

      expect(validator.validate({ url: "https://example.com" }).valid).toBe(
        true
      );
      expect(validator.validate({ url: "http://test.com" }).valid).toBe(true);
      expect(validator.validate({ url: "ftp://example.com" }).valid).toBe(
        false
      );
    });

    test("16進数カラーコード", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ color: string }>()
        .v("color", (b) => b.string.required().pattern(/^#[0-9A-Fa-f]{6}$/))
        .build();

      expect(validator.validate({ color: "#FF5733" }).valid).toBe(true);
      expect(validator.validate({ color: "#ff5733" }).valid).toBe(true);
      expect(validator.validate({ color: "#GG5733" }).valid).toBe(false);
      expect(validator.validate({ color: "FF5733" }).valid).toBe(false);
    });
  });

  describe("特殊なパターン", () => {
    test("空文字列を許可するパターン", () => {
      const validator = Builder()
        .use(stringPatternPlugin)
        .for<{ value: string }>()
        .v("value", (b) => b.string.pattern(/^[a-z]*$/))
        .build();

      expect(validator.validate({ value: "" }).valid).toBe(true);
      expect(validator.validate({ value: "abc" }).valid).toBe(true);
      expect(validator.validate({ value: "ABC" }).valid).toBe(false);
    });

    test("改行を含むパターン", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ text: string }>()
        .v("text", (b) => b.string.required().pattern(/^line1\nline2$/))
        .build();

      expect(validator.validate({ text: "line1\nline2" }).valid).toBe(true);
      expect(validator.validate({ text: "line1 line2" }).valid).toBe(false);
    });

    test("日本語を含むパターン", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().pattern(/^[ぁ-ん]+$/))
        .build();

      expect(validator.validate({ name: "ひらがな" }).valid).toBe(true);
      expect(validator.validate({ name: "カタカナ" }).valid).toBe(false);
      expect(validator.validate({ name: "hiragana" }).valid).toBe(false);
    });
  });

  describe("フラグ付き正規表現", () => {
    test("大文字小文字を無視するパターン（iフラグ）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ value: string }>()
        .v("value", (b) => b.string.required().pattern(/^hello$/i))
        .build();

      expect(validator.validate({ value: "hello" }).valid).toBe(true);
      expect(validator.validate({ value: "HELLO" }).valid).toBe(true);
      expect(validator.validate({ value: "HeLLo" }).valid).toBe(true);
    });

    test("複数行モード（mフラグ）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ text: string }>()
        .v("text", (b) => b.string.required().pattern(/^start.*end$/m))
        .build();

      expect(validator.validate({ text: "start middle end" }).valid).toBe(true);
      expect(
        validator.validate({ text: "prefix\nstart middle end\nsuffix" }).valid
      ).toBe(true);
    });
  });

  describe("エッジケース", () => {
    test("空文字列の処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ value: string }>()
        .v("value", (b) => b.string.required().pattern(/^.+$/))
        .build();

      expect(validator.validate({ value: "" }).valid).toBe(false);
    });

    test("特殊文字を含むパターン", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ value: string }>()
        .v("value", (b) => b.string.required().pattern(/^[\(\)\[\]\{\}]+$/))
        .build();

      expect(validator.validate({ value: "()[]{}" }).valid).toBe(true);
      expect(validator.validate({ value: "abc" }).valid).toBe(false);
    });

    test("バックスラッシュを含むパターン", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ path: string }>()
        .v("path", (b) => b.string.required().pattern(/^C:\\[^\\]+\\[^\\]+$/))
        .build();

      expect(validator.validate({ path: "C:\\Users\\test" }).valid).toBe(true);
      expect(validator.validate({ path: "C:/Users/test" }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringPatternPlugin)
        .for<{ code?: string }>()
        .v("code", (b) => b.string.optional().pattern(/^[A-Z]{3}$/))
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(true);
    });

    test("値が存在する場合は通常通りバリデーション", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringPatternPlugin)
        .for<{ code?: string }>()
        .v("code", (b) => b.string.optional().pattern(/^[A-Z]{3}$/))
        .build();

      expect(validator.validate({ code: "ABC" }).valid).toBe(true);
      expect(validator.validate({ code: "abc" }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ code: string }>()
        .v("code", (b) =>
          b.string.required().pattern(/^[A-Z]{3}$/, {
            messageFactory: () => "コードは大文字3文字で入力してください",
          })
        )
        .build();

      const result = validator.validate({ code: "abc" });
      expect(result.errors[0].message).toBe(
        "コードは大文字3文字で入力してください"
      );
    });
  });

  describe("パフォーマンステスト", () => {
    test("複雑なパターンでも高速に動作する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .for<{ email: string }>()
        .v("email", (b) =>
          b.string
            .required()
            .pattern(
              /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
            )
        )
        .build();

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        validator.validate({ email: "test.user+tag@example.com" });
      }

      const end = performance.now();
      const timePerValidation = (end - start) / 1000;

      // 1回のバリデーションが1ms未満であることを確認
      expect(timePerValidation).toBeLessThan(1);
    });
  });
});
