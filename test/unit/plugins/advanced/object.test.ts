import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { objectPlugin } from "../../../../src/core/plugin/object";
import { objectRecursivelyPlugin } from "../../../../src/core/plugin/objectRecursively";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";

describe("object and objectRecursively Plugins", () => {
  describe("objectPlugin 基本動作", () => {
    test("有効なオブジェクトを受け入れる", () => {
      const validator = Builder()
        .use(objectPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.object())
        .build();

      expect(validator.validate({ data: {} }).valid).toBe(true);
      expect(validator.validate({ data: { name: "test" } }).valid).toBe(true);
      expect(validator.validate({ data: { a: 1, b: 2 } }).valid).toBe(true);
    });

    test("非オブジェクトを拒否する", () => {
      const validator = Builder()
        .use(objectPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.object())
        .build();

      expect(validator.validate({ data: "string" }).valid).toBe(false);
      expect(validator.validate({ data: 123 }).valid).toBe(false);
      expect(validator.validate({ data: true }).valid).toBe(false);
      expect(validator.validate({ data: null }).valid).toBe(false);
      expect(validator.validate({ data: [] }).valid).toBe(false);
    });

    test("requiredと組み合わせて動作する", () => {
      const validator = Builder()
        .use(objectPlugin)
        .use(requiredPlugin)
        .for<{ data?: object }>()
        .v("data", (b) => b.object.required().object())
        .build();

      expect(validator.validate({ data: {} }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(false);
    });
  });

  describe("ネストしたオブジェクトの検証", () => {
    test("シンプルなネスト構造", () => {
      type UserData = {
        user: {
          name: string;
          age: number;
        };
      };

      const validator = Builder()
        .use(objectPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<UserData>()
        .v("user", (b) => b.object.required().object())
        .v("user.name", (b) => b.string.required().min(2))
        .v("user.age", (b) => b.number.required().min(0))
        .build();

      expect(
        validator.validate({
          user: {
            name: "John",
            age: 25,
          },
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          user: {
            name: "J", // 短すぎる
            age: 25,
          },
        }).valid
      ).toBe(false);
    });

    test("深いネスト構造", () => {
      type ConfigData = {
        config: {
          app: {
            name: string;
            version: string;
          };
          database: {
            host: string;
            port: number;
          };
        };
      };

      const validator = Builder()
        .use(objectPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<ConfigData>()
        .v("config", (b) => b.object.required().object())
        .v("config.app", (b) => b.object.required().object())
        .v("config.app.name", (b) => b.string.required().min(1))
        .v("config.app.version", (b) => b.string.required())
        .v("config.database", (b) => b.object.required().object())
        .v("config.database.host", (b) => b.string.required())
        .v("config.database.port", (b) => b.number.required().min(1))
        .build();

      expect(
        validator.validate({
          config: {
            app: {
              name: "MyApp",
              version: "1.0.0",
            },
            database: {
              host: "localhost",
              port: 5432,
            },
          },
        }).valid
      ).toBe(true);
    });
  });

  describe("objectRecursively Plugin", () => {
    test("再帰的検証のマーカーとして機能する", () => {
      const validator = Builder()
        .use(objectRecursivelyPlugin)
        .use(objectPlugin)
        .use(requiredPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.required().recursively())
        .build();

      // objectRecursivelyは実際の検証を行わず、マーカーとして機能する
      const result = validator.validate({
        data: {
          nested: {
            deep: {
              value: "test",
            },
          },
        },
      });
      expect(result.isValid()).toBe(true);
    });
  });

  describe("実用的なシナリオ", () => {
    test("APIレスポンスの検証", () => {
      type ApiResponse = {
        status: {
          code: number;
          message: string;
        };
        data: {
          items: any[];
          total: number;
        };
      };

      const validator = Builder()
        .use(objectPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<ApiResponse>()
        .v("status", (b) => b.object.required().object())
        .v("status.code", (b) => b.number.required().min(100))
        .v("status.message", (b) => b.string.required())
        .v("data", (b) => b.object.required().object())
        .v("data.items", (b) => b.array.required())
        .v("data.total", (b) => b.number.required().min(0))
        .build();

      expect(
        validator.validate({
          status: {
            code: 200,
            message: "OK",
          },
          data: {
            items: [1, 2, 3],
            total: 3,
          },
        }).valid
      ).toBe(true);
    });

    test("設定オブジェクトの検証", () => {
      type Settings = {
        theme: {
          colors: {
            primary: string;
            secondary: string;
          };
          fonts: {
            body: string;
            heading: string;
          };
        };
      };

      const validator = Builder()
        .use(objectPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Settings>()
        .v("theme", (b) => b.object.required().object())
        .v("theme.colors", (b) => b.object.required().object())
        .v("theme.colors.primary", (b) => b.string.required().min(1))
        .v("theme.colors.secondary", (b) => b.string.required().min(1))
        .v("theme.fonts", (b) => b.object.required().object())
        .v("theme.fonts.body", (b) => b.string.required())
        .v("theme.fonts.heading", (b) => b.string.required())
        .build();

      expect(
        validator.validate({
          theme: {
            colors: {
              primary: "#000000",
              secondary: "#ffffff",
            },
            fonts: {
              body: "Arial",
              heading: "Georgia",
            },
          },
        }).valid
      ).toBe(true);
    });
  });

  describe("エラーコンテキスト", () => {
    test("オブジェクト型エラーの詳細を提供する", () => {
      const validator = Builder()
        .use(objectPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.object())
        .build();

      const result = validator.validate({ data: "not an object" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "data",
        code: "object",
        message: expect.any(String),
      });
    });

    test("ネストしたオブジェクトのエラーパス", () => {
      type NestedData = {
        level1: {
          level2: {
            value: string;
          };
        };
      };

      const validator = Builder()
        .use(objectPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<NestedData>()
        .v("level1", (b) => b.object.required().object())
        .v("level1.level2", (b) => b.object.required().object())
        .v("level1.level2.value", (b) => b.string.required().min(5))
        .build();

      const result = validator.validate({
        level1: {
          level2: {
            value: "hi", // 短すぎる
          },
        },
      });

      expect(result.isValid()).toBe(false);
      expect(result.errors[0].path).toBe("level1.level2.value");
    });
  });
});
