import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { nullablePlugin } from "../../../../src/core/plugin/nullable";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";

describe("nullable Plugin", () => {
  describe("基本動作", () => {
    test("nullを受け入れる", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ value: string | null }>()
        .v("value", (b) => b.string.nullable())
        .build();

      expect(validator.validate({ value: null }).valid).toBe(true);
    });

    test("有効な値を受け入れる", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ value: string | null }>()
        .v("value", (b) => b.string.nullable())
        .build();

      expect(validator.validate({ value: "test" }).valid).toBe(true);
      expect(validator.validate({ value: "" }).valid).toBe(true);
    });

    test("undefinedは拒否する", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ value: string | null }>()
        .v("value", (b) => b.string.nullable())
        .build();

      const result = validator.validate({ value: undefined });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "nullable",
      });
    });
  });

  describe("様々な型でのnullable", () => {
    test("文字列のnullable", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ text: string | null }>()
        .v("text", (b) => b.string.nullable())
        .build();

      expect(validator.validate({ text: null }).valid).toBe(true);
      expect(validator.validate({ text: "hello" }).valid).toBe(true);
      expect(validator.validate({ text: "" }).valid).toBe(true);
      expect(validator.validate({ text: undefined }).valid).toBe(false);
    });

    test("数値のnullable", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ count: number | null }>()
        .v("count", (b) => b.number.nullable())
        .build();

      expect(validator.validate({ count: null }).valid).toBe(true);
      expect(validator.validate({ count: 42 }).valid).toBe(true);
      expect(validator.validate({ count: 0 }).valid).toBe(true);
      expect(validator.validate({ count: -1 }).valid).toBe(true);
      expect(validator.validate({ count: undefined }).valid).toBe(false);
    });

    test("ブール値のnullable", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ flag: boolean | null }>()
        .v("flag", (b) => b.boolean.nullable())
        .build();

      expect(validator.validate({ flag: null }).valid).toBe(true);
      expect(validator.validate({ flag: true }).valid).toBe(true);
      expect(validator.validate({ flag: false }).valid).toBe(true);
      expect(validator.validate({ flag: undefined }).valid).toBe(false);
    });

    test("配列のnullable", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ items: string[] | null }>()
        .v("items", (b) => b.array.nullable())
        .build();

      expect(validator.validate({ items: null }).valid).toBe(true);
      expect(validator.validate({ items: [] }).valid).toBe(true);
      expect(validator.validate({ items: ["a", "b"] }).valid).toBe(true);
      expect(validator.validate({ items: undefined }).valid).toBe(false);
    });

    test("オブジェクトのnullable", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ data: { name: string } | null }>()
        .v("data", (b) => b.object.nullable())
        .build();

      expect(validator.validate({ data: null }).valid).toBe(true);
      expect(validator.validate({ data: { name: "test" } }).valid).toBe(true);
      expect(validator.validate({ data: undefined }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("nullable + 文字列最小長", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .use(stringMinPlugin)
        .for<{ name: string | null }>()
        .v("name", (b) => b.string.nullable().min(3))
        .build();

      // nullは許可される
      expect(validator.validate({ name: null }).valid).toBe(true);

      // 有効な文字列
      expect(validator.validate({ name: "John" }).valid).toBe(true);
      expect(validator.validate({ name: "Alice" }).valid).toBe(true);

      // 短すぎる文字列は拒否される
      expect(validator.validate({ name: "Jo" }).valid).toBe(false);
      expect(validator.validate({ name: "" }).valid).toBe(false);

      // undefinedは拒否される
      expect(validator.validate({ name: undefined }).valid).toBe(false);
    });

    test("nullable + 数値最小値", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .use(numberMinPlugin)
        .for<{ age: number | null }>()
        .v("age", (b) => b.number.nullable().min(18))
        .build();

      // nullは許可される
      expect(validator.validate({ age: null }).valid).toBe(true);

      // 有効な数値
      expect(validator.validate({ age: 18 }).valid).toBe(true);
      expect(validator.validate({ age: 25 }).valid).toBe(true);

      // 最小値未満は拒否される
      expect(validator.validate({ age: 17 }).valid).toBe(false);
      expect(validator.validate({ age: 0 }).valid).toBe(false);

      // undefinedは拒否される
      expect(validator.validate({ age: undefined }).valid).toBe(false);
    });

    test("nullable + 配列最小長", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .use(arrayMinLengthPlugin)
        .for<{ tags: string[] | null }>()
        .v("tags", (b) => b.array.nullable().minLength(2))
        .build();

      // nullは許可される
      expect(validator.validate({ tags: null }).valid).toBe(true);

      // 有効な配列
      expect(validator.validate({ tags: ["a", "b"] }).valid).toBe(true);
      expect(validator.validate({ tags: ["x", "y", "z"] }).valid).toBe(true);

      // 短すぎる配列は拒否される
      expect(validator.validate({ tags: [] }).valid).toBe(false);
      expect(validator.validate({ tags: ["a"] }).valid).toBe(false);

      // undefinedは拒否される
      expect(validator.validate({ tags: undefined }).valid).toBe(false);
    });

    test("nullable + required（競合する要件）", () => {
      // nullable と required は通常競合するが、実装によっては両方指定可能
      const validator = Builder()
        .use(requiredPlugin)
        .use(nullablePlugin)
        .for<{ value: string | null }>()
        .v("value", (b) => b.string.required().nullable())
        .build();

      // nullは許可される（nullableが優先）
      expect(validator.validate({ value: null }).valid).toBe(true);

      // 有効な文字列
      expect(validator.validate({ value: "test" }).valid).toBe(true);

      // undefinedは拒否される（requiredの効果）
      expect(validator.validate({ value: undefined }).valid).toBe(false);
    });
  });

  describe("複数フィールドでのnullable", () => {
    test("複数のnullableフィールド", () => {
      interface OptionalData {
        name: string | null;
        age: number | null;
        email: string | null;
        tags: string[] | null;
      }

      const validator = Builder()
        .use(nullablePlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<OptionalData>()
        .v("name", (b) => b.string.nullable().min(2))
        .v("age", (b) => b.number.nullable().min(0))
        .v("email", (b) => b.string.nullable().min(5))
        .v("tags", (b) => b.array.nullable())
        .build();

      // すべてnull
      expect(
        validator.validate({
          name: null,
          age: null,
          email: null,
          tags: null,
        }).valid
      ).toBe(true);

      // 部分的にnull
      expect(
        validator.validate({
          name: "John",
          age: null,
          email: "john@example.com",
          tags: null,
        }).valid
      ).toBe(true);

      // すべて有効な値
      expect(
        validator.validate({
          name: "Alice",
          age: 25,
          email: "alice@example.com",
          tags: ["user", "admin"],
        }).valid
      ).toBe(true);

      // 無効な組み合わせ
      expect(
        validator.validate({
          name: "A", // 短すぎる
          age: -1, // 負の値
          email: null, // null（OK）
          tags: ["test"], // 有効
        }).valid
      ).toBe(false);
    });
  });

  describe("ネストしたオブジェクトでのnullable", () => {
    test("ネストしたnullableオブジェクト", () => {
      interface User {
        profile: {
          name: string | null;
          bio: string | null;
        } | null;
        settings: {
          theme: string | null;
          notifications: boolean | null;
        } | null;
      }

      const validator = Builder()
        .use(nullablePlugin)
        .use(stringMinPlugin)
        .for<User>()
        .v("profile", (b) => b.object.nullable())
        .v("profile.name", (b) => b.string.nullable().min(2))
        .v("profile.bio", (b) => b.string.nullable())
        .v("settings", (b) => b.object.nullable())
        .v("settings.theme", (b) => b.string.nullable())
        .v("settings.notifications", (b) => b.boolean.nullable())
        .build();

      // 両方null
      expect(
        validator.validate({
          profile: null,
          settings: null,
        }).valid
      ).toBe(true);

      // profileのみnull
      expect(
        validator.validate({
          profile: null,
          settings: {
            theme: "dark",
            notifications: true,
          },
        }).valid
      ).toBe(true);

      // ネストしたフィールドがnull
      expect(
        validator.validate({
          profile: {
            name: null,
            bio: null,
          },
          settings: {
            theme: null,
            notifications: null,
          },
        }).valid
      ).toBe(true);

      // 有効な値
      expect(
        validator.validate({
          profile: {
            name: "John",
            bio: "Software developer",
          },
          settings: {
            theme: "light",
            notifications: false,
          },
        }).valid
      ).toBe(true);
    });
  });

  describe("エラーコンテキスト", () => {
    test("undefinedに対するエラー情報", () => {
      const validator = Builder()
        .use(nullablePlugin)
        .for<{ value: string | null }>()
        .v("value", (b) => b.string.nullable())
        .build();

      const result = validator.validate({ value: undefined });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "nullable",
        message: expect.any(String),
      });
    });
  });

  describe("実用的なシナリオ", () => {
    test("ユーザープロフィールのオプショナル情報", () => {
      interface UserProfile {
        id: string; // 必須
        username: string; // 必須
        email: string; // 必須
        firstName: string | null; // オプショナル
        lastName: string | null; // オプショナル
        bio: string | null; // オプショナル
        avatar: string | null; // オプショナル
        phoneNumber: string | null; // オプショナル
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(nullablePlugin)
        .use(stringMinPlugin)
        .for<UserProfile>()
        .v("id", (b) => b.string.required().min(1))
        .v("username", (b) => b.string.required().min(3))
        .v("email", (b) => b.string.required().min(5))
        .v("firstName", (b) => b.string.nullable().min(1))
        .v("lastName", (b) => b.string.nullable().min(1))
        .v("bio", (b) => b.string.nullable())
        .v("avatar", (b) => b.string.nullable())
        .v("phoneNumber", (b) => b.string.nullable().min(10))
        .build();

      // 最小限のプロフィール
      const minimalProfile = {
        id: "user123",
        username: "johndoe",
        email: "john@example.com",
        firstName: null,
        lastName: null,
        bio: null,
        avatar: null,
        phoneNumber: null,
      };
      expect(validator.validate(minimalProfile).valid).toBe(true);

      // 完全なプロフィール
      const completeProfile = {
        id: "user456",
        username: "alicesmith",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        bio: "Software engineer passionate about web development",
        avatar: "https://example.com/avatar.jpg",
        phoneNumber: "1234567890",
      };
      expect(validator.validate(completeProfile).valid).toBe(true);

      // 無効なプロフィール（必須フィールドが不足）
      const invalidProfile = {
        id: "", // 空文字列
        username: "ab", // 短すぎる
        email: "bad", // 短すぎる
        firstName: "", // 空文字列（nullでない場合は最小長が適用される）
        lastName: "Smith",
        bio: null,
        avatar: null,
        phoneNumber: "123", // 短すぎる
      };
      expect(validator.validate(invalidProfile).valid).toBe(false);
    });

    test("商品情報のオプショナルフィールド", () => {
      interface Product {
        id: string; // 必須
        name: string; // 必須
        price: number; // 必須
        description: string | null; // オプショナル
        category: string | null; // オプショナル
        brand: string | null; // オプショナル
        tags: string[] | null; // オプショナル
        discount: number | null; // オプショナル（0-100%）
        weight: number | null; // オプショナル
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(nullablePlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<Product>()
        .v("id", (b) => b.string.required().min(1))
        .v("name", (b) => b.string.required().min(1))
        .v("price", (b) => b.number.required().min(0))
        .v("description", (b) => b.string.nullable())
        .v("category", (b) => b.string.nullable())
        .v("brand", (b) => b.string.nullable())
        .v("tags", (b) => b.array.nullable())
        .v("discount", (b) => b.number.nullable().min(0))
        .v("weight", (b) => b.number.nullable().min(0))
        .build();

      // 基本商品情報のみ
      const basicProduct = {
        id: "prod001",
        name: "Basic Widget",
        price: 29.99,
        description: null,
        category: null,
        brand: null,
        tags: null,
        discount: null,
        weight: null,
      };
      expect(validator.validate(basicProduct).valid).toBe(true);

      // 詳細商品情報
      const detailedProduct = {
        id: "prod002",
        name: "Premium Widget",
        price: 99.99,
        description: "High-quality widget with advanced features",
        category: "Electronics",
        brand: "TechCorp",
        tags: ["premium", "electronics", "featured"],
        discount: 15.5,
        weight: 0.5,
      };
      expect(validator.validate(detailedProduct).valid).toBe(true);
    });

    test("APIレスポンスのオプショナルフィールド", () => {
      interface ApiResponse {
        success: boolean; // 必須
        data: any | null; // オプショナル
        messageFactory: string | null; // オプショナル
        metadata: {
          requestId: string; // 必須
          timestamp: number; // 必須
          version: string | null; // オプショナル
          debug: any | null; // オプショナル
        };
        pagination: {
          page: number; // 必須
          limit: number; // 必須
          total: number | null; // オプショナル（計算済みでない場合）
          hasMore: boolean | null; // オプショナル
        } | null; // ページネーション自体がオプショナル
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(nullablePlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<ApiResponse>()
        .v("success", (b) => b.boolean.required())
        .v("data", (b) => b.string.nullable()) // anyの代わりにstringを使用
        .v("error", (b) => b.string.nullable())
        .v("metadata.requestId", (b) => b.string.required().min(1))
        .v("metadata.timestamp", (b) => b.number.required().min(0))
        .v("metadata.version", (b) => b.string.nullable())
        .v("metadata.debug", (b) => b.string.nullable())
        .v("pagination", (b) => b.object.nullable())
        .v("pagination.page", (b) => b.number.required().min(1))
        .v("pagination.limit", (b) => b.number.required().min(1))
        .v("pagination.total", (b) => b.number.nullable().min(0))
        .v("pagination.hasMore", (b) => b.boolean.nullable())
        .build();

      // 成功レスポンス（ページネーションなし）
      const successResponse = {
        success: true,
        data: '{"result": "success"}',
        messageFactory: null,
        metadata: {
          requestId: "req_123",
          timestamp: 1634567890,
          version: null,
          debug: null,
        },
        pagination: null,
      };
      expect(validator.validate(successResponse).valid).toBe(true);

      // エラーレスポンス
      const errorResponse = {
        success: false,
        data: null,
        messageFactory: "Invalid request parameters",
        metadata: {
          requestId: "req_456",
          timestamp: 1634567891,
          version: "v1.2.3",
          debug: '{"stack": "error trace"}',
        },
        pagination: null,
      };
      expect(validator.validate(errorResponse).valid).toBe(true);

      // ページネーション付きレスポンス
      const paginatedResponse = {
        success: true,
        data: '[{"id": 1}, {"id": 2}]',
        messageFactory: null,
        metadata: {
          requestId: "req_789",
          timestamp: 1634567892,
          version: "v1.2.3",
          debug: null,
        },
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          hasMore: true,
        },
      };
      expect(validator.validate(paginatedResponse).valid).toBe(true);
    });
  });
});
