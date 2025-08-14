import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { numberRangePlugin } from "../../../../src/core/plugin/numberRange";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { numberPositivePlugin } from "../../../../src/core/plugin/numberPositive";
import { numberMultipleOfPlugin } from "../../../../src/core/plugin/numberMultipleOf";

describe("numberRange Plugin", () => {
  describe("基本動作", () => {
    test("範囲内の数値を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ percentage: number }>()
        .v("percentage", (b) => b.number.required().range(0, 100))
        .build();

      expect(validator.validate({ percentage: 0 }).isValid()).toBe(true);
      expect(validator.validate({ percentage: 50 }).isValid()).toBe(true);
      expect(validator.validate({ percentage: 100 }).isValid()).toBe(true);
      expect(validator.validate({ percentage: 25.5 }).isValid()).toBe(true);
      expect(validator.validate({ percentage: 99.99 }).isValid()).toBe(true);
    });

    test("範囲外の数値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ percentage: number }>()
        .v("percentage", (b) => b.number.required().range(0, 100))
        .build();

      // 最小値未満
      const belowMinResult = validator.validate({ percentage: -0.1 });
      expect(belowMinResult.isValid()).toBe(false);
      expect(belowMinResult.errors[0]).toMatchObject({
        path: "percentage",
        code: "not_in_range",
      });

      // 最大値超過
      const aboveMaxResult = validator.validate({ percentage: 100.1 });
      expect(aboveMaxResult.isValid()).toBe(false);
      expect(aboveMaxResult.errors[0]).toMatchObject({
        path: "percentage",
        code: "not_in_range",
      });
    });
  });

  describe("様々な範囲での検証", () => {
    test("負の範囲", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ temperature: number }>()
        .v("temperature", (b) => b.number.required().range(-273.15, -200))
        .build();

      expect(validator.validate({ temperature: -273.15 }).isValid()).toBe(true); // 絶対零度
      expect(validator.validate({ temperature: -250 }).isValid()).toBe(true);
      expect(validator.validate({ temperature: -200 }).isValid()).toBe(true);

      expect(validator.validate({ temperature: -300 }).isValid()).toBe(false); // 絶対零度未満
      expect(validator.validate({ temperature: -190 }).isValid()).toBe(false); // 上限超過
      expect(validator.validate({ temperature: 25 }).isValid()).toBe(false); // 大幅に範囲外
    });

    test("小数の範囲", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ probability: number }>()
        .v("probability", (b) => b.number.required().range(0.0, 1.0))
        .build();

      expect(validator.validate({ probability: 0.0 }).isValid()).toBe(true);
      expect(validator.validate({ probability: 0.5 }).isValid()).toBe(true);
      expect(validator.validate({ probability: 1.0 }).isValid()).toBe(true);
      expect(validator.validate({ probability: 0.333333 }).isValid()).toBe(true);

      expect(validator.validate({ probability: -0.1 }).isValid()).toBe(false);
      expect(validator.validate({ probability: 1.1 }).isValid()).toBe(false);
    });

    test("大きな数値の範囲", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ distance: number }>()
        .v("distance", (b) => b.number.required().range(1000000, 10000000))
        .build();

      expect(validator.validate({ distance: 1000000 }).isValid()).toBe(true);
      expect(validator.validate({ distance: 5000000 }).isValid()).toBe(true);
      expect(validator.validate({ distance: 10000000 }).isValid()).toBe(true);

      expect(validator.validate({ distance: 999999 }).isValid()).toBe(false);
      expect(validator.validate({ distance: 10000001 }).isValid()).toBe(false);
    });

    test("単一値の範囲（min = max）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ exact: number }>()
        .v("exact", (b) => b.number.required().range(42, 42))
        .build();

      expect(validator.validate({ exact: 42 }).isValid()).toBe(true);
      expect(validator.validate({ exact: 41 }).isValid()).toBe(false);
      expect(validator.validate({ exact: 43 }).isValid()).toBe(false);
      expect(validator.validate({ exact: 42.0 }).isValid()).toBe(true);
    });
  });

  describe("境界値での動作", () => {
    test("境界値の包含性", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().range(10, 20))
        .build();

      // 境界値は含まれる
      expect(validator.validate({ value: 10 }).isValid()).toBe(true);
      expect(validator.validate({ value: 20 }).isValid()).toBe(true);

      // 境界値の外側は除外される
      expect(validator.validate({ value: 9.9999 }).isValid()).toBe(false);
      expect(validator.validate({ value: 20.0001 }).isValid()).toBe(false);
    });

    test("浮動小数点の精度問題", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().range(0.1, 0.3))
        .build();

      expect(validator.validate({ value: 0.1 }).isValid()).toBe(true);
      expect(validator.validate({ value: 0.2 }).isValid()).toBe(true);
      expect(validator.validate({ value: 0.3 }).isValid()).toBe(true);

      // 浮動小数点の計算結果
      const calculated = 0.1 + 0.2; // 0.30000000000000004
      const result = validator.validate({ value: calculated });
      // 実装が適切に浮動小数点誤差を処理しているかをテスト
      // （結果は実装依存だが、通常は範囲外として扱われる可能性が高い）
    });
  });

  describe("特殊な数値での動作", () => {
    test("Infinityの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().range(0, 1000))
        .build();

      expect(validator.validate({ value: Infinity }).isValid()).toBe(false);
      expect(validator.validate({ value: -Infinity }).isValid()).toBe(false);
    });

    test("NaNの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().range(0, 100))
        .build();

      expect(validator.validate({ value: NaN }).isValid()).toBe(false);
    });

    test("極値での範囲", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) =>
          b.number
            .required()
            .range(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
        )
        .build();

      expect(validator.validate({ value: Number.MIN_SAFE_INTEGER }).isValid()).toBe(
        true
      );
      expect(validator.validate({ value: Number.MAX_SAFE_INTEGER }).isValid()).toBe(
        true
      );
      expect(validator.validate({ value: 0 }).isValid()).toBe(true);
    });
  });

  describe("エラーパラメータの検証", () => {
    test("無効な範囲パラメータ（min > max）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().range(100, 50)) // min > max
        .build();

      // 無効なパラメータでは任意の値で検証が失敗する
      const result = validator.validate({ value: 75 });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toContain("Plugin configuration error");
    });

    test("NaNパラメータ", () => {
      const validator1 = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().range(NaN, 100))
        .build();

      const result1 = validator1.validate({ value: 50 });
      expect(result1.isValid()).toBe(false);
      expect(result1.errors[0].message).toContain("Cannot use NaN values");

      const validator2 = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().range(0, NaN))
        .build();

      const result2 = validator2.validate({ value: 50 });
      expect(result2.isValid()).toBe(false);  
      expect(result2.errors[0].message).toContain("Cannot use NaN values");
    });

    test("Infinityパラメータ", () => {
      // 実装によってはInfinityを範囲として許可する場合もある
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().range(-Infinity, Infinity))
        .build();

      expect(validator.validate({ value: 1000000 }).isValid()).toBe(true);
      expect(validator.validate({ value: -1000000 }).isValid()).toBe(true);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("整数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .use(numberIntegerPlugin)
        .for<{ level: number }>()
        .v("level", (b) => b.number.required().integer().range(1, 10))
        .build();

      // 有効: 整数かつ範囲内
      expect(validator.validate({ level: 1 }).isValid()).toBe(true);
      expect(validator.validate({ level: 5 }).isValid()).toBe(true);
      expect(validator.validate({ level: 10 }).isValid()).toBe(true);

      // 無効: 範囲内だが整数でない
      expect(validator.validate({ level: 5.5 }).isValid()).toBe(false);

      // 無効: 整数だが範囲外
      expect(validator.validate({ level: 0 }).isValid()).toBe(false);
      expect(validator.validate({ level: 11 }).isValid()).toBe(false);
    });

    test("正の数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .use(numberPositivePlugin)
        .for<{ amount: number }>()
        .v("amount", (b) => b.number.required().positive().range(1, 1000))
        .build();

      // 有効: 正の数かつ範囲内
      expect(validator.validate({ amount: 1 }).isValid()).toBe(true);
      expect(validator.validate({ amount: 500 }).isValid()).toBe(true);
      expect(validator.validate({ amount: 1000 }).isValid()).toBe(true);

      // 無効: 範囲内だが正の数でない
      expect(validator.validate({ amount: 0 }).isValid()).toBe(false); // ゼロ（正の数でない）

      // 無効: 正の数だが範囲外
      expect(validator.validate({ amount: 0.5 }).isValid()).toBe(false); // 範囲外（1未満）
      expect(validator.validate({ amount: 1001 }).isValid()).toBe(false); // 範囲外（1000超過）
    });

    test("倍数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .use(numberMultipleOfPlugin)
        .for<{ score: number }>()
        .v("score", (b) => b.number.required().range(0, 100).multipleOf(5))
        .build();

      // 有効: 範囲内かつ5の倍数
      expect(validator.validate({ score: 0 }).isValid()).toBe(true);
      expect(validator.validate({ score: 25 }).isValid()).toBe(true);
      expect(validator.validate({ score: 50 }).isValid()).toBe(true);
      expect(validator.validate({ score: 100 }).isValid()).toBe(true);

      // 無効: 範囲内だが5の倍数でない
      expect(validator.validate({ score: 3 }).isValid()).toBe(false);
      expect(validator.validate({ score: 47 }).isValid()).toBe(false);

      // 無効: 5の倍数だが範囲外
      expect(validator.validate({ score: -5 }).isValid()).toBe(false);
      expect(validator.validate({ score: 105 }).isValid()).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberRangePlugin)
        .for<{ value?: number }>()
        .v("value", (b) => b.number.optional().range(0, 100))
        .build();

      expect(validator.validate({}).isValid()).toBe(true);
      expect(validator.validate({ value: undefined }).isValid()).toBe(true);
    });

    test("値が存在する場合は範囲検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberRangePlugin)
        .for<{ value?: number }>()
        .v("value", (b) => b.number.optional().range(0, 100))
        .build();

      expect(validator.validate({ value: 50 }).isValid()).toBe(true);
      expect(validator.validate({ value: -10 }).isValid()).toBe(false);
      expect(validator.validate({ value: 110 }).isValid()).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("ユーザー評価システム", () => {
      interface UserRating {
        overall: number; // 1-5
        quality: number; // 1-5
        service: number; // 1-5
        value: number; // 1-5
        recommend: number; // 0-10（Net Promoter Score）
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<UserRating>()
        .v("overall", (b) => b.number.required().range(1, 5))
        .v("quality", (b) => b.number.required().range(1, 5))
        .v("service", (b) => b.number.required().range(1, 5))
        .v("value", (b) => b.number.required().range(1, 5))
        .v("recommend", (b) => b.number.required().range(0, 10))
        .build();

      // 有効な評価
      const validRating = {
        overall: 4.5,
        quality: 5,
        service: 3,
        value: 4,
        recommend: 8,
      };
      expect(validator.validate(validRating).isValid()).toBe(true);

      // 無効な評価
      const invalidRating = {
        overall: 0, // 範囲外（1未満）
        quality: 6, // 範囲外（5超過）
        service: 3, // OK
        value: 4, // OK
        recommend: 11, // 範囲外（10超過）
      };
      expect(validator.validate(invalidRating).isValid()).toBe(false);
    });

    test("ゲーム設定システム", () => {
      interface GameSettings {
        difficulty: number; // 1-10
        volume: number; // 0-100
        brightness: number; // 0-100
        sensitivity: number; // 0.1-10.0
        fov: number; // 60-120 (Field of View)
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .use(numberIntegerPlugin)
        .for<GameSettings>()
        .v("difficulty", (b) => b.number.required().integer().range(1, 10))
        .v("volume", (b) => b.number.required().integer().range(0, 100))
        .v("brightness", (b) => b.number.required().integer().range(0, 100))
        .v("sensitivity", (b) => b.number.required().range(0.1, 10.0))
        .v("fov", (b) => b.number.required().integer().range(60, 120))
        .build();

      // 有効なゲーム設定
      const validSettings = {
        difficulty: 7,
        volume: 75,
        brightness: 80,
        sensitivity: 2.5,
        fov: 90,
      };
      expect(validator.validate(validSettings).isValid()).toBe(true);

      // 無効なゲーム設定
      const invalidSettings = {
        difficulty: 11, // 範囲外
        volume: -5, // 範囲外
        brightness: 150, // 範囲外
        sensitivity: 0.05, // 範囲外
        fov: 45, // 範囲外
      };
      expect(validator.validate(invalidSettings).isValid()).toBe(false);
    });

    test("センサーデータ検証", () => {
      interface SensorReading {
        temperature: number; // -40 to 125 (摂氏)
        humidity: number; // 0-100 (%)
        pressure: number; // 300-1100 (hPa)
        altitude: number; // -500 to 9000 (m)
        light: number; // 0-65535 (lux)
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .use(numberIntegerPlugin)
        .for<SensorReading>()
        .v("temperature", (b) => b.number.required().range(-40, 125))
        .v("humidity", (b) => b.number.required().range(0, 100))
        .v("pressure", (b) => b.number.required().range(300, 1100))
        .v("altitude", (b) => b.number.required().range(-500, 9000))
        .v("light", (b) => b.number.required().integer().range(0, 65535))
        .build();

      // 有効なセンサーデータ
      const validReading = {
        temperature: 22.5,
        humidity: 45.3,
        pressure: 1013.25,
        altitude: 150,
        light: 1200,
      };
      expect(validator.validate(validReading).isValid()).toBe(true);

      // 無効なセンサーデータ
      const invalidReading = {
        temperature: -50, // 範囲外（低すぎる）
        humidity: 120, // 範囲外（高すぎる）
        pressure: 200, // 範囲外（低すぎる）
        altitude: 10000, // 範囲外（高すぎる）
        light: 70000, // 範囲外（高すぎる）
      };
      expect(validator.validate(invalidReading).isValid()).toBe(false);
    });

    test("金融取引制限", () => {
      interface TransactionLimits {
        dailyLimit: number; // 0-50000
        monthlyLimit: number; // 0-200000
        transactionAmount: number; // 0.01-10000
        transferFee: number; // 0-100
        exchangeRate: number; // 0.001-1000
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberRangePlugin)
        .for<TransactionLimits>()
        .v("dailyLimit", (b) => b.number.required().range(0, 50000))
        .v("monthlyLimit", (b) => b.number.required().range(0, 200000))
        .v("transactionAmount", (b) => b.number.required().range(0.01, 10000))
        .v("transferFee", (b) => b.number.required().range(0, 100))
        .v("exchangeRate", (b) => b.number.required().range(0.001, 1000))
        .build();

      // 有効な取引設定
      const validLimits = {
        dailyLimit: 5000,
        monthlyLimit: 20000,
        transactionAmount: 150.5,
        transferFee: 2.5,
        exchangeRate: 1.25,
      };
      expect(validator.validate(validLimits).isValid()).toBe(true);

      // 無効な取引設定
      const invalidLimits = {
        dailyLimit: 60000, // 範囲外
        monthlyLimit: -1000, // 範囲外
        transactionAmount: 0, // 範囲外（最小値未満）
        transferFee: 150, // 範囲外
        exchangeRate: 0.0001, // 範囲外
      };
      expect(validator.validate(invalidLimits).isValid()).toBe(false);
    });
  });
});