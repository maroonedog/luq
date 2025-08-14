import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { skipPlugin } from "../../../../src/core/plugin/skip";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";

describe("skip Plugin", () => {
  describe("基本動作", () => {
    test("条件が満たされた場合にバリデーションをスキップ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<{ type: string; comment: string }>()
        .v("type", (b) => b.string.required())
        .v("comment", (b) =>
          b.string
            .skip((data) => data.type === "system")
            .required()
            .min(5)
        )
        .build();

      // 条件が満たされた場合、バリデーションがスキップされる
      expect(validator.validate({ type: "system", comment: "x" }).valid).toBe(
        true
      );
      expect(validator.validate({ type: "system", comment: "" }).valid).toBe(
        true
      );
    });

    test("条件が満たされない場合にバリデーションを実行", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<{ type: string; comment: string }>()
        .v("type", (b) => b.string.required())
        .v("comment", (b) =>
          b.string
            .required()
            .min(5)
            .skip((data) => data.type === "system")
        )
        .build();

      // 条件が満たされない場合、バリデーションが実行される
      const result = validator.validate({ type: "user", comment: "bad" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "comment",
        code: "stringMin",
      });

      expect(
        validator.validate({
          type: "user",
          comment: "This is a good comment",
        }).valid
      ).toBe(true);
    });
  });

  describe("様々な条件での検証", () => {
    test("ブール値フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(numberMinPlugin)
        .for<{ isDisabled: boolean; threshold: number }>()
        .v("isDisabled", (b) => b.boolean.required())
        .v("threshold", (b) =>
          b.number
            .skip((data) => data.isDisabled)
            .required()
            .min(1)
        )
        .build();

      // 無効化されている場合、閾値のバリデーションがスキップされる
      expect(
        validator.validate({ isDisabled: true, threshold: -5 }).valid
      ).toBe(true);
      expect(validator.validate({ isDisabled: true, threshold: 0 }).valid).toBe(
        true
      );

      // 有効化されている場合、閾値のバリデーションが実行される
      expect(
        validator.validate({ isDisabled: false, threshold: 0 }).valid
      ).toBe(false);
      expect(
        validator.validate({ isDisabled: false, threshold: 10 }).valid
      ).toBe(true);
    });

    test("数値フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<{ status: number; errorMessage: string }>()
        .v("status", (b) => b.number.required())
        .v("errorMessage", (b) =>
          b.string
            .skip((data) => data.status === 200)
            .required()
            .min(10)
        )
        .build();

      // 成功ステータスの場合、エラーメッセージのバリデーションがスキップされる
      expect(
        validator.validate({ status: 200, errorMessage: "ok" }).valid
      ).toBe(true);
      expect(validator.validate({ status: 200, errorMessage: "" }).valid).toBe(
        true
      );

      // エラーステータスの場合、エラーメッセージのバリデーションが実行される
      expect(
        validator.validate({ status: 500, errorMessage: "short" }).valid
      ).toBe(false);
      expect(
        validator.validate({
          status: 404,
          errorMessage: "Resource not found",
        }).valid
      ).toBe(true);
    });

    test("配列フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<{ features: string[]; licenseKey: string }>()
        .v("features", (b) => b.array.required())
        .v("licenseKey", (b) =>
          b.string
            .skip((data) => data.features.includes("free"))
            .required()
            .min(16)
        )
        .build();

      // フリー機能が含まれる場合、ライセンスキーのバリデーションがスキップされる
      expect(
        validator.validate({
          features: ["basic", "free"],
          licenseKey: "x",
        }).valid
      ).toBe(true);

      // 有料機能のみの場合、ライセンスキーのバリデーションが実行される
      expect(
        validator.validate({
          features: ["premium", "advanced"],
          licenseKey: "short",
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          features: ["premium", "advanced"],
          licenseKey: "valid_license_key_123",
        }).valid
      ).toBe(true);
    });

    test("複数フィールドの組み合わせ条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<{
          mode: string;
          level: number;
          securityToken: string;
        }>()
        .v("mode", (b) => b.string.required())
        .v("level", (b) => b.number.required())
        .v("securityToken", (b) =>
          b.string
            .skip((data) => data.mode === "debug" || data.level < 3)
            .required()
            .min(12)
        )
        .build();

      // 条件が満たされる場合、セキュリティトークンのバリデーションがスキップされる
      expect(
        validator.validate({
          mode: "debug",
          level: 5,
          securityToken: "x",
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          mode: "production",
          level: 1,
          securityToken: "y",
        }).valid
      ).toBe(true);

      // 条件が満たされない場合、セキュリティトークンのバリデーションが実行される
      expect(
        validator.validate({
          mode: "production",
          level: 5,
          securityToken: "short",
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          mode: "production",
          level: 5,
          securityToken: "secure_token_123",
        }).valid
      ).toBe(true);
    });
  });

  describe("複数のバリデーションルールとの組み合わせ", () => {
    test("skipと他のバリデーションの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<{ bypass: boolean; value: string }>()
        .v("bypass", (b) => b.boolean.required())
        .v(
          "value",
          (b) =>
            b.string
              .skip((data) => data.bypass) // skipを最初に
              .required() // skipがfalseの場合のみ適用
              .min(5) // skipがfalseの場合のみ適用
        )
        .build();

      // 条件が満たされる場合、すべてのバリデーションがスキップされる
      expect(validator.validate({ bypass: true }).valid).toBe(true);
      expect(validator.validate({ bypass: true, value: "" }).valid).toBe(true);
      expect(validator.validate({ bypass: true, value: "x" }).valid).toBe(true);

      // 条件が満たされない場合、すべてのバリデーションが適用される
      expect(validator.validate({ bypass: false }).valid).toBe(false); // required violation

      expect(
        validator.validate({
          bypass: false,
          value: "a",
        }).valid
      ).toBe(false); // min violation

      expect(
        validator.validate({
          bypass: false,
          value: "valid_value",
        }).valid
      ).toBe(true);
    });

    test("複数のskip条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{
          testMode: boolean;
          userType: string;
          config: string;
          maxRetries: number;
        }>()
        .v("testMode", (b) => b.boolean.required())
        .v("userType", (b) => b.string.required())
        .v("config", (b) =>
          b.string
            .skip((data) => data.testMode)
            .required()
            .min(10)
        )
        .v("maxRetries", (b) =>
          b.number
            .skip((data) => data.userType === "guest")
            .required()
            .min(1)
        )
        .build();

      // 両方の条件が満たされる場合（両方スキップ）
      expect(
        validator.validate({
          testMode: true,
          userType: "guest",
          config: "x",
          maxRetries: 0,
        }).valid
      ).toBe(true);

      // 一方の条件のみ満たされる場合
      expect(
        validator.validate({
          testMode: true,
          userType: "user",
          config: "x", // スキップされる
          maxRetries: 0, // バリデーション失敗
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          testMode: false,
          userType: "guest",
          config: "short", // バリデーション失敗
          maxRetries: 0, // スキップされる
        }).valid
      ).toBe(false);

      // 両方の条件が満たされない場合（両方バリデーション実行）
      expect(
        validator.validate({
          testMode: false,
          userType: "user",
          config: "short", // バリデーション失敗
          maxRetries: 0, // バリデーション失敗
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          testMode: false,
          userType: "user",
          config: "valid_config_123",
          maxRetries: 3,
        }).valid
      ).toBe(true);
    });
  });

  describe("ネストしたオブジェクトでの条件", () => {
    test("ネストしたフィールドを条件に使用", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<{
          options: { enabled: boolean; priority: number };
          configuration: string;
        }>()
        .v("options.enabled", (b) => b.boolean.required())
        .v("options.priority", (b) => b.number.required())
        .v("configuration", (b) =>
          b.string
            .skip((data) => !data.options.enabled || data.options.priority < 5)
            .required()
            .min(15)
        )
        .build();

      // 条件が満たされる場合（スキップ）
      expect(
        validator.validate({
          options: { enabled: false, priority: 8 },
          configuration: "x",
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          options: { enabled: true, priority: 2 },
          configuration: "y",
        }).valid
      ).toBe(true);

      // 条件が満たされない場合（バリデーション実行）
      expect(
        validator.validate({
          options: { enabled: true, priority: 7 },
          configuration: "short",
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          options: { enabled: true, priority: 7 },
          configuration: "valid_configuration_123",
        }).valid
      ).toBe(true);
    });
  });

  describe("実用的なシナリオ", () => {
    test("開発/本番環境の設定管理", () => {
      interface DeploymentConfig {
        environment: string; // 'development' | 'staging' | 'production'
        debugMode: boolean;
        useCache: boolean;
        databaseUrl: string; // 本番環境以外ではスキップ
        encryptionKey: string; // 本番環境以外ではスキップ
        logLevel: string; // debugModeがtrueでない場合はスキップ
        cacheSize: number; // useCacheがfalseの場合はスキップ
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<DeploymentConfig>()
        .v("environment", (b) => b.string.required())
        .v("debugMode", (b) => b.boolean.required())
        .v("useCache", (b) => b.boolean.required())
        .v("databaseUrl", (b) =>
          b.string
            .skip((data) => data.environment !== "production")
            .required()
            .min(20)
        )
        .v("encryptionKey", (b) =>
          b.string
            .skip((data) => data.environment !== "production")
            .required()
            .min(32)
        )
        .v("logLevel", (b) =>
          b.string
            .skip((data) => !data.debugMode)
            .required()
            .min(3)
        )
        .v("cacheSize", (b) =>
          b.number
            .skip((data) => !data.useCache)
            .required()
            .min(1)
        )
        .build();

      // 開発環境設定
      expect(
        validator.validate({
          environment: "development",
          debugMode: false,
          useCache: false,
          databaseUrl: "x", // スキップ
          encryptionKey: "y", // スキップ
          logLevel: "z", // スキップ
          cacheSize: 0, // スキップ
        }).valid
      ).toBe(true);

      // 本番環境設定（すべて必要）
      expect(
        validator.validate({
          environment: "production",
          debugMode: true,
          useCache: true,
          databaseUrl: "short", // バリデーション失敗
          encryptionKey: "short", // バリデーション失敗
          logLevel: "ab", // バリデーション失敗
          cacheSize: 0, // バリデーション失敗
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          environment: "production",
          debugMode: true,
          useCache: true,
          databaseUrl: "postgresql://user:pass@host:5432/db",
          encryptionKey: "very_secure_encryption_key_123456789",
          logLevel: "debug",
          cacheSize: 100,
        }).valid
      ).toBe(true);
    });

    test("条件付きAPIレスポンス検証", () => {
      interface ApiResponse {
        success: boolean;
        status: number;
        hasData: boolean;
        data: string; // success && hasDataの場合のみ検証
        errorCode: string; // !successの場合のみ検証
        errorMessage: string; // !successの場合のみ検証
        pagination: string; // hasDataの場合のみ検証
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<ApiResponse>()
        .v("success", (b) => b.boolean.required())
        .v("status", (b) => b.number.required())
        .v("hasData", (b) => b.boolean.required())
        .v("data", (b) =>
          b.string
            .skip((data) => !data.success || !data.hasData)
            .required()
            .min(5)
        )
        .v("errorCode", (b) =>
          b.string
            .skip((data) => data.success)
            .required()
            .min(3)
        )
        .v("errorMessage", (b) =>
          b.string
            .skip((data) => data.success)
            .required()
            .min(10)
        )
        .v("pagination", (b) =>
          b.string
            .skip((data) => !data.hasData)
            .required()
            .min(8)
        )
        .build();

      // 成功レスポンス、データあり
      expect(
        validator.validate({
          success: true,
          status: 200,
          hasData: true,
          data: "result_data",
          errorCode: "x", // スキップ
          errorMessage: "y", // スキップ
          pagination: "page_info",
        }).valid
      ).toBe(true);

      // 成功レスポンス、データなし
      expect(
        validator.validate({
          success: true,
          status: 204,
          hasData: false,
          data: "x", // スキップ
          errorCode: "y", // スキップ
          errorMessage: "z", // スキップ
          pagination: "w", // スキップ
        }).valid
      ).toBe(true);

      // エラーレスポンス
      expect(
        validator.validate({
          success: false,
          status: 400,
          hasData: false,
          data: "x", // スキップ
          errorCode: "INVALID_REQUEST",
          errorMessage: "The request parameters are invalid",
          pagination: "w", // スキップ
        }).valid
      ).toBe(true);

      // エラーレスポンス（バリデーション失敗）
      expect(
        validator.validate({
          success: false,
          status: 500,
          hasData: false,
          data: "x", // スキップ
          errorCode: "ER", // バリデーション失敗
          errorMessage: "Error", // バリデーション失敗
          pagination: "w", // スキップ
        }).valid
      ).toBe(false);
    });

    test("機能フラグベースの設定", () => {
      interface FeatureConfig {
        enabledFeatures: string[];
        userTier: string; // 'free' | 'premium' | 'enterprise'
        analyticsConfig: string; // 'analytics'機能が有効でない場合スキップ
        paymentConfig: string; // 'payments'機能が有効でない場合スキップ
        advancedConfig: string; // enterpriseティアでない場合スキップ
        premiumConfig: string; // premium/enterpriseティアでない場合スキップ
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<FeatureConfig>()
        .v("enabledFeatures", (b) => b.array.required())
        .v("userTier", (b) => b.string.required())
        .v("analyticsConfig", (b) =>
          b.string
            .skip((data) => !data.enabledFeatures.includes("analytics"))
            .required()
            .min(15)
        )
        .v("paymentConfig", (b) =>
          b.string
            .skip((data) => !data.enabledFeatures.includes("payments"))
            .required()
            .min(12)
        )
        .v("advancedConfig", (b) =>
          b.string
            .skip((data) => data.userTier !== "enterprise")
            .required()
            .min(20)
        )
        .v("premiumConfig", (b) =>
          b.string
            .skip((data) => data.userTier === "free")
            .required()
            .min(10)
        )
        .build();

      // フリーティア、基本機能のみ
      expect(
        validator.validate({
          enabledFeatures: ["basic", "profile"],
          userTier: "free",
          analyticsConfig: "x", // スキップ
          paymentConfig: "y", // スキップ
          advancedConfig: "z", // スキップ
          premiumConfig: "w", // スキップ
        }).valid
      ).toBe(true);

      // プレミアムティア、支払い機能有効
      expect(
        validator.validate({
          enabledFeatures: ["basic", "payments"],
          userTier: "premium",
          analyticsConfig: "x", // スキップ
          paymentConfig: "short", // バリデーション失敗
          advancedConfig: "z", // スキップ
          premiumConfig: "short", // バリデーション失敗
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          enabledFeatures: ["basic", "payments", "analytics"],
          userTier: "premium",
          analyticsConfig: "analytics_config_123",
          paymentConfig: "payment_config_456",
          advancedConfig: "z", // スキップ
          premiumConfig: "premium_config",
        }).valid
      ).toBe(true);

      // エンタープライズティア、全機能有効
      expect(
        validator.validate({
          enabledFeatures: ["basic", "payments", "analytics", "advanced"],
          userTier: "enterprise",
          analyticsConfig: "enterprise_analytics_config",
          paymentConfig: "enterprise_payment_config",
          advancedConfig: "enterprise_advanced_configuration_system",
          premiumConfig: "enterprise_premium_config",
        }).valid
      ).toBe(true);
    });
  });

  describe("エラーコンテキスト", () => {
    test("スキップされないバリデーションのエラー情報", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(skipPlugin)
        .use(stringMinPlugin)
        .for<{ bypass: boolean; value: string }>()
        .v("bypass", (b) => b.boolean.required())
        .v("value", (b) =>
          b.string
            .required()
            .min(5)
            .skip((data) => data.bypass)
        )
        .build();

      const result = validator.validate({ bypass: false, value: "ab" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "stringMin", // 元のバリデーションエラー
      });
    });
  });
});
