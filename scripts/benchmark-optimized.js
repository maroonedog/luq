#!/usr/bin/env node

/**
 * Benchmark optimized LUQ vs original vs AJV
 */

import {
  createSimpleUserValidatorOptimized,
  benchmarkOptimizedValidator,
} from "../src/core/plugin/utils/v8-optimized-validator.js";
import { Builder } from "../src/core/builder/builder.js";
import { requiredPlugin } from "../src/core/plugin/required.js";
import { stringMinPlugin } from "../src/core/plugin/stringMin.js";
import { stringEmailPlugin } from "../src/core/plugin/stringEmail.js";
import { numberMinPlugin } from "../src/core/plugin/numberMin.js";

// Test data
const validData = {
  name: "John Doe",
  email: "john@example.com",
  age: 25,
};

const invalidData = {
  name: "Jo", // too short
  email: "invalid-email",
  age: 15, // too young
};

// Create validators
const optimizedValidator = createSimpleUserValidatorOptimized();

const originalValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .for()
  .field("name", (b) => b.string.required().min(3))
  .field("email", (b) => b.string.required().email())
  .field("age", (b) => b.number.required().min(18))
  .build();

// Benchmark function
function benchmark(name, validatorFn, iterations = 100000) {
  console.log(`\n🔍 Benchmarking: ${name}`);

  // Warm up
  for (let i = 0; i < 1000; i++) {
    validatorFn(validData);
    validatorFn(invalidData);
  }

  // Valid data benchmark
  let validStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    validatorFn(validData);
  }
  let validEnd = performance.now();
  const validOpsPerSec = (iterations / (validEnd - validStart)) * 1000;

  // Invalid data benchmark
  let invalidStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    validatorFn(invalidData);
  }
  let invalidEnd = performance.now();
  const invalidOpsPerSec = (iterations / (invalidEnd - invalidStart)) * 1000;

  console.log(
    `  Valid data:   ${validOpsPerSec.toFixed(0).padStart(10)} ops/sec`
  );
  console.log(
    `  Invalid data: ${invalidOpsPerSec.toFixed(0).padStart(10)} ops/sec`
  );

  return { validOpsPerSec, invalidOpsPerSec };
}

// Run benchmarks
console.log("🚀 LUQ Performance Comparison\n");

const optimizedResults = benchmark("LUQ Optimized", optimizedValidator);
const originalResults = benchmark("LUQ Original", (data) =>
  originalValidator.validate(data)
);

// Calculate improvements
const validImprovement =
  (optimizedResults.validOpsPerSec / originalResults.validOpsPerSec - 1) * 100;
const invalidImprovement =
  (optimizedResults.invalidOpsPerSec / originalResults.invalidOpsPerSec - 1) *
  100;

console.log("\n📊 Performance Improvement:");
console.log("=====================================");
console.log(
  `Valid data:   ${validImprovement > 0 ? "+" : ""}${validImprovement.toFixed(1)}%`
);
console.log(
  `Invalid data: ${invalidImprovement > 0 ? "+" : ""}${invalidImprovement.toFixed(1)}%`
);

// AJV comparison data (from previous benchmark)
const ajvValidOps = 1920993;
const ajvInvalidOps = 16654703;

console.log("\n🎯 Comparison with AJV:");
console.log("=====================================");
const ajvValidRatio = (optimizedResults.validOpsPerSec / ajvValidOps) * 100;
const ajvInvalidRatio =
  (optimizedResults.invalidOpsPerSec / ajvInvalidOps) * 100;

console.log(`Valid data:   ${ajvValidRatio.toFixed(1)}% of AJV performance`);
console.log(`Invalid data: ${ajvInvalidRatio.toFixed(1)}% of AJV performance`);

// Memory usage comparison
console.log("\n💾 Memory Usage:");
console.log("=====================================");

const memBefore = process.memoryUsage();

// Create many validators to test memory usage
const validators = [];
for (let i = 0; i < 1000; i++) {
  validators.push(createSimpleUserValidatorOptimized());
}

const memAfter = process.memoryUsage();
const memDiff = memAfter.heapUsed - memBefore.heapUsed;

console.log(`Memory per validator: ${(memDiff / 1000 / 1024).toFixed(2)} KB`);

console.log("\n✅ Benchmark Complete!");
