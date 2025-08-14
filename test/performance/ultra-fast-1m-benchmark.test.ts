import { describe, test, expect } from "@jest/globals";
import {
  Builder,
  requiredPlugin,
  stringMinPlugin,
  transformPlugin,
} from "../../src";

describe("Ultra-Fast 1M ops/sec Benchmark", () => {
  // Enable ultra-fast mode
  beforeAll(() => {
    (global as any).__LUQ_ULTRA_FAST__ = true;
  });

  afterAll(() => {
    delete (global as any).__LUQ_ULTRA_FAST__;
  });

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
  };

  describe("Ultra-Fast Mode Performance", () => {
    test("Single field with transform - Ultra-fast mode", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<{ value: string }>()
        .v("value", (b) =>
          b.string
            .required()
            .min(3)
            .transform((v) => v.toLowerCase())
        )
        .build();

      const testData = { value: "TEST123" };

      const result = measurePerformance(
        "🚀 Ultra-fast single field",
        () => {
          const parseResult = validator.parse(testData);
          if (!parseresult.isValid()) {
            throw new Error("Parse validation failed");
          }
        },
        100000
      );

      console.log(`🎯 Target: 1,000,000+ ops/sec`);
      console.log(
        `${result.ops >= 1000000 ? "✅ ACHIEVED" : "❌ FAILED"} target!`
      );

      // Expect to achieve 1M+ ops/sec
      expect(result.ops).toBeGreaterThan(1000000);
    });

    test("Two fields with transform - Ultra-fast mode", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<SimpleUser>()
        .v("name", (b) => b.string.required().min(3))
        .v("email", (b) =>
          b.string
            .required()
            .min(5)
            .transform((v) => v.toLowerCase())
        )
        .build();

      const testData = {
        name: "John Doe",
        email: "JOHN.DOE@EXAMPLE.COM",
      };

      const result = measurePerformance(
        "🚀 Ultra-fast two fields",
        () => {
          const parseResult = validator.parse(testData);
          if (!parseresult.isValid()) {
            throw new Error("Parse validation failed");
          }
        },
        100000
      );

      console.log(`🎯 Target: 800,000+ ops/sec (two fields)`);
      console.log(
        `${result.ops >= 800000 ? "✅ ACHIEVED" : "❌ FAILED"} target!`
      );

      // Expect good performance even with two fields
      expect(result.ops).toBeGreaterThan(800000);
    });

    test("Compare with standard mode", () => {
      // Disable ultra-fast mode temporarily
      delete (global as any).__LUQ_ULTRA_FAST__;

      const standardValidator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<{ value: string }>()
        .v("value", (b) =>
          b.string
            .required()
            .min(3)
            .transform((v) => v.toLowerCase())
        )
        .build();

      // Re-enable ultra-fast mode
      (global as any).__LUQ_ULTRA_FAST__ = true;

      const ultraFastValidator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<{ value: string }>()
        .v("value", (b) =>
          b.string
            .required()
            .min(3)
            .transform((v) => v.toLowerCase())
        )
        .build();

      const testData = { value: "TEST123" };

      const standardResult = measurePerformance(
        "Standard mode",
        () => {
          const parseResult = standardValidator.parse(testData);
          if (!parseresult.isValid()) throw new Error("Failed");
        },
        100000
      );

      const ultraFastResult = measurePerformance(
        "Ultra-fast mode",
        () => {
          const parseResult = ultraFastValidator.parse(testData);
          if (!parseresult.isValid()) throw new Error("Failed");
        },
        100000
      );

      const speedup = ultraFastResult.ops / standardResult.ops;

      console.log(`\n📊 Performance Comparison:`);
      console.log(
        `   Standard mode: ${standardResult.ops.toLocaleString()} ops/sec`
      );
      console.log(
        `   Ultra-fast mode: ${ultraFastResult.ops.toLocaleString()} ops/sec`
      );
      console.log(`   Speedup: ${speedup.toFixed(1)}x faster`);
      console.log(`\n🎯 1M ops/sec Achievement:`);
      console.log(
        `   ${ultraFastResult.ops >= 1000000 ? "✅ SUCCESS!" : "❌ Not yet..."} (${((ultraFastResult.ops / 1000000) * 100).toFixed(1)}% of target)`
      );

      // Ultra-fast should be significantly faster
      expect(speedup).toBeGreaterThan(1.5);
    });
  });
});
