import { describe, test, expect } from "@jest/globals";
import { validator as complexValidator } from "../../bundle-size-comparison/implementations/luq/complex";
import { complexValidData, complexInvalidData } from "../../bundle-size-comparison/schemas/shared-types";

describe("Complex Schema Performance Optimization", () => {
  const measure = (name: string, fn: () => void, iterations: number = 10000): number => {
    // Warm up
    for (let i = 0; i < 100; i++) {
      fn();
    }
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    const ops = Math.round(iterations / ((end - start) / 1000));
    console.log(`${name}: ${ops.toLocaleString()} ops/sec`);
    return ops;
  };

  test("Current complex schema performance baseline", () => {
    console.log("\n📊 Current Complex Schema Performance:");
    
    // Test with validate method
    const validateOps = measure("validate (valid data)", () => {
      complexValidator.validate(complexValidData);
    });
    
    const validateInvalidOps = measure("validate (invalid data)", () => {
      complexValidator.validate(complexInvalidData);
    });
    
    // Test with parse method if available
    const parseOps = measure("parse (valid data)", () => {
      complexValidator.parse(complexValidData);
    });
    
    console.log("\n🎯 Performance Summary:");
    console.log(`  Validate (valid): ${validateOps.toLocaleString()} ops/sec`);
    console.log(`  Validate (invalid): ${validateInvalidOps.toLocaleString()} ops/sec`);
    console.log(`  Parse (valid): ${parseOps.toLocaleString()} ops/sec`);
    
    console.log("\n🎯 Goals:");
    console.log(`  Minimum (beat Zod): 56,269+ ops/sec`);
    console.log(`  Target: 1,000,000 ops/sec`);
    console.log(`  Current: ${validateOps.toLocaleString()} ops/sec`);
    console.log(`  Improvement needed: ${(1000000 / validateOps).toFixed(1)}x`);
  });

  test("Analyze bottlenecks", () => {
    // Baseline performance for comparison
    const baselineOps = measure("Baseline", () => {
      complexValidator.validate(complexValidData);
    });
    
    // Test with ultra-fast mode
    console.log("\n🚀 Testing with ultra-fast mode:");
    (global as any).__LUQ_ULTRA_FAST__ = true;
    
    const ultraFastOps = measure("Ultra-fast mode (valid data)", () => {
      complexValidator.validate(complexValidData);
    });
    
    if ('validateRaw' in complexValidator) {
      const rawOps = measure("validateRaw (valid data)", () => {
        (complexValidator as any).validateRaw(complexValidData);
      });
      console.log(`  Raw validation speedup: ${(rawOps / baselineOps).toFixed(1)}x`);
    }
    
    if ('parseRaw' in complexValidator) {
      const parseRawOps = measure("parseRaw (valid data)", () => {
        (complexValidator as any).parseRaw(complexValidData);
      });
      console.log(`  parseRaw speedup: ${(parseRawOps / baselineOps).toFixed(1)}x`);
    }
    
    delete (global as any).__LUQ_ULTRA_FAST__;
  });
});