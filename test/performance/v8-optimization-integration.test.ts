import { describe, test, expect } from "@jest/globals";
import { createUnifiedValidator } from "../../src/core/optimization/unified-validator";
import {
  Builder,
  requiredPlugin,
  stringMinPlugin,
  transformPlugin,
} from "../../src";

describe("V8 Optimization Integration Test", () => {
  // Direct test of unified validator without builder overhead

  test("Direct unified validator - 1 validator, 1 transform", () => {
    // Simulate what the builder would create
    const fieldDef = {
      path: "value",
      builderFunction: (context: any) => ({
        _validators: [
          {
            check: (value: any) =>
              typeof value === "string" && value.length >= 3,
            code: "STRING_MIN",
          },
        ],
        _transforms: [(value: any) => value.toLowerCase()],
      }),
    };

    const plugins = {};

    // Create validator directly
    const validator = createUnifiedValidator(
      fieldDef,
      plugins,
      "fast_separated"
    );

    const iterations = 100000;

    // Test validate performance
    const validateStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = validator.validate("TEST123", {});
      if (!result.isValid()) throw new Error("Failed");
    }
    const validateEnd = performance.now();
    const validateOps = Math.round(
      iterations / ((validateEnd - validateStart) / 1000)
    );

    // Test parse performance
    const parseStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = validator.parse("TEST123", {});
      if (!result.valid || result.data !== "test123") throw new Error("Failed");
    }
    const parseEnd = performance.now();
    const parseOps = Math.round(iterations / ((parseEnd - parseStart) / 1000));

    console.log(`Direct validator (1 validator, 1 transform):`);
    console.log(`  Validate: ${validateOps.toLocaleString()} ops/sec`);
    console.log(`  Parse: ${parseOps.toLocaleString()} ops/sec`);

    // Direct validator should easily exceed 800K ops/sec
    expect(parseOps).toBeGreaterThan(800000);
  });

  test("Direct unified validator - 2 validators, 1 transform", () => {
    // Simulate required + stringMin validators
    const fieldDef = {
      path: "value",
      builderFunction: (context: any) => ({
        _validators: [
          {
            check: (value: any) => value != null && value !== "",
            code: "REQUIRED",
          },
          {
            check: (value: any) =>
              typeof value === "string" && value.length >= 3,
            code: "STRING_MIN",
          },
        ],
        _transforms: [(value: any) => value.toLowerCase()],
      }),
    };

    const plugins = {};

    // Create validator directly
    const validator = createUnifiedValidator(
      fieldDef,
      plugins,
      "fast_separated"
    );

    const iterations = 100000;

    // Test parse performance
    const parseStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = validator.parse("TEST123", {});
      if (!result.valid || result.data !== "test123") throw new Error("Failed");
    }
    const parseEnd = performance.now();
    const parseOps = Math.round(iterations / ((parseEnd - parseStart) / 1000));

    console.log(`Direct validator (2 validators, 1 transform):`);
    console.log(`  Parse: ${parseOps.toLocaleString()} ops/sec`);

    // Should achieve 800K+ ops/sec
    expect(parseOps).toBeGreaterThan(800000);
  });

  test("Validator factory overhead analysis", () => {
    // Compare direct validator vs full builder
    const directFieldDef = {
      path: "value",
      builderFunction: (context: any) => ({
        _validators: [
          {
            check: (value: any) =>
              typeof value === "string" && value.length >= 3,
            code: "STRING_MIN",
          },
        ],
        _transforms: [(value: any) => value.toLowerCase()],
      }),
    };

    const directValidator = createUnifiedValidator(
      directFieldDef,
      {},
      "fast_separated"
    );

    // Now test with actual builder
    type TestType = { value: string };

    const builderValidator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(transformPlugin)
      .for<TestType>()
      .v("value", (b: any) =>
        b.string
          .required()
          .min(3)
          .transform((v: string) => v.toLowerCase())
      )
      .build();

    const iterations = 100000;
    const testData = { value: "TEST123" };

    // Direct validator parse
    const directStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = directValidator.parse("TEST123", {});
      if (!result.isValid()) throw new Error("Failed");
    }
    const directEnd = performance.now();
    const directOps = Math.round(
      iterations / ((directEnd - directStart) / 1000)
    );

    // Builder validator parse
    const builderStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = builderValidator.parse(testData);
      if (!result.isValid()) throw new Error("Failed");
    }
    const builderEnd = performance.now();
    const builderOps = Math.round(
      iterations / ((builderEnd - builderStart) / 1000)
    );

    console.log(`\nOverhead Analysis:`);
    console.log(`  Direct validator: ${directOps.toLocaleString()} ops/sec`);
    console.log(`  Builder validator: ${builderOps.toLocaleString()} ops/sec`);
    console.log(
      `  Overhead: ${(((directOps - builderOps) / directOps) * 100).toFixed(1)}%`
    );

    // Both should achieve good performance
    expect(directOps).toBeGreaterThan(800000);
    expect(builderOps).toBeGreaterThan(600000); // Allow some overhead for full builder
  });
});
