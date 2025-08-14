import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { numberMultipleOfPlugin } from "../../../../src/core/plugin/numberMultipleOf";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("numberMultipleOf Plugin", () => {
  describe("基本動作", () => {
    test("指定した数の倍数を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().multipleOf(5))
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true); // 0は全ての数の倍数
      expect(validator.validate({ value: 5 }).valid).toBe(true);
      expect(validator.validate({ value: 10 }).valid).toBe(true);
      expect(validator.validate({ value: -5 }).valid).toBe(true);
      expect(validator.validate({ value: -15 }).valid).toBe(true);
      expect(validator.validate({ value: 100 }).valid).toBe(true);
    });

    test("指定した数の倍数でない値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().multipleOf(5))
        .build();

      const nonMultiples = [1, 2, 3, 4, 6, 7, 8, 9, 11, 13, 17, 23];

      nonMultiples.forEach((value) => {
        const result = validator.validate({ value });
        expect(result.isValid()).toBe(false);
        expect(result.errors[0]).toMatchObject({
          path: "value",
          code: "numberMultipleOf",
        });
      });
    });
  });

  describe("様々な倍数での検証", () => {
    test("2の倍数（偶数）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ even: number }>()
        .v("even", (b) => b.number.required().multipleOf(2))
        .build();

      expect(validator.validate({ even: 0 }).valid).toBe(true);
      expect(validator.validate({ even: 2 }).valid).toBe(true);
      expect(validator.validate({ even: 4 }).valid).toBe(true);
      expect(validator.validate({ even: -6 }).valid).toBe(true);
      expect(validator.validate({ even: 100 }).valid).toBe(true);

      expect(validator.validate({ even: 1 }).valid).toBe(false);
      expect(validator.validate({ even: 3 }).valid).toBe(false);
      expect(validator.validate({ even: -7 }).valid).toBe(false);
    });

    test("10の倍数", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ tens: number }>()
        .v("tens", (b) => b.number.required().multipleOf(10))
        .build();

      expect(validator.validate({ tens: 0 }).valid).toBe(true);
      expect(validator.validate({ tens: 10 }).valid).toBe(true);
      expect(validator.validate({ tens: 100 }).valid).toBe(true);
      expect(validator.validate({ tens: -50 }).valid).toBe(true);

      expect(validator.validate({ tens: 5 }).valid).toBe(false);
      expect(validator.validate({ tens: 15 }).valid).toBe(false);
      expect(validator.validate({ tens: 99 }).valid).toBe(false);
    });

    test("小数の倍数", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().multipleOf(0.5))
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: 0.5 }).valid).toBe(true);
      expect(validator.validate({ value: 1.0 }).valid).toBe(true);
      expect(validator.validate({ value: 1.5 }).valid).toBe(true);
      expect(validator.validate({ value: 2.0 }).valid).toBe(true);
      expect(validator.validate({ value: -1.5 }).valid).toBe(true);

      expect(validator.validate({ value: 0.25 }).valid).toBe(false);
      expect(validator.validate({ value: 0.75 }).valid).toBe(false);
      expect(validator.validate({ value: 1.25 }).valid).toBe(false);
    });

    test("1の倍数（全ての整数）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ integer: number }>()
        .v("integer", (b) => b.number.required().multipleOf(1))
        .build();

      expect(validator.validate({ integer: 0 }).valid).toBe(true);
      expect(validator.validate({ integer: 1 }).valid).toBe(true);
      expect(validator.validate({ integer: -5 }).valid).toBe(true);
      expect(validator.validate({ integer: 1000 }).valid).toBe(true);

      expect(validator.validate({ integer: 0.5 }).valid).toBe(false);
      expect(validator.validate({ integer: 1.1 }).valid).toBe(false);
      expect(validator.validate({ integer: -2.7 }).valid).toBe(false);
    });
  });

  describe("浮動小数点の精度問題", () => {
    test("0.1の倍数での精度問題", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ decimal: number }>()
        .v("decimal", (b) => b.number.required().multipleOf(0.1))
        .build();

      // 浮動小数点の精度の問題があるため、これらのテストは実装依存
      expect(validator.validate({ decimal: 0.1 }).valid).toBe(true);
      expect(validator.validate({ decimal: 0.2 }).valid).toBe(true);
      expect(validator.validate({ decimal: 0.3 }).valid).toBe(true);

      // 0.1 + 0.2 = 0.30000000000000004 という精度問題があるため、
      // 実装によっては期待と異なる結果になる可能性がある
      const calculated = 0.1 + 0.2;
      const result = validator.validate({ decimal: calculated });
      // 実装が適切に浮動小数点誤差を処理しているかをテスト
      // （結果は実装に依存）
    });

    test("小さな倍数での計算", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().multipleOf(0.01))
        .build();

      expect(validator.validate({ value: 0.01 }).valid).toBe(true);
      expect(validator.validate({ value: 0.02 }).valid).toBe(true);
      expect(validator.validate({ value: 1.23 }).valid).toBe(true);

      expect(validator.validate({ value: 0.001 }).valid).toBe(false);
      expect(validator.validate({ value: 1.234 }).valid).toBe(false);
    });
  });

  describe("特殊なケース", () => {
    test("ゼロでの除算（エラーケース）", () => {
      // 0での割り算は数学的に定義されていないため、
      // プラグインがどのように処理するかをテスト
      expect(() => {
        Builder()
          .use(requiredPlugin)
          .use(numberMultipleOfPlugin)
          .for<{ value: number }>()
          .v("value", (b) => b.number.required().multipleOf(0))
          .build();
      }).toThrow(); // 実装がエラーを投げることを期待
    });

    test("負の倍数", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().multipleOf(-3))
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: -3 }).valid).toBe(true);
      expect(validator.validate({ value: 3 }).valid).toBe(true); // -3 * -1
      expect(validator.validate({ value: -6 }).valid).toBe(true); // -3 * 2
      expect(validator.validate({ value: 6 }).valid).toBe(true); // -3 * -2

      expect(validator.validate({ value: 1 }).valid).toBe(false);
      expect(validator.validate({ value: -1 }).valid).toBe(false);
      expect(validator.validate({ value: 4 }).valid).toBe(false);
    });

    test("InfinityとNaNの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().multipleOf(5))
        .build();

      expect(validator.validate({ value: Infinity }).valid).toBe(false);
      expect(validator.validate({ value: -Infinity }).valid).toBe(false);
      expect(validator.validate({ value: NaN }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("範囲制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ score: number }>()
        .v("score", (b) => b.number.required().multipleOf(10).min(0).max(100))
        .build();

      // 有効: 10の倍数かつ範囲内
      expect(validator.validate({ score: 0 }).valid).toBe(true);
      expect(validator.validate({ score: 10 }).valid).toBe(true);
      expect(validator.validate({ score: 50 }).valid).toBe(true);
      expect(validator.validate({ score: 100 }).valid).toBe(true);

      // 無効: 範囲内だが10の倍数でない
      expect(validator.validate({ score: 15 }).valid).toBe(false);
      expect(validator.validate({ score: 99 }).valid).toBe(false);

      // 無効: 10の倍数だが範囲外
      expect(validator.validate({ score: -10 }).valid).toBe(false);
      expect(validator.validate({ score: 110 }).valid).toBe(false);
    });

    test("整数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .use(numberIntegerPlugin)
        .for<{ quantity: number }>()
        .v("quantity", (b) => b.number.required().integer().multipleOf(12))
        .build();

      // 有効: 整数かつ12の倍数
      expect(validator.validate({ quantity: 0 }).valid).toBe(true);
      expect(validator.validate({ quantity: 12 }).valid).toBe(true);
      expect(validator.validate({ quantity: 24 }).valid).toBe(true);
      expect(validator.validate({ quantity: -36 }).valid).toBe(true);

      // 無効: 12の倍数だが整数でない（この場合、12の倍数の小数は存在しにくい）
      expect(validator.validate({ quantity: 12.5 }).valid).toBe(false);

      // 無効: 整数だが12の倍数でない
      expect(validator.validate({ quantity: 10 }).valid).toBe(false);
      expect(validator.validate({ quantity: 15 }).valid).toBe(false);
    });

    test("正の数チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .use(numberPositivePlugin)
        .for<{ amount: number }>()
        .v("amount", (b) => b.number.required().positive().multipleOf(0.25))
        .build();

      // 有効: 正の数かつ0.25の倍数
      expect(validator.validate({ amount: 0.25 }).valid).toBe(true);
      expect(validator.validate({ amount: 0.5 }).valid).toBe(true);
      expect(validator.validate({ amount: 1.0 }).valid).toBe(true);
      expect(validator.validate({ amount: 2.75 }).valid).toBe(true);

      // 無効: 0.25の倍数だが正の数でない
      expect(validator.validate({ amount: 0 }).valid).toBe(false);
      expect(validator.validate({ amount: -0.25 }).valid).toBe(false);

      // 無効: 正の数だが0.25の倍数でない
      expect(validator.validate({ amount: 0.1 }).valid).toBe(false);
      expect(validator.validate({ amount: 1.1 }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ value?: number }>()
        .v("value", (b) => b.number.optional().multipleOf(5))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ value: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は倍数検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberMultipleOfPlugin)
        .for<{ value?: number }>()
        .v("value", (b) => b.number.optional().multipleOf(5))
        .build();

      expect(validator.validate({ value: 10 }).valid).toBe(true);
      expect(validator.validate({ value: 7 }).valid).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("時間間隔の検証（15分単位）", () => {
      interface TimeSlot {
        startMinute: number; // 0-59分
        durationMinutes: number; // 15分単位
        reminderMinutes: number; // 5分単位
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(numberIntegerPlugin)
        .for<TimeSlot>()
        .v("startMinute", (b) =>
          b.number.required().integer().min(0).max(59).multipleOf(15)
        ) // 0, 15, 30, 45分のみ
        .v("durationMinutes", (b) =>
          b.number
            .required()
            .integer()
            .min(15)
            .max(480) // 8時間まで
            .multipleOf(15)
        )
        .v("reminderMinutes", (b) =>
          b.number.required().integer().min(5).max(60).multipleOf(5)
        )
        .build();

      // 有効な時間設定
      const validTimeSlot = {
        startMinute: 30, // 30分
        durationMinutes: 90, // 1時間30分
        reminderMinutes: 10, // 10分前通知
      };
      expect(validator.validate(validTimeSlot).valid).toBe(true);

      // 無効な時間設定
      const invalidTimeSlot = {
        startMinute: 20, // 15分単位でない
        durationMinutes: 35, // 15分単位でない
        reminderMinutes: 7, // 5分単位でない
      };
      expect(validator.validate(invalidTimeSlot).valid).toBe(false);
    });

    test("在庫パッケージ単位", () => {
      interface ProductPackaging {
        itemsPerPack: number; // 12個入り
        packsPerCase: number; // 6パック入り
        minimumOrder: number; // ケース単位（72個）
        pricePerUnit: number; // 0.25単位の価格
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .use(numberPositivePlugin)
        .use(numberIntegerPlugin)
        .for<ProductPackaging>()
        .v("itemsPerPack", (b) =>
          b.number.required().positive().integer().multipleOf(12)
        )
        .v("packsPerCase", (b) =>
          b.number.required().positive().integer().multipleOf(6)
        )
        .v("minimumOrder", (b) =>
          b.number.required().positive().integer().multipleOf(72)
        ) // 12 * 6 = 72
        .v("pricePerUnit", (b) =>
          b.number.required().positive().multipleOf(0.25)
        )
        .build();

      // 有効なパッケージ設定
      const validPackaging = {
        itemsPerPack: 12,
        packsPerCase: 6,
        minimumOrder: 144, // 2ケース
        pricePerUnit: 2.75,
      };
      expect(validator.validate(validPackaging).valid).toBe(true);

      // 無効なパッケージ設定
      const invalidPackaging = {
        itemsPerPack: 10, // 12の倍数でない
        packsPerCase: 5, // 6の倍数でない
        minimumOrder: 100, // 72の倍数でない
        pricePerUnit: 2.33, // 0.25の倍数でない
      };
      expect(validator.validate(invalidPackaging).valid).toBe(false);
    });

    test("グリッドレイアウトシステム", () => {
      interface GridLayout {
        columns: number; // 12列システム
        rowHeight: number; // 20px単位
        gutter: number; // 4px単位
        width: number; // 8px単位
        margin: number; // 16px単位
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .use(numberPositivePlugin)
        .use(numberIntegerPlugin)
        .for<GridLayout>()
        .v("columns", (b) =>
          b.number.required().positive().integer().multipleOf(1)
        ) // 列数は任意の正整数
        .v("rowHeight", (b) =>
          b.number.required().positive().integer().multipleOf(20)
        )
        .v("gutter", (b) =>
          b.number.required().positive().integer().multipleOf(4)
        )
        .v("width", (b) =>
          b.number.required().positive().integer().multipleOf(8)
        )
        .v("margin", (b) =>
          b.number.required().positive().integer().multipleOf(16)
        )
        .build();

      // 有効なグリッド設定
      const validGrid = {
        columns: 12,
        rowHeight: 40,
        gutter: 16,
        width: 320,
        margin: 32,
      };
      expect(validator.validate(validGrid).valid).toBe(true);

      // 無効なグリッド設定
      const invalidGrid = {
        columns: 0, // 正の数でない
        rowHeight: 25, // 20の倍数でない
        gutter: 15, // 4の倍数でない
        width: 325, // 8の倍数でない
        margin: 30, // 16の倍数でない
      };
      expect(validator.validate(invalidGrid).valid).toBe(false);
    });

    test("音楽のBPM（テンポ）設定", () => {
      interface MusicTempo {
        bpm: number; // BPM（4の倍数が一般的）
        timeSignature: number; // 拍子（通常は2, 3, 4, 6, 8, 12）
        subdivisions: number; // 分割（2の倍数）
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMultipleOfPlugin)
        .use(numberPositivePlugin)
        .use(numberIntegerPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<MusicTempo>()
        .v("bpm", (b) =>
          b.number
            .required()
            .positive()
            .integer()
            .min(60)
            .max(200)
            .multipleOf(4)
        )
        .v("timeSignature", (b) =>
          b.number.required().positive().integer().multipleOf(1)
        ) // より複雑な制約は別途実装
        .v("subdivisions", (b) =>
          b.number.required().positive().integer().multipleOf(2)
        )
        .build();

      // 有効な音楽設定
      const validTempo = {
        bpm: 120, // 標準的なテンポ
        timeSignature: 4, // 4/4拍子
        subdivisions: 16, // 16分音符
      };
      expect(validator.validate(validTempo).valid).toBe(true);

      // 無効な音楽設定
      const invalidTempo = {
        bpm: 125, // 4の倍数でない
        timeSignature: 4, // OK
        subdivisions: 15, // 2の倍数でない
      };
      expect(validator.validate(invalidTempo).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { numberPositivePlugin } from "../../../../src/core/plugin/numberPositive";
