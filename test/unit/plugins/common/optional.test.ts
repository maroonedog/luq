import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";

describe("optional Plugin", () => {
  describe("基本動作", () => {
    test("undefinedを受け入れる", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ value?: string }>()
        .v("value", (b) => b.string.optional())
        .build();

      expect(validator.validate({ value: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);
    });

    test("有効な値を受け入れる", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ value?: string }>()
        .v("value", (b) => b.string.optional())
        .build();

      expect(validator.validate({ value: "test" }).valid).toBe(true);
      expect(validator.validate({ value: "" }).valid).toBe(true);
    });

    test("nullは拒否する", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ value?: string }>()
        .v("value", (b) => b.string.optional())
        .build();

      const result = validator.validate({ value: null });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "optional",
      });
    });
  });

  describe("様々な型でのoptional", () => {
    test("文字列のoptional", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ text?: string }>()
        .v("text", (b) => b.string.optional())
        .build();

      expect(validator.validate({ text: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ text: "hello" }).valid).toBe(true);
      expect(validator.validate({ text: "" }).valid).toBe(true);
      expect(validator.validate({ text: null }).valid).toBe(false);
    });

    test("数値のoptional", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ count?: number }>()
        .v("count", (b) => b.number.optional())
        .build();

      expect(validator.validate({ count: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ count: 42 }).valid).toBe(true);
      expect(validator.validate({ count: 0 }).valid).toBe(true);
      expect(validator.validate({ count: -1 }).valid).toBe(true);
      expect(validator.validate({ count: null }).valid).toBe(false);
    });

    test("ブール値のoptional", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ flag?: boolean }>()
        .v("flag", (b) => b.boolean.optional())
        .build();

      expect(validator.validate({ flag: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ flag: true }).valid).toBe(true);
      expect(validator.validate({ flag: false }).valid).toBe(true);
      expect(validator.validate({ flag: null }).valid).toBe(false);
    });

    test("配列のoptional", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ items?: string[] }>()
        .v("items", (b) => b.array.optional())
        .build();

      expect(validator.validate({ items: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ items: [] }).valid).toBe(true);
      expect(validator.validate({ items: ["a", "b"] }).valid).toBe(true);
      expect(validator.validate({ items: null }).valid).toBe(false);
    });

    test("オブジェクトのoptional", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ data?: { name: string } }>()
        .v("data", (b) => b.object.optional())
        .build();

      expect(validator.validate({ data: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ data: { name: "test" } }).valid).toBe(true);
      expect(validator.validate({ data: null }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("optional + 文字列最小長", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<{ name?: string }>()
        .v("name", (b) => b.string.optional().min(3))
        .build();

      // undefinedは許可される（バリデーションをスキップ）
      expect(validator.validate({ name: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);

      // 有効な文字列
      expect(validator.validate({ name: "John" }).valid).toBe(true);
      expect(validator.validate({ name: "Alice" }).valid).toBe(true);

      // 短すぎる文字列は拒否される
      expect(validator.validate({ name: "Jo" }).valid).toBe(false);
      expect(validator.validate({ name: "" }).valid).toBe(false);

      // nullは拒否される
      expect(validator.validate({ name: null }).valid).toBe(false);
    });

    test("optional + 数値最小値", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(numberMinPlugin)
        .for<{ age?: number }>()
        .v("age", (b) => b.number.optional().min(18))
        .build();

      // undefinedは許可される（バリデーションをスキップ）
      expect(validator.validate({ age: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);

      // 有効な数値
      expect(validator.validate({ age: 18 }).valid).toBe(true);
      expect(validator.validate({ age: 25 }).valid).toBe(true);

      // 最小値未満は拒否される
      expect(validator.validate({ age: 17 }).valid).toBe(false);
      expect(validator.validate({ age: 0 }).valid).toBe(false);

      // nullは拒否される
      expect(validator.validate({ age: null }).valid).toBe(false);
    });

    test("optional + 配列最小長", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ tags?: string[] }>()
        .v("tags", (b) => b.array.optional().minLength(2))
        .build();

      // undefinedは許可される（バリデーションをスキップ）
      expect(validator.validate({ tags: undefined }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(true);

      // 有効な配列
      expect(validator.validate({ tags: ["a", "b"] }).valid).toBe(true);
      expect(validator.validate({ tags: ["x", "y", "z"] }).valid).toBe(true);

      // 短すぎる配列は拒否される
      expect(validator.validate({ tags: [] }).valid).toBe(false);
      expect(validator.validate({ tags: ["a"] }).valid).toBe(false);

      // nullは拒否される
      expect(validator.validate({ tags: null }).valid).toBe(false);
    });
  });

  describe("複数のoptionalフィールド", () => {
    test("複数のoptionalフィールド", () => {
      interface OptionalData {
        name?: string;
        age?: number;
        email?: string;
        tags?: string[];
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<OptionalData>()
        .v("name", (b) => b.string.optional().min(2))
        .v("age", (b) => b.number.optional().min(0))
        .v("email", (b) => b.string.optional().min(5))
        .v("tags", (b) => b.array.optional())
        .build();

      // すべてundefined
      expect(validator.validate({}).valid).toBe(true);
      expect(
        validator.validate({
          name: undefined,
          age: undefined,
          email: undefined,
          tags: undefined,
        }).valid
      ).toBe(true);

      // 部分的にundefined
      expect(
        validator.validate({
          name: "John",
          age: undefined,
          email: "john@example.com",
          tags: undefined,
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
          email: undefined, // undefined（OK）
          tags: ["test"], // 有効
        }).valid
      ).toBe(false);
    });
  });

  describe("必須フィールドとoptionalフィールドの混合", () => {
    test("必須とoptionalの組み合わせ", () => {
      interface MixedData {
        id: string; // 必須
        name: string; // 必須
        email?: string; // optional
        phone?: string; // optional
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<MixedData>()
        .v("id", (b) => b.string.min(1)) // requiredPluginなしでも必須として扱われる
        .v("name", (b) => b.string.min(2))
        .v("email", (b) => b.string.optional().min(5))
        .v("phone", (b) => b.string.optional().min(10))
        .build();

      // 必須フィールドのみ
      expect(
        validator.validate({
          id: "user123",
          name: "John",
        }).valid
      ).toBe(true);

      // 必須フィールド + 一部optional
      expect(
        validator.validate({
          id: "user456",
          name: "Alice",
          email: "alice@example.com",
        }).valid
      ).toBe(true);

      // 必須フィールド + 全optional
      expect(
        validator.validate({
          id: "user789",
          name: "Bob",
          email: "bob@example.com",
          phone: "1234567890",
        }).valid
      ).toBe(true);

      // 必須フィールドが不足
      expect(
        validator.validate({
          id: "user000",
          // name が不足
          email: "test@example.com",
        }).valid
      ).toBe(false);

      // optionalフィールドが無効
      expect(
        validator.validate({
          id: "user111",
          name: "Charlie",
          email: "bad", // 短すぎる
          phone: "123", // 短すぎる
        }).valid
      ).toBe(false);
    });
  });

  describe("ネストしたoptionalフィールド", () => {
    test("ネストしたoptionalオブジェクト", () => {
      interface User {
        profile?: {
          name?: string;
          bio?: string;
        };
        settings?: {
          theme?: string;
          notifications?: boolean;
        };
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<User>()
        .v("profile", (b) => b.object.optional())
        .v("profile.name", (b) => b.string.optional().min(2))
        .v("profile.bio", (b) => b.string.optional())
        .v("settings", (b) => b.object.optional())
        .v("settings.theme", (b) => b.string.optional())
        .v("settings.notifications", (b) => b.boolean.optional())
        .build();

      // 空のオブジェクト
      expect(validator.validate({}).valid).toBe(true);

      // 両方undefined
      expect(
        validator.validate({
          profile: undefined,
          settings: undefined,
        }).valid
      ).toBe(true);

      // profileのみ存在
      expect(
        validator.validate({
          profile: {
            name: "John",
            bio: undefined,
          },
        }).valid
      ).toBe(true);

      // ネストしたフィールドがすべてundefined
      expect(
        validator.validate({
          profile: {
            name: undefined,
            bio: undefined,
          },
          settings: {
            theme: undefined,
            notifications: undefined,
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
            theme: "dark",
            notifications: true,
          },
        }).valid
      ).toBe(true);

      // 無効なネストしたフィールド
      expect(
        validator.validate({
          profile: {
            name: "J", // 短すぎる
            bio: "Some bio",
          },
        }).valid
      ).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("ユーザー登録フォーム", () => {
      interface RegistrationForm {
        username: string; // 必須
        email: string; // 必須
        password: string; // 必須
        firstName?: string; // optional
        lastName?: string; // optional
        phone?: string; // optional
        newsletter?: boolean; // optional
        referrer?: string; // optional
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<RegistrationForm>()
        .v("username", (b) => b.string.min(3))
        .v("email", (b) => b.string.min(5))
        .v("password", (b) => b.string.min(8))
        .v("firstName", (b) => b.string.optional().min(1))
        .v("lastName", (b) => b.string.optional().min(1))
        .v("phone", (b) => b.string.optional().min(10))
        .v("newsletter", (b) => b.boolean.optional())
        .v("referrer", (b) => b.string.optional())
        .build();

      // 最小限の登録
      const minimalRegistration = {
        username: "johndoe",
        email: "john@example.com",
        password: "securepassword123",
      };
      expect(validator.validate(minimalRegistration).valid).toBe(true);

      // 完全な登録
      const completeRegistration = {
        username: "alicesmith",
        email: "alice@example.com",
        password: "supersecure456",
        firstName: "Alice",
        lastName: "Smith",
        phone: "1234567890",
        newsletter: true,
        referrer: "google",
      };
      expect(validator.validate(completeRegistration).valid).toBe(true);

      // 部分的な登録
      const partialRegistration = {
        username: "bobwilson",
        email: "bob@example.com",
        password: "password789",
        firstName: "Bob",
        newsletter: false,
        // lastName, phone, referrer は省略
      };
      expect(validator.validate(partialRegistration).valid).toBe(true);
    });

    test("商品フィルター設定", () => {
      interface ProductFilter {
        category: string; // 必須
        minPrice?: number; // optional
        maxPrice?: number; // optional
        brand?: string; // optional
        color?: string; // optional
        size?: string; // optional
        inStock?: boolean; // optional
        tags?: string[]; // optional
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<ProductFilter>()
        .v("category", (b) => b.string.min(1))
        .v("minPrice", (b) => b.number.optional().min(0))
        .v("maxPrice", (b) => b.number.optional().min(0))
        .v("brand", (b) => b.string.optional().min(1))
        .v("color", (b) => b.string.optional().min(1))
        .v("size", (b) => b.string.optional().min(1))
        .v("inStock", (b) => b.boolean.optional())
        .v("tags", (b) => b.array.optional())
        .build();

      // カテゴリのみ指定
      const basicFilter = {
        category: "electronics",
      };
      expect(validator.validate(basicFilter).valid).toBe(true);

      // 価格範囲を指定
      const priceFilter = {
        category: "clothing",
        minPrice: 50,
        maxPrice: 200,
      };
      expect(validator.validate(priceFilter).valid).toBe(true);

      // 複数フィルターを指定
      const complexFilter = {
        category: "shoes",
        minPrice: 100,
        maxPrice: 500,
        brand: "Nike",
        color: "black",
        size: "42",
        inStock: true,
        tags: ["running", "sports"],
      };
      expect(validator.validate(complexFilter).valid).toBe(true);
    });

    test("設定管理システム", () => {
      interface AppSettings {
        theme: string; // 必須
        language: string; // 必須
        notifications?: {
          email?: boolean;
          push?: boolean;
          sms?: boolean;
        };
        privacy?: {
          profileVisible?: boolean;
          searchable?: boolean;
          analyticsEnabled?: boolean;
        };
        advanced?: {
          debugMode?: boolean;
          apiTimeout?: number;
          cacheEnabled?: boolean;
          logLevel?: string;
        };
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<AppSettings>()
        .v("theme", (b) => b.string.min(1))
        .v("language", (b) => b.string.min(2))
        .v("notifications", (b) => b.object.optional())
        .v("notifications.email", (b) => b.boolean.optional())
        .v("notifications.push", (b) => b.boolean.optional())
        .v("notifications.sms", (b) => b.boolean.optional())
        .v("privacy", (b) => b.object.optional())
        .v("privacy.profileVisible", (b) => b.boolean.optional())
        .v("privacy.searchable", (b) => b.boolean.optional())
        .v("privacy.analyticsEnabled", (b) => b.boolean.optional())
        .v("advanced", (b) => b.object.optional())
        .v("advanced.debugMode", (b) => b.boolean.optional())
        .v("advanced.apiTimeout", (b) => b.number.optional().min(1000))
        .v("advanced.cacheEnabled", (b) => b.boolean.optional())
        .v("advanced.logLevel", (b) => b.string.optional().min(1))
        .build();

      // 基本設定のみ
      const basicSettings = {
        theme: "light",
        language: "en",
      };
      expect(validator.validate(basicSettings).valid).toBe(true);

      // 通知設定を追加
      const withNotifications = {
        theme: "dark",
        language: "ja",
        notifications: {
          email: true,
          push: false,
        },
      };
      expect(validator.validate(withNotifications).valid).toBe(true);

      // 完全な設定
      const completeSettings = {
        theme: "auto",
        language: "en",
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
        privacy: {
          profileVisible: true,
          searchable: false,
          analyticsEnabled: true,
        },
        advanced: {
          debugMode: false,
          apiTimeout: 5000,
          cacheEnabled: true,
          logLevel: "info",
        },
      };
      expect(validator.validate(completeSettings).valid).toBe(true);
    });
  });

  describe("エラーコンテキスト", () => {
    test("nullに対するエラー情報", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .for<{ value?: string }>()
        .v("value", (b) => b.string.optional())
        .build();

      const result = validator.validate({ value: null });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "value",
        code: "optional",
        message: expect.any(String),
      });
    });
  });
});
