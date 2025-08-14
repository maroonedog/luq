import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("numberMax Plugin", () => {
  describe("基本動作", () => {
    test("最大値以下の数値を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ score: number }>()
        .v("score", (b) => b.number.required().max(100))
        .build();

      expect(validator.validate({ score: 0 }).valid).toBe(true);
      expect(validator.validate({ score: 50 }).valid).toBe(true);
      expect(validator.validate({ score: 100 }).valid).toBe(true);
      expect(validator.validate({ score: -100 }).valid).toBe(true);
    });

    test("最大値を超える数値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ score: number }>()
        .v("score", (b) => b.number.required().max(100))
        .build();

      const result = validator.validate({ score: 101 });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "score",
        code: "numberMax",
        context: { max: 100 },
      });
    });
  });

  describe("様々な数値での検証", () => {
    test("小数での最大値検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ temperature: number }>()
        .v("temperature", (b) => b.number.required().max(37.5))
        .build();

      expect(validator.validate({ temperature: 36.5 }).valid).toBe(true);
      expect(validator.validate({ temperature: 37.5 }).valid).toBe(true);
      expect(validator.validate({ temperature: 37.6 }).valid).toBe(false);
      expect(validator.validate({ temperature: 38.0 }).valid).toBe(false);
    });

    test("負の数での最大値検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ depth: number }>()
        .v("depth", (b) => b.number.required().max(-10))
        .build();

      expect(validator.validate({ depth: -100 }).valid).toBe(true);
      expect(validator.validate({ depth: -50 }).valid).toBe(true);
      expect(validator.validate({ depth: -10 }).valid).toBe(true);
      expect(validator.validate({ depth: -9 }).valid).toBe(false);
      expect(validator.validate({ depth: 0 }).valid).toBe(false);
    });

    test("ゼロでの最大値検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ loss: number }>()
        .v("loss", (b) => b.number.required().max(0))
        .build();

      expect(validator.validate({ loss: -100 }).valid).toBe(true);
      expect(validator.validate({ loss: -1 }).valid).toBe(true);
      expect(validator.validate({ loss: 0 }).valid).toBe(true);
      expect(validator.validate({ loss: 1 }).valid).toBe(false);
      expect(validator.validate({ loss: 100 }).valid).toBe(false);
    });

    test("大きな数値での最大値検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ population: number }>()
        .v("population", (b) => b.number.required().max(1000000000))
        .build();

      expect(validator.validate({ population: 999999999 }).valid).toBe(true);
      expect(validator.validate({ population: 1000000000 }).valid).toBe(true);
      expect(validator.validate({ population: 1000000001 }).valid).toBe(false);
    });
  });

  describe("エッジケース", () => {
    test("Infinityの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().max(1000))
        .build();

      expect(validator.validate({ value: Infinity }).valid).toBe(false);
      expect(validator.validate({ value: -Infinity }).valid).toBe(true);
    });

    test("NaNの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().max(100))
        .build();

      const result = validator.validate({ value: NaN });
      // NaN比較は常にfalseなので、バリデーションがどう扱うかに依存
      expect(result.isValid()).toBe(false);
    });

    test("浮動小数点の精度", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ price: number }>()
        .v("price", (b) => b.number.required().max(0.3))
        .build();

      expect(validator.validate({ price: 0.1 + 0.2 }).valid).toBe(true); // 0.30000000000000004
      expect(validator.validate({ price: 0.31 }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("最小値と最大値の組み合わせ（範囲）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ percentage: number }>()
        .v("percentage", (b) => b.number.required().min(0).max(100))
        .build();

      // 有効: 0-100の範囲内
      expect(validator.validate({ percentage: 0 }).valid).toBe(true);
      expect(validator.validate({ percentage: 50 }).valid).toBe(true);
      expect(validator.validate({ percentage: 100 }).valid).toBe(true);

      // 無効: 範囲外
      expect(validator.validate({ percentage: -1 }).valid).toBe(false);
      expect(validator.validate({ percentage: 101 }).valid).toBe(false);
    });

    test("整数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .use(numberIntegerPlugin)
        .for<{ level: number }>()
        .v("level", (b) => b.number.required().integer().max(10))
        .build();

      // 有効: 整数かつ最大値以下
      expect(validator.validate({ level: 5 }).valid).toBe(true);
      expect(validator.validate({ level: 10 }).valid).toBe(true);

      // 無効: 小数
      expect(validator.validate({ level: 5.5 }).valid).toBe(false);

      // 無効: 最大値超過
      expect(validator.validate({ level: 11 }).valid).toBe(false);
    });

    test("正の数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .use(numberPositivePlugin)
        .for<{ price: number }>()
        .v("price", (b) => b.number.required().positive().max(1000))
        .build();

      // 有効: 正の数かつ最大値以下
      expect(validator.validate({ price: 1 }).valid).toBe(true);
      expect(validator.validate({ price: 999.99 }).valid).toBe(true);

      // 無効: 負の数
      expect(validator.validate({ price: -100 }).valid).toBe(false);

      // 無効: ゼロ
      expect(validator.validate({ price: 0 }).valid).toBe(false);

      // 無効: 最大値超過
      expect(validator.validate({ price: 1001 }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberMaxPlugin)
        .for<{ limit?: number }>()
        .v("limit", (b) => b.number.optional().max(100))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ limit: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は最大値検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberMaxPlugin)
        .for<{ limit?: number }>()
        .v("limit", (b) => b.number.optional().max(100))
        .build();

      expect(validator.validate({ limit: 50 }).valid).toBe(true);
      expect(validator.validate({ limit: 150 }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ age: number }>()
        .v("age", (b) =>
          b.number.required().max(120, {
            messageFactory: () => "年齢は120歳以下で入力してください",
          })
        )
        .build();

      const result = validator.validate({ age: 150 });
      expect(result.errors[0].message).toBe(
        "年齢は120歳以下で入力してください"
      );
    });

    test("動的なエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMaxPlugin)
        .for<{ score: number }>()
        .v("score", (b) =>
          b.number.required().max(100, {
            messageFactory: (ctx) =>
              `スコア ${ctx.value} は最大値 100 を超えています`,
          })
        )
        .build();

      const result = validator.validate({ score: 150 });
      expect(result.errors[0].message).toBe(
        "スコア 150 は最大値 100 を超えています"
      );
    });
  });

  describe("実用的なシナリオ", () => {
    test("在庫管理システムの数量制限", () => {
      interface Inventory {
        itemCount: number;
        minOrderQuantity: number;
        maxOrderQuantity: number;
        warningThreshold: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(numberIntegerPlugin)
        .for<Inventory>()
        .v("itemCount", (b) => b.number.required().integer().min(0).max(99999))
        .v("minOrderQuantity", (b) =>
          b.number.required().integer().min(1).max(1000)
        )
        .v("maxOrderQuantity", (b) =>
          b.number.required().integer().min(1).max(10000)
        )
        .v("warningThreshold", (b) =>
          b.number.required().integer().min(0).max(1000)
        )
        .build();

      // 有効な在庫データ
      const validInventory = {
        itemCount: 150,
        minOrderQuantity: 10,
        maxOrderQuantity: 500,
        warningThreshold: 50,
      };
      expect(validator.validate(validInventory).valid).toBe(true);

      // 無効な在庫データ
      const invalidInventory = {
        itemCount: 100000, // 最大値超過
        minOrderQuantity: 0, // 最小値未満
        maxOrderQuantity: 20000, // 最大値超過
        warningThreshold: -10, // 負の値
      };
      const result = validator.validate(invalidInventory);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBe(4);
    });

    test("評価システムのスコア制限", () => {
      interface Rating {
        overall: number;
        quality: number;
        service: number;
        value: number;
        recommendation: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<Rating>()
        .v("overall", (b) => b.number.required().min(0).max(5))
        .v("quality", (b) => b.number.required().min(0).max(5))
        .v("service", (b) => b.number.required().min(0).max(5))
        .v("value", (b) => b.number.required().min(0).max(5))
        .v("recommendation", (b) => b.number.required().min(0).max(10))
        .build();

      // 有効な評価
      const validRating = {
        overall: 4.5,
        quality: 5,
        service: 4,
        value: 3.5,
        recommendation: 8,
      };
      expect(validator.validate(validRating).valid).toBe(true);

      // 無効な評価
      const invalidRating = {
        overall: 6, // 5を超える
        quality: -1, // 負の値
        service: 5.5, // 5を超える
        value: 5, // OK
        recommendation: 15, // 10を超える
      };
      expect(validator.validate(invalidRating).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { numberPositivePlugin } from "../../../../src/core/plugin/numberPositive";
