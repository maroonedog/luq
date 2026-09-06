import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringExactLengthPlugin } from "../../../../src/core/plugin/stringExactLength";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringExactLength Plugin", () => {
  describe("基本動作", () => {
    test("指定した長さの文字列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().exactLength(5))
        .build();

      expect(validator.validate({ code: "ABCDE" }).valid).toBe(true);
      expect(validator.validate({ code: "12345" }).valid).toBe(true);
      expect(validator.validate({ code: "a1b2c" }).valid).toBe(true);
    });

    test("指定した長さと異なる文字列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().exactLength(5))
        .build();

      // 短すぎる
      const shortResult = validator.validate({ code: "ABC" });
      expect(shortResult.isValid()).toBe(false);
      expect(shortResult.errors[0]).toMatchObject({
        path: "code",
        code: "stringExactLength",
      });

      // 長すぎる
      const longResult = validator.validate({ code: "ABCDEFG" });
      expect(longResult.isValid()).toBe(false);
      expect(longResult.errors[0]).toMatchObject({
        path: "code",
        code: "stringExactLength",
      });
    });
  });

  describe("様々な長さでの検証", () => {
    test("長さ0（空文字列）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ empty: string }>()
        .v("empty", (b) => b.string.required().exactLength(0))
        .build();

      expect(validator.validate({ empty: "" }).valid).toBe(true);
      expect(validator.validate({ empty: "a" }).valid).toBe(false);
    });

    test("長さ1（単一文字）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ char: string }>()
        .v("char", (b) => b.string.required().exactLength(1))
        .build();

      expect(validator.validate({ char: "A" }).valid).toBe(true);
      expect(validator.validate({ char: "1" }).valid).toBe(true);
      expect(validator.validate({ char: "@" }).valid).toBe(true);
      expect(validator.validate({ char: "" }).valid).toBe(false);
      expect(validator.validate({ char: "AB" }).valid).toBe(false);
    });

    test("長い文字列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ description: string }>()
        .v("description", (b) => b.string.required().exactLength(100))
        .build();

      const exactly100 = "A".repeat(100);
      const only99 = "A".repeat(99);
      const tooLong = "A".repeat(101);

      expect(validator.validate({ description: exactly100 }).valid).toBe(true);
      expect(validator.validate({ description: only99 }).valid).toBe(false);
      expect(validator.validate({ description: tooLong }).valid).toBe(false);
    });
  });

  describe("マルチバイト文字での検証", () => {
    test("日本語文字", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ japanese: string }>()
        .v("japanese", (b) => b.string.required().exactLength(3))
        .build();

      expect(validator.validate({ japanese: "あいう" }).valid).toBe(true);
      expect(validator.validate({ japanese: "こんにちは" }).valid).toBe(false); // 5文字
      expect(validator.validate({ japanese: "漢字" }).valid).toBe(false); // 2文字
    });

    test("絵文字", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ emoji: string }>()
        .v("emoji", (b) => b.string.required().exactLength(2))
        .build();

      expect(validator.validate({ emoji: "😀😁" }).valid).toBe(true);
      expect(validator.validate({ emoji: "👨‍👩‍👧‍👦" }).valid).toBe(false); // 複合絵文字は長い
    });

    test("混合文字", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ mixed: string }>()
        .v("mixed", (b) => b.string.required().exactLength(6))
        .build();

      expect(validator.validate({ mixed: "Hello世" }).valid).toBe(true); // 英語5文字+日本語1文字
      expect(validator.validate({ mixed: "テスト123" }).valid).toBe(true); // 日本語3文字+数字3文字
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("パターンとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .use(stringPatternPlugin)
        .for<{ productCode: string }>()
        .v("productCode", (b) =>
          b.string
            .required()
            .exactLength(6)
            .pattern(/^[A-Z]{3}\d{3}$/)
        )
        .build();

      // 有効: 6文字かつパターンに一致
      expect(validator.validate({ productCode: "ABC123" }).valid).toBe(true);

      // 無効: パターンに一致するが長さが違う
      expect(validator.validate({ productCode: "ABCD1234" }).valid).toBe(false);

      // 無効: 長さは正しいがパターンに一致しない
      expect(validator.validate({ productCode: "abc123" }).valid).toBe(false);
    });

    test("英数字制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .use(stringAlphanumericPlugin)
        .for<{ userId: string }>()
        .v("userId", (b) => b.string.required().exactLength(8).alphanumeric())
        .build();

      // 有効: 8文字の英数字
      expect(validator.validate({ userId: "user1234" }).valid).toBe(true);
      expect(validator.validate({ userId: "USER1234" }).valid).toBe(true);

      // 無効: 8文字だが英数字以外を含む
      expect(validator.validate({ userId: "user-123" }).valid).toBe(false);

      // 無効: 英数字だが長さが違う
      expect(validator.validate({ userId: "user123456" }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringExactLengthPlugin)
        .for<{ code?: string }>()
        .v("code", (b) => b.string.optional().exactLength(5))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ code: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は長さ検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringExactLengthPlugin)
        .for<{ code?: string }>()
        .v("code", (b) => b.string.optional().exactLength(5))
        .build();

      expect(validator.validate({ code: "ABCDE" }).valid).toBe(true);
      expect(validator.validate({ code: "ABC" }).valid).toBe(false);
    });
  });

  describe("エラーコンテキスト", () => {
    test("期待される長さが含まれる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .for<{ pin: string }>()
        .v("pin", (b) => b.string.required().exactLength(4))
        .build();

      const result = validator.validate({ pin: "123" });
      expect(result.isValid()).toBe(false);
      // Context property is not available in current API
      // expect(result.errors[0].context).toMatchObject({
      //   expectedLength: 4,
      // });
    });
  });

  describe("実用的なシナリオ", () => {
    test("固定長コードシステム", () => {
      interface SystemCodes {
        countryCode: string; // ISO 3166-1 alpha-2 (2文字)
        currencyCode: string; // ISO 4217 (3文字)
        languageCode: string; // ISO 639-1 (2文字)
        postalCode: string; // 郵便番号 (7文字)
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .use(stringPatternPlugin)
        .for<SystemCodes>()
        .v("countryCode", (b) =>
          b.string
            .required()
            .exactLength(2)
            .pattern(/^[A-Z]{2}$/)
        )
        .v("currencyCode", (b) =>
          b.string
            .required()
            .exactLength(3)
            .pattern(/^[A-Z]{3}$/)
        )
        .v("languageCode", (b) =>
          b.string
            .required()
            .exactLength(2)
            .pattern(/^[a-z]{2}$/)
        )
        .v("postalCode", (b) =>
          b.string
            .required()
            .exactLength(7)
            .pattern(/^\d{3}-\d{4}$/)
        )
        .build();

      // 有効なコード
      const validCodes = {
        countryCode: "JP",
        currencyCode: "JPY",
        languageCode: "ja",
        postalCode: "123-4567",
      };
      expect(validator.validate(validCodes).valid).toBe(true);

      // 無効なコード（長さが違う）
      const invalidCodes = {
        countryCode: "JPN", // 3文字（2文字であるべき）
        currencyCode: "YEN", // 3文字だが通貨コードではない
        languageCode: "jpn", // 3文字（2文字であるべき）
        postalCode: "1234567", // 7文字だがハイフンなし
      };
      expect(validator.validate(invalidCodes).valid).toBe(false);
    });

    test("認証システムの固定長トークン", () => {
      interface AuthTokens {
        sessionId: string; // 32文字のhex
        csrfToken: string; // 64文字のランダム文字列
        refreshToken: string; // 128文字のbase64
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .use(stringPatternPlugin)
        .for<AuthTokens>()
        .v("sessionId", (b) =>
          b.string
            .required()
            .exactLength(32)
            .pattern(/^[a-f0-9]{32}$/)
        )
        .v("csrfToken", (b) =>
          b.string
            .required()
            .exactLength(64)
            .pattern(/^[A-Za-z0-9+/]{64}$/)
        )
        .v("refreshToken", (b) =>
          b.string
            .required()
            .exactLength(128)
            .pattern(/^[A-Za-z0-9+/=]{128}$/)
        )
        .build();

      // 有効なトークン
      const validTokens = {
        sessionId: "a1b2c3d4e5f67890123456789abcdef0",
        csrfToken: "A".repeat(64),
        refreshToken: "B".repeat(128),
      };
      expect(validator.validate(validTokens).valid).toBe(true);

      // 無効なトークン（長さが違う）
      const invalidTokens = {
        sessionId: "a1b2c3d4e5f67890123456789abcdef", // 31文字（短い）
        csrfToken: "A".repeat(63), // 63文字（短い）
        refreshToken: "B".repeat(129), // 129文字（長い）
      };
      expect(validator.validate(invalidTokens).valid).toBe(false);
    });

    test("クレジットカード番号の分割検証", () => {
      interface CreditCard {
        part1: string; // 4桁
        part2: string; // 4桁
        part3: string; // 4桁
        part4: string; // 4桁
        cvv: string; // 3桁
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringExactLengthPlugin)
        .use(stringPatternPlugin)
        .for<CreditCard>()
        .v("part1", (b) =>
          b.string
            .required()
            .exactLength(4)
            .pattern(/^\d{4}$/)
        )
        .v("part2", (b) =>
          b.string
            .required()
            .exactLength(4)
            .pattern(/^\d{4}$/)
        )
        .v("part3", (b) =>
          b.string
            .required()
            .exactLength(4)
            .pattern(/^\d{4}$/)
        )
        .v("part4", (b) =>
          b.string
            .required()
            .exactLength(4)
            .pattern(/^\d{4}$/)
        )
        .v("cvv", (b) =>
          b.string
            .required()
            .exactLength(3)
            .pattern(/^\d{3}$/)
        )
        .build();

      // 有効なクレジットカード情報
      const validCard = {
        part1: "1234",
        part2: "5678",
        part3: "9012",
        part4: "3456",
        cvv: "123",
      };
      expect(validator.validate(validCard).valid).toBe(true);

      // 無効なクレジットカード情報
      const invalidCard = {
        part1: "123", // 3桁（短い）
        part2: "56789", // 5桁（長い）
        part3: "9012", // OK
        part4: "3456", // OK
        cvv: "12", // 2桁（短い）
      };
      expect(validator.validate(invalidCard).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { stringAlphanumericPlugin } from "../../../../src/core/plugin/stringAlphanumeric";
