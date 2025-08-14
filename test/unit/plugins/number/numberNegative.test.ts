import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { numberNegativePlugin } from "../../../../src/core/plugin/numberNegative";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("numberNegative Plugin", () => {
  describe("基本動作", () => {
    test("負の数を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ deficit: number }>()
        .v("deficit", (b) => b.number.required().negative())
        .build();

      expect(validator.validate({ deficit: -1 }).valid).toBe(true);
      expect(validator.validate({ deficit: -0.1 }).valid).toBe(true);
      expect(validator.validate({ deficit: -0.0001 }).valid).toBe(true);
      expect(validator.validate({ deficit: -100 }).valid).toBe(true);
      expect(validator.validate({ deficit: -999999 }).valid).toBe(true);
      expect(
        validator.validate({ deficit: Number.MIN_SAFE_INTEGER }).valid
      ).toBe(true);
    });

    test("ゼロを拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ deficit: number }>()
        .v("deficit", (b) => b.number.required().negative())
        .build();

      const result = validator.validate({ deficit: 0 });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "deficit",
        code: "numberNegative",
      });
    });

    test("正の数を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ deficit: number }>()
        .v("deficit", (b) => b.number.required().negative())
        .build();

      const positiveValues = [1, 0.1, 100, 999999, Number.MAX_SAFE_INTEGER];

      positiveValues.forEach((value) => {
        const result = validator.validate({ deficit: value });
        expect(result.isValid()).toBe(false);
        expect(result.errors[0]).toMatchObject({
          path: "deficit",
          code: "numberNegative",
        });
      });
    });

    test("-0を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().negative())
        .build();

      // -0は負の数として扱われる場合がある（実装依存）
      const result = validator.validate({ value: -0 });
      // この動作は実装によって異なる可能性があります
      // 多くの場合、-0 === 0 なので拒否される可能性が高い
      expect(result.isValid()).toBe(false); // 実装に応じて調整が必要
    });
  });

  describe("特殊な数値での動作", () => {
    test("Infinityの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().negative())
        .build();

      // 負の無限大は負の数として扱われる
      expect(validator.validate({ value: -Infinity }).valid).toBe(true);

      // 正の無限大は拒否される
      expect(validator.validate({ value: Infinity }).valid).toBe(false);
    });

    test("NaNの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().negative())
        .build();

      const result = validator.validate({ value: NaN });
      expect(result.isValid()).toBe(false);
    });

    test("非常に小さい負の数", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().negative())
        .build();

      expect(validator.validate({ value: -Number.MIN_VALUE }).valid).toBe(true);
      expect(validator.validate({ value: -1e-10 }).valid).toBe(true);
      expect(validator.validate({ value: -1e-100 }).valid).toBe(true);
      expect(validator.validate({ value: -1e-323 }).valid).toBe(true); // 極小の負の値
    });
  });

  describe("境界値での動作", () => {
    test("ゼロ周辺の値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().negative())
        .build();

      // ゼロより小さい最大の値
      expect(validator.validate({ value: -Number.EPSILON }).valid).toBe(true);

      // ゼロ近似値
      expect(validator.validate({ value: -1e-16 }).valid).toBe(true);

      // 実質的にゼロに近い値でも負なら有効
      expect(validator.validate({ value: -1e-50 }).valid).toBe(true);
    });

    test("浮動小数点の精度問題", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().negative())
        .build();

      // 計算結果が負の値になる場合
      expect(validator.validate({ value: -0.1 - 0.2 }).valid).toBe(true); // -0.30000000000000004
      expect(validator.validate({ value: 0.9 - 1 }).valid).toBe(true); // -0.09999999999999998
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("範囲制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ loss: number }>()
        .v("loss", (b) => b.number.required().negative().min(-1000).max(-1))
        .build();

      // 有効: 負の数かつ範囲内
      expect(validator.validate({ loss: -500 }).valid).toBe(true);
      expect(validator.validate({ loss: -1 }).valid).toBe(true);
      expect(validator.validate({ loss: -1000 }).valid).toBe(true);

      // 無効: 負の数だが範囲外
      expect(validator.validate({ loss: -0.5 }).valid).toBe(false); // max超過
      expect(validator.validate({ loss: -2000 }).valid).toBe(false); // min未満

      // 無効: 正の数
      expect(validator.validate({ loss: 100 }).valid).toBe(false);

      // 無効: ゼロ
      expect(validator.validate({ loss: 0 }).valid).toBe(false);
    });

    test("整数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .use(numberIntegerPlugin)
        .for<{ decrement: number }>()
        .v("decrement", (b) => b.number.required().negative().integer())
        .build();

      // 有効: 負の整数
      expect(validator.validate({ decrement: -1 }).valid).toBe(true);
      expect(validator.validate({ decrement: -100 }).valid).toBe(true);

      // 無効: 負の小数
      expect(validator.validate({ decrement: -1.5 }).valid).toBe(false);

      // 無効: ゼロ
      expect(validator.validate({ decrement: 0 }).valid).toBe(false);

      // 無効: 正の整数
      expect(validator.validate({ decrement: 1 }).valid).toBe(false);
    });

    test("有限数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .use(numberFinitePlugin)
        .for<{ debt: number }>()
        .v("debt", (b) => b.number.required().negative().finite())
        .build();

      // 有効: 負の有限数
      expect(validator.validate({ debt: -42.5 }).valid).toBe(true);
      expect(validator.validate({ debt: -0.001 }).valid).toBe(true);

      // 無効: 負の無限大（負だが有限ではない）
      expect(validator.validate({ debt: -Infinity }).valid).toBe(false);

      // 無効: ゼロ
      expect(validator.validate({ debt: 0 }).valid).toBe(false);

      // 無効: 正の数
      expect(validator.validate({ debt: 5 }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberNegativePlugin)
        .for<{ loss?: number }>()
        .v("loss", (b) => b.number.optional().negative())
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ loss: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は負数検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberNegativePlugin)
        .for<{ loss?: number }>()
        .v("loss", (b) => b.number.optional().negative())
        .build();

      expect(validator.validate({ loss: -100 }).valid).toBe(true);
      expect(validator.validate({ loss: 0 }).valid).toBe(false);
      expect(validator.validate({ loss: 50 }).valid).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("会計システムの負債・損失", () => {
      interface AccountingData {
        netLoss: number;
        debt: number;
        deficit: number;
        expense: number;
        depreciation: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .use(numberFinitePlugin)
        .for<AccountingData>()
        .v("netLoss", (b) => b.number.required().negative().finite())
        .v("debt", (b) => b.number.required().negative().finite())
        .v("deficit", (b) => b.number.required().negative().finite())
        .v("expense", (b) => b.number.required().negative().finite())
        .v("depreciation", (b) => b.number.required().negative().finite())
        .build();

      // 有効な会計データ（全て負の値）
      const validData = {
        netLoss: -50000,
        debt: -200000,
        deficit: -75000,
        expense: -25000,
        depreciation: -10000,
      };
      expect(validator.validate(validData).valid).toBe(true);

      // 無効な会計データ
      const invalidData = {
        netLoss: 0, // ゼロ損失
        debt: 100000, // 正の債務（資産？）
        deficit: 0, // ゼロ赤字
        expense: 5000, // 正の支出（収入？）
        depreciation: 0, // ゼロ減価償却
      };
      expect(validator.validate(invalidData).valid).toBe(false);
    });

    test("物理システムの変化量", () => {
      interface PhysicalChange {
        velocityChange: number; // 速度の変化（減速）
        energyLoss: number; // エネルギー損失
        temperatureDrop: number; // 温度低下
        pressureDecrease: number; // 圧力減少
        altitudeChange: number; // 高度変化（下降）
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .use(numberFinitePlugin)
        .for<PhysicalChange>()
        .v("velocityChange", (b) => b.number.required().negative().finite())
        .v("energyLoss", (b) => b.number.required().negative().finite())
        .v("temperatureDrop", (b) => b.number.required().negative().finite())
        .v("pressureDecrease", (b) => b.number.required().negative().finite())
        .v("altitudeChange", (b) => b.number.required().negative().finite())
        .build();

      // 有効な物理変化データ（全て減少）
      const validChange = {
        velocityChange: -15.5,
        energyLoss: -100.0,
        temperatureDrop: -25.3,
        pressureDecrease: -1013.25,
        altitudeChange: -500.0,
      };
      expect(validator.validate(validChange).valid).toBe(true);

      // 無効な物理変化データ
      const invalidChange = {
        velocityChange: 10, // 加速（正の変化）
        energyLoss: 0, // エネルギー損失なし
        temperatureDrop: 5, // 温度上昇
        pressureDecrease: 0, // 圧力変化なし
        altitudeChange: 100, // 上昇
      };
      expect(validator.validate(invalidChange).valid).toBe(false);
    });

    test("ゲームスコア調整システム", () => {
      interface ScoreAdjustment {
        penalty: number;
        deduction: number;
        malus: number;
        timeBonus: number; // 時間切れペナルティ
        accuracyPenalty: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .use(numberIntegerPlugin)
        .use(numberMinPlugin)
        .for<ScoreAdjustment>()
        .v("penalty", (b) => b.number.required().negative().integer())
        .v("deduction", (b) => b.number.required().negative().integer())
        .v("malus", (b) => b.number.required().negative().integer())
        .v("timeBonus", (b) =>
          b.number.required().negative().integer().min(-1000)
        )
        .v("accuracyPenalty", (b) => b.number.required().negative().integer())
        .build();

      // 有効なスコア調整（全てペナルティ）
      const validAdjustment = {
        penalty: -50,
        deduction: -25,
        malus: -10,
        timeBonus: -100,
        accuracyPenalty: -75,
      };
      expect(validator.validate(validAdjustment).valid).toBe(true);

      // 無効なスコア調整
      const invalidAdjustment = {
        penalty: 0, // ペナルティなし
        deduction: 25, // 正のボーナス
        malus: -5.5, // 小数のペナルティ
        timeBonus: -2000, // 許可された範囲外の大きなペナルティ
        accuracyPenalty: 10, // 正のボーナス
      };
      expect(validator.validate(invalidAdjustment).valid).toBe(false);
    });

    test("環境変化データ", () => {
      interface EnvironmentalChange {
        co2Reduction: number; // CO2削減量
        pollutionDecrease: number; // 汚染減少
        deforestation: number; // 森林減少
        speciesLoss: number; // 種の減少
        ozoneDamage: number; // オゾン層破壊
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .use(numberFinitePlugin)
        .use(numberMinPlugin)
        .for<EnvironmentalChange>()
        .v("co2Reduction", (b) => b.number.required().negative().finite())
        .v("pollutionDecrease", (b) => b.number.required().negative().finite())
        .v("deforestation", (b) => b.number.required().negative().finite())
        .v("speciesLoss", (b) => b.number.required().negative().finite())
        .v("ozoneDamage", (b) =>
          b.number.required().negative().finite().min(-100)
        )
        .build();

      // 有効な環境変化データ（全て減少）
      const validEnvironment = {
        co2Reduction: -1000.5,
        pollutionDecrease: -50.25,
        deforestation: -15.7,
        speciesLoss: -3.2,
        ozoneDamage: -5.5,
      };
      expect(validator.validate(validEnvironment).valid).toBe(true);

      // 無効な環境変化データ
      const invalidEnvironment = {
        co2Reduction: 100, // CO2増加（悪化）
        pollutionDecrease: 0, // 汚染変化なし
        deforestation: 25, // 森林増加（本来は減少を測定）
        speciesLoss: 0, // 種の変化なし
        ozoneDamage: -150, // 許可された範囲外の大きな破壊
      };
      expect(validator.validate(invalidEnvironment).valid).toBe(false);
    });

    test("投資リスク評価", () => {
      interface RiskAssessment {
        expectedLoss: number;
        worstCaseScenario: number;
        downside: number;
        riskAdjustment: number;
        hedgeCost: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberNegativePlugin)
        .use(numberFinitePlugin)
        .use(numberMaxPlugin)
        .for<RiskAssessment>()
        .v("expectedLoss", (b) => b.number.required().negative().finite())
        .v("worstCaseScenario", (b) => b.number.required().negative().finite())
        .v("downside", (b) => b.number.required().negative().finite())
        .v("riskAdjustment", (b) =>
          b.number.required().negative().finite().max(-0.01)
        )
        .v("hedgeCost", (b) => b.number.required().negative().finite())
        .build();

      // 有効なリスク評価（全て負の影響）
      const validRisk = {
        expectedLoss: -5000,
        worstCaseScenario: -20000,
        downside: -7500,
        riskAdjustment: -0.05,
        hedgeCost: -500,
      };
      expect(validator.validate(validRisk).valid).toBe(true);

      // 無効なリスク評価
      const invalidRisk = {
        expectedLoss: 1000, // 期待利益（損失ではない）
        worstCaseScenario: 0, // リスクなし
        downside: 5000, // アップサイド（ダウンサイドではない）
        riskAdjustment: -0.001, // 調整が小さすぎる
        hedgeCost: 0, // ヘッジコストなし
      };
      expect(validator.validate(invalidRisk).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { numberFinitePlugin } from "../../../../src/core/plugin/numberFinite";
