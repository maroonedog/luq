import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { validateIfPlugin } from "../../../../src/core/plugin/validateIf";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";

describe("validateIf Plugin", () => {
  describe("基本動作", () => {
    test("条件が満たされた場合にバリデーションを実行", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<{ type: string; comment: string }>()
        .v("type", (b) => b.string.required())
        .v("comment", (b) =>
          b.string
            .required()
            .min(5)
            .validateIf((data) => data.type === "feedback")
        )
        .build();

      // 条件が満たされた場合、バリデーションが実行される
      const result = validator.validate({ type: "feedback", comment: "bad" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "comment",
        code: "stringMin",
      });

      expect(
        validator.validate({
          type: "feedback",
          comment: "This is a good feedback",
        }).valid
      ).toBe(true);
    });

    test("条件が満たされない場合にバリデーションをスキップ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<{ type: string; comment: string }>()
        .v("type", (b) => b.string.required())
        .v("comment", (b) =>
          b.string
            .required()
            .min(5)
            .validateIf((data) => data.type === "feedback")
        )
        .build();

      // 条件が満たされない場合、バリデーションがスキップされる
      expect(validator.validate({ type: "info", comment: "ok" }).valid).toBe(
        true
      );
      expect(validator.validate({ type: "warning", comment: "x" }).valid).toBe(
        true
      );
    });
  });

  describe("様々な条件での検証", () => {
    test("ブール値フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(numberMinPlugin)
        .for<{ hasLimit: boolean; maxValue: number }>()
        .v("hasLimit", (b) => b.boolean.required())
        .v("maxValue", (b) =>
          b.number
            .required()
            .min(1)
            .validateIf((data) => data.hasLimit)
        )
        .build();

      // 制限ありの場合、最大値のバリデーションが実行される
      expect(validator.validate({ hasLimit: true, maxValue: 0 }).valid).toBe(
        false
      );
      expect(validator.validate({ hasLimit: true, maxValue: 10 }).valid).toBe(
        true
      );

      // 制限なしの場合、最大値のバリデーションがスキップされる
      expect(validator.validate({ hasLimit: false, maxValue: -5 }).valid).toBe(
        true
      );
      expect(validator.validate({ hasLimit: false, maxValue: 100 }).valid).toBe(
        true
      );
    });

    test("数値フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<{ priority: number; escalationNote: string }>()
        .v("priority", (b) => b.number.required())
        .v("escalationNote", (b) =>
          b.string
            .required()
            .min(10)
            .validateIf((data) => data.priority >= 8)
        )
        .build();

      // 高優先度の場合、エスカレーション記録のバリデーションが実行される
      expect(
        validator.validate({ priority: 9, escalationNote: "short" }).valid
      ).toBe(false);
      expect(
        validator.validate({
          priority: 8,
          escalationNote: "Detailed escalation note",
        }).valid
      ).toBe(true);

      // 低優先度の場合、エスカレーション記録のバリデーションがスキップされる
      expect(
        validator.validate({ priority: 5, escalationNote: "x" }).valid
      ).toBe(true);
    });

    test("配列フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<{ tags: string[]; description: string }>()
        .v("tags", (b) => b.array.required())
        .v("description", (b) =>
          b.string
            .required()
            .min(20)
            .validateIf((data) => data.tags.includes("detailed"))
        )
        .build();

      // 詳細タグがある場合、説明のバリデーションが実行される
      expect(
        validator.validate({
          tags: ["basic", "detailed"],
          description: "short desc",
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          tags: ["basic", "detailed"],
          description: "This is a very detailed description of the item",
        }).valid
      ).toBe(true);

      // 詳細タグがない場合、説明のバリデーションがスキップされる
      expect(
        validator.validate({
          tags: ["basic", "simple"],
          description: "ok",
        }).valid
      ).toBe(true);
    });

    test("複数フィールドの組み合わせ条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<{
          environment: string;
          security: number;
          encryptionKey: string;
        }>()
        .v("environment", (b) => b.string.required())
        .v("security", (b) => b.number.required())
        .v("encryptionKey", (b) =>
          b.string
            .required()
            .min(16)
            .validateIf(
              (data) => data.environment === "production" && data.security >= 5
            )
        )
        .build();

      // 条件が満たされる場合、暗号化キーのバリデーションが実行される
      expect(
        validator.validate({
          environment: "production",
          security: 7,
          encryptionKey: "short",
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          environment: "production",
          security: 5,
          encryptionKey: "very_secure_encryption_key_123",
        }).valid
      ).toBe(true);

      // 条件が満たされない場合、暗号化キーのバリデーションがスキップされる
      expect(
        validator.validate({
          environment: "development",
          security: 8,
          encryptionKey: "x",
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          environment: "production",
          security: 3,
          encryptionKey: "y",
        }).valid
      ).toBe(true);
    });
  });

  describe("複数のバリデーションルールとの組み合わせ", () => {
    test("validateIfと他のバリデーションの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<{ mode: string; config: string }>()
        .v("mode", (b) => b.string.required())
        .v("config", (b) =>
          b.string
            .required() // requiredは常に適用
            .min(5) // minも常に適用
            .validateIf((data) => data.mode === "advanced")
        ) // validateIfは条件付き
        .build();

      // 条件が満たされない場合でも、required と min は適用される
      expect(validator.validate({ mode: "basic" }).valid).toBe(false); // required violation

      expect(
        validator.validate({
          mode: "basic",
          config: "a",
        }).valid
      ).toBe(false); // min violation

      expect(
        validator.validate({
          mode: "basic",
          config: "basic_config",
        }).valid
      ).toBe(true);

      // 条件が満たされる場合、すべてのバリデーションが適用される
      expect(
        validator.validate({
          mode: "advanced",
          config: "adv",
        }).valid
      ).toBe(false); // min violation

      expect(
        validator.validate({
          mode: "advanced",
          config: "advanced_config",
        }).valid
      ).toBe(true);
    });

    test("複数のvalidateIf条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{
          userType: string;
          level: number;
          adminCode: string;
          securityToken: string;
        }>()
        .v("userType", (b) => b.string.required())
        .v("level", (b) => b.number.required())
        .v("adminCode", (b) =>
          b.string
            .required()
            .min(8)
            .validateIf((data) => data.userType === "admin")
        )
        .v("securityToken", (b) =>
          b.string
            .required()
            .min(12)
            .validateIf((data) => data.level >= 5)
        )
        .build();

      // 両方の条件が満たされない場合
      expect(
        validator.validate({
          userType: "user",
          level: 3,
          adminCode: "x",
          securityToken: "y",
        }).valid
      ).toBe(true);

      // 一方の条件のみ満たされる場合
      expect(
        validator.validate({
          userType: "admin",
          level: 3,
          adminCode: "short",
          securityToken: "y",
        }).valid
      ).toBe(false); // adminCode validation fails

      expect(
        validator.validate({
          userType: "user",
          level: 7,
          adminCode: "x",
          securityToken: "short",
        }).valid
      ).toBe(false); // securityToken validation fails

      // 両方の条件が満たされる場合
      expect(
        validator.validate({
          userType: "admin",
          level: 8,
          adminCode: "short",
          securityToken: "short",
        }).valid
      ).toBe(false); // both validations fail

      expect(
        validator.validate({
          userType: "admin",
          level: 8,
          adminCode: "admin_code_123",
          securityToken: "security_token_456",
        }).valid
      ).toBe(true);
    });
  });

  describe("ネストしたオブジェクトでの条件", () => {
    test("ネストしたフィールドを条件に使用", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<{
          settings: { mode: string; level: number };
          debugInfo: string;
        }>()
        .v("settings.mode", (b) => b.string.required())
        .v("settings.level", (b) => b.number.required())
        .v("debugInfo", (b) =>
          b.string
            .required()
            .min(15)
            .validateIf(
              (data) =>
                data.settings.mode === "debug" && data.settings.level > 3
            )
        )
        .build();

      // 条件が満たされない場合
      expect(
        validator.validate({
          settings: { mode: "normal", level: 5 },
          debugInfo: "x",
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          settings: { mode: "debug", level: 2 },
          debugInfo: "y",
        }).valid
      ).toBe(true);

      // 条件が満たされる場合
      expect(
        validator.validate({
          settings: { mode: "debug", level: 5 },
          debugInfo: "short",
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          settings: { mode: "debug", level: 5 },
          debugInfo: "Detailed debug information",
        }).valid
      ).toBe(true);
    });
  });

  describe("実用的なシナリオ", () => {
    test("レポート生成システム", () => {
      interface ReportConfig {
        reportType: string; // 'summary' | 'detailed' | 'analytics'
        format: string; // 'pdf' | 'excel' | 'csv'
        includeCharts: boolean;
        customQuery: string; // analyticsタイプで検証
        chartConfig: string; // chartsありで検証
        pdfSettings: string; // PDFフォーマットで検証
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<ReportConfig>()
        .v("reportType", (b) => b.string.required())
        .v("format", (b) => b.string.required())
        .v("includeCharts", (b) => b.boolean.required())
        .v("customQuery", (b) =>
          b.string
            .required()
            .min(20)
            .validateIf((data) => data.reportType === "analytics")
        )
        .v("chartConfig", (b) =>
          b.string
            .required()
            .min(10)
            .validateIf((data) => data.includeCharts)
        )
        .v("pdfSettings", (b) =>
          b.string
            .required()
            .min(8)
            .validateIf((data) => data.format === "pdf")
        )
        .build();

      // サマリーレポート、CSV、チャートなし
      expect(
        validator.validate({
          reportType: "summary",
          format: "csv",
          includeCharts: false,
          customQuery: "x",
          chartConfig: "y",
          pdfSettings: "z",
        }).valid
      ).toBe(true);

      // 詳細レポート、Excel、チャートあり
      expect(
        validator.validate({
          reportType: "detailed",
          format: "excel",
          includeCharts: true,
          customQuery: "x",
          chartConfig: "short", // バリデーション失敗
          pdfSettings: "z",
        }).valid
      ).toBe(false);

      // アナリティクスレポート、PDF、チャートあり
      expect(
        validator.validate({
          reportType: "analytics",
          format: "pdf",
          includeCharts: true,
          customQuery: "SELECT * FROM analytics WHERE date > today() - 30 days",
          chartConfig: "line_chart_config",
          pdfSettings: "A4_portrait",
        }).valid
      ).toBe(true);
    });

    test("動的フォームバリデーション", () => {
      interface DynamicForm {
        fieldType: string; // 'text' | 'email' | 'phone' | 'url'
        isRequired: boolean;
        hasMinLength: boolean;
        value: string;
        emailDomain: string; // emailタイプで検証
        phoneCountry: string; // phoneタイプで検証
        urlProtocol: string; // urlタイプで検証
        minLengthValue: number; // hasMinLength=trueで検証
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<DynamicForm>()
        .v("fieldType", (b) => b.string.required())
        .v("isRequired", (b) => b.boolean.required())
        .v("hasMinLength", (b) => b.boolean.required())
        .v("value", (b) =>
          b.string.required().validateIf((data) => data.isRequired)
        )
        .v("emailDomain", (b) =>
          b.string
            .required()
            .min(3)
            .validateIf((data) => data.fieldType === "email")
        )
        .v("phoneCountry", (b) =>
          b.string
            .required()
            .min(2)
            .validateIf((data) => data.fieldType === "phone")
        )
        .v("urlProtocol", (b) =>
          b.string
            .required()
            .min(4)
            .validateIf((data) => data.fieldType === "url")
        )
        .v("minLengthValue", (b) =>
          b.number
            .required()
            .min(1)
            .validateIf((data) => data.hasMinLength)
        )
        .build();

      // テキストフィールド、必須なし、最小長なし
      expect(
        validator.validate({
          fieldType: "text",
          isRequired: false,
          hasMinLength: false,
          value: "",
          emailDomain: "x",
          phoneCountry: "y",
          urlProtocol: "z",
          minLengthValue: 0,
        }).valid
      ).toBe(true);

      // メールフィールド、必須あり、最小長あり
      expect(
        validator.validate({
          fieldType: "email",
          isRequired: true,
          hasMinLength: true,
          value: "", // required validation fails
          emailDomain: "xx", // email domain validation fails
          phoneCountry: "y",
          urlProtocol: "z",
          minLengthValue: 0, // min length validation fails
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          fieldType: "email",
          isRequired: true,
          hasMinLength: true,
          value: "user@example.com",
          emailDomain: "example.com",
          phoneCountry: "y",
          urlProtocol: "z",
          minLengthValue: 5,
        }).valid
      ).toBe(true);
    });

    test("権限ベースの設定バリデーション", () => {
      interface PermissionConfig {
        userRole: string; // 'user' | 'admin' | 'superadmin'
        accessLevel: number; // 1-10
        environment: string; // 'dev' | 'staging' | 'production'
        adminPassword: string; // adminロールで検証
        superAdminKey: string; // superadminロールで検証
        productionToken: string; // 本番環境で検証
        highSecurityCode: string; // アクセスレベル8以上で検証
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<PermissionConfig>()
        .v("userRole", (b) => b.string.required())
        .v("accessLevel", (b) => b.number.required().min(1))
        .v("environment", (b) => b.string.required())
        .v("adminPassword", (b) =>
          b.string
            .required()
            .min(12)
            .validateIf(
              (data) =>
                data.userRole === "admin" || data.userRole === "superadmin"
            )
        )
        .v("superAdminKey", (b) =>
          b.string
            .required()
            .min(24)
            .validateIf((data) => data.userRole === "superadmin")
        )
        .v("productionToken", (b) =>
          b.string
            .required()
            .min(16)
            .validateIf((data) => data.environment === "production")
        )
        .v("highSecurityCode", (b) =>
          b.string
            .required()
            .min(20)
            .validateIf((data) => data.accessLevel >= 8)
        )
        .build();

      // 一般ユーザー、低アクセスレベル、開発環境
      expect(
        validator.validate({
          userRole: "user",
          accessLevel: 3,
          environment: "dev",
          adminPassword: "x",
          superAdminKey: "y",
          productionToken: "z",
          highSecurityCode: "w",
        }).valid
      ).toBe(true);

      // 管理者、高アクセスレベル、本番環境
      expect(
        validator.validate({
          userRole: "admin",
          accessLevel: 9,
          environment: "production",
          adminPassword: "short", // fails
          superAdminKey: "y",
          productionToken: "short", // fails
          highSecurityCode: "short", // fails
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          userRole: "admin",
          accessLevel: 9,
          environment: "production",
          adminPassword: "secure_admin_password_123",
          superAdminKey: "y", // not validated for admin
          productionToken: "production_token_456",
          highSecurityCode: "high_security_access_code_789",
        }).valid
      ).toBe(true);
    });
  });

  describe("エラーコンテキスト", () => {
    test("条件付きバリデーションのエラー情報", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin)
        .for<{ type: string; value: string }>()
        .v("type", (b) => b.string.required())
        .v("value", (b) =>
          b.string
            .required()
            .min(5)
            .validateIf((data) => data.type === "strict")
        )
        .build();

      const result = validator.validate({ type: "strict", value: "ab" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "stringMin", // 元のバリデーションエラー
      });
    });
  });
});
