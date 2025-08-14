import { describe, test, expect } from "@jest/globals";
import {
  Builder,
  requiredPlugin,
  stringMinPlugin,
  stringEmailPlugin,
  transformPlugin,
} from "../../src";

describe("Fast Validator Performance Test", () => {
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

  describe("Fast vs Slow Validator Comparison", () => {
    test("Fast validator (no preprocess/postprocess)", () => {
      // Simple validation without preprocess/postprocess (should use fast path)
      const fastValidator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringEmailPlugin)
        .for<SimpleUser>()
        .v("name", (b) => b.string.required().min(3))
        .v("email", (b) => b.string.required().email())
        .build();

      const testData = {
        name: "John Doe",
        email: "john.doe@example.com",
        age: 30,
      };

      const result = measurePerformance(
        "🚀 Fast validator (simple fields)",
        () => {
          const validationResult = fastValidator.validate(testData);
          if (!validationResult.isValid()) {
            throw new Error("Fast validation failed");
          }
        },
        100000
      );

      console.log(`🎯 Target: 800,000+ ops/sec for fast validator`);
      console.log(
        `✅ Fast validator ${result.ops >= 800000 ? "ACHIEVED" : "FAILED"} target!`
      );

      // Expect fast validator to achieve at least 800k ops/sec
      expect(result.ops).toBeGreaterThan(800000);
    });

    test("Slow validator (with postprocess)", () => {
      // Validation with postprocess (should use slow path)
      const slowValidator = Builder()
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
        "🐌 Slow validator (with postprocess)",
        () => {
          const validationResult = slowValidator.validate(testData);
          if (!validationResult.isValid()) {
            throw new Error("Slow validation failed");
          }
        },
        100000
      );

      // Slow validator should still be reasonably fast (at least 50k ops/sec)
      expect(result.ops).toBeGreaterThan(50000);
    });

    test("Performance comparison test", () => {
      console.log("\n=== Fast vs Slow Validator Performance Analysis ===");

      // Setup validators
      const fastValidator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringEmailPlugin)
        .for<SimpleUser>()
        .v("name", (b) => b.string.required().min(3))
        .v("email", (b) => b.string.required().email())
        .build();

      const slowValidator = Builder()
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
        email: "john.doe@example.com",
        age: 30,
      };

      const fastResult = measurePerformance(
        "Fast Path",
        () => fastValidator.validate(testData),
        100000
      );

      const slowResult = measurePerformance(
        "Slow Path",
        () => slowValidator.validate(testData),
        100000
      );

      const speedupRatio = fastResult.ops / slowResult.ops;

      console.log(`\n📊 Performance Analysis:`);
      console.log(
        `   Fast validator: ${fastResult.ops.toLocaleString()} ops/sec`
      );
      console.log(
        `   Slow validator: ${slowResult.ops.toLocaleString()} ops/sec`
      );
      console.log(`   Speed ratio: ${speedupRatio.toFixed(2)}x faster`);
      console.log(`\n🎯 Target Achievement:`);
      console.log(
        `   800k ops/sec target: ${fastResult.ops >= 800000 ? "✅ ACHIEVED" : "❌ FAILED"}`
      );
      console.log(
        `   Expected speedup: ${speedupRatio >= 2 ? "✅ GOOD" : "⚠️  NEEDS IMPROVEMENT"} (${speedupRatio.toFixed(2)}x)`
      );

      // The fast validator should be significantly faster
      expect(speedupRatio).toBeGreaterThan(2);

      // The fast validator should achieve the 800k target
      expect(fastResult.ops).toBeGreaterThan(800000);
    });
  });
});
