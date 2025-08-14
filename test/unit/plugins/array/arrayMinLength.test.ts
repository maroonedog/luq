import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("arrayMinLength Plugin", () => {
  describe("基本動作", () => {
    test("最小長以上の配列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) => b.array.required().minLength(2))
        .build();

      const result = validator.validate({ tags: ["tag1", "tag2", "tag3"] });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("最小長未満の配列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) => b.array.required().minLength(3))
        .build();

      const result = validator.validate({ tags: ["tag1", "tag2"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "tags",
        code: "arrayMinLength",
      });
    });

    test("境界値での動作確認", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: number[] }>()
        .v("items", (b) => b.array.required().minLength(3))
        .build();

      // ちょうど3要素
      expect(validator.validate({ items: [1, 2, 3] }).valid).toBe(true);
      // 2要素（境界値-1）
      expect(validator.validate({ items: [1, 2] }).valid).toBe(false);
      // 4要素（境界値+1）
      expect(validator.validate({ items: [1, 2, 3, 4] }).valid).toBe(true);
    });
  });

  describe("エラーハンドリング", () => {
    test("負の最小長でエラーを投げる", () => {
      expect(() => {
        Builder()
          .use(requiredPlugin)
          .use(arrayMinLengthPlugin)
          .for<{ items: string[] }>()
          .v("items", (b) => b.array.required().minLength(-1))
          .build();
      }).toThrow("Invalid minLength: -1");
    });

    test("非数値の最小長でエラーを投げる", () => {
      expect(() => {
        Builder()
          .use(requiredPlugin)
          .use(arrayMinLengthPlugin)
          .for<{ items: string[] }>()
          .v("items", (b) => b.array.required().minLength(NaN))
          .build();
      }).toThrow("Invalid minLength: NaN");
    });
  });

  describe("カスタムオプション", () => {
    test("カスタムエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().minLength(3, {
          messageFactory: ({ path, min, actual }) => 
            `${path}は最低${min}個必要（現在${actual}個）`
        }))
        .build();

      const result = validator.validate({ items: ["a", "b"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe("itemsは最低3個必要（現在2個）");
    });

    test("カスタムエラーコード", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().minLength(3, {
          code: "CUSTOM_MIN_LENGTH"
        }))
        .build();

      const result = validator.validate({ items: ["a", "b"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("CUSTOM_MIN_LENGTH");
    });
  });

  describe("非配列値の処理", () => {
    test("null値は検証をスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: string[] | null }>()
        .v("items", (b) => b.array.optional().minLength(2))
        .build();

      expect(validator.validate({ items: null }).valid).toBe(true);
    });

    test("undefined値は検証をスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items?: string[] }>()
        .v("items", (b) => b.array.optional().minLength(2))
        .build();

      expect(validator.validate({}).valid).toBe(true);
    });
  });

  describe("様々な配列型での動作", () => {
    test("文字列配列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ names: string[] }>()
        .v("names", (b) => b.array.required().minLength(1))
        .build();

      expect(validator.validate({ names: ["Alice", "Bob"] }).valid).toBe(true);
      expect(validator.validate({ names: [] }).valid).toBe(false);
    });

    test("数値配列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ scores: number[] }>()
        .v("scores", (b) => b.array.required().minLength(5))
        .build();

      expect(validator.validate({ scores: [10, 20, 30, 40, 50] }).valid).toBe(
        true
      );
      expect(validator.validate({ scores: [10, 20, 30, 40] }).valid).toBe(
        false
      );
    });

    test("オブジェクト配列", () => {
      interface Item {
        id: number;
        name: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: Item[] }>()
        .v("items", (b) => b.array.required().minLength(2))
        .build();

      const items: Item[] = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ];

      expect(validator.validate({ items }).valid).toBe(true);
      expect(validator.validate({ items: [items[0]] }).valid).toBe(false);
    });

    test("混合型配列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ mixed: any[] }>()
        .v("mixed", (b) => b.array.required().minLength(3))
        .build();

      const mixed = [1, "string", { key: "value" }, true, null];
      expect(validator.validate({ mixed }).valid).toBe(true);
      expect(validator.validate({ mixed: [1, "string"] }).valid).toBe(false);
    });
  });

  describe("特殊なケース", () => {
    test("空配列の処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().minLength(1))
        .build();

      const result = validator.validate({ items: [] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toContain("1");
    });

    test("最小長0の特殊ケース", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().minLength(0))
        .build();

      // 空配列も許可される
      expect(validator.validate({ items: [] }).valid).toBe(true);
      expect(validator.validate({ items: [1] }).valid).toBe(true);
    });

    test("スパース配列（穴あき配列）の処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().minLength(3))
        .build();

      const sparse = [1, , 3, , 5]; // length は 5
      expect(validator.validate({ items: sparse }).valid).toBe(true);
    });

    test("配列風オブジェクトの処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: any }>()
        .v("items", (b) => b.array.required().minLength(2))
        .build();

      // 配列風オブジェクト（length プロパティを持つ）
      const arrayLike = { 0: "a", 1: "b", length: 2 };
      const result = validator.validate({ items: arrayLike as any });
      expect(result.isValid()).toBe(false); // 真の配列でないため失敗
    });
  });

  describe("ネストした配列", () => {
    test("2次元配列の処理", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ matrix: number[][] }>()
        .v("matrix", (b) => b.array.required().minLength(2))
        .build();

      const matrix = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];
      expect(validator.validate({ matrix }).valid).toBe(true);
      expect(validator.validate({ matrix: [[1, 2]] }).valid).toBe(false);
    });

    test("深くネストした配列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ deep: any[][][][] }>()
        .v("deep", (b) => b.array.required().minLength(1))
        .build();

      const deep = [[[[1]]]];
      expect(validator.validate({ deep }).valid).toBe(true);
      expect(validator.validate({ deep: [] }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ tags?: string[] }>()
        .v("tags", (b) => b.array.optional().minLength(2))
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(true);
    });

    test("値が存在する場合は通常通りバリデーション", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ tags?: string[] }>()
        .v("tags", (b) => b.array.optional().minLength(2))
        .build();

      expect(validator.validate({ tags: ["tag1", "tag2"] }).valid).toBe(true);
      expect(validator.validate({ tags: ["tag1"] }).valid).toBe(false);
    });

    test("空配列は値として扱われる", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ tags?: string[] }>()
        .v("tags", (b) => b.array.optional().minLength(1))
        .build();

      // 空配列は存在する値として扱われ、minLengthチェックが実行される
      const result = validator.validate({ tags: [] });
      expect(result.isValid()).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) =>
          b.array.required().minLength(3, {
            messageFactory: () => "少なくとも3つのタグが必要です",
          })
        )
        .build();

      const result = validator.validate({ tags: ["tag1", "tag2"] });
      expect(result.errors[0].message).toBe("少なくとも3つのタグが必要です");
    });

    test("動的なエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: any[] }>()
        .v("items", (b) =>
          b.array.required().minLength(5, {
            messageFactory: (ctx) =>
              `あと${5 - (ctx.value?.length || 0)}個必要です`,
          })
        )
        .build();

      const result = validator.validate({ items: [1, 2] });
      expect(result.errors[0].message).toBe("あと3個必要です");
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("最大長との組み合わせ（範囲指定）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items: number[] }>()
        .v("items", (b) => b.array.required().minLength(2).maxLength(5))
        .build();

      expect(validator.validate({ items: [1, 2, 3] }).valid).toBe(true);
      expect(validator.validate({ items: [1] }).valid).toBe(false); // 最小長未満
      expect(validator.validate({ items: [1, 2, 3, 4, 5, 6] }).valid).toBe(
        false
      ); // 最大長超過
    });

    test("配列要素のバリデーションとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayIncludesPlugin)
        .for<{ roles: string[] }>()
        .v("roles", (b) => b.array.required().minLength(2).includes("admin"))
        .build();

      expect(validator.validate({ roles: ["admin", "user"] }).valid).toBe(true);
      expect(validator.validate({ roles: ["admin"] }).valid).toBe(false); // 最小長未満
      expect(validator.validate({ roles: ["user", "guest"] }).valid).toBe(
        false
      ); // adminを含まない
    });
  });

  describe("パフォーマンステスト", () => {
    test("大きな配列でも高速に動作する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: number[] }>()
        .v("items", (b) => b.array.required().minLength(1000))
        .build();

      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        validator.validate({ items: largeArray });
      }

      const end = performance.now();
      const timePerValidation = (end - start) / 1000;

      // 1回のバリデーションが0.1ms未満であることを確認
      expect(timePerValidation).toBeLessThan(0.1);
    });
  });
});

// 必要なimportを追加
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
import { arrayIncludesPlugin } from "../../../../src/core/plugin/arrayIncludes";
