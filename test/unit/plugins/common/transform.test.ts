import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { transformPlugin } from "../../../../src/core/plugin/transform";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";

describe("transform Plugin", () => {
  describe("基本動作", () => {
    test("値を変換する", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.transform((value) => value.toUpperCase()))
        .build();

      const result = validator.validate({ name: "john" });
      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({ name: "JOHN" });
    });

    test("変換後にバリデーションを実行", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.transform((value) => value.trim()).min(3))
        .build();

      // 変換前は長さ不足だが、変換後は有効
      const result1 = validator.validate({ name: "  ab  " });
      expect(result1.valid).toBe(false); // 'ab'.length < 3

      // 変換後に十分な長さになる
      const result2 = validator.validate({ name: "  abc  " });
      expect(result2.valid).toBe(true);
      expect(result2.data).toEqual({ name: "abc" });
    });
  });

  describe("様々な変換での検証", () => {
    test("文字列の変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ email: string; name: string; code: string }>()
        .v("email", (b) => b.string.transform((value) => value.toLowerCase()))
        .v("name", (b) =>
          b.string.transform((value) => value.trim().replace(/\s+/g, " "))
        )
        .v("code", (b) =>
          b.string.transform((value) => value.replace(/[^A-Z0-9]/g, ""))
        )
        .build();

      const result = validator.validate({
        email: "USER@EXAMPLE.COM",
        name: "  John   Doe  ",
        code: "A1-B2-C3",
      });

      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({
        email: "user@example.com",
        name: "John Doe",
        code: "A1B2C3",
      });
    });

    test("数値の変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ price: number; percentage: number; rounded: number }>()
        .v("price", (b) =>
          b.number.transform((value) => Math.round(value * 100) / 100)
        )
        .v("percentage", (b) => b.number.transform((value) => value / 100))
        .v("rounded", (b) => b.number.transform((value) => Math.floor(value)))
        .build();

      const result = validator.validate({
        price: 19.999,
        percentage: 85,
        rounded: 7.8,
      });

      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({
        price: 20.0,
        percentage: 0.85,
        rounded: 7,
      });
    });

    test("配列の変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ tags: string[]; numbers: number[] }>()
        .v("tags", (b) =>
          b.array.transform((value: string[]) =>
            value
              .map((tag) => tag.toLowerCase().trim())
              .filter((tag) => tag.length > 0)
          )
        )
        .v("numbers", (b) =>
          b.array.transform((value: number[]) =>
            value.map((num) => Math.abs(num)).sort((a, b) => a - b)
          )
        )
        .build();

      const result = validator.validate({
        tags: ["  REACT  ", "javascript ", "", "  NODE  "],
        numbers: [-3, 1, -5, 2],
      });

      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({
        tags: ["react", "javascript", "node"],
        numbers: [1, 2, 3, 5],
      });
    });

    test("オブジェクトの変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ metadata: any }>()
        .v("metadata", (b) =>
          b.object.transform((value: any) => ({
            ...value,
            timestamp: new Date(value.timestamp).toISOString(),
            version: `v${value.version}`,
          }))
        )
        .build();

      const result = validator.validate({
        metadata: {
          name: "test",
          timestamp: "2023-01-01",
          version: 1.0,
        },
      });

      expect(result.isValid()).toBe(true);
      expect(result.data.metadata.timestamp).toBe("2023-01-01T00:00:00.000Z");
      expect(result.data.metadata.version).toBe("v1");
    });
  });

  describe("チェーンした変換", () => {
    test("複数の変換を連続適用", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ text: string }>()
        .v("text", (b) =>
          b.string
            .transform((value) => value.trim())
            .transform((value) => value.toLowerCase())
            .transform((value) => value.replace(/\s+/g, "-"))
            .transform((value) => value.replace(/[^a-z0-9-]/g, ""))
        )
        .build();

      const result = validator.validate({ text: "  Hello World! 123  " });
      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({ text: "hello-world-123" });
    });

    test("変換とバリデーションの組み合わせ", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .use(requiredPlugin)
        .for<{ username: string }>()
        .v("username", (b) =>
          b.string
            .required()
            .transform((value) => value.trim().toLowerCase())
            .min(3)
            .transform((value) => value.replace(/[^a-z0-9]/g, ""))
        )
        .build();

      // 変換前: '  John123!  '
      // 1. trim + toLowerCase: 'john123!'
      // 2. min(3) validation: passes (length = 8)
      // 3. remove non-alphanumeric: 'john123'
      const result = validator.validate({ username: "  John123!  " });
      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({ username: "john123" });
    });
  });

  describe("型変換", () => {
    test("文字列から数値への変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(numberMinPlugin)
        .for<{ age: number }>()
        .v("age", (b) =>
          b.string.transform((value: string) => parseInt(value, 10)).min(18)
        )
        .build();

      const result = validator.validate({ age: "25" as any });
      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({ age: 25 });

      const result2 = validator.validate({ age: "16" as any });
      expect(result2.valid).toBe(false);
    });

    test("数値から文字列への変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ id: string }>()
        .v("id", (b) =>
          b.number
            .transform(
              (value: number) => `ID-${value.toString().padStart(4, "0")}`
            )
            .min(6)
        )
        .build();

      const result = validator.validate({ id: 123 as any });
      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({ id: "ID-0123" });
    });

    test("配列から文字列への変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ tags: string }>()
        .v("tags", (b) =>
          b.array.transform((value: string[]) => value.join(", ")).min(5)
        )
        .build();

      const result = validator.validate({
        tags: ["react", "vue", "angular"] as any,
      });
      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({ tags: "react, vue, angular" });
    });
  });

  describe("エラー処理", () => {
    test("変換中のエラーを適切に処理", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ data: any }>()
        .v("data", (b) =>
          b.string.transform((value: string) => {
            if (value === "error") {
              throw new Error("Transform error");
            }
            return value.toUpperCase();
          })
        )
        .build();

      // エラーを投げる変換
      const result1 = validator.validate({ data: "error" });
      expect(result1.valid).toBe(false);
      expect(result1.errors[0]).toMatchObject({
        path: "data",
        code: "transform",
      });

      // 正常な変換
      const result2 = validator.validate({ data: "success" });
      expect(result2.valid).toBe(true);
      expect(result2.data).toEqual({ data: "SUCCESS" });
    });

    test("無効な変換結果の処理", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ text: string }>()
        .v("text", (b) =>
          b.string.transform((value: string) => value.trim()).min(3)
        )
        .build();

      // 変換後に空文字列になってバリデーション失敗
      const result = validator.validate({ text: "   " });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "text",
        code: "stringMin",
      });
    });
  });

  describe("ネストしたオブジェクトでの変換", () => {
    test("ネストしたフィールドの変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ user: { name: string; email: string } }>()
        .v("user.name", (b) =>
          b.string.transform((value) => value.trim().toUpperCase())
        )
        .v("user.email", (b) =>
          b.string.transform((value) => value.toLowerCase())
        )
        .build();

      const result = validator.validate({
        user: {
          name: "  john doe  ",
          email: "JOHN@EXAMPLE.COM",
        },
      });

      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({
        user: {
          name: "JOHN DOE",
          email: "john@example.com",
        },
      });
    });

    test("オブジェクト全体の変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ profile: any }>()
        .v("profile", (b) =>
          b.object.transform((value: any) => ({
            fullName: `${value.firstName} ${value.lastName}`,
            email: value.email.toLowerCase(),
            age: parseInt(value.age, 10),
          }))
        )
        .build();

      const result = validator.validate({
        profile: {
          firstName: "John",
          lastName: "Doe",
          email: "JOHN@EXAMPLE.COM",
          age: "30",
        },
      });

      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({
        profile: {
          fullName: "John Doe",
          email: "john@example.com",
          age: 30,
        },
      });
    });
  });

  describe("実用的なシナリオ", () => {
    test("ユーザー入力の正規化", () => {
      interface UserInput {
        username: string;
        email: string;
        phone: string;
        website: string;
        tags: string[];
      }

      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .use(requiredPlugin)
        .for<UserInput>()
        .v("username", (b) =>
          b.string
            .required()
            .transform((value) => value.trim().toLowerCase())
            .min(3)
            .transform((value) => value.replace(/[^a-z0-9_]/g, ""))
        )
        .v("email", (b) =>
          b.string.required().transform((value) => value.trim().toLowerCase())
        )
        .v("phone", (b) =>
          b.string
            .required()
            .transform((value) => value.replace(/[^0-9]/g, ""))
            .min(10)
        )
        .v("website", (b) =>
          b.string.required().transform((value) => {
            let url = value.trim().toLowerCase();
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
              url = "https://" + url;
            }
            return url;
          })
        )
        .v("tags", (b) =>
          b.array.required().transform((value: string[]) =>
            value
              .map((tag) => tag.trim().toLowerCase())
              .filter((tag) => tag.length > 0)
              .filter((tag, index, arr) => arr.indexOf(tag) === index)
          )
        )
        .build();

      const input = {
        username: "  John_Doe123!  ",
        email: "  JOHN@EXAMPLE.COM  ",
        phone: "+1 (555) 123-4567",
        website: "example.com",
        tags: ["  React  ", "javascript", "REACT", "", "node.js"],
      };

      const result = validator.validate(input);
      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({
        username: "john_doe123",
        email: "john@example.com",
        phone: "15551234567",
        website: "https://example.com",
        tags: ["react", "javascript", "node.js"],
      });
    });

    test("フォームデータの処理", () => {
      interface FormData {
        price: number;
        discount: number;
        description: string;
        keywords: string;
        metadata: any;
      }

      const validator = Builder()
        .use(transformPlugin)
        .use(numberMinPlugin)
        .use(stringMinPlugin)
        .for<FormData>()
        .v("price", (b) =>
          b.string
            .transform((value: string) =>
              parseFloat(value.replace(/[^0-9.]/g, ""))
            )
            .min(0)
        )
        .v("discount", (b) =>
          b.string.transform((value: string) => {
            const num = parseFloat(value.replace(/[^0-9.]/g, ""));
            return Math.max(0, Math.min(100, num)); // 0-100の範囲に制限
          })
        )
        .v("description", (b) =>
          b.string
            .transform((value) => value.trim().replace(/\s+/g, " "))
            .min(10)
        )
        .v("keywords", (b) =>
          b.string.transform((value) =>
            value
              .toLowerCase()
              .split(",")
              .map((k) => k.trim())
              .filter((k) => k.length > 0)
              .join(", ")
          )
        )
        .v("metadata", (b) =>
          b.object.transform((value: any) => ({
            ...value,
            createdAt: new Date().toISOString(),
            processed: true,
          }))
        )
        .build();

      const input = {
        price: "$29.99",
        discount: "150%", // 100%を超える値
        description: "  This   is  a   great   product  ",
        keywords: "JAVASCRIPT,  react,   vue, ",
        metadata: { source: "web", priority: "high" },
      };

      const result = validator.validate(input as any);
      expect(result.isValid()).toBe(true);
      expect(result.data.price).toBe(29.99);
      expect(result.data.discount).toBe(100);
      expect(result.data.description).toBe("This is a great product");
      expect(result.data.keywords).toBe("javascript, react, vue");
      expect(result.data.metadata.processed).toBe(true);
      expect(result.data.metadata.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    test("APIデータの変換", () => {
      interface ApiResponse {
        userId: string;
        timestamps: number[];
        coordinates: string;
        statusCode: number;
        message: string;
      }

      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<ApiResponse>()
        .v("userId", (b) =>
          b.number.transform(
            (value: number) => `user_${value.toString().padStart(6, "0")}`
          )
        )
        .v("timestamps", (b) =>
          b.array.transform((value: string[]) =>
            value.map((ts) => new Date(ts).getTime()).sort((a, b) => a - b)
          )
        )
        .v("coordinates", (b) =>
          b.array.transform((value: number[]) => `${value[0]},${value[1]}`)
        )
        .v("statusCode", (b) =>
          b.string.transform((value: string) => parseInt(value, 10))
        )
        .v("message", (b) =>
          b.string
            .transform(
              (value) =>
                value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
            )
            .min(5)
        )
        .build();

      const input = {
        userId: 12345,
        timestamps: [
          "2023-01-01T10:00:00Z",
          "2023-01-01T09:00:00Z",
          "2023-01-01T11:00:00Z",
        ],
        coordinates: [40.7128, -74.006],
        statusCode: "200",
        message: "SUCCESS RESPONSE",
      };

      const result = validator.validate(input as any);
      expect(result.isValid()).toBe(true);
      expect(result.data.userId).toBe("user_012345");
      expect(result.data.coordinates).toBe("40.7128,-74.006");
      expect(result.data.statusCode).toBe(200);
      expect(result.data.message).toBe("Success response");
      expect(result.data.timestamps).toEqual([
        new Date("2023-01-01T09:00:00Z").getTime(),
        new Date("2023-01-01T10:00:00Z").getTime(),
        new Date("2023-01-01T11:00:00Z").getTime(),
      ]);
    });

    test("設定データの正規化", () => {
      interface Configuration {
        environment: string;
        debug: boolean;
        logLevel: string;
        timeout: number;
        features: string[];
        database: any;
      }

      const validator = Builder()
        .use(transformPlugin)
        .for<Configuration>()
        .v("environment", (b) =>
          b.string.transform((value) => value.toLowerCase().trim())
        )
        .v("debug", (b) =>
          b.string.transform((value: string) => {
            const lower = value.toLowerCase();
            return lower === "true" || lower === "1" || lower === "yes";
          })
        )
        .v("logLevel", (b) =>
          b.string.transform((value) => {
            const levels = ["error", "warn", "info", "debug"];
            const level = value.toLowerCase();
            return levels.includes(level) ? level : "info";
          })
        )
        .v("timeout", (b) =>
          b.string.transform((value: string) => {
            const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
            return Math.max(1000, Math.min(60000, num)); // 1秒-60秒の範囲
          })
        )
        .v("features", (b) =>
          b.string.transform((value: string) =>
            value
              .split(",")
              .map((f) => f.trim())
              .filter((f) => f.length > 0)
          )
        )
        .v("database", (b) =>
          b.object.transform((value: any) => ({
            host: value.host || "localhost",
            port: parseInt(value.port, 10) || 5432,
            name: value.database || value.name || "default",
            ssl: value.ssl === "true" || value.ssl === true,
          }))
        )
        .build();

      const input = {
        environment: "  PRODUCTION  ",
        debug: "TRUE",
        logLevel: "VERBOSE", // 無効なレベル
        timeout: "30000ms",
        features: "auth, payments, analytics",
        database: {
          host: "db.example.com",
          port: "3306",
          database: "myapp",
          ssl: "true",
        },
      };

      const result = validator.validate(input as any);
      expect(result.isValid()).toBe(true);
      expect(result.data).toEqual({
        environment: "production",
        debug: true,
        logLevel: "info", // デフォルトにフォールバック
        timeout: 30000,
        features: ["auth", "payments", "analytics"],
        database: {
          host: "db.example.com",
          port: 3306,
          name: "myapp",
          ssl: true,
        },
      });
    });
  });

  describe("パフォーマンス", () => {
    test("大量データの変換", () => {
      const validator = Builder()
        .use(transformPlugin)
        .for<{ items: any[] }>()
        .v("items", (b) =>
          b.array.transform((value: any[]) =>
            value.map((item) => ({
              ...item,
              processed: true,
              id: `item_${item.id}`,
            }))
          )
        )
        .build();

      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
      }));
      const start = Date.now();
      const result = validator.validate({ items: largeArray });
      const end = Date.now();

      expect(result.isValid()).toBe(true);
      expect(result.data.items).toHaveLength(1000);
      expect(result.data.items[0]).toMatchObject({
        id: "item_0",
        name: "Item 0",
        processed: true,
      });
      expect(end - start).toBeLessThan(100); // 100ms未満で完了
    });
  });
});
