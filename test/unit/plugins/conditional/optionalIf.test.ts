import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { optionalIfPlugin } from "../../../../src/core/plugin/optionalIf";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";

describe("optionalIf Plugin", () => {
  describe("基本動作", () => {
    test("条件が満たされた場合にoptionalとして動作", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{ userType: string; adminCode: string }>()
        .v("userType", (b) => b.string.required())
        .v("adminCode", (b) =>
          b.string.optionalIf((data) => data.userType !== "admin")
        )
        .build();

      // 条件が満たされた場合（admin以外）、adminCodeはoptional
      expect(validator.validate({ userType: "user" }).valid).toBe(true);
      expect(validator.validate({ userType: "guest" }).valid).toBe(true);
      expect(
        validator.validate({ userType: "user", adminCode: "ABC123" }).valid
      ).toBe(true);
    });

    test("条件が満たされない場合はrequiredとして動作", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{ userType: string; adminCode: string }>()
        .v("userType", (b) => b.string.required())
        .v("adminCode", (b) =>
          b.string.optionalIf((data) => data.userType !== "admin")
        )
        .build();

      // 条件が満たされない場合（admin）、adminCodeは必須
      const result = validator.validate({ userType: "admin" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "adminCode",
        code: "optionalIf",
      });

      expect(
        validator.validate({ userType: "admin", adminCode: "ADMIN123" }).valid
      ).toBe(true);
    });
  });

  describe("様々な条件での検証", () => {
    test("ブール値フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{ isEnabled: boolean; configuration: string }>()
        .v("isEnabled", (b) => b.boolean.required())
        .v("configuration", (b) =>
          b.string.optionalIf((data) => !data.isEnabled)
        )
        .build();

      // 無効時は設定はoptional
      expect(validator.validate({ isEnabled: false }).valid).toBe(true);
      expect(
        validator.validate({ isEnabled: false, configuration: "disabled" })
          .valid
      ).toBe(true);

      // 有効時は設定が必須
      expect(validator.validate({ isEnabled: true }).valid).toBe(false);
      expect(
        validator.validate({ isEnabled: true, configuration: "active" }).valid
      ).toBe(true);
    });

    test("数値フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{ priority: number; escalationNote: string }>()
        .v("priority", (b) => b.number.required())
        .v("escalationNote", (b) =>
          b.string.optionalIf((data) => data.priority < 5)
        )
        .build();

      // 低優先度では説明はoptional
      expect(validator.validate({ priority: 3 }).valid).toBe(true);
      expect(validator.validate({ priority: 1 }).valid).toBe(true);

      // 高優先度では説明が必須
      expect(validator.validate({ priority: 8 }).valid).toBe(false);
      expect(
        validator.validate({ priority: 10, escalationNote: "Critical issue" })
          .valid
      ).toBe(true);
    });

    test("配列フィールドの条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{ permissions: string[]; superAdminKey: string }>()
        .v("permissions", (b) => b.array.required())
        .v("superAdminKey", (b) =>
          b.string.optionalIf(
            (data) => !data.permissions.includes("super_admin")
          )
        )
        .build();

      // super_admin権限がない場合はキーはoptional
      expect(validator.validate({ permissions: ["read", "write"] }).valid).toBe(
        true
      );
      expect(validator.validate({ permissions: [] }).valid).toBe(true);

      // super_admin権限がある場合はキーが必須
      expect(
        validator.validate({ permissions: ["read", "write", "super_admin"] })
          .valid
      ).toBe(false);
      expect(
        validator.validate({
          permissions: ["read", "write", "super_admin"],
          superAdminKey: "SECRET_KEY_123",
        }).valid
      ).toBe(true);
    });

    test("複数フィールドの組み合わせ条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{ environment: string; tier: string; productionKey: string }>()
        .v("environment", (b) => b.string.required())
        .v("tier", (b) => b.string.required())
        .v("productionKey", (b) =>
          b.string.optionalIf(
            (data) =>
              data.environment !== "production" || data.tier !== "premium"
          )
        )
        .build();

      // 本番環境かつプレミアムティア以外ではキーはoptional
      expect(
        validator.validate({
          environment: "development",
          tier: "premium",
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          environment: "production",
          tier: "basic",
        }).valid
      ).toBe(true);

      // 本番環境かつプレミアムティアではキーが必須
      expect(
        validator.validate({
          environment: "production",
          tier: "premium",
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          environment: "production",
          tier: "premium",
          productionKey: "PROD_PREMIUM_KEY",
        }).valid
      ).toBe(true);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("optionalIf + 文字列最小長", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .use(stringMinPlugin)
        .for<{ needsDetail: boolean; details: string }>()
        .v("needsDetail", (b) => b.boolean.required())
        .v("details", (b) =>
          b.string.optionalIf((data) => !data.needsDetail).min(10)
        )
        .build();

      // 詳細不要の場合はoptional
      expect(validator.validate({ needsDetail: false }).valid).toBe(true);

      // 詳細必要の場合はrequiredかつ最小長チェック
      expect(validator.validate({ needsDetail: true }).valid).toBe(false); // 不足
      expect(
        validator.validate({
          needsDetail: true,
          details: "short",
        }).valid
      ).toBe(false); // 短すぎる

      expect(
        validator.validate({
          needsDetail: true,
          details: "This is a detailed description",
        }).valid
      ).toBe(true);

      // optionalの場合でも値が提供されれば最小長チェックが適用される
      expect(
        validator.validate({
          needsDetail: false,
          details: "short",
        }).valid
      ).toBe(false); // 短すぎる

      expect(
        validator.validate({
          needsDetail: false,
          details: "Valid details even when optional",
        }).valid
      ).toBe(true);
    });

    test("複数のoptionalIf条件", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{
          mode: string;
          level: number;
          debugInfo: string;
          performanceMetrics: string;
        }>()
        .v("mode", (b) => b.string.required())
        .v("level", (b) => b.number.required())
        .v("debugInfo", (b) =>
          b.string.optionalIf((data) => data.mode !== "debug")
        )
        .v("performanceMetrics", (b) =>
          b.string.optionalIf((data) => data.level < 5)
        )
        .build();

      // 両方の条件が満たされる場合（両方optional）
      expect(
        validator.validate({
          mode: "production",
          level: 2,
        }).valid
      ).toBe(true);

      // 一方の条件のみ満たされる場合
      expect(
        validator.validate({
          mode: "debug",
          level: 2,
        }).valid
      ).toBe(false); // debugInfoが必須

      expect(
        validator.validate({
          mode: "production",
          level: 8,
        }).valid
      ).toBe(false); // performanceMetricsが必須

      // 両方の条件が満たされない場合（両方required）
      expect(
        validator.validate({
          mode: "debug",
          level: 8,
        }).valid
      ).toBe(false); // 両方とも必須

      expect(
        validator.validate({
          mode: "debug",
          level: 8,
          debugInfo: "Debug information",
          performanceMetrics: "Performance data",
        }).valid
      ).toBe(true);
    });
  });

  describe("ネストしたオブジェクトでの条件", () => {
    test("ネストしたフィールドを条件に使用", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{
          config: { type: string; security: number };
          encryptionKey: string;
        }>()
        .v("config.type", (b) => b.string.required())
        .v("config.security", (b) => b.number.required())
        .v("encryptionKey", (b) =>
          b.string.optionalIf(
            (data) => data.config.type !== "secure" || data.config.security < 3
          )
        )
        .build();

      // 条件が満たされる場合（optional）
      expect(
        validator.validate({
          config: { type: "basic", security: 5 },
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          config: { type: "secure", security: 1 },
        }).valid
      ).toBe(true);

      // 条件が満たされない場合（required）
      expect(
        validator.validate({
          config: { type: "secure", security: 5 },
        }).valid
      ).toBe(false);

      expect(
        validator.validate({
          config: { type: "secure", security: 5 },
          encryptionKey: "ENC_KEY_ABC123",
        }).valid
      ).toBe(true);
    });
  });

  describe("実用的なシナリオ", () => {
    test("APIキー管理システム", () => {
      interface ApiKeyRequest {
        serviceType: string; // 'public' | 'private' | 'internal'
        accessLevel: number; // 1-10
        environment: string; // 'dev' | 'staging' | 'production'
        justification: string; // 高アクセスレベルまたは本番環境で必須
        supervisorApproval: string; // プライベートサービスで必須
        securityClearance: string; // 内部サービスで必須
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .use(stringMinPlugin)
        .for<ApiKeyRequest>()
        .v("serviceType", (b) => b.string.required())
        .v("accessLevel", (b) => b.number.required())
        .v("environment", (b) => b.string.required())
        .v("justification", (b) =>
          b.string
            .optionalIf(
              (data) =>
                data.accessLevel < 7 && data.environment !== "production"
            )
            .min(20)
        )
        .v("supervisorApproval", (b) =>
          b.string.optionalIf((data) => data.serviceType !== "private").min(5)
        )
        .v("securityClearance", (b) =>
          b.string.optionalIf((data) => data.serviceType !== "internal").min(10)
        )
        .build();

      // パブリックサービス、低アクセスレベル、開発環境
      expect(
        validator.validate({
          serviceType: "public",
          accessLevel: 3,
          environment: "dev",
        }).valid
      ).toBe(true);

      // プライベートサービス（承認が必要）
      expect(
        validator.validate({
          serviceType: "private",
          accessLevel: 5,
          environment: "staging",
        }).valid
      ).toBe(false); // supervisorApprovalが必要

      expect(
        validator.validate({
          serviceType: "private",
          accessLevel: 5,
          environment: "staging",
          supervisorApproval: "SUPERVISOR_123",
        }).valid
      ).toBe(true);

      // 内部サービス（セキュリティクリアランスが必要）
      expect(
        validator.validate({
          serviceType: "internal",
          accessLevel: 4,
          environment: "dev",
        }).valid
      ).toBe(false); // securityClearanceが必要

      // 高アクセスレベル（正当化が必要）
      expect(
        validator.validate({
          serviceType: "public",
          accessLevel: 8,
          environment: "dev",
        }).valid
      ).toBe(false); // justificationが必要

      // 本番環境（正当化が必要）
      expect(
        validator.validate({
          serviceType: "public",
          accessLevel: 3,
          environment: "production",
        }).valid
      ).toBe(false); // justificationが必要

      expect(
        validator.validate({
          serviceType: "public",
          accessLevel: 8,
          environment: "production",
          justification:
            "This API key is needed for the production deployment of our customer-facing application.",
        }).valid
      ).toBe(true);
    });

    test("マルチテナント設定システム", () => {
      interface TenantConfig {
        tenantType: string; // 'standard' | 'premium' | 'enterprise'
        featureSet: string; // 'basic' | 'advanced' | 'complete'
        customization: string; // enterpriseで必須
        supportLevel: string; // premiumまたはenterpriseで必須
        whiteLabeling: string; // enterpriseで必須
        customDomain: string; // advanced/completeフィーチャーセットで必須
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .use(stringMinPlugin)
        .for<TenantConfig>()
        .v("tenantType", (b) => b.string.required())
        .v("featureSet", (b) => b.string.required())
        .v("customization", (b) =>
          b.string.optionalIf((data) => data.tenantType !== "enterprise").min(5)
        )
        .v("supportLevel", (b) =>
          b.string.optionalIf((data) => data.tenantType === "standard").min(3)
        )
        .v("whiteLabeling", (b) =>
          b.string.optionalIf((data) => data.tenantType !== "enterprise").min(5)
        )
        .v("customDomain", (b) =>
          b.string.optionalIf((data) => data.featureSet === "basic").min(5)
        )
        .build();

      // スタンダードテナント、基本フィーチャー
      expect(
        validator.validate({
          tenantType: "standard",
          featureSet: "basic",
        }).valid
      ).toBe(true);

      // プレミアムテナント（サポートレベルが必要）
      expect(
        validator.validate({
          tenantType: "premium",
          featureSet: "basic",
        }).valid
      ).toBe(false); // supportLevelが必要

      // エンタープライズテナント（多くの設定が必要）
      expect(
        validator.validate({
          tenantType: "enterprise",
          featureSet: "complete",
        }).valid
      ).toBe(false); // 複数フィールドが必要

      expect(
        validator.validate({
          tenantType: "enterprise",
          featureSet: "complete",
          customization: "CUSTOM_THEME_001",
          supportLevel: "PREMIUM_SUPPORT",
          whiteLabeling: "WHITE_LABEL_CONFIG",
          customDomain: "client.company.com",
        }).valid
      ).toBe(true);
    });

    test("コンテンツモデレーションシステム", () => {
      interface ModerationRule {
        contentType: string; // 'text' | 'image' | 'video' | 'audio'
        strictness: number; // 1-10
        audience: string; // 'public' | 'restricted' | 'private'
        aiModel: string; // 高い厳格度で必須
        humanReview: string; // 制限された/プライベートオーディエンスで必須
        customFilters: string; // 動画/音声コンテンツで必須
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .use(stringMinPlugin)
        .for<ModerationRule>()
        .v("contentType", (b) => b.string.required())
        .v("strictness", (b) => b.number.required())
        .v("audience", (b) => b.string.required())
        .v("aiModel", (b) =>
          b.string.optionalIf((data) => data.strictness < 7).min(3)
        )
        .v("humanReview", (b) =>
          b.string.optionalIf((data) => data.audience === "public").min(5)
        )
        .v("customFilters", (b) =>
          b.string
            .optionalIf(
              (data) =>
                data.contentType === "text" || data.contentType === "image"
            )
            .min(10)
        )
        .build();

      // テキストコンテンツ、低厳格度、公開オーディエンス
      expect(
        validator.validate({
          contentType: "text",
          strictness: 3,
          audience: "public",
        }).valid
      ).toBe(true);

      // 動画コンテンツ（カスタムフィルターが必要）
      expect(
        validator.validate({
          contentType: "video",
          strictness: 5,
          audience: "public",
        }).valid
      ).toBe(false); // customFiltersが必要

      // 高厳格度（AIモデルが必要）
      expect(
        validator.validate({
          contentType: "text",
          strictness: 9,
          audience: "public",
        }).valid
      ).toBe(false); // aiModelが必要

      // 制限されたオーディエンス（人間のレビューが必要）
      expect(
        validator.validate({
          contentType: "image",
          strictness: 6,
          audience: "restricted",
        }).valid
      ).toBe(false); // humanReviewが必要

      expect(
        validator.validate({
          contentType: "video",
          strictness: 8,
          audience: "restricted",
          aiModel: "GPT_VISION_V2",
          humanReview: "HUMAN_REVIEW_LEVEL_2",
          customFilters: "VIDEO_CONTENT_ANALYSIS_FILTERS",
        }).valid
      ).toBe(true);
    });
  });

  describe("エラーコンテキスト", () => {
    test("元のバリデーションエラーが保持される", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalIfPlugin)
        .for<{ type: string; value: string }>()
        .v("type", (b) => b.string.required())
        .v("value", (b) =>
          b.string.optionalIf((data) => data.type === "optional")
        )
        .build();

      const result = validator.validate({ type: "required" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "optionalIf", // optionalIfが条件に基づいてrequiredを判定した結果のエラー
      });
    });
  });
});
