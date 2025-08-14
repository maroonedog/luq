import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src";
import * as plugins from "../../src/core/plugin";

describe("パフォーマンスベンチマーク", () => {
  // パフォーマンス測定用のヘルパー関数
  const measurePerformance = (
    name: string,
    fn: () => void,
    iterations: number = 1000
  ): { total: number; average: number; ops: number } => {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      fn();
    }

    const end = performance.now();
    const total = end - start;
    const average = total / iterations;
    const ops = 1000 / average; // operations per second

    console.log(
      `${name}: ${average.toFixed(3)}ms/op, ${ops.toFixed(0)} ops/sec`
    );

    return { total, average, ops };
  };

  describe("シンプルなバリデーション", () => {
    const createSimpleValidator = () => {
      return Builder()
        .use(plugins.requiredPlugin)
        .use(plugins.stringMinPlugin)
        .use(plugins.stringMaxPlugin)
        .use(plugins.stringEmailPlugin)
        .for<{
          name: string;
          email: string;
          age: number;
        }>()
        .v("name", (b) => b.string.required().min(2).max(50))
        .v("email", (b) => b.string.required().email())
        .v("age", (b) => b.number.required())
        .build();
    };

    test("有効なデータのバリデーション速度", () => {
      const validator = createSimpleValidator();
      const validData = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      };

      const result = measurePerformance(
        "Simple Valid",
        () => {
          validator.validate(validData);
        },
        10000
      );

      // 1回のバリデーションが0.1ms未満であることを確認
      expect(result.average).toBeLessThan(0.1);
      // 10,000 ops/sec 以上であることを確認
      expect(result.ops).toBeGreaterThan(10000);
    });

    test("無効なデータのバリデーション速度", () => {
      const validator = createSimpleValidator();
      const invalidData = {
        name: "J", // 短すぎる
        email: "invalid-email", // 無効なメール
        age: -5, // 負の数（エラーではないが記録のため）
      };

      const result = measurePerformance(
        "Simple Invalid",
        () => {
          validator.validate(invalidData);
        },
        10000
      );

      // エラーがあっても0.2ms未満であることを確認
      expect(result.average).toBeLessThan(0.2);
    });
  });

  describe("複雑なバリデーション", () => {
    interface ComplexData {
      user: {
        id: string;
        profile: {
          firstName: string;
          lastName: string;
          email: string;
          phone?: string;
        };
        settings: {
          notifications: boolean;
          theme: "light" | "dark";
          language: string;
        };
      };
      items: Array<{
        id: number;
        name: string;
        quantity: number;
        price: number;
      }>;
      metadata: {
        created: Date;
        updated: Date;
        tags: string[];
      };
    }

    const createComplexValidator = () => {
      return (
        Builder()
          .use(plugins.requiredPlugin)
          .use(plugins.optionalPlugin)
          .use(plugins.stringMinPlugin)
          .use(plugins.stringMaxPlugin)
          .use(plugins.stringPatternPlugin)
          .use(plugins.stringEmailPlugin)
          .use(plugins.numberMinPlugin)
          .use(plugins.numberPositivePlugin)
          .use(plugins.numberIntegerPlugin)
          .use(plugins.arrayMinLengthPlugin)
          .use(plugins.arrayMaxLengthPlugin)
          .use(plugins.oneOfPlugin)
          .use(plugins.booleanTruthyPlugin)
          .for<ComplexData>()
          .v("user.id", (b) => b.string.required().pattern(/^[A-Z0-9]{8}$/))
          .v("user.profile.firstName", (b) =>
            b.string.required().min(1).max(50)
          )
          .v("user.profile.lastName", (b) =>
            b.string.required().min(1).max(50)
          )
          .v("user.profile.email", (b) => b.string.required().email())
          .v("user.profile.phone", (b) =>
            b.string.optional().pattern(/^\+?[\d\s-()]+$/)
          )
          .v("user.settings.notifications", (b) => b.boolean.required())
          .v("user.settings.theme", (b) =>
            b.string.required().oneOf(["light", "dark"])
          )
          .v("user.settings.language", (b) =>
            b.string.required().min(2).max(5)
          )
          // 配列の特定インデックスへのバリデーションはサポートされていないため、配列全体のみをバリデーション
          .v("items", (b) => b.array.required().minLength(1).maxLength(100))
          .v("metadata.tags", (b) =>
            b.array.required().minLength(0).maxLength(20)
          )
          .build()
      );
    };

    test("複雑な有効データのバリデーション速度", () => {
      const validator = createComplexValidator();
      const validData: ComplexData = {
        user: {
          id: "ABC12345",
          profile: {
            firstName: "Alice",
            lastName: "Johnson",
            email: "alice@example.com",
            phone: "+1-234-567-8900",
          },
          settings: {
            notifications: true,
            theme: "dark",
            language: "en",
          },
        },
        items: [
          { id: 1, name: "Product A", quantity: 2, price: 29.99 },
          { id: 2, name: "Product B", quantity: 1, price: 49.99 },
        ],
        metadata: {
          created: new Date(),
          updated: new Date(),
          tags: ["new", "featured", "sale"],
        },
      };

      const result = measurePerformance(
        "Complex Valid",
        () => {
          validator.validate(validData);
        },
        1000
      );

      // 複雑なバリデーションでも1ms未満であることを確認
      expect(result.average).toBeLessThan(1);
    });
  });

  describe("大量フィールドのバリデーション", () => {
    test("100フィールドのバリデーション速度", () => {
      const fieldCount = 100;
      let builder = Builder()
        .use(plugins.requiredPlugin)
        .use(plugins.stringMinPlugin)
        .use(plugins.stringMaxPlugin)
        .for<any>();

      // 100個のフィールドを追加
      for (let i = 0; i < fieldCount; i++) {
        builder = builder.v(`field${i}`, (b) =>
          b.string.required().min(1).max(100)
        );
      }

      const validator = builder.build();

      // テストデータ生成
      const data: any = {};
      for (let i = 0; i < fieldCount; i++) {
        data[`field${i}`] = `value${i}`;
      }

      const result = measurePerformance(
        "100 Fields",
        () => {
          validator.validate(data);
        },
        100
      );

      // 100フィールドでも10ms未満であることを確認
      expect(result.average).toBeLessThan(10);
    });

    test("1000フィールドのバリデーション速度", () => {
      const fieldCount = 1000;
      let builder = Builder()
        .use(plugins.requiredPlugin)
        .use(plugins.stringMinPlugin)
        .for<any>();

      // 1000個のフィールドを追加
      for (let i = 0; i < fieldCount; i++) {
        builder = builder.v(`field${i}`, (b) => b.string.required().min(1));
      }

      const validator = builder.build();

      // テストデータ生成
      const data: any = {};
      for (let i = 0; i < fieldCount; i++) {
        data[`field${i}`] = `value${i}`;
      }

      const result = measurePerformance(
        "1000 Fields",
        () => {
          validator.validate(data);
        },
        10
      );

      // 1000フィールドでも100ms未満であることを確認
      expect(result.average).toBeLessThan(100);
    });
  });

  describe("配列要素のバリデーション", () => {
    test("大きな配列のバリデーション速度", () => {
      const validator = Builder()
        .use(plugins.requiredPlugin)
        .use(plugins.arrayMinLengthPlugin)
        .use(plugins.arrayMaxLengthPlugin)
        .for<{ items: number[] }>()
        .v("items", (b) => b.array.required().minLength(1).maxLength(10000))
        .build();

      // 1000要素の配列
      const data = {
        items: Array.from({ length: 1000 }, (_, i) => i),
      };

      const result = measurePerformance(
        "1000 Array Elements",
        () => {
          validator.validate(data);
        },
        1000
      );

      // 1000要素でも0.5ms未満であることを確認
      expect(result.average).toBeLessThan(0.5);
    });
  });

  describe("条件付きバリデーション", () => {
    test("複雑な条件付きバリデーションの速度", () => {
      interface ConditionalForm {
        type: "a" | "b" | "c";
        fieldA?: string;
        fieldB?: number;
        fieldC?: boolean;
        nested?: {
          subType: "x" | "y" | "z";
          subFieldX?: string;
          subFieldY?: number;
          subFieldZ?: boolean;
        };
      }

      const validator = Builder()
        .use(plugins.requiredPlugin)
        .use(plugins.requiredIfPlugin)
        .use(plugins.stringMinPlugin)
        .use(plugins.numberMinPlugin)
        .for<ConditionalForm>()
        .v("type", (b) => b.string.required())
        .v("fieldA", (b) =>
          b.string.requiredIf((d) => d.type === "a").min(5)
        )
        .v("fieldB", (b) =>
          b.number.requiredIf((d) => d.type === "b").min(10)
        )
        .v("fieldC", (b) => b.boolean.requiredIf((d) => d.type === "c"))
        .v("nested.subType", (b) =>
          b.string.requiredIf((d) => d.nested !== undefined)
        )
        .v("nested.subFieldX", (b) =>
          b.string.requiredIf((d) => d.nested?.subType === "x")
        )
        .v("nested.subFieldY", (b) =>
          b.number.requiredIf((d) => d.nested?.subType === "y")
        )
        .v("nested.subFieldZ", (b) =>
          b.boolean.requiredIf((d) => d.nested?.subType === "z")
        )
        .build();

      const testData: ConditionalForm = {
        type: "a",
        fieldA: "test value",
        nested: {
          subType: "x",
          subFieldX: "nested value",
        },
      };

      const result = measurePerformance(
        "Conditional Validation",
        () => {
          validator.validate(testData);
        },
        1000
      );

      // 条件付きバリデーションでも1ms未満であることを確認
      expect(result.average).toBeLessThan(1);
    });
  });

  describe("Transform処理のパフォーマンス", () => {
    test("複数のtransform処理の速度", () => {
      const validator = Builder()
        .use(plugins.requiredPlugin)
        .use(plugins.transformPlugin)
        .for<{
          text: string;
          number: string;
          json: string;
          csv: string;
        }>()
        .v("text", (b) =>
          b.string
            .required()
            .transform((v) => v.trim())
            .transform((v) => v.toLowerCase())
            .transform((v) => v.replace(/\s+/g, " "))
        )
        .v("number", (b) =>
          b.string
            .required()
            .transform((v) => parseInt(v, 10))
            .transform((v) => Math.max(0, v))
            .transform((v) => Math.min(100, v))
        )
        .v("json", (b) =>
          b.string
            .required()
            .transform((v) => JSON.parse(v))
            .transform((v) => ({ ...v, processed: true }))
            .transform((v) => JSON.stringify(v))
        )
        .v("csv", (b) =>
          b.string
            .required()
            .transform((v) => v.split(","))
            .transform((v) => v.map((s) => s.trim()))
            .transform((v) => v.filter((s) => s.length > 0))
            .transform((v) => v.join(","))
        )
        .build();

      const data = {
        text: "  HELLO   WORLD  ",
        number: "150",
        json: '{"name":"test","value":123}',
        csv: "a, b, , c,  d  ",
      };

      const result = measurePerformance(
        "Multiple Transforms",
        () => {
          validator.validate(data);
        },
        1000
      );

      // 複数のtransformでも2ms未満であることを確認
      expect(result.average).toBeLessThan(2);
    });
  });

  describe("メモリ使用量の観点", () => {
    test("バリデーター作成のメモリ効率", () => {
      const createValidator = () => {
        return Builder()
          .use(plugins.requiredPlugin)
          .use(plugins.stringMinPlugin)
          .for<{ value: string }>()
          .v("value", (b) => b.string.required().min(1))
          .build();
      };

      // 100個のバリデーターを作成
      const validators: any[] = [];
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        validators.push(createValidator());
      }

      const end = performance.now();
      const timePerCreation = (end - start) / 100;

      // バリデーター作成が1ms未満であることを確認
      expect(timePerCreation).toBeLessThan(1);

      // すべてのバリデーターが独立して動作することを確認
      const testData = { value: "test" };
      validators.forEach((v) => {
        expect(v.validate(testData).valid).toBe(true);
      });
    });
  });

  describe("ベンチマーク結果の妥当性検証", () => {
    test("パフォーマンスが表示されている数値と一致するか", () => {
      console.log("\n=== Luq Performance Benchmark Results ===\n");

      // シンプルなバリデーション
      const simpleValidator = Builder()
        .use(plugins.requiredPlugin)
        .use(plugins.stringMinPlugin)
        .use(plugins.stringEmailPlugin)
        .for<{ email: string }>()
        .v("email", (b) => b.string.required().email())
        .build();

      const simpleValid = measurePerformance(
        "Simple (valid)",
        () => simpleValidator.validate({ email: "test@example.com" }),
        10000
      );

      const simpleInvalid = measurePerformance(
        "Simple (invalid)",
        () => simpleValidator.validate({ email: "invalid" }),
        10000
      );

      // 複雑なバリデーション
      const complexValidator = Builder()
        .use(plugins.requiredPlugin)
        .use(plugins.stringMinPlugin)
        .use(plugins.numberMinPlugin)
        .use(plugins.arrayMinLengthPlugin)
        .use(plugins.objectPlugin)
        .for<{
          user: { name: string; age: number };
          items: Array<{ id: number; name: string }>;
        }>()
        .v("user.name", (b) => b.string.required().min(2))
        .v("user.age", (b) => b.number.required().min(0))
        .v("items", (b) => b.array.required().minLength(1))
        .build();

      const complexValid = measurePerformance(
        "Complex (valid)",
        () =>
          complexValidator.validate({
            user: { name: "John", age: 30 },
            items: [{ id: 1, name: "Item" }],
          }),
        10000
      );

      const complexInvalid = measurePerformance(
        "Complex (invalid)",
        () =>
          complexValidator.validate({
            user: { name: "J", age: -1 },
            items: [],
          }),
        10000
      );

      console.log("\n========================================\n");

      // ベンチマーク結果の妥当性確認
      // シンプルなケースは非常に高速であるべき
      expect(simpleValid.ops).toBeGreaterThan(100000); // 100k ops/sec以上

      // 複雑なケースでも十分高速であるべき
      expect(complexValid.ops).toBeGreaterThan(10000); // 10k ops/sec以上

      // 無効なデータでも大きな性能劣化はないはず
      expect(simpleInvalid.ops).toBeGreaterThan(50000); // 50k ops/sec以上
      expect(complexInvalid.ops).toBeGreaterThan(5000); // 5k ops/sec以上
    });
  });
});
