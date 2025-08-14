import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { booleanFalsyPlugin } from "../../../../src/core/plugin/booleanFalsy";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("booleanFalsy Plugin", () => {
  describe("基本動作", () => {
    test("false値を受け入れる", () => {
      const validator = Builder()
        .use(booleanFalsyPlugin)
        .for<{ flag: boolean }>()
        .v("flag", (b) => b.boolean.falsy())
        .build();

      const result = validator.validate({ flag: false });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("true値を拒否する", () => {
      const validator = Builder()
        .use(booleanFalsyPlugin)
        .for<{ flag: boolean }>()
        .v("flag", (b) => b.boolean.falsy())
        .build();

      const result = validator.validate({ flag: true });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "flag",
        code: "booleanFalsy",
        message: "Value must be falsy",
      });
    });
  });

  describe("カスタムオプション", () => {
    test("カスタムエラーメッセージ", () => {
      const validator = Builder()
        .use(booleanFalsyPlugin)
        .for<{ flag: boolean }>()
        .v("flag", (b) =>
          b.boolean.falsy({
            messageFactory: ({ path, value }) =>
              `${path}はfalseでなければなりません (現在: ${value})`,
          })
        )
        .build();

      const result = validator.validate({ flag: true });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe(
        "flagはfalseでなければなりません (現在: true)"
      );
    });

    test("カスタムエラーコード", () => {
      const validator = Builder()
        .use(booleanFalsyPlugin)
        .for<{ flag: boolean }>()
        .v("flag", (b) =>
          b.boolean.falsy({
            code: "CUSTOM_FALSY",
          })
        )
        .build();

      const result = validator.validate({ flag: true });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("CUSTOM_FALSY");
    });
  });

  describe("非boolean値の処理", () => {
    test("null値は検証をスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(booleanFalsyPlugin)
        .for<{ flag: boolean | null }>()
        .v("flag", (b) => b.boolean.optional().falsy())
        .build();

      expect(validator.validate({ flag: null }).valid).toBe(true);
    });

    test("undefined値は検証をスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(booleanFalsyPlugin)
        .for<{ flag?: boolean }>()
        .v("flag", (b) => b.boolean.optional().falsy())
        .build();

      expect(validator.validate({}).valid).toBe(true);
    });

    test("非boolean値は検証をスキップ", () => {
      const validator = Builder()
        .use(booleanFalsyPlugin)
        .for<{ flag: any }>()
        .v("flag", (b) => b.boolean.falsy())
        .build();

      // 文字列、数値等は検証をスキップしてtrueを返す
      expect(validator.validate({ flag: "false" }).valid).toBe(true);
      expect(validator.validate({ flag: 0 }).valid).toBe(true);
    });
  });

  test("非boolean値はスキップする", () => {
    const validator = Builder()
      .use(booleanFalsyPlugin)
      .for<{ value: any }>()
      .v("value", (b) => b.boolean.falsy())
      .build();

    // 非boolean値は検証をスキップ（valid=true）
    expect(validator.validate({ value: "false" }).valid).toBe(true);
    expect(validator.validate({ value: 0 }).valid).toBe(true);
    expect(validator.validate({ value: null }).valid).toBe(true);
    expect(validator.validate({ value: undefined }).valid).toBe(true);
    expect(validator.validate({ value: [] }).valid).toBe(true);
    expect(validator.validate({ value: {} }).valid).toBe(true);
  });
});

describe("requiredとの組み合わせ", () => {
  test("required + falsy の組み合わせ", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(booleanFalsyPlugin)
      .for<{ disabled: boolean }>()
      .v("disabled", (b) => b.boolean.required().falsy())
      .build();

    // falseは有効
    expect(validator.validate({ disabled: false }).valid).toBe(true);

    // trueは無効（falsyバリデーションで失敗）
    const resultTrue = validator.validate({ disabled: true });
    expect(resultTrue.valid).toBe(false);
    expect(resultTrue.errors[0].code).toBe("booleanFalsy");

    // undefinedは無効（requiredバリデーションで失敗）
    const resultUndefined = validator.validate({});
    expect(resultUndefined.valid).toBe(false);
    expect(resultUndefined.errors[0].code).toBe("required");
  });

  test("optional + falsy の組み合わせ", () => {
    const validator = Builder()
      .use(optionalPlugin)
      .use(booleanFalsyPlugin)
      .for<{ feature?: boolean }>()
      .v("feature", (b) => b.boolean.optional().falsy())
      .build();

    // undefinedは有効（optional）
    expect(validator.validate({}).valid).toBe(true);

    // falseは有効
    expect(validator.validate({ feature: false }).valid).toBe(true);

    // trueは無効
    expect(validator.validate({ feature: true }).valid).toBe(false);
  });
});

describe("カスタムエラーメッセージ", () => {
  test("カスタムエラーメッセージを設定できる", () => {
    const validator = Builder()
      .use(booleanFalsyPlugin)
      .for<{ setting: boolean }>()
      .v("setting", (b) =>
        b.boolean.falsy({
          messageFactory: ({ path, value }) =>
            `${path} must be disabled (current: ${value})`,
        })
      )
      .build();

    const result = validator.validate({ setting: true });
    expect(result.isValid()).toBe(false);
    expect(result.errors[0].message).toBe(
      "setting must be disabled (current: true)"
    );
  });

  test("カスタムエラーコードを設定できる", () => {
    const validator = Builder()
      .use(booleanFalsyPlugin)
      .for<{ flag: boolean }>()
      .v("flag", (b) =>
        b.boolean.falsy({
          code: "MUST_BE_DISABLED",
        })
      )
      .build();

    const result = validator.validate({ flag: true });
    expect(result.isValid()).toBe(false);
    expect(result.errors[0].code).toBe("MUST_BE_DISABLED");
  });
});

describe("実用的なシナリオ", () => {
  test("セキュリティ設定での使用", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(booleanFalsyPlugin)
      .for<{
        allowExternalAccess: boolean;
        enableDebugMode: boolean;
        shareAnalytics: boolean;
      }>()
      .v("allowExternalAccess", (b) => b.boolean.required().falsy())
      .v("enableDebugMode", (b) => b.boolean.required().falsy())
      .v("shareAnalytics", (b) => b.boolean.required().falsy())
      .build();

    // 全てがfalseの場合は有効
    expect(
      validator.validate({
        allowExternalAccess: false,
        enableDebugMode: false,
        shareAnalytics: false,
      }).valid
    ).toBe(true);

    // 一つでもtrueがあれば無効
    expect(
      validator.validate({
        allowExternalAccess: true,
        enableDebugMode: false,
        shareAnalytics: false,
      }).valid
    ).toBe(false);
  });

  test("機能フラグの無効化チェック", () => {
    type FeatureFlags = {
      experimentalFeature?: boolean;
      betaFeature?: boolean;
      unsafeMode?: boolean;
    };

    const validator = Builder()
      .use(optionalPlugin)
      .use(booleanFalsyPlugin)
      .for<FeatureFlags>()
      .v("experimentalFeature", (b) => b.boolean.optional().falsy())
      .v("betaFeature", (b) => b.boolean.optional().falsy())
      .v("unsafeMode", (b) => b.boolean.optional().falsy())
      .build();

    // 未定義は有効（optional）
    expect(validator.validate({}).valid).toBe(true);

    // 全てfalseは有効
    expect(
      validator.validate({
        experimentalFeature: false,
        betaFeature: false,
        unsafeMode: false,
      }).valid
    ).toBe(true);

    // 一つでもtrueがあれば無効
    expect(
      validator.validate({
        experimentalFeature: false,
        betaFeature: true,
        unsafeMode: false,
      }).valid
    ).toBe(false);
  });
});

describe("ネストしたオブジェクト", () => {
  test("ネストしたフィールドでの使用", () => {
    const validator = Builder()
      .use(booleanFalsyPlugin)
      .for<{ config: { debug: boolean } }>()
      .v("config.debug", (b) => b.boolean.falsy())
      .build();

    expect(validator.validate({ config: { debug: false } }).valid).toBe(true);
    expect(validator.validate({ config: { debug: true } }).valid).toBe(false);
  });

  test("配列内のオブジェクトでの使用", () => {
    const validator = Builder()
      .use(booleanFalsyPlugin)
      .for<{ users: Array<{ isAdmin: boolean }> }>()
      .v("users[*].isAdmin", (b) => b.boolean.falsy())
      .build();

    expect(validator.validate({ users: [{ isAdmin: false }] }).valid).toBe(
      true
    );
    expect(validator.validate({ users: [{ isAdmin: true }] }).valid).toBe(
      false
    );
  });
});

describe("エッジケース", () => {
  test("真偽値変換は行わない", () => {
    const validator = Builder()
      .use(booleanFalsyPlugin)
      .for<{ value: any }>()
      .v("value", (b) => b.boolean.falsy())
      .build();

    // JavaScriptのfalsy値でも、boolean以外はスキップ
    expect(validator.validate({ value: 0 }).valid).toBe(true);
    expect(validator.validate({ value: "" }).valid).toBe(true);
    expect(validator.validate({ value: null }).valid).toBe(true);
    expect(validator.validate({ value: undefined }).valid).toBe(true);

    // boolean型のみ検証
    expect(validator.validate({ value: false }).valid).toBe(true);
    expect(validator.validate({ value: true }).valid).toBe(false);
  });
});

describe("パフォーマンステスト", () => {
  test("大量のフィールドでも高速に動作する", () => {
    const builder = Builder()
      .use(booleanFalsyPlugin)
      .for<Record<string, boolean>>();

    // 1000個のフィールドでバリデーターを構築
    let validatorBuilder = builder;
    for (let i = 0; i < 1000; i++) {
      validatorBuilder = validatorBuilder.v(`field${i}`, (b) =>
        b.boolean.falsy()
      );
    }
    const validator = validatorBuilder.build();

    // 1000個のfalse値でテスト
    const testData: Record<string, boolean> = {};
    for (let i = 0; i < 1000; i++) {
      testData[`field${i}`] = false;
    }

    const start = performance.now();
    const result = validator.validate(testData);
    const end = performance.now();

    expect(result.isValid()).toBe(true);
    expect(end - start).toBeLessThan(100); // 100ms以内での完了を期待
  });
});
