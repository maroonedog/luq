import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { numberFinitePlugin } from "../../../../src/core/plugin/numberFinite";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("numberFinite Plugin", () => {
  describe("基本動作", () => {
    test("有限数を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().finite())
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: 1 }).valid).toBe(true);
      expect(validator.validate({ value: -1 }).valid).toBe(true);
      expect(validator.validate({ value: 100.5 }).valid).toBe(true);
      expect(validator.validate({ value: -999.999 }).valid).toBe(true);
      expect(validator.validate({ value: Number.MAX_SAFE_INTEGER }).valid).toBe(
        true
      );
      expect(validator.validate({ value: Number.MIN_SAFE_INTEGER }).valid).toBe(
        true
      );
    });

    test("無限大を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().finite())
        .build();

      const positiveInfinityResult = validator.validate({ value: Infinity });
      expect(positiveInfinityresult.isValid()).toBe(false);
      expect(positiveInfinityResult.errors[0]).toMatchObject({
        path: "value",
        code: "numberFinite",
      });

      const negativeInfinityResult = validator.validate({ value: -Infinity });
      expect(negativeInfinityresult.isValid()).toBe(false);
      expect(negativeInfinityResult.errors[0]).toMatchObject({
        path: "value",
        code: "numberFinite",
      });
    });

    test("NaNを拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().finite())
        .build();

      const result = validator.validate({ value: NaN });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "numberFinite",
      });
    });
  });

  describe("境界値での動作", () => {
    test("JavaScriptの最大・最小値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().finite())
        .build();

      // 最大値
      expect(validator.validate({ value: Number.MAX_VALUE }).valid).toBe(true);

      // 最小値（正の最小値）
      expect(validator.validate({ value: Number.MIN_VALUE }).valid).toBe(true);

      // 安全な整数の範囲
      expect(validator.validate({ value: Number.MAX_SAFE_INTEGER }).valid).toBe(
        true
      );
      expect(validator.validate({ value: Number.MIN_SAFE_INTEGER }).valid).toBe(
        true
      );
    });

    test("非常に小さな数値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().finite())
        .build();

      expect(validator.validate({ value: 1e-10 }).valid).toBe(true);
      expect(validator.validate({ value: 1e-100 }).valid).toBe(true);
      expect(validator.validate({ value: 1e-300 }).valid).toBe(true);
      expect(validator.validate({ value: -1e-300 }).valid).toBe(true);
    });

    test("非常に大きな数値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().finite())
        .build();

      expect(validator.validate({ value: 1e10 }).valid).toBe(true);
      expect(validator.validate({ value: 1e100 }).valid).toBe(true);
      expect(validator.validate({ value: 1e307 }).valid).toBe(true);
      expect(validator.validate({ value: -1e307 }).valid).toBe(true);
    });
  });

  describe("計算結果の検証", () => {
    test("有効な計算結果", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .for<{ result: number }>()
        .v("result", (b) => b.number.required().finite())
        .build();

      // 正常な計算結果
      expect(validator.validate({ result: 10 / 3 }).valid).toBe(true);
      expect(validator.validate({ result: Math.sqrt(16) }).valid).toBe(true);
      expect(validator.validate({ result: Math.pow(2, 10) }).valid).toBe(true);
      expect(validator.validate({ result: Math.log(Math.E) }).valid).toBe(true);
    });

    test("無効な計算結果", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .for<{ result: number }>()
        .v("result", (b) => b.number.required().finite())
        .build();

      // 無限大になる計算
      expect(validator.validate({ result: 1 / 0 }).valid).toBe(false);
      expect(validator.validate({ result: -1 / 0 }).valid).toBe(false);
      expect(validator.validate({ result: Math.log(0) }).valid).toBe(false); // -Infinity

      // NaNになる計算
      expect(validator.validate({ result: 0 / 0 }).valid).toBe(false);
      expect(validator.validate({ result: Math.sqrt(-1) }).valid).toBe(false);
      expect(validator.validate({ result: Math.log(-1) }).valid).toBe(false);
      expect(validator.validate({ result: Infinity - Infinity }).valid).toBe(
        false
      );
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("範囲制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ percentage: number }>()
        .v("percentage", (b) => b.number.required().finite().min(0).max(100))
        .build();

      // 有効: 有限数かつ範囲内
      expect(validator.validate({ percentage: 50 }).valid).toBe(true);
      expect(validator.validate({ percentage: 0 }).valid).toBe(true);
      expect(validator.validate({ percentage: 100 }).valid).toBe(true);

      // 無効: 無限大
      expect(validator.validate({ percentage: Infinity }).valid).toBe(false);

      // 無効: 範囲外
      expect(validator.validate({ percentage: -10 }).valid).toBe(false);
      expect(validator.validate({ percentage: 150 }).valid).toBe(false);
    });

    test("整数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .use(numberIntegerPlugin)
        .for<{ count: number }>()
        .v("count", (b) => b.number.required().finite().integer())
        .build();

      // 有効: 有限の整数
      expect(validator.validate({ count: 0 }).valid).toBe(true);
      expect(validator.validate({ count: 42 }).valid).toBe(true);
      expect(validator.validate({ count: -10 }).valid).toBe(true);

      // 無効: 無限大
      expect(validator.validate({ count: Infinity }).valid).toBe(false);

      // 無効: 小数
      expect(validator.validate({ count: 3.14 }).valid).toBe(false);
    });

    test("正の数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .use(numberPositivePlugin)
        .for<{ amount: number }>()
        .v("amount", (b) => b.number.required().finite().positive())
        .build();

      // 有効: 有限の正の数
      expect(validator.validate({ amount: 1 }).valid).toBe(true);
      expect(validator.validate({ amount: 0.1 }).valid).toBe(true);
      expect(validator.validate({ amount: 1000000 }).valid).toBe(true);

      // 無効: 無限大（正でも無効）
      expect(validator.validate({ amount: Infinity }).valid).toBe(false);

      // 無効: 負の数やゼロ
      expect(validator.validate({ amount: 0 }).valid).toBe(false);
      expect(validator.validate({ amount: -1 }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberFinitePlugin)
        .for<{ value?: number }>()
        .v("value", (b) => b.number.optional().finite())
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ value: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は有限性検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberFinitePlugin)
        .for<{ value?: number }>()
        .v("value", (b) => b.number.optional().finite())
        .build();

      expect(validator.validate({ value: 42 }).valid).toBe(true);
      expect(validator.validate({ value: Infinity }).valid).toBe(false);
      expect(validator.validate({ value: NaN }).valid).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("科学計算の結果検証", () => {
      interface CalculationResult {
        mean: number;
        variance: number;
        standardDeviation: number;
        correlation: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<CalculationResult>()
        .v("mean", (b) => b.number.required().finite())
        .v("variance", (b) => b.number.required().finite().min(0))
        .v("standardDeviation", (b) => b.number.required().finite().min(0))
        .v("correlation", (b) => b.number.required().finite().min(-1).max(1))
        .build();

      // 有効な統計結果
      const validStats = {
        mean: 25.5,
        variance: 12.3,
        standardDeviation: 3.5,
        correlation: 0.75,
      };
      expect(validator.validate(validStats).valid).toBe(true);

      // 無効な統計結果（計算エラー）
      const invalidStats = {
        mean: NaN, // 計算エラー
        variance: Infinity, // オーバーフロー
        standardDeviation: -1, // 負の標準偏差
        correlation: 1.5, // 相関係数の範囲外
      };
      expect(validator.validate(invalidStats).valid).toBe(false);
    });

    test("金融計算の検証", () => {
      interface FinancialCalculation {
        presentValue: number;
        futureValue: number;
        interestRate: number;
        paymentAmount: number;
        netPresentValue: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .use(numberPositivePlugin)
        .for<FinancialCalculation>()
        .v("presentValue", (b) => b.number.required().finite().positive())
        .v("futureValue", (b) => b.number.required().finite().positive())
        .v("interestRate", (b) => b.number.required().finite())
        .v("paymentAmount", (b) => b.number.required().finite().positive())
        .v("netPresentValue", (b) => b.number.required().finite())
        .build();

      // 有効な金融計算結果
      const validFinance = {
        presentValue: 10000,
        futureValue: 11025,
        interestRate: 0.05,
        paymentAmount: 1000,
        netPresentValue: 2500,
      };
      expect(validator.validate(validFinance).valid).toBe(true);

      // 無効な金融計算結果
      const invalidFinance = {
        presentValue: Infinity, // 計算オーバーフロー
        futureValue: -1000, // 負の将来価値
        interestRate: NaN, // 計算エラー
        paymentAmount: 0, // ゼロ支払い
        netPresentValue: Infinity, // オーバーフロー
      };
      expect(validator.validate(invalidFinance).valid).toBe(false);
    });

    test("物理計算の検証", () => {
      interface PhysicsCalculation {
        velocity: number; // m/s
        acceleration: number; // m/s²
        force: number; // N
        energy: number; // J
        power: number; // W
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .use(numberMinPlugin)
        .for<PhysicsCalculation>()
        .v("velocity", (b) => b.number.required().finite())
        .v("acceleration", (b) => b.number.required().finite())
        .v("force", (b) => b.number.required().finite())
        .v("energy", (b) => b.number.required().finite().min(0))
        .v("power", (b) => b.number.required().finite())
        .build();

      // 有効な物理計算結果
      const validPhysics = {
        velocity: 30.5,
        acceleration: 9.8,
        force: 490,
        energy: 1000,
        power: 500,
      };
      expect(validator.validate(validPhysics).valid).toBe(true);

      // 無効な物理計算結果
      const invalidPhysics = {
        velocity: NaN, // 計算エラー
        acceleration: Infinity, // 無限大の加速度
        force: NaN, // 計算エラー
        energy: -100, // 負のエネルギー
        power: Infinity, // 無限大の電力
      };
      expect(validator.validate(invalidPhysics).valid).toBe(false);
    });

    test("グラフィックス座標の検証", () => {
      interface GraphicsCoordinate {
        x: number;
        y: number;
        z: number;
        scale: number;
        rotation: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberFinitePlugin)
        .use(numberPositivePlugin)
        .for<GraphicsCoordinate>()
        .v("x", (b) => b.number.required().finite())
        .v("y", (b) => b.number.required().finite())
        .v("z", (b) => b.number.required().finite())
        .v("scale", (b) => b.number.required().finite().positive())
        .v("rotation", (b) => b.number.required().finite())
        .build();

      // 有効な座標
      const validCoords = {
        x: 100.5,
        y: -50.2,
        z: 0,
        scale: 1.5,
        rotation: 45,
      };
      expect(validator.validate(validCoords).valid).toBe(true);

      // 無効な座標（計算エラー）
      const invalidCoords = {
        x: Infinity, // 無限大の座標
        y: NaN, // 計算エラー
        z: -Infinity, // 負の無限大
        scale: 0, // ゼロスケール
        rotation: NaN, // 回転角度の計算エラー
      };
      expect(validator.validate(invalidCoords).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { numberPositivePlugin } from "../../../../src/core/plugin/numberPositive";
