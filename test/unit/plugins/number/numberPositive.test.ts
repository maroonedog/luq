import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { numberPositivePlugin } from "../../../../src/core/plugin/numberPositive";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("numberPositive Plugin", () => {
  describe("基本動作", () => {
    test("正の数を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ amount: number }>()
        .v("amount", (b) => b.number.required().positive())
        .build();

      expect(validator.validate({ amount: 1 }).valid).toBe(true);
      expect(validator.validate({ amount: 0.1 }).valid).toBe(true);
      expect(validator.validate({ amount: 0.0001 }).valid).toBe(true);
      expect(validator.validate({ amount: 100 }).valid).toBe(true);
      expect(validator.validate({ amount: 999999 }).valid).toBe(true);
      expect(validator.validate({ amount: Number.MAX_VALUE }).valid).toBe(true);
    });

    test("ゼロを拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ amount: number }>()
        .v("amount", (b) => b.number.required().positive())
        .build();

      const result = validator.validate({ amount: 0 });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "amount",
        code: "numberPositive",
      });
    });

    test("負の数を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ amount: number }>()
        .v("amount", (b) => b.number.required().positive())
        .build();

      const negativeValues = [-1, -0.1, -100, -999999, Number.MIN_SAFE_INTEGER];

      negativeValues.forEach((value) => {
        const result = validator.validate({ amount: value });
        expect(result.isValid()).toBe(false);
        expect(result.errors[0]).toMatchObject({
          path: "amount",
          code: "numberPositive",
        });
      });
    });

    test("-0を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ amount: number }>()
        .v("amount", (b) => b.number.required().positive())
        .build();

      const result = validator.validate({ amount: -0 });
      expect(result.isValid()).toBe(false);
    });
  });

  describe("特殊な数値での動作", () => {
    test("Infinityの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().positive())
        .build();

      // 正の無限大は正の数として扱われる
      expect(validator.validate({ value: Infinity }).valid).toBe(true);

      // 負の無限大は拒否される
      expect(validator.validate({ value: -Infinity }).valid).toBe(false);
    });

    test("NaNの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().positive())
        .build();

      const result = validator.validate({ value: NaN });
      expect(result.isValid()).toBe(false);
    });

    test("非常に小さい正の数", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().positive())
        .build();

      expect(validator.validate({ value: Number.MIN_VALUE }).valid).toBe(true);
      expect(validator.validate({ value: 1e-10 }).valid).toBe(true);
      expect(validator.validate({ value: 1e-100 }).valid).toBe(true);
      expect(validator.validate({ value: 1e-323 }).valid).toBe(true); // 極小値
    });
  });

  describe("境界値での動作", () => {
    test("ゼロ周辺の値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().positive())
        .build();

      // ゼロより大きい最小の値
      expect(validator.validate({ value: Number.EPSILON }).valid).toBe(true);

      // ゼロ近似値
      expect(validator.validate({ value: 1e-16 }).valid).toBe(true);

      // 実質的にゼロに近い値でも正なら有効
      expect(validator.validate({ value: 1e-50 }).valid).toBe(true);
    });

    test("浮動小数点の精度問題", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().positive())
        .build();

      // 計算結果が正の値になる場合
      expect(validator.validate({ value: 0.1 + 0.2 }).valid).toBe(true); // 0.30000000000000004
      expect(validator.validate({ value: 1 - 0.9 }).valid).toBe(true); // 0.09999999999999998
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("範囲制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ price: number }>()
        .v("price", (b) => b.number.required().positive().min(1).max(10000))
        .build();

      // 有効: 正の数かつ範囲内
      expect(validator.validate({ price: 100 }).valid).toBe(true);
      expect(validator.validate({ price: 1 }).valid).toBe(true);
      expect(validator.validate({ price: 10000 }).valid).toBe(true);

      // 無効: 正の数だが範囲外
      expect(validator.validate({ price: 0.5 }).valid).toBe(false); // min未満
      expect(validator.validate({ price: 20000 }).valid).toBe(false); // max超過

      // 無効: 負の数
      expect(validator.validate({ price: -100 }).valid).toBe(false);

      // 無効: ゼロ
      expect(validator.validate({ price: 0 }).valid).toBe(false);
    });

    test("整数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .use(numberIntegerPlugin)
        .for<{ count: number }>()
        .v("count", (b) => b.number.required().positive().integer())
        .build();

      // 有効: 正の整数
      expect(validator.validate({ count: 1 }).valid).toBe(true);
      expect(validator.validate({ count: 100 }).valid).toBe(true);

      // 無効: 正の小数
      expect(validator.validate({ count: 1.5 }).valid).toBe(false);

      // 無効: ゼロ
      expect(validator.validate({ count: 0 }).valid).toBe(false);

      // 無効: 負の整数
      expect(validator.validate({ count: -1 }).valid).toBe(false);
    });

    test("有限数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .use(numberFinitePlugin)
        .for<{ measurement: number }>()
        .v("measurement", (b) => b.number.required().positive().finite())
        .build();

      // 有効: 正の有限数
      expect(validator.validate({ measurement: 42.5 }).valid).toBe(true);
      expect(validator.validate({ measurement: 0.001 }).valid).toBe(true);

      // 無効: 正の無限大（正だが有限ではない）
      expect(validator.validate({ measurement: Infinity }).valid).toBe(false);

      // 無効: ゼロ
      expect(validator.validate({ measurement: 0 }).valid).toBe(false);

      // 無効: 負の数
      expect(validator.validate({ measurement: -5 }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberPositivePlugin)
        .for<{ amount?: number }>()
        .v("amount", (b) => b.number.optional().positive())
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ amount: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は正数検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberPositivePlugin)
        .for<{ amount?: number }>()
        .v("amount", (b) => b.number.optional().positive())
        .build();

      expect(validator.validate({ amount: 100 }).valid).toBe(true);
      expect(validator.validate({ amount: 0 }).valid).toBe(false);
      expect(validator.validate({ amount: -50 }).valid).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("金融データの検証", () => {
      interface FinancialData {
        amount: number;
        interestRate: number;
        fees: number;
        exchangeRate: number;
        balance: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .use(numberFinitePlugin)
        .for<FinancialData>()
        .v("amount", (b) => b.number.required().positive().finite())
        .v("interestRate", (b) => b.number.required().positive().finite())
        .v("fees", (b) => b.number.required().positive().finite())
        .v("exchangeRate", (b) => b.number.required().positive().finite())
        .v("balance", (b) => b.number.required().positive().finite())
        .build();

      // 有効な金融データ
      const validData = {
        amount: 1000.5,
        interestRate: 0.035,
        fees: 25.0,
        exchangeRate: 1.25,
        balance: 5000.0,
      };
      expect(validator.validate(validData).valid).toBe(true);

      // 無効な金融データ
      const invalidData = {
        amount: 0, // ゼロ金額
        interestRate: -0.01, // 負の金利
        fees: -5, // 負の手数料
        exchangeRate: 0, // ゼロ為替レート
        balance: -100, // 負の残高
      };
      expect(validator.validate(invalidData).valid).toBe(false);
    });

    test("物理測定値の検証", () => {
      interface PhysicalMeasurement {
        length: number; // メートル
        mass: number; // キログラム
        time: number; // 秒
        temperature: number; // ケルビン（絶対温度）
        pressure: number; // パスカル
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .use(numberFinitePlugin)
        .use(numberMinPlugin)
        .for<PhysicalMeasurement>()
        .v("length", (b) => b.number.required().positive().finite())
        .v("mass", (b) => b.number.required().positive().finite())
        .v("time", (b) => b.number.required().positive().finite())
        .v("temperature", (b) => b.number.required().positive().finite().min(0)) // 絶対零度以上
        .v("pressure", (b) => b.number.required().positive().finite())
        .build();

      // 有効な物理測定値
      const validMeasurement = {
        length: 2.5,
        mass: 1.2,
        time: 3.7,
        temperature: 293.15, // 20°C
        pressure: 101325, // 標準大気圧
      };
      expect(validator.validate(validMeasurement).valid).toBe(true);

      // 無効な物理測定値
      const invalidMeasurement = {
        length: 0, // ゼロ長
        mass: -1, // 負の質量
        time: -5, // 負の時間
        temperature: -10, // 絶対零度未満
        pressure: 0, // ゼロ圧力
      };
      expect(validator.validate(invalidMeasurement).valid).toBe(false);
    });

    test("商品在庫システム", () => {
      interface ProductInventory {
        quantity: number;
        price: number;
        weight: number;
        volume: number;
        discount: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .use(numberIntegerPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<ProductInventory>()
        .v("quantity", (b) => b.number.required().positive().integer())
        .v("price", (b) => b.number.required().positive().min(0.01))
        .v("weight", (b) => b.number.required().positive())
        .v("volume", (b) => b.number.required().positive())
        .v("discount", (b) => b.number.required().positive().max(1)) // 0-1の範囲（割合）
        .build();

      // 有効な在庫データ
      const validInventory = {
        quantity: 150,
        price: 29.99,
        weight: 0.5,
        volume: 0.002,
        discount: 0.15,
      };
      expect(validator.validate(validInventory).valid).toBe(true);

      // 無効な在庫データ
      const invalidInventory = {
        quantity: 0, // 在庫なし
        price: 0, // 無料商品（0円）
        weight: -0.1, // 負の重量
        volume: 0, // ゼロ体積
        discount: 1.5, // 150%割引（不可能）
      };
      expect(validator.validate(invalidInventory).valid).toBe(false);
    });

    test("パフォーマンス指標", () => {
      interface PerformanceMetrics {
        responseTime: number; // ミリ秒
        throughput: number; // リクエスト/秒
        cpuUsage: number; // 0-1の範囲
        memoryUsage: number; // バイト
        errorRate: number; // 0-1の範囲
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .use(numberFinitePlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<PerformanceMetrics>()
        .v("responseTime", (b) => b.number.required().positive().finite())
        .v("throughput", (b) => b.number.required().positive().finite())
        .v("cpuUsage", (b) => b.number.required().positive().finite().max(1))
        .v("memoryUsage", (b) => b.number.required().positive().finite())
        .v("errorRate", (b) => b.number.required().positive().finite().max(1))
        .build();

      // 有効なパフォーマンス指標
      const validMetrics = {
        responseTime: 150.5,
        throughput: 1000,
        cpuUsage: 0.65,
        memoryUsage: 2048000000, // 2GB
        errorRate: 0.001,
      };
      expect(validator.validate(validMetrics).valid).toBe(true);

      // 無効なパフォーマンス指標
      const invalidMetrics = {
        responseTime: 0, // ゼロ応答時間
        throughput: -100, // 負のスループット
        cpuUsage: 1.5, // 150% CPU使用率
        memoryUsage: 0, // ゼロメモリ使用
        errorRate: -0.1, // 負のエラー率
      };
      expect(validator.validate(invalidMetrics).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { numberFinitePlugin } from "../../../../src/core/plugin/numberFinite";
