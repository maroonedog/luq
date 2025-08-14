import { describe, test, expect } from "@jest/globals";
import {
  Builder,
  requiredPlugin,
  stringMinPlugin,
  transformPlugin,
} from "../../src";

describe("V8 Optimization Benchmark", () => {
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

  describe("Single Field Optimization", () => {
    test("Single field - no transform", () => {
      type SingleField = {
        value: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<SingleField>()
        .v("value", (b) => b.string.required().min(3))
        .build();

      const testData = { value: "test123" };

      const validateResult = measurePerformance(
        "Single field validate",
        () => {
          const result = validator.validate(testData);
          if (!result.isValid()) throw new Error("Failed");
        },
        100000
      );

      const parseResult = measurePerformance(
        "Single field parse (no transform)",
        () => {
          const result = validator.parse(testData);
          if (!result.isValid()) throw new Error("Failed");
        },
        100000
      );

      console.log(
        `Parse/Validate ratio: ${(parseResult.ops / validateResult.ops).toFixed(2)}`
      );

      // Single field should be extremely fast
      expect(validateResult.ops).toBeGreaterThan(1000000);
      expect(parseResult.ops).toBeGreaterThan(900000);
    });

    test("Single field - with transform", () => {
      type SingleField = {
        value: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<SingleField>()
        .v("value", (b) =>
          b.string
            .required()
            .min(3)
            .transform((v) => v.toLowerCase())
        )
        .build();

      const testData = { value: "TEST123" };

      const validateResult = measurePerformance(
        "Single field validate (transform ignored)",
        () => {
          const result = validator.validate(testData);
          if (!result.isValid()) throw new Error("Failed");
        },
        100000
      );

      const parseResult = measurePerformance(
        "Single field parse (with transform)",
        () => {
          const result = validator.parse(testData);
          if (!result.isValid()) throw new Error("Failed");
        },
        100000
      );

      console.log(
        `\nTransform overhead: ${(((validateResult.ops - parseResult.ops) / validateResult.ops) * 100).toFixed(1)}%`
      );
      console.log(
        `Parse performance: ${parseResult.ops.toLocaleString()} ops/sec`
      );

      // Target: 800K+ ops/sec even with transform
      expect(parseResult.ops).toBeGreaterThan(800000);
    });

    test("Progressive field count impact", () => {
      console.log("\n=== Field Count Impact Analysis ===");

      // Test with 1, 2, 3, 5 fields
      const fieldCounts = [1, 2, 3, 5];
      const results: any[] = [];

      for (const count of fieldCounts) {
        type TestObject = Record<string, string>;

        const builder = Builder()
          .use(requiredPlugin)
          .use(stringMinPlugin)
          .use(transformPlugin)
          .for<TestObject>();

        const testData: TestObject = {};

        // Add fields dynamically
        for (let i = 0; i < count; i++) {
          const fieldName = `field${i}`;
          builder.v(fieldName, (b) =>
            b.string
              .required()
              .min(3)
              .transform((v) => v.toLowerCase())
          );
          testData[fieldName] = `VALUE${i}`;
        }

        const validator = builder.build();

        const result = measurePerformance(
          `${count} field(s) parse`,
          () => {
            const parseResult = validator.parse(testData);
            if (!parseResult.isValid()) throw new Error("Failed");
          },
          100000
        );

        results.push({ count, ops: result.ops });
      }

      // Analyze performance degradation
      console.log("\n📊 Performance by field count:");
      results.forEach((r, i) => {
        const degradation =
          i > 0
            ? (((results[0].ops - r.ops) / results[0].ops) * 100).toFixed(1)
            : "0";
        console.log(
          `   ${r.count} field(s): ${r.ops.toLocaleString()} ops/sec (${degradation}% degradation)`
        );
      });

      // Single field with transform should achieve 800K+
      expect(results[0].ops).toBeGreaterThan(800000);
    });

    test("Transform complexity impact", () => {
      console.log("\n=== Transform Complexity Analysis ===");

      type SingleField = { value: string };

      // No transform
      const noTransform = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<SingleField>()
        .v("value", (b) => b.string.required().min(3))
        .build();

      // Single transform
      const singleTransform = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<SingleField>()
        .v("value", (b) =>
          b.string
            .required()
            .min(3)
            .transform((v) => v.toLowerCase())
        )
        .build();

      // Double transform
      const doubleTransform = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<SingleField>()
        .v("value", (b) =>
          b.string
            .required()
            .min(3)
            .transform((v) => v.trim())
            .transform((v) => v.toLowerCase())
        )
        .build();

      const testData = { value: "  TEST123  " };

      const noTransformResult = measurePerformance(
        "No transform",
        () => {
          const result = noTransform.parse(testData);
          if (!result.isValid()) throw new Error("Failed");
        },
        100000
      );

      const singleResult = measurePerformance(
        "Single transform",
        () => {
          const result = singleTransform.parse(testData);
          if (!result.isValid()) throw new Error("Failed");
        },
        100000
      );

      const doubleResult = measurePerformance(
        "Double transform",
        () => {
          const result = doubleTransform.parse(testData);
          if (!result.isValid()) throw new Error("Failed");
        },
        100000
      );

      console.log("\n📊 Transform impact:");
      console.log(
        `   No transform: ${noTransformResult.ops.toLocaleString()} ops/sec (baseline)`
      );
      console.log(
        `   Single transform: ${singleResult.ops.toLocaleString()} ops/sec (${(((noTransformResult.ops - singleResult.ops) / noTransformResult.ops) * 100).toFixed(1)}% overhead)`
      );
      console.log(
        `   Double transform: ${doubleResult.ops.toLocaleString()} ops/sec (${(((noTransformResult.ops - doubleResult.ops) / noTransformResult.ops) * 100).toFixed(1)}% overhead)`
      );

      // Single transform should achieve 800K+
      expect(singleResult.ops).toBeGreaterThan(800000);
    });
  });
});
