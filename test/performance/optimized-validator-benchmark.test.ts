import { describe, test, expect } from "@jest/globals";
import {
  Builder,
  requiredPlugin,
  stringMinPlugin,
  stringEmailPlugin,
  transformPlugin,
} from "../../src";

describe("Optimized Validator Benchmark", () => {
  // パフォーマンス測定用のヘルパー関数
  const measurePerformance = (
    name: string,
    fn: () => void,
    iterations: number = 100000
  ): { total: number; average: number; ops: number } => {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      fn();
    }

    const end = performance.now();
    const total = end - start;
    const average = total / iterations;
    const ops = Math.round(iterations / (total / 1000)); // operations per second

    console.log(
      `${name}: ${total.toFixed(2)}ms total, ${average.toFixed(4)}ms/op, ${ops.toLocaleString()} ops/sec`
    );

    return { total, average, ops };
  };

  type SimpleUser = {
    name: string;
    email: string;
    age: number;
  };

  describe("Parse Mode Performance with Transforms", () => {
    test("Simple transform validator - parse mode", () => {
      // Simple validation with one transform
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringEmailPlugin)
        .use(transformPlugin)
        .for<SimpleUser>()
        .v("name", (b) => b.string.required().min(3))
        .v("email", (b) =>
          b.string
            .required()
            .email()
            .transform((v) => v.toLowerCase())
        )
        .build();

      const testData = {
        name: "John Doe",
        email: "JOHN.DOE@EXAMPLE.COM",
        age: 30,
      };

      const result = measurePerformance(
        "📊 Parse mode with 1 transform",
        () => {
          const parseResult = validator.parse(testData);
          if (!parseresult.isValid()) {
            throw new Error("Parse validation failed");
          }
        },
        100000
      );

      console.log(`🎯 Target: 800,000+ ops/sec`);
      console.log(
        `${result.ops >= 800000 ? "✅ ACHIEVED" : "❌ FAILED"} target!`
      );

      // Expect to achieve at least 800k ops/sec
      expect(result.ops).toBeGreaterThan(800000);
    });

    test("Multiple transform validator - parse mode", () => {
      // Validation with multiple transforms
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<SimpleUser>()
        .v("name", (b) =>
          b.string
            .required()
            .min(3)
            .transform((v) => v.trim())
            .transform((v) => v.toUpperCase())
        )
        .v("email", (b) =>
          b.string
            .required()
            .min(5)
            .transform((v) => v.toLowerCase())
            .transform((v) => v.trim())
        )
        .build();

      const testData = {
        name: "  John Doe  ",
        email: "  JOHN.DOE@EXAMPLE.COM  ",
        age: 30,
      };

      const result = measurePerformance(
        "📊 Parse mode with 4 transforms (2 per field)",
        () => {
          const parseResult = validator.parse(testData);
          if (!parseresult.isValid()) {
            throw new Error("Parse validation failed");
          }
        },
        100000
      );

      console.log(`🎯 Target: 600,000+ ops/sec (multiple transforms)`);
      console.log(
        `${result.ops >= 600000 ? "✅ ACHIEVED" : "❌ FAILED"} target!`
      );

      // Expect reasonable performance even with multiple transforms
      expect(result.ops).toBeGreaterThan(600000);
    });

    test("Validate mode should skip transforms", () => {
      // Same validator with transforms
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringEmailPlugin)
        .use(transformPlugin)
        .for<SimpleUser>()
        .v("name", (b) => b.string.required().min(3))
        .v("email", (b) =>
          b.string
            .required()
            .email()
            .transform((v) => v.toLowerCase())
        )
        .build();

      const testData = {
        name: "John Doe",
        email: "JOHN.DOE@EXAMPLE.COM",
        age: 30,
      };

      const validateResult = measurePerformance(
        "📊 Validate mode (should skip transforms)",
        () => {
          const result = validator.validate(testData);
          if (!result.isValid()) {
            throw new Error("Validation failed");
          }
        },
        100000
      );

      const parseResult = measurePerformance(
        "📊 Parse mode (executes transforms)",
        () => {
          const result = validator.parse(testData);
          if (!result.isValid()) {
            throw new Error("Parse failed");
          }
        },
        100000
      );

      console.log(`\n📈 Performance difference:`);
      console.log(
        `   Validate: ${validateResult.ops.toLocaleString()} ops/sec`
      );
      console.log(`   Parse: ${parseResult.ops.toLocaleString()} ops/sec`);
      console.log(
        `   Validate is ${(validateResult.ops / parseResult.ops).toFixed(2)}x faster (transforms skipped)`
      );

      // Validate should be significantly faster since it skips transforms
      expect(validateResult.ops).toBeGreaterThan(parseResult.ops * 1.5);
    });
  });
});
