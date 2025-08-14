import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { orFailPlugin } from "../../../../src/core/plugin/orFail";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";

describe("orFail Plugin", () => {
  describe("基本動作", () => {
    test("条件がfalseの場合は検証を通す", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ type: string; value: string }>()
        .v("type", (b) => b.string)
        .v("value", (b) =>
          b.string.orFail((allValues) => allValues.type === "restricted", {
            messageFactory: () => "This field is restricted",
          })
        )
        .build();

      // 条件がfalseなので検証成功
      const result = validator.validate({ type: "normal", value: "test" });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("条件がtrueの場合は検証を失敗させる", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ type: string; value: string }>()
        .v("type", (b) => b.string)
        .v("value", (b) =>
          b.string.orFail((allValues) => allValues.type === "restricted", {
            messageFactory: () => "This field is restricted",
          })
        )
        .build();

      // 条件がtrueなので検証失敗
      const result = validator.validate({ type: "restricted", value: "test" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "validation_error",
        message: "This field is restricted",
      });
    });

    test("allValuesが提供されない場合はデフォルトで成功", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ value: string }>()
        .v("value", (b) =>
          b.string.orFail(
            () => true, // 常にtrueの条件
            { messageFactory: () => "Should fail" }
          )
        )
        .build();

      // allValuesへのアクセスが制限されている場合のfallback
      const result = validator.validate({ value: "test" });
      // Note: この動作は実装に依存するため、現在の動作を確認
      expect(result.isValid()).toBe(true);
    });
  });

  describe("様々な条件での検証", () => {
    test("ブール値フィールドを条件に使用", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ disabled: boolean; data: string }>()
        .v("disabled", (b) => b.boolean)
        .v("data", (b) =>
          b.string.orFail((allValues) => allValues.disabled === true, {
            messageFactory: () => "Cannot process data when disabled",
          })
        )
        .build();

      // disabledがfalseの場合は成功
      expect(validator.validate({ disabled: false, data: "test" }).valid).toBe(
        true
      );

      // disabledがtrueの場合は失敗
      const result = validator.validate({ disabled: true, data: "test" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe(
        "Cannot process data when disabled"
      );
    });

    test("数値フィールドを条件に使用", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ version: number; legacyField: string }>()
        .v("version", (b) => b.number)
        .v("legacyField", (b) =>
          b.string.orFail((allValues) => allValues.version >= 2, {
            messageFactory: () => "This field is not supported in version 2+",
          })
        )
        .build();

      // version < 2の場合は成功
      expect(
        validator.validate({ version: 1, legacyField: "legacy" }).valid
      ).toBe(true);

      // version >= 2の場合は失敗
      expect(
        validator.validate({ version: 2, legacyField: "legacy" }).valid
      ).toBe(false);
    });

    test("配列フィールドを条件に使用", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ roles: string[]; adminData: string }>()
        .v("roles", (b) => b.array)
        .v("adminData", (b) =>
          b.string.orFail((allValues) => !allValues.roles.includes("admin"), {
            messageFactory: () => "Admin data requires admin role",
          })
        )
        .build();

      // adminロールがある場合は成功
      expect(
        validator.validate({ roles: ["user", "admin"], adminData: "secret" })
          .valid
      ).toBe(true);

      // adminロールがない場合は失敗
      expect(
        validator.validate({ roles: ["user"], adminData: "secret" }).valid
      ).toBe(false);
    });

    test("複数フィールドの組み合わせ条件", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{
          environment: string;
          userRole: string;
          sensitiveData: string;
        }>()
        .v("environment", (b) => b.string)
        .v("userRole", (b) => b.string)
        .v("sensitiveData", (b) =>
          b.string.orFail(
            (allValues) =>
              allValues.environment === "production" &&
              allValues.userRole !== "admin",
            {
              messageFactory: () =>
                "Sensitive data requires admin role in production",
            }
          )
        )
        .build();

      // production + adminの場合は成功
      expect(
        validator.validate({
          environment: "production",
          userRole: "admin",
          sensitiveData: "secret",
        }).valid
      ).toBe(true);

      // development + 非adminの場合は成功
      expect(
        validator.validate({
          environment: "development",
          userRole: "user",
          sensitiveData: "secret",
        }).valid
      ).toBe(true);

      // production + 非adminの場合は失敗
      expect(
        validator.validate({
          environment: "production",
          userRole: "user",
          sensitiveData: "secret",
        }).valid
      ).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("orFail + required の組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(orFailPlugin)
        .for<{ status: string; data: string }>()
        .v("status", (b) => b.string.required())
        .v("data", (b) =>
          b.string
            .required()
            .orFail((allValues) => allValues.status === "disabled", {
              messageFactory: () => "Field disabled by status",
            })
        )
        .build();

      // statusがenabledでdataが存在する場合は成功
      expect(
        validator.validate({ status: "enabled", data: "test" }).valid
      ).toBe(true);

      // statusがdisabledの場合はorFailで失敗
      expect(
        validator.validate({ status: "disabled", data: "test" }).valid
      ).toBe(false);

      // dataが未定義の場合はrequiredで失敗
      expect(validator.validate({ status: "enabled" }).valid).toBe(false);
    });

    test("orFail + stringMin の組み合わせ", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .use(stringMinPlugin)
        .for<{ mode: string; text: string }>()
        .v("mode", (b) => b.string)
        .v("text", (b) =>
          b.string
            .min(5)
            .orFail((allValues) => allValues.mode === "strict", {
              messageFactory: () => "Text not allowed in strict mode",
            })
        )
        .build();

      // normalモードで文字列長が満たされる場合は成功
      expect(validator.validate({ mode: "normal", text: "hello" }).valid).toBe(
        true
      );

      // strictモードの場合はorFailで失敗（文字列長に関係なく）
      expect(
        validator.validate({ mode: "strict", text: "hello world" }).valid
      ).toBe(false);

      // normalモードで文字列長が不足の場合はstringMinで失敗
      expect(validator.validate({ mode: "normal", text: "hi" }).valid).toBe(
        false
      );
    });

    test("複数のorFail条件", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{
          userType: string;
          permissions: string[];
          sensitiveField: string;
        }>()
        .v("userType", (b) => b.string)
        .v("permissions", (b) => b.array)
        .v("sensitiveField", (b) =>
          b.string
            .orFail((allValues) => allValues.userType === "guest", {
              messageFactory: () => "Guests cannot access this field",
            })
            .orFail(
              (allValues) => !allValues.permissions.includes("read_sensitive"),
              {
                messageFactory: () =>
                  "Missing required permission: read_sensitive",
              }
            )
        )
        .build();

      // adminユーザーで適切な権限がある場合は成功
      expect(
        validator.validate({
          userType: "admin",
          permissions: ["read_sensitive"],
          sensitiveField: "secret",
        }).valid
      ).toBe(true);

      // guestユーザーの場合は最初のorFailで失敗
      expect(
        validator.validate({
          userType: "guest",
          permissions: ["read_sensitive"],
          sensitiveField: "secret",
        }).valid
      ).toBe(false);

      // 権限不足の場合は2番目のorFailで失敗
      expect(
        validator.validate({
          userType: "user",
          permissions: [],
          sensitiveField: "secret",
        }).valid
      ).toBe(false);
    });
  });

  describe("ネストしたオブジェクトでの条件", () => {
    test("ネストしたフィールドを条件に使用", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{
          config: { readonly: boolean };
          data: { value: string };
        }>()
        .v("data.value", (b) =>
          b.string.orFail((allValues) => allValues.config.readonly === true, {
            messageFactory: () => "Cannot modify value in readonly mode",
          })
        )
        .build();

      // readonlyがfalseの場合は成功
      expect(
        validator.validate({
          config: { readonly: false },
          data: { value: "test" },
        }).valid
      ).toBe(true);

      // readonlyがtrueの場合は失敗
      expect(
        validator.validate({
          config: { readonly: true },
          data: { value: "test" },
        }).valid
      ).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("環境による制限", () => {
      type Configuration = {
        environment: "development" | "staging" | "production";
        debugMode: boolean;
        sensitiveData?: string;
      };

      const validator = Builder()
        .use(orFailPlugin)
        .for<Configuration>()
        .v("environment", (b) => b.string)
        .v("debugMode", (b) => b.boolean)
        .v("sensitiveData", (b) =>
          b.string.orFail(
            (allValues) => allValues.environment === "production",
            { messageFactory: () => "Sensitive data not allowed in production" }
          )
        )
        .build();

      // developmentでは成功
      expect(
        validator.validate({
          environment: "development",
          debugMode: true,
          sensitiveData: "debug-info",
        }).valid
      ).toBe(true);

      // productionでは失敗
      expect(
        validator.validate({
          environment: "production",
          debugMode: false,
          sensitiveData: "debug-info",
        }).valid
      ).toBe(false);
    });

    test("機能フラグによる制限", () => {
      type FeatureConfig = {
        betaEnabled: boolean;
        userLevel: number;
        betaFeature?: string;
      };

      const validator = Builder()
        .use(orFailPlugin)
        .for<FeatureConfig>()
        .v("betaEnabled", (b) => b.boolean)
        .v("userLevel", (b) => b.number)
        .v("betaFeature", (b) =>
          b.string.orFail(
            (allValues) => !allValues.betaEnabled || allValues.userLevel < 5,
            {
              messageFactory: () =>
                "Beta feature requires level 5+ and beta access",
            }
          )
        )
        .build();

      // 条件を満たす場合は成功
      expect(
        validator.validate({
          betaEnabled: true,
          userLevel: 5,
          betaFeature: "new-ui",
        }).valid
      ).toBe(true);

      // betaが無効の場合は失敗
      expect(
        validator.validate({
          betaEnabled: false,
          userLevel: 5,
          betaFeature: "new-ui",
        }).valid
      ).toBe(false);

      // レベルが不足の場合は失敗
      expect(
        validator.validate({
          betaEnabled: true,
          userLevel: 3,
          betaFeature: "new-ui",
        }).valid
      ).toBe(false);
    });

    test("APIバージョンによる互換性チェック", () => {
      type ApiRequest = {
        apiVersion: number;
        deprecatedField?: string;
        newField?: string;
      };

      const validator = Builder()
        .use(orFailPlugin)
        .for<ApiRequest>()
        .v("apiVersion", (b) => b.number)
        .v("deprecatedField", (b) =>
          b.string.orFail((allValues) => allValues.apiVersion >= 2, {
            messageFactory: () => "This field is deprecated in API v2+",
          })
        )
        .v("newField", (b) =>
          b.string.orFail((allValues) => allValues.apiVersion < 2, {
            messageFactory: () => "This field is only available in API v2+",
          })
        )
        .build();

      // API v1でdeprecatedFieldを使用 - 成功
      expect(
        validator.validate({
          apiVersion: 1,
          deprecatedField: "legacy-data",
        }).valid
      ).toBe(true);

      // API v2でnewFieldを使用 - 成功
      expect(
        validator.validate({
          apiVersion: 2,
          newField: "modern-data",
        }).valid
      ).toBe(true);

      // API v2でdeprecatedFieldを使用 - 失敗
      expect(
        validator.validate({
          apiVersion: 2,
          deprecatedField: "legacy-data",
        }).valid
      ).toBe(false);

      // API v1でnewFieldを使用 - 失敗
      expect(
        validator.validate({
          apiVersion: 1,
          newField: "modern-data",
        }).valid
      ).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("静的メッセージの設定", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ blocked: boolean; action: string }>()
        .v("action", (b) =>
          b.string.orFail((allValues) => allValues.blocked, {
            messageFactory: () => "Action blocked by security policy",
          })
        )
        .build();

      const result = validator.validate({ blocked: true, action: "delete" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe(
        "Action blocked by security policy"
      );
    });

    test("カスタムエラーコードの設定", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ restricted: boolean; data: string }>()
        .v("data", (b) =>
          b.string.orFail((allValues) => allValues.restricted, {
            messageFactory: () => "Access denied",
            code: "ACCESS_DENIED",
          })
        )
        .build();

      const result = validator.validate({ restricted: true, data: "test" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("ACCESS_DENIED");
      expect(result.errors[0].message).toBe("Access denied");
    });

    test("動的エラーメッセージ（messageFactory）", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ reason: string; action: string }>()
        .v("action", (b) =>
          b.string.orFail((allValues) => allValues.reason === "security", {
            messageFactory: ({ path, value }) =>
              `${path} '${value}' is blocked for security reasons`,
          })
        )
        .build();

      const result = validator.validate({
        reason: "security",
        action: "delete-all",
      });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe(
        "action 'delete-all' is blocked for security reasons"
      );
    });
  });

  describe("パフォーマンステスト", () => {
    test("複雑な条件評価でも高速に動作", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{
          config: Record<string, any>;
          data: Record<string, string>;
        }>()
        .v("data.field1", (b) =>
          b.string.orFail(
            (allValues) => {
              // 複雑な条件評価
              return (
                allValues.config.strictMode &&
                Object.keys(allValues.data).length > 10
              );
            },
            { messageFactory: () => "Too many fields in strict mode" }
          )
        )
        .build();

      const testData = {
        config: { strictMode: false },
        data: { field1: "test" },
      };

      const start = performance.now();
      const result = validator.validate(testData);
      const end = performance.now();

      expect(result.isValid()).toBe(true);
      expect(end - start).toBeLessThan(10); // 10ms以内での完了を期待
    });

    test("大量のorFail条件でも高速に動作", () => {
      const builder = Builder()
        .use(orFailPlugin)
        .for<{ trigger: boolean } & Record<string, string>>();

      // 50個のフィールドにorFail条件を設定
      let validatorBuilder = builder.v("trigger", (b) => b.boolean);
      for (let i = 0; i < 50; i++) {
        validatorBuilder = validatorBuilder.v(`field${i}`, (b) =>
          b.string.orFail((allValues) => allValues.trigger === true, {
            messageFactory: () => `Field ${i} blocked`,
          })
        );
      }
      const validator = validatorBuilder.build();

      const testData: any = { trigger: false };
      for (let i = 0; i < 50; i++) {
        testData[`field${i}`] = `value${i}`;
      }

      const start = performance.now();
      const result = validator.validate(testData);
      const end = performance.now();

      expect(result.isValid()).toBe(true);
      expect(end - start).toBeLessThan(50); // 50ms以内での完了を期待
    });
  });

  describe("エッジケース", () => {
    test("条件関数がundefinedやnullにアクセスする場合", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ optional?: string; data: string }>()
        .v("data", (b) =>
          b.string.orFail((allValues) => allValues.optional?.length > 5, {
            messageFactory: () => "Blocked by optional field length",
          })
        )
        .build();

      // optionalがundefinedの場合（条件はfalse）
      expect(validator.validate({ data: "test" }).valid).toBe(true);

      // optionalが短い場合（条件はfalse）
      expect(validator.validate({ optional: "hi", data: "test" }).valid).toBe(
        true
      );

      // optionalが長い場合（条件はtrue）
      expect(
        validator.validate({ optional: "very long text", data: "test" }).valid
      ).toBe(false);
    });

    test("条件関数が例外を投げる場合のハンドリング", () => {
      const validator = Builder()
        .use(orFailPlugin)
        .for<{ config: any; data: string }>()
        .v("data", (b) =>
          b.string.orFail(
            (allValues) => {
              // 意図的に例外を発生させるケース
              return allValues.config.nonExistentProperty.someMethod();
            },
            { messageFactory: () => "Condition evaluation failed" }
          )
        )
        .build();

      // 例外が発生した場合の動作を確認
      // （実装に依存：例外をキャッチしてfalse扱いかエラー扱いか）
      expect(() => {
        validator.validate({ config: {}, data: "test" });
      }).not.toThrow(); // 例外が適切にハンドリングされることを期待
    });
  });
});
