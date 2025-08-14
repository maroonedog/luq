/**
 * Performance Benchmark: Optimized Hoisting
 *
 * Compares standard validation with optimized hoisted validation
 * to demonstrate memory and performance improvements
 */

import { Builder } from "../../src/core/builder/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { OptimizedHoistedBuilder } from "../../src/core/optimization/hoisted-integration-optimized";

describe("Hoisting Optimization Performance", () => {
  // Test data generators
  const generateValidData = (count: number) => {
    const data: any[] = [];
    for (let i = 0; i < count; i++) {
      data.push({
        name: "John Doe Smith",
        email: "john.doe@example.com",
        age: 25,
        bio: "Software developer with 5 years of experience",
        score: 85.5,
        username: "johndoe123",
      });
    }
    return data;
  };

  const generateInvalidData = (count: number) => {
    const data: any[] = [];
    for (let i = 0; i < count; i++) {
      data.push({
        name: "", // Invalid: empty
        email: "a", // Invalid: too short
        age: 10, // Invalid: too young
        bio: "Hi", // Invalid: too short
        score: -5, // Invalid: negative
        username: "jd", // Invalid: too short
      });
    }
    return data;
  };

  // Standard validator using traditional approach
  const createStandardValidator = () => {
    return Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<any>()
      .v("name", (b) => b.string.required().min(3))
      .v("email", (b) => b.string.required().min(5))
      .v("age", (b) => b.number.required().min(18))
      .v("bio", (b) => b.string.required().min(10))
      .v("score", (b) => b.number.required().min(0))
      .v("username", (b) => b.string.required().min(3))
      .build();
  };

  // Optimized hoisted validator
  const createOptimizedValidator = () => {
    const builder = new OptimizedHoistedBuilder();

    // Create field contexts manually with optimized plugins
    const stringContext = {
      _executionPlan: {
        steps: [
          {
            type: "validator",
            name: "required",
            plugin: requiredPlugin,
            params: [],
          },
        ],
      },
    };

    // Add fields with plugin configurations
    builder.addField("name", {
      _executionPlan: {
        steps: [
          {
            type: "validator",
            name: "required",
            plugin: requiredPlugin,
            params: [],
          },
          {
            type: "validator",
            name: "stringMin",
            plugin: stringMinPlugin,
            params: [3],
          },
        ],
      },
    } as any);

    builder.addField("email", {
      _executionPlan: {
        steps: [
          {
            type: "validator",
            name: "required",
            plugin: requiredPlugin,
            params: [],
          },
          {
            type: "validator",
            name: "stringMin",
            plugin: stringMinPlugin,
            params: [5],
          },
        ],
      },
    } as any);

    builder.addField("age", {
      _executionPlan: {
        steps: [
          {
            type: "validator",
            name: "required",
            plugin: requiredPlugin,
            params: [],
          },
          {
            type: "validator",
            name: "numberMin",
            plugin: numberMinPlugin,
            params: [18],
          },
        ],
      },
    } as any);

    builder.addField("bio", {
      _executionPlan: {
        steps: [
          {
            type: "validator",
            name: "required",
            plugin: requiredPlugin,
            params: [],
          },
          {
            type: "validator",
            name: "stringMin",
            plugin: stringMinPlugin,
            params: [10],
          },
        ],
      },
    } as any);

    builder.addField("score", {
      _executionPlan: {
        steps: [
          {
            type: "validator",
            name: "required",
            plugin: requiredPlugin,
            params: [],
          },
          {
            type: "validator",
            name: "numberMin",
            plugin: numberMinPlugin,
            params: [0],
          },
        ],
      },
    } as any);

    builder.addField("username", {
      _executionPlan: {
        steps: [
          {
            type: "validator",
            name: "required",
            plugin: requiredPlugin,
            params: [],
          },
          {
            type: "validator",
            name: "stringMin",
            plugin: stringMinPlugin,
            params: [3],
          },
        ],
      },
    } as any);

    return builder.build();
  };

  // Performance test helper
  const runBenchmark = (name: string, validator: any, data: any[]) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    let errorCount = 0;
    for (const item of data) {
      // Handle both validator types
      const result =
        typeof validator === "function"
          ? validator(item)
          : validator.validate(item, { abortEarly: false });

      // Handle Result interface (standard validator)
      if (result.isValid && result.errors) {
        if (!result.isValid()) {
          const errors = result.errors;
          errorCount += errors.length;
        }
      }
      // Handle plain object result (optimized validator)
      else if (typeof result.valid !== "undefined") {
        if (!result.valid && result.errors) {
          errorCount += result.errors.length;
        }
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    return {
      name,
      time: endTime - startTime,
      memory: endMemory - startMemory,
      errorCount,
      avgTimePerItem: (endTime - startTime) / data.length,
      avgMemoryPerError:
        errorCount > 0 ? (endMemory - startMemory) / errorCount : 0,
    };
  };

  describe("Small dataset (100 items)", () => {
    const validData = generateValidData(100);
    const invalidData = generateInvalidData(100);

    it("should show performance improvement for valid data", () => {
      const standardValidator = createStandardValidator();
      const optimizedValidator = createOptimizedValidator();

      const standardResult = runBenchmark(
        "Standard",
        standardValidator,
        validData
      );
      const optimizedResult = runBenchmark(
        "Optimized",
        optimizedValidator,
        validData
      );

      console.log("Valid data results (100 items):");
      console.log("Standard:", standardResult);
      console.log("Optimized:", optimizedResult);
      console.log(
        `Time improvement: ${(((standardResult.time - optimizedResult.time) / standardResult.time) * 100).toFixed(2)}%`
      );
    });

    it("should show significant improvement for invalid data", () => {
      const standardValidator = createStandardValidator();
      const optimizedValidator = createOptimizedValidator();

      // Test with a single invalid item first to understand error count
      const singleInvalid = invalidData[0];
      console.log("\nTesting single invalid item:", singleInvalid);

      const standardSingle = standardValidator.validate(singleInvalid, {
        abortEarly: false,
      });
      const standardErrors = standardSingle.errors ? standardSingle.errors : [];
      console.log("Standard single result:", {
        valid: standardSingle.valid,
        errorCount: standardErrors.length,
        errors: standardErrors.map((e) => ({ path: e.path, code: e.code })),
      });

      const optimizedSingle = optimizedValidator(singleInvalid);
      console.log("Optimized single result:", {
        valid: optimizedSingle.valid,
        errorCount: optimizedSingle.errors?.length || 0,
        errors: optimizedSingle.errors?.map((e) => ({
          path: e.path,
          code: e.code,
        })),
      });

      const standardResult = runBenchmark(
        "Standard",
        standardValidator,
        invalidData
      );
      const optimizedResult = runBenchmark(
        "Optimized",
        optimizedValidator,
        invalidData
      );

      console.log("\nInvalid data results (100 items, expected 600 errors):");
      console.log("Standard:", standardResult);
      console.log("Optimized:", optimizedResult);
      console.log(
        `Time improvement: ${(((standardResult.time - optimizedResult.time) / standardResult.time) * 100).toFixed(2)}%`
      );
      console.log(
        `Memory per error reduction: ${(((standardResult.avgMemoryPerError - optimizedResult.avgMemoryPerError) / standardResult.avgMemoryPerError) * 100).toFixed(2)}%`
      );
    });
  });

  describe("Large dataset (10,000 items)", () => {
    const validData = generateValidData(10000);
    const invalidData = generateInvalidData(10000);

    it("should scale well with large valid datasets", () => {
      const standardValidator = createStandardValidator();
      const optimizedValidator = createOptimizedValidator();

      const standardResult = runBenchmark(
        "Standard",
        standardValidator,
        validData
      );
      const optimizedResult = runBenchmark(
        "Optimized",
        optimizedValidator,
        validData
      );

      console.log("\nLarge valid data results (10,000 items):");
      console.log("Standard:", standardResult);
      console.log("Optimized:", optimizedResult);
      console.log(
        `Time improvement: ${(((standardResult.time - optimizedResult.time) / standardResult.time) * 100).toFixed(2)}%`
      );
    });

    it("should show massive improvement with many errors", () => {
      const standardValidator = createStandardValidator();
      const optimizedValidator = createOptimizedValidator();

      const standardResult = runBenchmark(
        "Standard",
        standardValidator,
        invalidData
      );
      const optimizedResult = runBenchmark(
        "Optimized",
        optimizedValidator,
        invalidData
      );

      console.log(
        "\nLarge invalid data results (10,000 items, 60,000 errors):"
      );
      console.log("Standard:", standardResult);
      console.log("Optimized:", optimizedResult);
      console.log(
        `Time improvement: ${(((standardResult.time - optimizedResult.time) / standardResult.time) * 100).toFixed(2)}%`
      );
      console.log(
        `Memory per error reduction: ${(((standardResult.avgMemoryPerError - optimizedResult.avgMemoryPerError) / standardResult.avgMemoryPerError) * 100).toFixed(2)}%`
      );

      // Expected results:
      // - Time improvement: 30-50%
      // - Memory reduction: 90-95% per error
    });
  });

  describe("Memory pressure test", () => {
    it("should handle extreme error cases efficiently", () => {
      const extremeInvalidData = generateInvalidData(1000);
      const optimizedValidator = createOptimizedValidator();

      // Force garbage collection before test
      if (global.gc) {
        global.gc();
      }

      const startMemory = process.memoryUsage().heapUsed;

      // Run validation but don't access errors (lazy evaluation)
      const results = extremeInvalidData.map((data) =>
        optimizedValidator(data)
      );

      const afterValidationMemory = process.memoryUsage().heapUsed;

      // Now access errors (triggers reconstruction)
      let totalErrors = 0;
      for (const result of results) {
        if (!result.valid && result.errors) {
          totalErrors += result.errors.length;
        }
      }

      const afterErrorAccessMemory = process.memoryUsage().heapUsed;

      console.log("\nMemory pressure test (1,000 items with errors):");
      console.log(
        `Memory used during validation: ${(afterValidationMemory - startMemory) / 1024 / 1024} MB`
      );
      console.log(
        `Memory used after error access: ${(afterErrorAccessMemory - startMemory) / 1024 / 1024} MB`
      );
      console.log(`Total errors: ${totalErrors}`);
      console.log(
        `Bytes per error (validation): ${(afterValidationMemory - startMemory) / totalErrors}`
      );
      console.log(
        `Bytes per error (with messages): ${(afterErrorAccessMemory - startMemory) / totalErrors}`
      );
    });
  });
});

/**
 * Expected improvements:
 *
 * 1. Performance (time):
 *    - Valid data: 20-30% faster
 *    - Invalid data: 30-50% faster
 *
 * 2. Memory usage:
 *    - During validation: ~4 bytes per error (vs 100-180 bytes)
 *    - 95%+ reduction in memory usage for error tracking
 *    - Errors reconstructed only when accessed
 *
 * 3. Scalability:
 *    - Linear scaling with data size
 *    - Minimal GC pressure even with millions of errors
 */
