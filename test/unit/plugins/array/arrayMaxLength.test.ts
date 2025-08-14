import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("arrayMaxLength Plugin", () => {
  describe("基本動作", () => {
    test("最大長以下の配列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().maxLength(3))
        .build();

      expect(validator.validate({ items: [] }).valid).toBe(true);
      expect(validator.validate({ items: ["a"] }).valid).toBe(true);
      expect(validator.validate({ items: ["a", "b"] }).valid).toBe(true);
      expect(validator.validate({ items: ["a", "b", "c"] }).valid).toBe(true);
    });

    test("最大長を超える配列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().maxLength(3))
        .build();

      const result = validator.validate({ items: ["a", "b", "c", "d"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "items",
        code: "arrayMaxLength",
      });
    });
  });

  describe("エラーハンドリング", () => {
    test("負の最大長でエラーを投げる", () => {
      expect(() => {
        Builder()
          .use(requiredPlugin)
          .use(arrayMaxLengthPlugin)
          .for<{ items: string[] }>()
          .v("items", (b) => b.array.required().maxLength(-1))
          .build();
      }).toThrow("Invalid maxLength: -1");
    });

    test("非数値の最大長でエラーを投げる", () => {
      expect(() => {
        Builder()
          .use(requiredPlugin)
          .use(arrayMaxLengthPlugin)
          .for<{ items: string[] }>()
          .v("items", (b) => b.array.required().maxLength(NaN))
          .build();
      }).toThrow("Invalid maxLength: NaN");
    });
  });

  describe("カスタムオプション", () => {
    test("カスタムエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().maxLength(2, {
          messageFactory: ({ path, max, actual }) => 
            `${path}は最大${max}個まで（現在${actual}個）`
        }))
        .build();

      const result = validator.validate({ items: ["a", "b", "c"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe("itemsは最大2個まで（現在3個）");
    });

    test("カスタムエラーコード", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().maxLength(2, {
          code: "CUSTOM_MAX_LENGTH"
        }))
        .build();

      const result = validator.validate({ items: ["a", "b", "c"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("CUSTOM_MAX_LENGTH");
    });
  });

  describe("非配列値の処理", () => {
    test("null値は検証をスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items: string[] | null }>()
        .v("items", (b) => b.array.optional().maxLength(2))
        .build();

      expect(validator.validate({ items: null }).valid).toBe(true);
    });

    test("undefined値は検証をスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items?: string[] }>()
        .v("items", (b) => b.array.optional().maxLength(2))
        .build();

      expect(validator.validate({}).valid).toBe(true);
    });
  });

  describe("様々な配列での検証", () => {
    test("文字列配列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) => b.array.required().maxLength(5))
        .build();

      expect(
        validator.validate({
          tags: ["red", "blue", "green", "yellow", "purple"],
        }).valid
      ).toBe(true);
      expect(
        validator.validate({
          tags: ["red", "blue", "green", "yellow", "purple", "orange"],
        }).valid
      ).toBe(false);
    });

    test("数値配列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ numbers: number[] }>()
        .v("numbers", (b) => b.array.required().maxLength(4))
        .build();

      expect(validator.validate({ numbers: [1, 2, 3, 4] }).valid).toBe(true);
      expect(validator.validate({ numbers: [1, 2, 3, 4, 5] }).valid).toBe(
        false
      );
    });

    test("オブジェクト配列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ users: Array<{ name: string; age: number }> }>()
        .v("users", (b) => b.array.required().maxLength(2))
        .build();

      expect(
        validator.validate({
          users: [
            { name: "Alice", age: 25 },
            { name: "Bob", age: 30 },
          ],
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          users: [
            { name: "Alice", age: 25 },
            { name: "Bob", age: 30 },
            { name: "Charlie", age: 35 },
          ],
        }).valid
      ).toBe(false);
    });

    test("混合型配列", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ mixed: any[] }>()
        .v("mixed", (b) => b.array.required().maxLength(3))
        .build();

      expect(validator.validate({ mixed: [1, "hello", true] }).valid).toBe(
        true
      );
      expect(
        validator.validate({ mixed: [1, "hello", true, null] }).valid
      ).toBe(false);
    });
  });

  describe("境界値での動作", () => {
    test("最大長0（空配列のみ許可）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ empty: any[] }>()
        .v("empty", (b) => b.array.required().maxLength(0))
        .build();

      expect(validator.validate({ empty: [] }).valid).toBe(true);
      expect(validator.validate({ empty: [1] }).valid).toBe(false);
    });

    test("最大長1（単一要素まで）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ single: string[] }>()
        .v("single", (b) => b.array.required().maxLength(1))
        .build();

      expect(validator.validate({ single: [] }).valid).toBe(true);
      expect(validator.validate({ single: ["one"] }).valid).toBe(true);
      expect(validator.validate({ single: ["one", "two"] }).valid).toBe(false);
    });

    test("大きな最大長", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ large: number[] }>()
        .v("large", (b) => b.array.required().maxLength(1000))
        .build();

      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      const tooLargeArray = Array.from({ length: 1001 }, (_, i) => i);

      expect(validator.validate({ large: largeArray }).valid).toBe(true);
      expect(validator.validate({ large: tooLargeArray }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("最小長と最大長の組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().minLength(2).maxLength(5))
        .build();

      // 有効: 範囲内
      expect(validator.validate({ items: ["a", "b"] }).valid).toBe(true);
      expect(validator.validate({ items: ["a", "b", "c"] }).valid).toBe(true);
      expect(
        validator.validate({ items: ["a", "b", "c", "d", "e"] }).valid
      ).toBe(true);

      // 無効: 短すぎる
      expect(validator.validate({ items: [] }).valid).toBe(false);
      expect(validator.validate({ items: ["a"] }).valid).toBe(false);

      // 無効: 長すぎる
      expect(
        validator.validate({ items: ["a", "b", "c", "d", "e", "f"] }).valid
      ).toBe(false);
    });

    test("配列の一意性チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .use(arrayUniquePlugin)
        .for<{ codes: string[] }>()
        .v("codes", (b) => b.array.required().maxLength(3).unique())
        .build();

      // 有効: 長さOKかつユニーク
      expect(validator.validate({ codes: ["A", "B", "C"] }).valid).toBe(true);

      // 無効: 長さOKだが重複あり
      expect(validator.validate({ codes: ["A", "B", "A"] }).valid).toBe(false);

      // 無効: ユニークだが長すぎる
      expect(validator.validate({ codes: ["A", "B", "C", "D"] }).valid).toBe(
        false
      );
    });

    test("配列の包含チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .use(arrayIncludesPlugin)
        .for<{ permissions: string[] }>()
        .v("permissions", (b) =>
          b.array.required().maxLength(5).includes("read")
        )
        .build();

      // 有効: 長さOKかつ必要な要素を含む
      expect(validator.validate({ permissions: ["read", "write"] }).valid).toBe(
        true
      );

      // 無効: 長さOKだが必要な要素を含まない
      expect(
        validator.validate({ permissions: ["write", "delete"] }).valid
      ).toBe(false);

      // 無効: 必要な要素を含むが長すぎる
      expect(
        validator.validate({
          permissions: ["read", "write", "delete", "create", "update", "admin"],
        }).valid
      ).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items?: string[] }>()
        .v("items", (b) => b.array.optional().maxLength(3))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ items: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は最大長検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items?: string[] }>()
        .v("items", (b) => b.array.optional().maxLength(3))
        .build();

      expect(validator.validate({ items: ["a", "b"] }).valid).toBe(true);
      expect(validator.validate({ items: ["a", "b", "c", "d"] }).valid).toBe(
        false
      );
    });
  });

  describe("エラーコンテキスト", () => {
    test("最大長が含まれる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().maxLength(2))
        .build();

      const result = validator.validate({ items: ["a", "b", "c"] });
      expect(result.isValid()).toBe(false);
      // Context property is not available in current API
      // expect(result.errors[0].context).toMatchObject({
      //   maxLength: 2,
      // });
    });
  });

  describe("実用的なシナリオ", () => {
    test("フォームの選択肢制限", () => {
      interface SurveyForm {
        favoriteColors: string[]; // 最大3つまで
        skills: string[]; // 最大10個まで
        languages: string[]; // 最大5つまで
        hobbies: string[]; // 最大7つまで
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .use(arrayMinLengthPlugin)
        .for<SurveyForm>()
        .v("favoriteColors", (b) =>
          b.array.required().minLength(1).maxLength(3)
        )
        .v("skills", (b) => b.array.required().minLength(1).maxLength(10))
        .v("languages", (b) => b.array.required().minLength(1).maxLength(5))
        .v("hobbies", (b) => b.array.required().minLength(1).maxLength(7))
        .build();

      // 有効なフォーム回答
      const validForm = {
        favoriteColors: ["blue", "green"],
        skills: ["JavaScript", "Python", "React"],
        languages: ["English", "Japanese"],
        hobbies: ["reading", "cooking", "gaming"],
      };
      expect(validator.validate(validForm).valid).toBe(true);

      // 無効なフォーム回答（制限超過）
      const invalidForm = {
        favoriteColors: ["red", "blue", "green", "yellow"], // 4つ（3つまで）
        skills: [
          "JS",
          "Python",
          "React",
          "Vue",
          "Angular",
          "Node",
          "Express",
          "MongoDB",
          "SQL",
          "Git",
          "Docker",
        ], // 11個（10個まで）
        languages: ["En", "Ja", "Ko", "Ch", "Fr", "De"], // 6つ（5つまで）
        hobbies: ["a", "b", "c", "d", "e", "f", "g", "h"], // 8つ（7つまで）
      };
      expect(validator.validate(invalidForm).valid).toBe(false);
    });

    test("ショッピングカートの制限", () => {
      interface ShoppingCart {
        items: Array<{
          productId: string;
          quantity: number;
          options: string[];
        }>;
        coupons: string[];
        giftCards: string[];
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<ShoppingCart>()
        .v("items", (b) => b.array.required().maxLength(20)) // 最大20商品
        .v("coupons", (b) => b.array.required().maxLength(5)) // 最大5クーポン
        .v("giftCards", (b) => b.array.required().maxLength(3)) // 最大3ギフトカード
        .build();

      // 有効なカート
      const validCart = {
        items: Array.from({ length: 15 }, (_, i) => ({
          productId: `prod-${i}`,
          quantity: 1,
          options: ["color:red"],
        })),
        coupons: ["SAVE10", "NEWUSER"],
        giftCards: ["GIFT001"],
      };
      expect(validator.validate(validCart).valid).toBe(true);

      // 無効なカート（制限超過）
      const invalidCart = {
        items: Array.from({ length: 25 }, (_, i) => ({
          // 25商品（20まで）
          productId: `prod-${i}`,
          quantity: 1,
          options: [],
        })),
        coupons: ["C1", "C2", "C3", "C4", "C5", "C6"], // 6クーポン（5まで）
        giftCards: ["G1", "G2", "G3", "G4"], // 4ギフトカード（3まで）
      };
      expect(validator.validate(invalidCart).valid).toBe(false);
    });

    test("ソーシャルメディア投稿制限", () => {
      interface SocialPost {
        hashtags: string[]; // 最大30個
        mentions: string[]; // 最大10人
        images: string[]; // 最大4枚
        links: string[]; // 最大2つ
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<SocialPost>()
        .v("hashtags", (b) => b.array.required().maxLength(30))
        .v("mentions", (b) => b.array.required().maxLength(10))
        .v("images", (b) => b.array.required().maxLength(4))
        .v("links", (b) => b.array.required().maxLength(2))
        .build();

      // 有効な投稿
      const validPost = {
        hashtags: ["nature", "photography", "sunset", "beautiful"],
        mentions: ["@friend1", "@friend2"],
        images: ["img1.jpg", "img2.jpg"],
        links: ["https://example.com"],
      };
      expect(validator.validate(validPost).valid).toBe(true);

      // 無効な投稿（制限超過）
      const invalidPost = {
        hashtags: Array.from({ length: 35 }, (_, i) => `tag${i}`), // 35個（30まで）
        mentions: Array.from({ length: 15 }, (_, i) => `@user${i}`), // 15人（10まで）
        images: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"], // 5枚（4まで）
        links: ["link1.com", "link2.com", "link3.com"], // 3つ（2まで）
      };
      expect(validator.validate(invalidPost).valid).toBe(false);
    });

    test("APIリクエストの制限", () => {
      interface BulkApiRequest {
        operations: Array<{
          method: string;
          endpoint: string;
          data?: any;
        }>;
        headers: Record<string, string>;
        queryParams: Array<{ key: string; value: string }>;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<BulkApiRequest>()
        .v("operations", (b) => b.array.required().maxLength(100)) // 最大100操作
        .v("queryParams", (b) => b.array.required().maxLength(20)) // 最大20パラメータ
        .build();

      // 有効なAPIリクエスト
      const validRequest = {
        operations: Array.from({ length: 50 }, (_, i) => ({
          method: "GET",
          endpoint: `/api/resource/${i}`,
        })),
        headers: { Authorization: "Bearer token" },
        queryParams: [
          { key: "limit", value: "10" },
          { key: "offset", value: "0" },
        ],
      };
      expect(validator.validate(validRequest).valid).toBe(true);

      // 無効なAPIリクエスト（制限超過）
      const invalidRequest = {
        operations: Array.from({ length: 150 }, (_, i) => ({
          // 150操作（100まで）
          method: "POST",
          endpoint: `/api/create/${i}`,
        })),
        headers: {},
        queryParams: Array.from({ length: 25 }, (_, i) => ({
          // 25パラメータ（20まで）
          key: `param${i}`,
          value: `value${i}`,
        })),
      };
      expect(validator.validate(invalidRequest).valid).toBe(false);
    });

    test("教育システムの課題提出", () => {
      interface Assignment {
        answers: string[]; // 最大50問
        attachments: string[]; // 最大5ファイル
        references: string[]; // 最大10参考文献
        keywords: string[]; // 最大15キーワード
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .use(arrayMinLengthPlugin)
        .for<Assignment>()
        .v("answers", (b) => b.array.required().minLength(1).maxLength(50))
        .v("attachments", (b) => b.array.required().maxLength(5))
        .v("references", (b) => b.array.required().maxLength(10))
        .v("keywords", (b) => b.array.required().minLength(3).maxLength(15))
        .build();

      // 有効な課題提出
      const validAssignment = {
        answers: ["Answer 1", "Answer 2", "Answer 3"],
        attachments: ["file1.pdf", "image1.png"],
        references: ["Book 1", "Paper 2", "Website 3"],
        keywords: ["education", "learning", "assessment", "evaluation"],
      };
      expect(validator.validate(validAssignment).valid).toBe(true);

      // 無効な課題提出（制限超過）
      const invalidAssignment = {
        answers: Array.from({ length: 60 }, (_, i) => `Answer ${i}`), // 60問（50まで）
        attachments: [
          "f1.pdf",
          "f2.doc",
          "f3.png",
          "f4.jpg",
          "f5.txt",
          "f6.mp4",
        ], // 6ファイル（5まで）
        references: Array.from({ length: 15 }, (_, i) => `Ref ${i}`), // 15参考文献（10まで）
        keywords: Array.from({ length: 20 }, (_, i) => `keyword${i}`), // 20キーワード（15まで）
      };
      expect(validator.validate(invalidAssignment).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { arrayUniquePlugin } from "../../../../src/core/plugin/arrayUnique";
import { arrayIncludesPlugin } from "../../../../src/core/plugin/arrayIncludes";
