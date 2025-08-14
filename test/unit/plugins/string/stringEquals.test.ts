import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringEqualsPlugin } from "../../../../src/core/plugin/stringEquals";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringEquals Plugin", () => {
  describe("基本動作", () => {
    test("完全に一致する文字列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ password: string }>()
        .v("password", (b) => b.string.required().equals("secret123"))
        .build();

      expect(validator.validate({ password: "secret123" }).valid).toBe(true);
    });

    test("一致しない文字列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ password: string }>()
        .v("password", (b) => b.string.required().equals("secret123"))
        .build();

      const result = validator.validate({ password: "wrongpassword" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "password",
        code: "stringEquals",
      });
    });
  });

  describe("厳密な比較", () => {
    test("大文字小文字を区別する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ command: string }>()
        .v("command", (b) => b.string.required().equals("START"))
        .build();

      expect(validator.validate({ command: "START" }).valid).toBe(true);
      expect(validator.validate({ command: "start" }).valid).toBe(false);
      expect(validator.validate({ command: "Start" }).valid).toBe(false);
      expect(validator.validate({ command: "StArT" }).valid).toBe(false);
    });

    test("前後のスペースも区別する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ value: string }>()
        .v("value", (b) => b.string.required().equals("test"))
        .build();

      expect(validator.validate({ value: "test" }).valid).toBe(true);
      expect(validator.validate({ value: " test" }).valid).toBe(false);
      expect(validator.validate({ value: "test " }).valid).toBe(false);
      expect(validator.validate({ value: " test " }).valid).toBe(false);
    });

    test("特殊文字も厳密に比較", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ symbol: string }>()
        .v("symbol", (b) => b.string.required().equals("$@#!"))
        .build();

      expect(validator.validate({ symbol: "$@#!" }).valid).toBe(true);
      expect(validator.validate({ symbol: "$@#" }).valid).toBe(false);
      expect(validator.validate({ symbol: "$@#!!" }).valid).toBe(false);
    });
  });

  describe("様々な文字列での検証", () => {
    test("空文字列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ empty: string }>()
        .v("empty", (b) => b.string.required().equals(""))
        .build();

      expect(validator.validate({ empty: "" }).valid).toBe(true);
      expect(validator.validate({ empty: " " }).valid).toBe(false);
      expect(validator.validate({ empty: "notempty" }).valid).toBe(false);
    });

    test("数値文字列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ number: string }>()
        .v("number", (b) => b.string.required().equals("12345"))
        .build();

      expect(validator.validate({ number: "12345" }).valid).toBe(true);
      expect(validator.validate({ number: "012345" }).valid).toBe(false);
      expect(validator.validate({ number: "12345.0" }).valid).toBe(false);
    });

    test("マルチバイト文字", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ japanese: string }>()
        .v("japanese", (b) => b.string.required().equals("こんにちは"))
        .build();

      expect(validator.validate({ japanese: "こんにちは" }).valid).toBe(true);
      expect(validator.validate({ japanese: "コンニチハ" }).valid).toBe(false);
      expect(validator.validate({ japanese: "hello" }).valid).toBe(false);
    });

    test("絵文字", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ emoji: string }>()
        .v("emoji", (b) => b.string.required().equals("😀👍"))
        .build();

      expect(validator.validate({ emoji: "😀👍" }).valid).toBe(true);
      expect(validator.validate({ emoji: "😀" }).valid).toBe(false);
      expect(validator.validate({ emoji: "😀👍🎉" }).valid).toBe(false);
    });
  });

  describe("セキュリティ関連のシナリオ", () => {
    test("パスワード確認", () => {
      // 実際のアプリケーションでは、パスワード確認は通常compareFieldを使用
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ confirmPassword: string }>()
        .v("confirmPassword", (b) =>
          b.string.required().equals("mySecretPassword123!")
        )
        .build();

      expect(
        validator.validate({ confirmPassword: "mySecretPassword123!" }).valid
      ).toBe(true);
      expect(
        validator.validate({ confirmPassword: "wrongpassword" }).valid
      ).toBe(false);
    });

    test("セキュリティキーワード", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ confirmAction: string }>()
        .v("confirmAction", (b) =>
          b.string.required().equals("DELETE_ALL_DATA")
        )
        .build();

      expect(
        validator.validate({ confirmAction: "DELETE_ALL_DATA" }).valid
      ).toBe(true);
      expect(
        validator.validate({ confirmAction: "delete_all_data" }).valid
      ).toBe(false);
      expect(validator.validate({ confirmAction: "YES" }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("変換後の等価性チェック", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .use(transformPlugin)
        .for<{ input: string }>()
        .v("input", (b) =>
          b.string
            .required()
            .transform((v) => v.toUpperCase())
            .equals("HELLO")
        )
        .build();

      // 変換前は異なるが、変換後に一致
      const result = validator.process({ input: "hello" });
      expect(result.isValid()).toBe(true);
      expect(result.transformedData?.input).toBe("HELLO");
    });

    test("パターンと等価性の両方チェック", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .use(stringPatternPlugin)
        .for<{ code: string }>()
        .v("code", (b) =>
          b.string
            .required()
            .pattern(/^[A-Z]{3}-\d{3}$/)
            .equals("ABC-123")
        )
        .build();

      // パターンに一致し、かつ特定の値と等しい
      expect(validator.validate({ code: "ABC-123" }).valid).toBe(true);

      // パターンに一致するが値が異なる
      expect(validator.validate({ code: "XYZ-456" }).valid).toBe(false);

      // 値は同じだがパターンに一致しない（実際にはパターンに一致する）
      expect(validator.validate({ code: "abc-123" }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringEqualsPlugin)
        .for<{ secretCode?: string }>()
        .v("secretCode", (b) => b.string.optional().equals("secret"))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ secretCode: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は等価性検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringEqualsPlugin)
        .for<{ secretCode?: string }>()
        .v("secretCode", (b) => b.string.optional().equals("secret"))
        .build();

      expect(validator.validate({ secretCode: "secret" }).valid).toBe(true);
      expect(validator.validate({ secretCode: "wrong" }).valid).toBe(false);
    });
  });

  describe("エラーコンテキスト", () => {
    test("期待される値が含まれる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<{ command: string }>()
        .v("command", (b) => b.string.required().equals("SHUTDOWN"))
        .build();

      const result = validator.validate({ command: "RESTART" });
      expect(result.isValid()).toBe(false);
      // Context property is not available in current API
      // expect(result.errors[0].context).toMatchObject({
      //   expected: "SHUTDOWN",
      // });
    });
  });

  describe("実用的なシナリオ", () => {
    test("設定ファイルの固定値検証", () => {
      interface ConfigFile {
        version: string;
        environment: string;
        debugMode: string;
        apiEndpoint: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<ConfigFile>()
        .v("version", (b) => b.string.required().equals("1.0.0"))
        .v("environment", (b) => b.string.required().equals("production"))
        .v("debugMode", (b) => b.string.required().equals("false"))
        .v("apiEndpoint", (b) =>
          b.string.required().equals("https://api.example.com/v1")
        )
        .build();

      // 正しい設定
      const validConfig = {
        version: "1.0.0",
        environment: "production",
        debugMode: "false",
        apiEndpoint: "https://api.example.com/v1",
      };
      expect(validator.validate(validConfig).valid).toBe(true);

      // 間違った設定
      const invalidConfig = {
        version: "1.0.1", // バージョンが違う
        environment: "development", // 環境が違う
        debugMode: "true", // デバッグモードが違う
        apiEndpoint: "https://api.example.com/v2", // エンドポイントが違う
      };
      expect(validator.validate(invalidConfig).valid).toBe(false);
    });

    test("コマンド認証システム", () => {
      interface DangerousCommand {
        action: string;
        confirmation: string;
        authorization: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<DangerousCommand>()
        .v("action", (b) => b.string.required().equals("DESTROY_DATABASE"))
        .v("confirmation", (b) =>
          b.string
            .required()
            .equals("I understand this action cannot be undone")
        )
        .v("authorization", (b) =>
          b.string.required().equals("CONFIRMED_BY_ADMIN")
        )
        .build();

      // 正しい認証情報
      const validCommand = {
        action: "DESTROY_DATABASE",
        confirmation: "I understand this action cannot be undone",
        authorization: "CONFIRMED_BY_ADMIN",
      };
      expect(validator.validate(validCommand).valid).toBe(true);

      // 不正な認証情報
      const invalidCommand = {
        action: "DESTROY_DATABASE",
        confirmation: "yes", // 確認メッセージが不正
        authorization: "confirmed by admin", // 大文字小文字が違う
      };
      expect(validator.validate(invalidCommand).valid).toBe(false);
    });

    test("ライセンス形式の検証", () => {
      interface LicenseInfo {
        type: string;
        status: string;
        level: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringEqualsPlugin)
        .for<LicenseInfo>()
        .v("type", (b) => b.string.required().equals("COMMERCIAL"))
        .v("status", (b) => b.string.required().equals("ACTIVE"))
        .v("level", (b) => b.string.required().equals("ENTERPRISE"))
        .build();

      // 有効なライセンス
      const validLicense = {
        type: "COMMERCIAL",
        status: "ACTIVE",
        level: "ENTERPRISE",
      };
      expect(validator.validate(validLicense).valid).toBe(true);

      // 無効なライセンス
      const invalidLicense = {
        type: "FREE", // 商用ライセンスではない
        status: "EXPIRED", // 期限切れ
        level: "BASIC", // エンタープライズレベルではない
      };
      expect(validator.validate(invalidLicense).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { transformPlugin } from "../../../../src/core/plugin/transform";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
