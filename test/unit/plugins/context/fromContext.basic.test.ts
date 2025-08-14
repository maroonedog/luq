/**
 * fromContext Plugin - 基本テスト
 * TypeScriptの複雑な型エラーを回避した基本動作テスト
 */

import { describe, test, expect } from "@jest/globals";

describe("fromContext Plugin - 基本テスト", () => {
  test("プラグインがインポートできること", () => {
    try {
      const {
        fromContextPlugin,
      } = require("../../../../src/core/plugin/fromContext");
      expect(fromContextPlugin).toBeDefined();
      expect(fromContextPlugin.name).toBe("fromContext");
      expect(fromContextPlugin.methodName).toBe("fromContext");
      expect(fromContextPlugin.category).toBe("context");
    } catch (error) {
      console.error("Import error:", error);
      throw error;
    }
  });

  test("プラグイン作成者（plugin creator）が正しく動作すること", () => {
    try {
      const {
        fromContextPlugin,
      } = require("../../../../src/core/plugin/fromContext");

      // プラグインの基本実装をテスト
      const implementation = (fromContextPlugin as any).impl({
        validate: (value: string, context: any) => ({
          valid: true,
          message: "Test validation",
        }),
        required: false,
        fallbackToValid: true,
      });

      expect(typeof implementation).toBe("function");

      // モックコンテキストでテスト
      const mockContext = {
        allValues: { test: "value" },
        currentValue: "test",
        originalValue: "test",
        path: "test",
        reporter: {
          report: () => {},
          getReports: () => [],
        },
      };

      const result = implementation("test", mockContext, mockContext.reporter);
      expect(result).toBeDefined();
      expect(typeof result.isValid()).toBe("boolean");
    } catch (error) {
      console.error("Plugin creation error:", error);
      throw error;
    }
  });

  test("passwordConfirmation ヘルパーが正しく動作すること", () => {
    try {
      const {
        passwordConfirmation,
      } = require("../../../../src/core/plugin/fromContext");

      const options = passwordConfirmation();
      expect(options).toBeDefined();
      expect(typeof options.validate).toBe("function");
      expect(options.required).toBe(false);
      expect(options.fallbackToValid).toBe(true);

      // パスワード一致テスト
      const validResult = options.validate(
        "password123",
        {},
        { password: "password123" }
      );
      expect(validResult.isValid()).toBe(true);

      // パスワード不一致テスト
      const invalidResult = options.validate(
        "password456",
        {},
        { password: "password123" }
      );
      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.message).toBe(
        "Password confirmation does not match"
      );
    } catch (error) {
      console.error("Helper function error:", error);
      throw error;
    }
  });

  test("emailDuplicationCheck ヘルパーが正しく動作すること", () => {
    try {
      const {
        emailDuplicationCheck,
      } = require("../../../../src/core/plugin/fromContext");

      const options = emailDuplicationCheck();
      expect(options).toBeDefined();
      expect(typeof options.validate).toBe("function");
      expect(options.required).toBe(true);

      // メールが存在しない場合
      const validResult = options.validate(
        "test@example.com",
        { hasEmail: false },
        {}
      );
      expect(validResult.isValid()).toBe(true);

      // メールが存在する場合
      const invalidResult = options.validate(
        "test@example.com",
        { hasEmail: true },
        {}
      );
      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.message).toContain("already registered");
    } catch (error) {
      console.error("Helper function error:", error);
      throw error;
    }
  });

  test("カスタムバリデーション関数が正しく実行されること", () => {
    try {
      const {
        fromContextPlugin,
      } = require("../../../../src/core/plugin/fromContext");

      // カスタム検証オプション
      const customValidation = {
        validate: (
          value: string,
          context: { isValid: boolean },
          allValues: any
        ) => {
          if (!context || typeof context.isValid !== "boolean") {
            return { valid: false, message: "Context not available" };
          }
          return {
            valid: context.isValid && value.length > 5,
            message: context.isValid
              ? "Value too short"
              : "Context validation failed",
          };
        },
        required: false,
        fallbackToValid: false,
      };

      const implementation = (fromContextPlugin as any).impl(customValidation);

      // コンテキストありで成功
      const mockContext1 = {
        allValues: { isValid: true },
        context: { isValid: true },
      };
      const result1 = implementation("long_value", mockContext1, {});
      expect(result1.valid).toBe(true);

      // コンテキストありで失敗（値が短い）
      const result2 = implementation("short", mockContext1, {});
      expect(result2.valid).toBe(false);
      expect(result2.message).toBe("Value too short");

      // コンテキストなしで失敗
      const mockContext3 = {
        allValues: {},
      };
      const result3 = implementation("any_value", mockContext3, {});
      expect(result3.valid).toBe(false);
    } catch (error) {
      console.error("Custom validation error:", error);
      throw error;
    }
  });

  test("エラーハンドリングが正しく動作すること", () => {
    try {
      const {
        fromContextPlugin,
      } = require("../../../../src/core/plugin/fromContext");

      // エラーが発生するバリデーション関数
      const errorValidation = {
        validate: () => {
          throw new Error("Validation error");
        },
        required: false,
        errorMessage: "Custom error occurred",
      };

      const implementation = (fromContextPlugin as any).impl(errorValidation);
      const mockContext = {
        allValues: { test: true },
      };

      const result = implementation("test", mockContext, {});
      expect(result.isValid()).toBe(false);
      expect(result.message).toBe("Custom error occurred");
    } catch (error) {
      console.error("Error handling test error:", error);
      throw error;
    }
  });

  test("required フラグの動作確認", () => {
    try {
      const {
        fromContextPlugin,
      } = require("../../../../src/core/plugin/fromContext");

      // required: true の場合
      const requiredValidation = {
        validate: (value: string, context: { exists: boolean }) => ({
          valid: !context.exists,
        }),
        required: true,
      };

      const implementation = (fromContextPlugin as any).impl(requiredValidation);

      // コンテキストなしでテスト
      const mockContext = {
        allValues: {},
      };

      const result = implementation("test", mockContext, {});
      expect(result.isValid()).toBe(false);
      expect(result.message).toBe("Context data is required for validation");
    } catch (error) {
      console.error("Required flag test error:", error);
      throw error;
    }
  });

  test("fallbackToValid フラグの動作確認", () => {
    try {
      const {
        fromContextPlugin,
      } = require("../../../../src/core/plugin/fromContext");

      // fallbackToValid: true の場合
      const fallbackTrueValidation = {
        validate: () => ({ valid: false }),
        required: false,
        fallbackToValid: true,
      };

      // fallbackToValid: false の場合
      const fallbackFalseValidation = {
        validate: () => ({ valid: false }),
        required: false,
        fallbackToValid: false,
      };

      const impl1 = (fromContextPlugin as any).impl(fallbackTrueValidation);
      const impl2 = (fromContextPlugin as any).impl(fallbackFalseValidation);

      const mockContext = {
        allValues: {},
      };

      const result1 = impl1("test", mockContext, {});
      expect(result1.valid).toBe(true); // fallbackToValid: true

      const result2 = impl2("test", mockContext, {});
      expect(result2.valid).toBe(false); // fallbackToValid: false
    } catch (error) {
      console.error("Fallback test error:", error);
      throw error;
    }
  });
});

// 型安全性に依存しない統合テスト
describe("fromContext Plugin - 統合テスト", () => {
  test("実際のBuilderとの統合", () => {
    try {
      // 動的インポートを使用してTypeScriptの型エラーを回避
      const { Builder } = require("../../../../src");
      const {
        fromContextPlugin,
      } = require("../../../../src/core/plugin/fromContext");

      // プラグインが正しく登録されることを確認
      expect(() => {
        const builder = Builder().use(fromContextPlugin);
        expect(builder).toBeDefined();
      }).not.toThrow();
    } catch (error) {
      console.error("Integration test error:", error);
      throw error;
    }
  });
});
