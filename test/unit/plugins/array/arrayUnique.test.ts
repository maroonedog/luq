import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { arrayUniquePlugin } from "../../../../src/core/plugin/arrayUnique";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("arrayUnique Plugin", () => {
  describe("基本動作", () => {
    test("ユニークな要素の配列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) => b.array.required().unique())
        .build();

      const result = validator.validate({ tags: ["tag1", "tag2", "tag3"] });
      expect(result.isValid()).toBe(true);
    });

    test("重複要素を含む配列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) => b.array.required().unique())
        .build();

      const result = validator.validate({ tags: ["tag1", "tag2", "tag1"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "tags",
        code: "arrayUnique",
      });
    });
  });

  describe("様々な型での重複チェック", () => {
    test("数値配列での重複チェック", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ numbers: number[] }>()
        .v("numbers", (b) => b.array.required().unique())
        .build();

      expect(validator.validate({ numbers: [1, 2, 3, 4, 5] }).valid).toBe(true);
      expect(validator.validate({ numbers: [1, 2, 3, 2, 5] }).valid).toBe(
        false
      );
      expect(validator.validate({ numbers: [0, -0] }).valid).toBe(true); // 0と-0は同じ
    });

    test("ブーリアン配列での重複チェック", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ flags: boolean[] }>()
        .v("flags", (b) => b.array.required().unique())
        .build();

      expect(validator.validate({ flags: [true, false] }).valid).toBe(true);
      expect(validator.validate({ flags: [true, true] }).valid).toBe(false);
      expect(validator.validate({ flags: [false, false, false] }).valid).toBe(
        false
      );
    });

    test("オブジェクト配列での重複チェック（参照の比較）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ items: Array<{ id: number; name: string }> }>()
        .v("items", (b) => b.array.required().unique())
        .build();

      const obj1 = { id: 1, name: "Item 1" };
      const obj2 = { id: 2, name: "Item 2" };
      const obj3 = { id: 1, name: "Item 1" }; // 内容は同じだが別オブジェクト

      // 異なる参照のオブジェクトは重複とみなされない
      expect(validator.validate({ items: [obj1, obj2, obj3] }).valid).toBe(
        true
      );

      // 同じ参照のオブジェクトは重複
      expect(validator.validate({ items: [obj1, obj2, obj1] }).valid).toBe(
        false
      );
    });

    test("混合型配列での重複チェック", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ mixed: any[] }>()
        .v("mixed", (b) => b.array.required().unique())
        .build();

      expect(
        validator.validate({ mixed: [1, "1", true, null, undefined] }).valid
      ).toBe(true);
      expect(validator.validate({ mixed: [1, 2, 1] }).valid).toBe(false);
      expect(validator.validate({ mixed: ["test", "test"] }).valid).toBe(false);
      expect(validator.validate({ mixed: [null, null] }).valid).toBe(false);
      expect(validator.validate({ mixed: [undefined, undefined] }).valid).toBe(
        false
      );
    });
  });

  describe("エッジケース", () => {
    test("空配列はユニーク", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().unique())
        .build();

      expect(validator.validate({ items: [] }).valid).toBe(true);
    });

    test("単一要素の配列はユニーク", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().unique())
        .build();

      expect(validator.validate({ items: ["single"] }).valid).toBe(true);
    });

    test("NaNの扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ numbers: number[] }>()
        .v("numbers", (b) => b.array.required().unique())
        .build();

      // NaN !== NaN なので、技術的には各NaNは「ユニーク」
      expect(validator.validate({ numbers: [NaN, NaN] }).valid).toBe(true);
    });

    test("大文字小文字の区別", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ words: string[] }>()
        .v("words", (b) => b.array.required().unique())
        .build();

      // 大文字小文字は区別される
      expect(
        validator.validate({ words: ["Test", "test", "TEST"] }).valid
      ).toBe(true);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("配列長とユニーク制約の組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ codes: string[] }>()
        .v("codes", (b) =>
          b.array.required().minLength(2).maxLength(5).unique()
        )
        .build();

      // 有効: 2-5個のユニークな要素
      expect(validator.validate({ codes: ["A", "B", "C"] }).valid).toBe(true);

      // 無効: 重複あり
      expect(validator.validate({ codes: ["A", "B", "A"] }).valid).toBe(false);

      // 無効: 少なすぎる
      expect(validator.validate({ codes: ["A"] }).valid).toBe(false);

      // 無効: 多すぎる
      expect(
        validator.validate({ codes: ["A", "B", "C", "D", "E", "F"] }).valid
      ).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ emails: string[] }>()
        .v("emails", (b) =>
          b.array.required().unique({
            messageFactory: () => "メールアドレスは重複できません",
          })
        )
        .build();

      const result = validator.validate({
        emails: ["test@example.com", "test@example.com"],
      });
      expect(result.errors[0].message).toBe("メールアドレスは重複できません");
    });
  });
});

// 必要なimportを追加
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
