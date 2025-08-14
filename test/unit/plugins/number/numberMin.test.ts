import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("numberMin Plugin", () => {
  describe("基本動作", () => {
    test("最小値以上の数値を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ age: number }>()
        .v("age", (b) => b.number.required().min(18))
        .build();

      const result = validator.validate({ age: 20 });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("最小値未満の数値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ age: number }>()
        .v("age", (b) => b.number.required().min(18))
        .build();

      const result = validator.validate({ age: 17 });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "age",
        code: "numberMin",
      });
    });

    test("境界値での動作確認", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(10))
        .build();

      // ちょうど10
      expect(validator.validate({ value: 10 }).valid).toBe(true);
      // 9（境界値-1）
      expect(validator.validate({ value: 9 }).valid).toBe(false);
      // 11（境界値+1）
      expect(validator.validate({ value: 11 }).valid).toBe(true);
    });
  });

  describe("様々な数値型での動作", () => {
    test("整数での動作", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(100))
        .build();

      expect(validator.validate({ value: 100 }).valid).toBe(true);
      expect(validator.validate({ value: 99 }).valid).toBe(false);
      expect(validator.validate({ value: 1000 }).valid).toBe(true);
    });

    test("小数での動作", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(0.5))
        .build();

      expect(validator.validate({ value: 0.5 }).valid).toBe(true);
      expect(validator.validate({ value: 0.49 }).valid).toBe(false);
      expect(validator.validate({ value: 0.51 }).valid).toBe(true);
      expect(validator.validate({ value: 1.0 }).valid).toBe(true);
    });

    test("負の数での動作", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(-10))
        .build();

      expect(validator.validate({ value: -5 }).valid).toBe(true);
      expect(validator.validate({ value: -10 }).valid).toBe(true);
      expect(validator.validate({ value: -11 }).valid).toBe(false);
      expect(validator.validate({ value: 0 }).valid).toBe(true);
    });

    test("0での境界値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(0))
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: -0.1 }).valid).toBe(false);
      expect(validator.validate({ value: 0.1 }).valid).toBe(true);
    });
  });

  describe("特殊な数値", () => {
    test("非常に大きな数値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(Number.MAX_SAFE_INTEGER - 1))
        .build();

      expect(validator.validate({ value: Number.MAX_SAFE_INTEGER }).valid).toBe(
        true
      );
      expect(
        validator.validate({ value: Number.MAX_SAFE_INTEGER - 2 }).valid
      ).toBe(false);
    });

    test("非常に小さな数値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(-Number.MAX_SAFE_INTEGER))
        .build();

      expect(
        validator.validate({ value: -Number.MAX_SAFE_INTEGER + 1 }).valid
      ).toBe(true);
      expect(
        validator.validate({ value: -Number.MAX_SAFE_INTEGER }).valid
      ).toBe(true);
    });

    test("浮動小数点の精度", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(0.1 + 0.2)) // 0.30000000000000004
        .build();

      expect(validator.validate({ value: 0.3 }).valid).toBe(false); // 0.3 < 0.30000000000000004
      expect(validator.validate({ value: 0.31 }).valid).toBe(true);
    });
  });

  describe("エッジケース", () => {
    test("Infinityの処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(100))
        .build();

      expect(validator.validate({ value: Infinity }).valid).toBe(true);
      expect(validator.validate({ value: -Infinity }).valid).toBe(false);
    });

    test("NaNの処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(0))
        .build();

      // NaNは比較が常にfalseになるため、バリデーションは失敗する
      const result = validator.validate({ value: NaN });
      expect(result.isValid()).toBe(false);
    });

    test("文字列として渡された数値", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: any }>()
        .v("value", (b) => b.number.required().min(10))
        .build();

      // 文字列は数値として扱われない
      expect(validator.validate({ value: "15" as any }).valid).toBe(false);
      expect(validator.validate({ value: "5" as any }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberMinPlugin)
        .for<{ age?: number }>()
        .v("age", (b) => b.number.optional().min(18))
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(true);
    });

    test("値が存在する場合は通常通りバリデーション", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberMinPlugin)
        .for<{ age?: number }>()
        .v("age", (b) => b.number.optional().min(18))
        .build();

      expect(validator.validate({ age: 20 }).valid).toBe(true);
      expect(validator.validate({ age: 17 }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ age: number }>()
        .v("age", (b) =>
          b.number.required().min(18, {
            messageFactory: () => "年齢は18歳以上である必要があります",
          })
        )
        .build();

      const result = validator.validate({ age: 17 });
      expect(result.errors[0].message).toBe(
        "年齢は18歳以上である必要があります"
      );
    });

    test("動的なエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ score: number }>()
        .v("score", (b) =>
          b.number.required().min(60, {
            messageFactory: (ctx) => `スコアが${60 - ctx.value}点不足しています`,
          })
        )
        .build();

      const result = validator.validate({ score: 45 });
      expect(result.errors[0].message).toBe("スコアが15点不足しています");
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("最大値との組み合わせ（範囲指定）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ percentage: number }>()
        .v("percentage", (b) => b.number.required().min(0).max(100))
        .build();

      expect(validator.validate({ percentage: 50 }).valid).toBe(true);
      expect(validator.validate({ percentage: -1 }).valid).toBe(false);
      expect(validator.validate({ percentage: 101 }).valid).toBe(false);
    });

    test("整数制約との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberIntegerPlugin)
        .for<{ count: number }>()
        .v("count", (b) => b.number.required().integer().min(1))
        .build();

      expect(validator.validate({ count: 5 }).valid).toBe(true);
      expect(validator.validate({ count: 1.5 }).valid).toBe(false); // 整数でない
      expect(validator.validate({ count: 0 }).valid).toBe(false); // 最小値未満
    });
  });

  describe("パフォーマンステスト", () => {
    test("大量のバリデーションでも高速に動作する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(100))
        .build();

      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        validator.validate({ value: i });
      }

      const end = performance.now();
      const timePerValidation = (end - start) / 10000;

      // 1回のバリデーションが0.1ms未満であることを確認
      expect(timePerValidation).toBeLessThan(0.1);
    });
  });
});

// 必要なimportを追加
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
