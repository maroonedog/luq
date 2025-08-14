import { describe, test } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../src/core/plugin/numberMax";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";

describe("Performance Optimization Comparison", () => {
  test("compare optimizations for array validation", () => {
    type Product = {
      id: string;
      name: string;
      price: number;
      stock: number;
    };

    type Order = {
      orderId: string;
      items: Product[];
      total: number;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .use(arrayMinLengthPlugin)
      .for<Order>()
      .v("orderId", (b) => b.string.required().min(5))
      .v("items", (b) => b.array.required().minLength(1))
      .v("items.id", (b) => b.string.required().min(3))
      .v("items.name", (b) => b.string.required().min(1))
      .v("items.price", (b) => b.number.required().min(0.01).max(999999))
      .v("items.stock", (b) => b.number.required().min(0).max(99999))
      .v("total", (b) => b.number.required().min(0))
      .build();

    // Create test data with many items
    const itemCount = 100;
    const testData: Order = {
      orderId: "ORD-12345",
      items: Array.from({ length: itemCount }, (_, i) => ({
        id: `PRD${i.toString().padStart(3, "0")}`,
        name: `Product ${i}`,
        price: Math.random() * 100 + 10,
        stock: Math.floor(Math.random() * 100),
      })),
      total: 5432.1,
    };

    // Warm up
    for (let i = 0; i < 100; i++) {
      validator.validate(testData);
    }

    console.log(`\n📊 Performance Optimization Results:`);
    console.log(
      `   Test: ${itemCount} items with 4 fields each = ${itemCount * 4} field validations`
    );

    // Test 1: Standard validation performance
    const iterations = 1000;
    const start1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      validator.validate(testData);
    }
    const end1 = performance.now();
    const time1 = end1 - start1;
    const opsPerSec1 = (iterations / time1) * 1000;

    console.log(`\n   Standard Validation:`);
    console.log(
      `     Time: ${time1.toFixed(2)}ms for ${iterations} iterations`
    );
    console.log(`     Speed: ${opsPerSec1.toFixed(0)} ops/sec`);
    console.log(`     Fields/sec: ${(opsPerSec1 * itemCount * 4).toFixed(0)}`);

    // Test 2: With error case (1 invalid item)
    const invalidData: Order = {
      ...testData,
      items: [
        ...testData.items.slice(0, 50),
        {
          id: "PR", // Too short - should fail min(3)
          name: "", // Empty - should fail min(1)
          price: -10, // Negative - should fail min(0.01)
          stock: -5, // Negative - should fail min(0)
        },
        ...testData.items.slice(51),
      ],
    };

    const start2 = performance.now();
    let errorCount = 0;
    for (let i = 0; i < iterations; i++) {
      const result = validator.validate(invalidData);
      if (!result.isValid()) errorCount++;
    }
    const end2 = performance.now();
    const time2 = end2 - start2;
    const opsPerSec2 = (iterations / time2) * 1000;

    console.log(`\n   With Errors (abort early):`);
    console.log(
      `     Time: ${time2.toFixed(2)}ms for ${iterations} iterations`
    );
    console.log(`     Speed: ${opsPerSec2.toFixed(0)} ops/sec`);
    console.log(`     Errors caught: ${errorCount}`);

    // Test 3: Worst case - all errors, no abort early
    const allInvalidData: Order = {
      orderId: "ORD", // Too short
      items: testData.items.map(() => ({
        id: "PR", // Too short
        name: "", // Empty
        price: -10, // Negative
        stock: -5, // Negative
      })),
      total: -100, // Negative
    };

    const start3 = performance.now();
    let totalErrors = 0;
    for (let i = 0; i < 100; i++) {
      // Fewer iterations for worst case
      const result = validator.validate(allInvalidData, {
        abortEarlyOnEachField: false,
      });
      if (!result.isValid()) {
        totalErrors += result.errors.length;
      }
    }
    const end3 = performance.now();
    const time3 = end3 - start3;
    const opsPerSec3 = (100 / time3) * 1000;

    console.log(`\n   Worst Case (all errors, no abort):`);
    console.log(`     Time: ${time3.toFixed(2)}ms for 100 iterations`);
    console.log(`     Speed: ${opsPerSec3.toFixed(0)} ops/sec`);
    console.log(`     Total errors: ${totalErrors}`);
    console.log(`     Avg errors/iteration: ${(totalErrors / 100).toFixed(0)}`);

    // Summary
    console.log(`\n   📈 Performance Summary:`);
    console.log(`     Best case (all valid): ${opsPerSec1.toFixed(0)} ops/sec`);
    console.log(
      `     Error case (abort early): ${opsPerSec2.toFixed(0)} ops/sec (${((opsPerSec2 / opsPerSec1) * 100).toFixed(1)}% of best)`
    );
    console.log(
      `     Worst case (all errors): ${opsPerSec3.toFixed(0)} ops/sec (${((opsPerSec3 / opsPerSec1) * 100).toFixed(1)}% of best)`
    );

    // Optimization notes
    console.log(`\n   💡 Optimizations Applied:`);
    console.log(
      `     ✓ Pre-computed element keys (no string.replace per element)`
    );
    console.log(`     ✓ Pre-compiled accessors with direct property access`);
    console.log(`     ✓ Cache-friendly indexed loops`);
    console.log(`     ✓ Minimal object allocations`);
  });

  test("micro-benchmark: field accessor performance", () => {
    // Test the actual accessor performance
    const testObj = {
      user: {
        profile: {
          settings: {
            notifications: {
              email: true,
              push: false,
            },
          },
        },
      },
    };

    // Import the optimized accessor
    const {
      createFieldAccessor,
    } = require("../../src/core/plugin/utils/field-accessor-optimized");

    const paths = [
      "user",
      "user.profile",
      "user.profile.settings",
      "user.profile.settings.notifications",
      "user.profile.settings.notifications.email",
    ];

    console.log(`\n🔬 Micro-benchmark: Field Accessor Performance`);

    paths.forEach((path) => {
      const accessor = createFieldAccessor(path);

      // Warm up
      for (let i = 0; i < 10000; i++) {
        accessor(testObj);
      }

      // Measure
      const iterations = 1000000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        accessor(testObj);
      }
      const end = performance.now();
      const time = end - start;
      const opsPerSec = (iterations / time) * 1000;

      console.log(`   Path "${path}" (depth ${path.split(".").length}):`);
      console.log(
        `     ${opsPerSec.toFixed(0)} ops/sec (${((time / iterations) * 1000).toFixed(3)} ns/op)`
      );
    });
  });
});
