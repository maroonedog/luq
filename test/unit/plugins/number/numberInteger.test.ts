import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("numberInteger Plugin", () => {
  describe("基本動作", () => {
    test("整数を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ count: number }>()
        .v("count", (b) => b.number.required().integer())
        .build();

      expect(validator.validate({ count: 0 }).valid).toBe(true);
      expect(validator.validate({ count: 1 }).valid).toBe(true);
      expect(validator.validate({ count: -1 }).valid).toBe(true);
      expect(validator.validate({ count: 100 }).valid).toBe(true);
      expect(validator.validate({ count: -100 }).valid).toBe(true);
      expect(validator.validate({ count: 999999999 }).valid).toBe(true);
    });

    test("小数を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ count: number }>()
        .v("count", (b) => b.number.required().integer())
        .build();

      const nonIntegers = [
        0.1, 0.5, 0.9, 1.1, 1.5, -0.1, -1.5, 3.14159, 99.99, 100.001,
      ];

      nonIntegers.forEach((value) => {
        const result = validator.validate({ count: value });
        expect(result.isValid()).toBe(false);
        expect(result.errors[0]).toMatchObject({
          path: "count",
          code: "numberInteger",
        });
      });
    });
  });

  describe("境界値での動作", () => {
    test("大きな整数値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ bigNumber: number }>()
        .v("bigNumber", (b) => b.number.required().integer())
        .build();

      // JavaScriptの安全な整数の最大値
      expect(
        validator.validate({ bigNumber: Number.MAX_SAFE_INTEGER }).valid
      ).toBe(true);
      expect(
        validator.validate({ bigNumber: Number.MIN_SAFE_INTEGER }).valid
      ).toBe(true);

      // 安全でない整数（精度が失われる可能性）
      expect(
        validator.validate({ bigNumber: Number.MAX_SAFE_INTEGER + 1 }).valid
      ).toBe(true);
    });

    test("ゼロ付近の値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().integer())
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: -0 }).valid).toBe(true);
      expect(validator.validate({ value: 0.0 }).valid).toBe(true);
      expect(validator.validate({ value: -0.0 }).valid).toBe(true);
    });

    test("極小の小数", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().integer())
        .build();

      expect(validator.validate({ value: 0.0000000001 }).valid).toBe(false);
      expect(validator.validate({ value: -0.0000000001 }).valid).toBe(false);
      expect(validator.validate({ value: 1e-10 }).valid).toBe(false);
    });
  });

  describe("特殊な数値での動作", () => {
    test("Infinityの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().integer())
        .build();

      expect(validator.validate({ value: Infinity }).valid).toBe(false);
      expect(validator.validate({ value: -Infinity }).valid).toBe(false);
    });

    test("NaNの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().integer())
        .build();

      expect(validator.validate({ value: NaN }).valid).toBe(false);
    });

    test("浮動小数点の丸め誤差", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().integer())
        .build();

      // 1.0は整数として扱われるべき
      expect(validator.validate({ value: 1.0 }).valid).toBe(true);
      expect(validator.validate({ value: 2.0 }).valid).toBe(true);
      expect(validator.validate({ value: 100.0 }).valid).toBe(true);

      // 計算結果が整数になる場合
      expect(validator.validate({ value: 3 * 1.0 }).valid).toBe(true);
      expect(validator.validate({ value: 10 / 5 }).valid).toBe(true);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("範囲制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ level: number }>()
        .v("level", (b) => b.number.required().integer().min(1).max(100))
        .build();

      // 有効: 整数かつ範囲内
      expect(validator.validate({ level: 1 }).valid).toBe(true);
      expect(validator.validate({ level: 50 }).valid).toBe(true);
      expect(validator.validate({ level: 100 }).valid).toBe(true);

      // 無効: 小数
      expect(validator.validate({ level: 50.5 }).valid).toBe(false);

      // 無効: 範囲外
      expect(validator.validate({ level: 0 }).valid).toBe(false);
      expect(validator.validate({ level: 101 }).valid).toBe(false);
    });

    test("正の整数の検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .use(numberPositivePlugin)
        .for<{ id: number }>()
        .v("id", (b) => b.number.required().integer().positive())
        .build();

      // 有効: 正の整数
      expect(validator.validate({ id: 1 }).valid).toBe(true);
      expect(validator.validate({ id: 100 }).valid).toBe(true);

      // 無効: ゼロまたは負
      expect(validator.validate({ id: 0 }).valid).toBe(false);
      expect(validator.validate({ id: -1 }).valid).toBe(false);

      // 無効: 正の小数
      expect(validator.validate({ id: 1.5 }).valid).toBe(false);
    });

    test("倍数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ quantity: number }>()
        .v("quantity", (b) => b.number.required().integer().multipleOf(5))
        .build();

      // 有効: 5の倍数の整数
      expect(validator.validate({ quantity: 0 }).valid).toBe(true);
      expect(validator.validate({ quantity: 5 }).valid).toBe(true);
      expect(validator.validate({ quantity: 10 }).valid).toBe(true);
      expect(validator.validate({ quantity: -15 }).valid).toBe(true);

      // 無効: 5の倍数でない
      expect(validator.validate({ quantity: 3 }).valid).toBe(false);

      // 無効: 5の倍数だが小数
      expect(validator.validate({ quantity: 7.5 }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberIntegerPlugin)
        .for<{ count?: number }>()
        .v("count", (b) => b.number.optional().integer())
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ count: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は整数検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberIntegerPlugin)
        .for<{ count?: number }>()
        .v("count", (b) => b.number.optional().integer())
        .build();

      expect(validator.validate({ count: 10 }).valid).toBe(true);
      expect(validator.validate({ count: 10.5 }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ quantity: number }>()
        .v("quantity", (b) =>
          b.number.required().integer({
            messageFactory: () => "数量は整数で入力してください",
          })
        )
        .build();

      const result = validator.validate({ quantity: 5.5 });
      expect(result.errors[0].message).toBe("数量は整数で入力してください");
    });

    test("動的なエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .for<{ count: number }>()
        .v("count", (b) =>
          b.number.required().integer({
            messageFactory: (value) => `${value} は整数ではありません`,
          })
        )
        .build();

      const result = validator.validate({ count: 3.14 });
      expect(result.errors[0].message).toBe("3.14 は整数ではありません");
    });
  });

  describe("実用的なシナリオ", () => {
    test("在庫管理システムの数量", () => {
      interface StockItem {
        quantity: number;
        reorderLevel: number;
        maxStock: number;
        minOrderQuantity: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .use(numberMinPlugin)
        .for<StockItem>()
        .v("quantity", (b) => b.number.required().integer().min(0))
        .v("reorderLevel", (b) => b.number.required().integer().min(0))
        .v("maxStock", (b) => b.number.required().integer().min(1))
        .v("minOrderQuantity", (b) => b.number.required().integer().min(1))
        .build();

      // 有効な在庫データ
      const validStock = {
        quantity: 150,
        reorderLevel: 50,
        maxStock: 500,
        minOrderQuantity: 10,
      };
      expect(validator.validate(validStock).valid).toBe(true);

      // 無効な在庫データ
      const invalidStock = {
        quantity: 150.5, // 小数
        reorderLevel: -10, // 負の値
        maxStock: 500.25, // 小数
        minOrderQuantity: 0, // 最小値未満
      };
      const result = validator.validate(invalidStock);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBe(4);
    });

    test("ページネーションパラメータ", () => {
      interface PaginationParams {
        page: number;
        pageSize: number;
        offset?: number;
        limit?: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(numberIntegerPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<PaginationParams>()
        .v("page", (b) => b.number.required().integer().min(1))
        .v("pageSize", (b) => b.number.required().integer().min(1).max(100))
        .v("offset", (b) => b.number.optional().integer().min(0))
        .v("limit", (b) => b.number.optional().integer().min(1).max(1000))
        .build();

      // 有効なページネーション
      const validPagination = {
        page: 1,
        pageSize: 20,
        offset: 0,
        limit: 100,
      };
      expect(validator.validate(validPagination).valid).toBe(true);

      // 無効なページネーション
      const invalidPagination = {
        page: 0, // 1未満
        pageSize: 150, // 最大値超過
        offset: -10, // 負の値
        limit: 0.5, // 小数
      };
      expect(validator.validate(invalidPagination).valid).toBe(false);
    });

    test("ゲームのスコアとレベル", () => {
      interface GameStats {
        score: number;
        level: number;
        lives: number;
        combo: number;
        highScore: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberIntegerPlugin)
        .use(numberMinPlugin)
        .for<GameStats>()
        .v("score", (b) => b.number.required().integer().min(0))
        .v("level", (b) => b.number.required().integer().min(1))
        .v("lives", (b) => b.number.required().integer().min(0))
        .v("combo", (b) => b.number.required().integer().min(0))
        .v("highScore", (b) => b.number.required().integer().min(0))
        .build();

      // 有効なゲームステータス
      const validStats = {
        score: 12500,
        level: 5,
        lives: 3,
        combo: 25,
        highScore: 50000,
      };
      expect(validator.validate(validStats).valid).toBe(true);

      // スコアに小数が含まれる場合
      const invalidStats = {
        score: 12500.5, // 小数点を含む
        level: 5,
        lives: 2.5, // 半分のライフ？
        combo: 25,
        highScore: 50000,
      };
      expect(validator.validate(invalidStats).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberPositivePlugin } from "../../../../src/core/plugin/numberPositive";
import { numberMultipleOfPlugin } from "../../../../src/core/plugin/numberMultipleOf";
