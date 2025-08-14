#!/usr/bin/env node

/**
 * LUQ Performance Profiler
 * Detailed bottleneck analysis
 */

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

// Build LUQ validator
const builder = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .for();

const validator = builder
  .field("name", (b) => b.string.required().min(3))
  .field("email", (b) => b.string.required().email())
  .field("age", (b) => b.number.required().min(18))
  .build();

// Profiling function
function profileFunction(name, fn, iterations = 100000) {
  console.log(`\n🔍 Profiling: ${name}`);

  // Warm up
  for (let i = 0; i < 1000; i++) {
    fn();
  }

  // Start memory usage measurement
  const memStart = process.memoryUsage();

  // Performance measurement
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    fn();
  }

  const end = performance.now();
  const memEnd = process.memoryUsage();

  const duration = end - start;
  const opsPerSecond = (iterations / duration) * 1000;
  const memDiff = {
    rss: memEnd.rss - memStart.rss,
    heapUsed: memEnd.heapUsed - memStart.heapUsed,
    heapTotal: memEnd.heapTotal - memStart.heapTotal,
    external: memEnd.external - memStart.external,
  };

  console.log(`  Duration: ${duration.toFixed(2)}ms`);
  console.log(`  Ops/sec: ${opsPerSecond.toFixed(0)}`);
  console.log(`  Memory delta:`, {
    rss: `${(memDiff.rss / 1024 / 1024).toFixed(2)}MB`,
    heapUsed: `${(memDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    heapTotal: `${(memDiff.heapTotal / 1024 / 1024).toFixed(2)}MB`,
    external: `${(memDiff.external / 1024 / 1024).toFixed(2)}MB`,
  });

  return { duration, opsPerSecond, memDiff };
}

// Detailed profiling
async function detailedProfile() {
  console.log("\n🚀 LUQ Performance Profiling\n");

  // Test individual components
  const results = {};

  // 1. Validator build time
  results.builderCreation = profileFunction(
    "Builder Creation",
    () => {
      const tempBuilder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringEmailPlugin)
        .use(numberMinPlugin)
        .for();

      return tempBuilder
        .field("name", (b) => b.string.required().min(3))
        .field("email", (b) => b.string.required().email())
        .field("age", (b) => b.number.required().min(18))
        .build();
    },
    10000
  );

  // 2. Valid data validation
  results.validValidation = profileFunction("Valid Data Validation", () => {
    return validator.validate(validData);
  });

  // 3. Invalid data validation
  results.invalidValidation = profileFunction("Invalid Data Validation", () => {
    return validator.validate(invalidData);
  });

  // 4. Individual plugin performance
  console.log("\n📊 Individual Plugin Performance:");

  // Required plugin
  const requiredValidator = Builder()
    .use(requiredPlugin)
    .for()
    .field("name", (b) => b.string.required())
    .build();

  results.requiredPlugin = profileFunction("Required Plugin", () => {
    return requiredValidator.validate({ name: "test" });
  });

  // String min plugin
  const stringMinValidator = Builder()
    .use(stringMinPlugin)
    .for()
    .field("name", (b) => b.string.min(3))
    .build();

  results.stringMinPlugin = profileFunction("StringMin Plugin", () => {
    return stringMinValidator.validate({ name: "test" });
  });

  // Email plugin
  const emailValidator = Builder()
    .use(stringEmailPlugin)
    .for()
    .field("email", (b) => b.string.email())
    .build();

  results.emailPlugin = profileFunction("Email Plugin", () => {
    return emailValidator.validate({ email: "test@example.com" });
  });

  // 5. Field access performance
  const complexData = {
    user: {
      profile: {
        details: {
          info: {
            name: "Deep Name",
          },
        },
      },
    },
  };

  // Deep nested access
  const { createFieldAccessor } = await import(
    "../src/core/plugin/utils/field-accessor.js"
  );
  const deepAccessor = createFieldAccessor("user.profile.details.info.name");

  results.deepFieldAccess = profileFunction("Deep Field Access", () => {
    return deepAccessor(complexData);
  });

  // 6. Error reporting overhead
  results.errorReporting = profileFunction("Error Reporting", () => {
    const result = validator.validate({
      name: "x",
      email: "invalid",
      age: 10,
    });
    return result.errors.length;
  });

  // Summary output
  console.log("\n📋 Performance Summary:");
  console.log("==================================================");

  Object.entries(results).forEach(([key, result]) => {
    console.log(
      `${key.padEnd(20)}: ${result.opsPerSecond.toFixed(0).padStart(8)} ops/sec`
    );
  });

  // V8 optimization hints
  console.log("\n💡 V8 Optimization Hints:");
  console.log("==================================================");

  // Hidden classes check
  console.log("- Object shapes consistency check...");
  const obj1 = { name: "test", email: "test@example.com", age: 25 };
  const obj2 = { name: "test2", email: "test2@example.com", age: 30 };
  const obj3 = { age: 35, name: "test3", email: "test3@example.com" }; // Different order

  console.log("  Same shape objects should have same performance");

  // Inline caching check
  console.log("- Function call patterns...");
  console.log("  Monomorphic calls should be faster than polymorphic");

  return results;
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  detailedProfile();
}
