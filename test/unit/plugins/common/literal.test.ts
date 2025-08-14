import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { literalPlugin } from "../../../../src/core/plugin/literal";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("literal Plugin", () => {
  describe("基本動作", () => {
    test("指定したリテラル値を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ status: "active" }>()
        .v("status", (b) => b.string.required().literal("active"))
        .build();

      expect(validator.validate({ status: "active" }).valid).toBe(true);
    });

    test("異なる値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ status: "active" }>()
        .v("status", (b) => b.string.required().literal("active"))
        .build();

      const result = validator.validate({ status: "inactive" as any });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "status",
        code: "literal",
        context: { expected: "active" },
      });
    });
  });

  describe("様々な型のリテラル", () => {
    test("文字列リテラル", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ type: "user" | "admin" }>()
        .v("type", (b) => b.string.required().literal("user"))
        .build();

      expect(validator.validate({ type: "user" }).valid).toBe(true);
      expect(validator.validate({ type: "admin" }).valid).toBe(false);
    });

    test("数値リテラル", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ version: 1 | 2 | 3 }>()
        .v("version", (b) => b.number.required().literal(2))
        .build();

      expect(validator.validate({ version: 2 }).valid).toBe(true);
      expect(validator.validate({ version: 1 }).valid).toBe(false);
      expect(validator.validate({ version: 3 }).valid).toBe(false);
    });

    test("ブール値リテラル", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ enabled: true }>()
        .v("enabled", (b) => b.boolean.required().literal(true))
        .build();

      expect(validator.validate({ enabled: true }).valid).toBe(true);
      expect(validator.validate({ enabled: false as any }).valid).toBe(false);
    });

    test("nullリテラル", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ value: null }>()
        .v("value", (b) => b.string.literal(null))
        .build();

      expect(validator.validate({ value: null }).valid).toBe(true);
      expect(validator.validate({ value: undefined as any }).valid).toBe(false);
      expect(validator.validate({ value: "" as any }).valid).toBe(false);
    });
  });

  describe("厳密な等価性チェック", () => {
    test("型の違いを検出", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ count: 0 }>()
        .v("count", (b) => b.number.required().literal(0))
        .build();

      expect(validator.validate({ count: 0 }).valid).toBe(true);
      expect(validator.validate({ count: "0" as any }).valid).toBe(false);
      expect(validator.validate({ count: false as any }).valid).toBe(false);
    });

    test("大文字小文字の区別", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ code: "ABC" }>()
        .v("code", (b) => b.string.required().literal("ABC"))
        .build();

      expect(validator.validate({ code: "ABC" }).valid).toBe(true);
      expect(validator.validate({ code: "abc" as any }).valid).toBe(false);
      expect(validator.validate({ code: "Abc" as any }).valid).toBe(false);
    });

    test("特殊な数値の扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().literal(0))
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: -0 }).valid).toBe(true); // 0 === -0
      expect(validator.validate({ value: 0.0 }).valid).toBe(true);
    });

    test("NaNの特殊なケース", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().literal(NaN))
        .build();

      expect(validator.validate({ value: NaN }).valid).toBe(true);
      expect(validator.validate({ value: 0 / 0 }).valid).toBe(true); // Also NaN
      expect(validator.validate({ value: Number.NaN }).valid).toBe(true);
      expect(validator.validate({ value: 0 }).valid).toBe(false);
      expect(validator.validate({ value: null as any }).valid).toBe(false);
      expect(validator.validate({ value: "NaN" as any }).valid).toBe(false);
    });

    test("Infinityの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().literal(Infinity))
        .build();

      expect(validator.validate({ value: Infinity }).valid).toBe(true);
      expect(validator.validate({ value: 1 / 0 }).valid).toBe(true);
      expect(
        validator.validate({ value: Number.POSITIVE_INFINITY }).valid
      ).toBe(true);
      expect(validator.validate({ value: -Infinity }).valid).toBe(false);
      expect(validator.validate({ value: Number.MAX_VALUE }).valid).toBe(false);
    });

    test("-Infinityの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().literal(-Infinity))
        .build();

      expect(validator.validate({ value: -Infinity }).valid).toBe(true);
      expect(validator.validate({ value: -1 / 0 }).valid).toBe(true);
      expect(
        validator.validate({ value: Number.NEGATIVE_INFINITY }).valid
      ).toBe(true);
      expect(validator.validate({ value: Infinity }).valid).toBe(false);
      expect(validator.validate({ value: Number.MIN_VALUE }).valid).toBe(false);
    });
  });

  describe("複数のリテラルとの組み合わせ（Union型）", () => {
    test("oneOfプラグインとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ priority: "low" | "medium" | "high" }>()
        .v("priority", (b) =>
          b.string.required().oneOf(["low", "medium", "high"])
        )
        .build();

      expect(validator.validate({ priority: "low" }).valid).toBe(true);
      expect(validator.validate({ priority: "medium" }).valid).toBe(true);
      expect(validator.validate({ priority: "high" }).valid).toBe(true);
      expect(validator.validate({ priority: "critical" as any }).valid).toBe(
        false
      );
    });

    test("複数フィールドでの定数値", () => {
      interface Config {
        version: 1;
        format: "json";
        encoding: "utf-8";
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<Config>()
        .v("version", (b) => b.number.required().literal(1))
        .v("format", (b) => b.string.required().literal("json"))
        .v("encoding", (b) => b.string.required().literal("utf-8"))
        .build();

      // 有効な設定
      const validConfig = {
        version: 1,
        format: "json",
        encoding: "utf-8",
      };
      expect(validator.validate(validConfig).valid).toBe(true);

      // 無効な設定
      const invalidConfig = {
        version: 2, // 異なるバージョン
        format: "xml", // 異なるフォーマット
        encoding: "utf-16", // 異なるエンコーディング
      };
      const result = validator.validate(invalidConfig as any);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(literalPlugin)
        .for<{ flag?: "yes" }>()
        .v("flag", (b) => b.string.optional().literal("yes"))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ flag: undefined }).valid).toBe(true);
    });

    test("値が存在する場合はリテラル検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(literalPlugin)
        .for<{ flag?: "yes" }>()
        .v("flag", (b) => b.string.optional().literal("yes"))
        .build();

      expect(validator.validate({ flag: "yes" }).valid).toBe(true);
      expect(validator.validate({ flag: "no" as any }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ environment: "production" }>()
        .v("environment", (b) =>
          b.string.required().literal("production", {
            messageFactory: () => "本番環境でのみ実行可能です",
          })
        )
        .build();

      const result = validator.validate({ environment: "development" as any });
      expect(result.errors[0].message).toBe("本番環境でのみ実行可能です");
    });

    test("動的なエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<{ apiVersion: "v2" }>()
        .v("apiVersion", (b) =>
          b.string.required().literal("v2", {
            messageFactory: (ctx) =>
              `APIバージョン "${ctx.value}" はサポートされていません。"${ctx.expected}" を使用してください。`,
          })
        )
        .build();

      const result = validator.validate({ apiVersion: "v1" as any });
      expect(result.errors[0].message).toBe(
        'APIバージョン "v1" はサポートされていません。"v2" を使用してください。'
      );
    });
  });

  describe("実用的なシナリオ", () => {
    test("APIレスポンスのステータスコード検証", () => {
      interface ApiResponse {
        status: "success";
        code: 200;
        data: any;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<ApiResponse>()
        .v("status", (b) => b.string.required().literal("success"))
        .v("code", (b) => b.number.required().literal(200))
        .build();

      // 成功レスポンス
      const successResponse = {
        status: "success",
        code: 200,
        data: { id: 1, name: "Test" },
      };
      expect(validator.validate(successResponse).valid).toBe(true);

      // エラーレスポンス（期待される形式と異なる）
      const errorResponse = {
        status: "error",
        code: 500,
        data: null,
      };
      expect(validator.validate(errorResponse as any).valid).toBe(false);
    });

    test("設定ファイルのマジックナンバー検証", () => {
      interface FileHeader {
        magic: "FILE_V1";
        version: 1;
        type: "data" | "config" | "log";
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .use(oneOfPlugin)
        .for<FileHeader>()
        .v("magic", (b) => b.string.required().literal("FILE_V1"))
        .v("version", (b) => b.number.required().literal(1))
        .v("type", (b) => b.string.required().oneOf(["data", "config", "log"]))
        .build();

      // 有効なヘッダー
      const validHeader = {
        magic: "FILE_V1",
        version: 1,
        type: "data" as const,
      };
      expect(validator.validate(validHeader).valid).toBe(true);

      // 無効なマジックナンバー
      const invalidHeader = {
        magic: "FILE_V2",
        version: 1,
        type: "data" as const,
      };
      expect(validator.validate(invalidHeader as any).valid).toBe(false);
    });

    test("定数を使った機能フラグ", () => {
      interface FeatureFlags {
        featureName: "NEW_UI";
        enabled: true;
        rolloutPercentage: 100;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(literalPlugin)
        .for<FeatureFlags>()
        .v("featureName", (b) => b.string.required().literal("NEW_UI"))
        .v("enabled", (b) => b.boolean.required().literal(true))
        .v("rolloutPercentage", (b) => b.number.required().literal(100))
        .build();

      // 完全にロールアウトされた機能
      const fullRollout = {
        featureName: "NEW_UI",
        enabled: true,
        rolloutPercentage: 100,
      };
      expect(validator.validate(fullRollout).valid).toBe(true);

      // 部分的なロールアウト（このバリデーターでは無効）
      const partialRollout = {
        featureName: "NEW_UI",
        enabled: true,
        rolloutPercentage: 50,
      };
      expect(validator.validate(partialRollout as any).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
