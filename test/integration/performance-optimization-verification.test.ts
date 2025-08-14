/**
 * Performance Optimization Verification Tests
 *
 * This test suite verifies that performance optimizations are working correctly
 * and that the library meets its performance targets. It includes benchmarks,
 * regression detection, memory usage verification, and scalability tests.
 */

import {
  Builder,
  requiredPlugin,
  optionalPlugin,
  stringMinPlugin,
  stringMaxPlugin,
  numberMinPlugin,
  numberMaxPlugin,
  arrayMinLengthPlugin,
  arrayUniquePlugin,
  objectPlugin,
  oneOfPlugin,
  stringEmailPlugin,
  booleanTruthyPlugin,
  transformPlugin,
} from "../../src/index";

// Performance measurement utilities
interface PerformanceMetrics {
  operations: number;
  totalTimeMs: number;
  opsPerSecond: number;
  avgTimePerOpUs: number;
  memoryUsageMB?: number;
}

function measurePerformance(
  operation: () => void,
  iterations: number = 10000,
  warmupIterations: number = 1000
): PerformanceMetrics {
  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    operation();
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const initialMemory = process.memoryUsage();
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    operation();
  }

  const endTime = performance.now();
  const finalMemory = process.memoryUsage();

  const totalTimeMs = endTime - startTime;
  const opsPerSecond = (iterations / totalTimeMs) * 1000;
  const avgTimePerOpUs = (totalTimeMs * 1000) / iterations;
  const memoryUsageMB =
    (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

  return {
    operations: iterations,
    totalTimeMs,
    opsPerSecond,
    avgTimePerOpUs,
    memoryUsageMB,
  };
}

describe("Performance Optimization Verification", () => {
  describe("Core Performance Targets", () => {
    it("should achieve target performance for simple validation (≥100k ops/sec)", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(2))
        .build();

      const testData = { name: "John" };
      const metrics = measurePerformance(() => {
        validator.validate(testData);
      }, 10000);

      console.log(
        `Simple validation: ${metrics.opsPerSecond.toFixed(0)} ops/sec`
      );
      expect(metrics.opsPerSecond).toBeGreaterThan(100000); // 100k ops/sec target
    });

    it("should achieve target performance for complex validation (≥10k ops/sec)", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(stringEmailPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayUniquePlugin)
        .use(objectPlugin)
        .use(booleanTruthyPlugin)
        .for<{
          name: string;
          email: string;
          age: number;
          tags: string[];
          isActive: boolean;
          profile: { bio: string };
        }>()
        .v("name", (b) => b.string.required().min(2).max(50))
        .v("email", (b) => b.string.required().email())
        .v("age", (b) => b.number.required().min(0).max(120))
        .v("tags", (b) => b.array.required().minLength(1).unique())
        .v("isActive", (b) => b.boolean.required().truthy())
        .v("profile", (b) => b.object.required())
        .v("profile.bio", (b) => b.string.required().min(10).max(500))
        .build();

      const testData = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        tags: ["developer", "javascript"],
        isActive: true,
        profile: {
          bio: "A passionate developer with years of experience in web development",
        },
      };

      const metrics = measurePerformance(() => {
        validator.validate(testData);
      }, 5000);

      console.log(
        `Complex validation: ${metrics.opsPerSecond.toFixed(0)} ops/sec`
      );
      expect(metrics.opsPerSecond).toBeGreaterThan(10000); // 10k ops/sec target
    });

    it("should have low memory overhead per validation", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ name: string; age: number }>()
        .v("name", (b) => b.string.required().min(2))
        .v("age", (b) => b.number.required().min(0))
        .build();

      const testData = { name: "John", age: 30 };
      const metrics = measurePerformance(() => {
        validator.validate(testData);
      }, 10000);

      console.log(
        `Memory usage: ${metrics.memoryUsageMB?.toFixed(2)} MB for ${metrics.operations} operations`
      );

      // Memory usage should be reasonable (less than 10MB for 10k validations)
      if (metrics.memoryUsageMB !== undefined) {
        expect(metrics.memoryUsageMB).toBeLessThan(10);
      }
    });
  });

  describe("Scalability Verification", () => {
    it("should handle large datasets efficiently", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ id: number; name: string; value: number }>()
        .v("id", (b) => b.number.required().min(1))
        .v("name", (b) => b.string.required().min(3))
        .v("value", (b) => b.number.required().min(0))
        .build();

      // Create a large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: Math.random() * 1000,
      }));

      const startTime = performance.now();

      largeDataset.forEach((item) => {
        const result = validator.validate(item);
        expect(result.isValid()).toBe(true);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const itemsPerSecond = (largeDataset.length / totalTime) * 1000;

      console.log(
        `Large dataset (${largeDataset.length} items): ${itemsPerSecond.toFixed(0)} items/sec`
      );
      expect(itemsPerSecond).toBeGreaterThan(1000); // Should process at least 1000 items/sec
    });

    it("should maintain performance with many validation rules", () => {
      // Create a validator with a fixed set of many fields to avoid strict mode issues
      interface ManyFieldsType {
        field0: string;
        field1: number;
        field2: string[];
        field3: string;
        field4: number;
        field5: string[];
        field6: string;
        field7: number;
        field8: string[];
        field9: string;
        field10: number;
        field11: string[];
        field12: string;
        field13: number;
        field14: string[];
        field15: string;
        field16: number;
        field17: string[];
        field18: string;
        field19: number;
        field20: string[];
        field21: string;
        field22: number;
        field23: string[];
        field24: string;
        field25: number;
        field26: string[];
        field27: string;
        field28: number;
        field29: string[];
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(arrayMinLengthPlugin)
        .for<ManyFieldsType>()
        .v("field0", (b) => b.string.required().min(1).max(100))
        .v("field1", (b) => b.number.required().min(0).max(1000))
        .v("field2", (b) => b.array.required().minLength(1))
        .v("field3", (b) => b.string.required().min(1).max(100))
        .v("field4", (b) => b.number.required().min(0).max(1000))
        .v("field5", (b) => b.array.required().minLength(1))
        .v("field6", (b) => b.string.required().min(1).max(100))
        .v("field7", (b) => b.number.required().min(0).max(1000))
        .v("field8", (b) => b.array.required().minLength(1))
        .v("field9", (b) => b.string.required().min(1).max(100))
        .v("field10", (b) => b.number.required().min(0).max(1000))
        .v("field11", (b) => b.array.required().minLength(1))
        .v("field12", (b) => b.string.required().min(1).max(100))
        .v("field13", (b) => b.number.required().min(0).max(1000))
        .v("field14", (b) => b.array.required().minLength(1))
        .v("field15", (b) => b.string.required().min(1).max(100))
        .v("field16", (b) => b.number.required().min(0).max(1000))
        .v("field17", (b) => b.array.required().minLength(1))
        .v("field18", (b) => b.string.required().min(1).max(100))
        .v("field19", (b) => b.number.required().min(0).max(1000))
        .v("field20", (b) => b.array.required().minLength(1))
        .v("field21", (b) => b.string.required().min(1).max(100))
        .v("field22", (b) => b.number.required().min(0).max(1000))
        .v("field23", (b) => b.array.required().minLength(1))
        .v("field24", (b) => b.string.required().min(1).max(100))
        .v("field25", (b) => b.number.required().min(0).max(1000))
        .v("field26", (b) => b.array.required().minLength(1))
        .v("field27", (b) => b.string.required().min(1).max(100))
        .v("field28", (b) => b.number.required().min(0).max(1000))
        .v("field29", (b) => b.array.required().minLength(1))
        .build();

      const testData: ManyFieldsType = {
        field0: "value0",
        field1: 1,
        field2: ["item2"],
        field3: "value3",
        field4: 4,
        field5: ["item5"],
        field6: "value6",
        field7: 7,
        field8: ["item8"],
        field9: "value9",
        field10: 10,
        field11: ["item11"],
        field12: "value12",
        field13: 13,
        field14: ["item14"],
        field15: "value15",
        field16: 16,
        field17: ["item17"],
        field18: "value18",
        field19: 19,
        field20: ["item20"],
        field21: "value21",
        field22: 22,
        field23: ["item23"],
        field24: "value24",
        field25: 25,
        field26: ["item26"],
        field27: "value27",
        field28: 28,
        field29: ["item29"],
      };

      const metrics = measurePerformance(() => {
        validator.validate(testData);
      }, 1000);

      const fieldCount = 30; // 30 fields defined above
      console.log(
        `Many fields (${fieldCount}): ${metrics.opsPerSecond.toFixed(0)} ops/sec`
      );
      expect(metrics.opsPerSecond).toBeGreaterThan(1000); // Should maintain reasonable performance
    });

    it("should handle deep nesting efficiently", () => {
      interface DeeplyNested {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: string;
                  count: number;
                };
              };
            };
          };
        };
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(objectPlugin)
        .for<DeeplyNested>()
        .v("level1", (b) => b.object.required())
        .v("level1.level2", (b) => b.object.required())
        .v("level1.level2.level3", (b) => b.object.required())
        .v("level1.level2.level3.level4", (b) => b.object.required())
        .v("level1.level2.level3.level4.level5", (b) => b.object.required())
        .v("level1.level2.level3.level4.level5.value", (b) =>
          b.string.required().min(1)
        )
        .v("level1.level2.level3.level4.level5.count", (b) =>
          b.number.required().min(0)
        )
        .build();

      const testData: DeeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: "deep value",
                  count: 42,
                },
              },
            },
          },
        },
      };

      const metrics = measurePerformance(() => {
        validator.validate(testData);
      }, 5000);

      console.log(`Deep nesting: ${metrics.opsPerSecond.toFixed(0)} ops/sec`);
      expect(metrics.opsPerSecond).toBeGreaterThan(5000); // Should handle deep nesting efficiently
    });
  });

  describe("V8 Optimization Verification", () => {
    it("should benefit from V8 optimizations after warmup", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(2))
        .build();

      const testData = { name: "John" };

      // Measure cold performance (first 1000 operations)
      const coldMetrics = measurePerformance(
        () => {
          validator.validate(testData);
        },
        1000,
        0
      ); // No warmup

      // Measure hot performance (after warmup)
      const hotMetrics = measurePerformance(
        () => {
          validator.validate(testData);
        },
        10000,
        5000
      ); // 5000 warmup iterations

      console.log(
        `Cold performance: ${coldMetrics.opsPerSecond.toFixed(0)} ops/sec`
      );
      console.log(
        `Hot performance: ${hotMetrics.opsPerSecond.toFixed(0)} ops/sec`
      );
      console.log(
        `Improvement: ${((hotMetrics.opsPerSecond / coldMetrics.opsPerSecond - 1) * 100).toFixed(1)}%`
      );

      // Hot performance should be at least 10% better than cold (V8 optimization can vary)
      expect(hotMetrics.opsPerSecond).toBeGreaterThan(
        coldMetrics.opsPerSecond * 1.1
      );
    });

    it("should have consistent performance across multiple runs", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ name: string; age: number }>()
        .v("name", (b) => b.string.required().min(2))
        .v("age", (b) => b.number.required().min(0))
        .build();

      const testData = { name: "John", age: 30 };
      const runs = 5;
      const performanceResults: number[] = [];

      for (let i = 0; i < runs; i++) {
        const metrics = measurePerformance(() => {
          validator.validate(testData);
        }, 5000);
        performanceResults.push(metrics.opsPerSecond);
      }

      const average = performanceResults.reduce((a, b) => a + b, 0) / runs;
      const variance =
        performanceResults.reduce(
          (acc, val) => acc + Math.pow(val - average, 2),
          0
        ) / runs;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = (standardDeviation / average) * 100;

      console.log(`Performance consistency across ${runs} runs:`);
      console.log(`Average: ${average.toFixed(0)} ops/sec`);
      console.log(`Std Dev: ${standardDeviation.toFixed(0)} ops/sec`);
      console.log(`CV: ${coefficientOfVariation.toFixed(1)}%`);

      // Coefficient of variation should be reasonable (less than 35%)
      // Note: JavaScript performance can vary due to GC, V8 optimization, system load
      expect(coefficientOfVariation).toBeLessThan(35);
    });
  });

  describe("Memory Efficiency Verification", () => {
    it("should not leak memory during repeated validations", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(objectPlugin)
        .for<{ data: { nested: string } }>()
        .v("data", (b) => b.object.required())
        .v("data.nested", (b) => b.string.required().min(1))
        .build();

      const testData = { data: { nested: "test value" } };

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many validations
      for (let i = 0; i < 10000; i++) {
        validator.validate(testData);
      }

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

      console.log(
        `Memory growth after 10k validations: ${memoryGrowthMB.toFixed(2)} MB`
      );

      // Memory growth should be minimal (less than 5MB)
      expect(memoryGrowthMB).toBeLessThan(5);
    });

    it("should efficiently handle validator creation and disposal", () => {
      const createValidator = () => {
        return Builder()
          .use(requiredPlugin)
          .use(stringMinPlugin)
          .use(numberMinPlugin)
          .for<{ name: string; age: number }>()
          .v("name", (b) => b.string.required().min(2))
          .v("age", (b) => b.number.required().min(0))
          .build();
      };

      const startTime = performance.now();

      // Create and use validators (focus on performance rather than memory)
      for (let i = 0; i < 100; i++) {
        const validator = createValidator();
        const result = validator.validate({ name: "John", age: 30 });
        expect(result.isValid()).toBe(true);
        // Let validator go out of scope
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const validatorsPerSecond = (100 / totalTime) * 1000;

      console.log(
        `Validator creation and usage: ${validatorsPerSecond.toFixed(0)} validators/sec`
      );
      console.log(
        `Average time per validator: ${(totalTime / 100).toFixed(2)}ms`
      );

      // Should be able to create and use validators efficiently
      expect(totalTime).toBeLessThan(1000); // Less than 1 second for 100 validators
      expect(validatorsPerSecond).toBeGreaterThan(50); // At least 50 validators per second
    });
  });

  describe("Regression Detection", () => {
    it("should maintain baseline performance for common use cases", () => {
      // This test serves as a performance regression detector
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringEmailPlugin)
        .use(numberMinPlugin)
        .use(booleanTruthyPlugin)
        .for<{
          name: string;
          email: string;
          age: number;
          isActive: boolean;
        }>()
        .v("name", (b) => b.string.required().min(2))
        .v("email", (b) => b.string.required().email())
        .v("age", (b) => b.number.required().min(0))
        .v("isActive", (b) => b.boolean.required().truthy())
        .build();

      const testData = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        isActive: true,
      };

      const metrics = measurePerformance(() => {
        validator.validate(testData);
      }, 10000);

      console.log(
        `Baseline performance: ${metrics.opsPerSecond.toFixed(0)} ops/sec`
      );

      // Define baseline performance expectations
      const BASELINE_PERFORMANCE = 50000; // 50k ops/sec minimum

      expect(metrics.opsPerSecond).toBeGreaterThan(BASELINE_PERFORMANCE);
      expect(metrics.avgTimePerOpUs).toBeLessThan(20); // Less than 20 microseconds per operation
    });

    it("should have reasonable performance for array validation", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayUniquePlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().minLength(1).unique())
        .build();

      const testData = {
        items: ["item1", "item2", "item3", "item4", "item5"],
      };

      const metrics = measurePerformance(() => {
        validator.validate(testData);
      }, 5000);

      console.log(
        `Array validation: ${metrics.opsPerSecond.toFixed(0)} ops/sec`
      );

      // Array validation should still be reasonably fast
      expect(metrics.opsPerSecond).toBeGreaterThan(20000); // 20k ops/sec minimum
    });
  });

  describe("CPU Usage Efficiency", () => {
    it("should complete validation within reasonable time limits", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(arrayMinLengthPlugin)
        .use(objectPlugin)
        .for<{
          id: number;
          name: string;
          data: {
            values: number[];
            metadata: { key: string };
          };
        }>()
        .v("id", (b) => b.number.required().min(1).max(999999))
        .v("name", (b) => b.string.required().min(1).max(100))
        .v("data", (b) => b.object.required())
        .v("data.values", (b) => b.array.required().minLength(1))
        .v("data.metadata", (b) => b.object.required())
        .v("data.metadata.key", (b) => b.string.required().min(1).max(50))
        .build();

      const testData = {
        id: 12345,
        name: "Test Item",
        data: {
          values: [1, 2, 3, 4, 5],
          metadata: { key: "test-key" },
        },
      };

      const startTime = performance.now();

      // Run validation 1000 times
      for (let i = 0; i < 1000; i++) {
        const result = validator.validate(testData);
        expect(result.isValid()).toBe(true);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(
        `1000 complex validations completed in: ${totalTime.toFixed(2)}ms`
      );

      // Should complete within reasonable time (less than 100ms for 1000 validations)
      expect(totalTime).toBeLessThan(100);
    });

    it("should handle concurrent validations efficiently", async () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ name: string; value: number }>()
        .v("name", (b) => b.string.required().min(2))
        .v("value", (b) => b.number.required().min(0))
        .build();

      const testData = { name: "John", value: 42 };
      const concurrentValidations = 100;

      const startTime = performance.now();

      // Run many validations concurrently
      const promises = Array.from({ length: concurrentValidations }, () =>
        Promise.resolve().then(() => validator.validate(testData))
      );

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All validations should succeed
      results.forEach((result) => {
        expect(result.isValid()).toBe(true);
      });

      console.log(
        `${concurrentValidations} concurrent validations completed in: ${totalTime.toFixed(2)}ms`
      );

      // Should handle concurrent validations efficiently (less than 50ms)
      expect(totalTime).toBeLessThan(50);
    });
  });
});
