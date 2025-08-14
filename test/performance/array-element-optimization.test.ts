import { describe, test } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";

describe("Array Element Access Optimization", () => {
  test("performance with large arrays", () => {
    type Data = {
      items: Array<{
        id: string;
        name: string;
        value: number;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .use(arrayMinLengthPlugin)
      .for<Data>()
      .v("items", (b) => b.array.required().minLength(1))
      .v("items.id", (b) => b.string.required().min(1))
      .v("items.name", (b) => b.string.required().min(2))
      .v("items.value", (b) => b.number.required().min(0))
      .build();

    // Create test data with many items
    const itemCount = 1000;
    const testData: Data = {
      items: Array.from({ length: itemCount }, (_, i) => ({
        id: `ID${i}`,
        name: `Item ${i}`,
        value: i * 10,
      })),
    };

    // Warm up
    for (let i = 0; i < 10; i++) {
      validator.validate(testData);
    }

    // Measure performance
    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = validator.validate(testData);
      if (!result.isValid()) {
        throw new Error("Validation should pass");
      }
    }

    const end = performance.now();
    const totalTime = end - start;
    const timePerOp = totalTime / iterations;
    const opsPerSec = 1000 / timePerOp;

    console.log(`Array validation (${itemCount} items, 3 fields per item):`);
    console.log(
      `  Total time for ${iterations} iterations: ${totalTime.toFixed(2)}ms`
    );
    console.log(`  Time per operation: ${timePerOp.toFixed(3)}ms`);
    console.log(`  Operations per second: ${opsPerSec.toFixed(0)}`);
    console.log(
      `  Elements validated per second: ${(opsPerSec * itemCount).toFixed(0)}`
    );

    // After optimization, this should be significantly faster
    // Previously each element access would do a string replace
    // Now it uses pre-compiled accessors
  });

  test("verify correctness with nested array fields", () => {
    type ComplexData = {
      orders: Array<{
        orderId: string;
        items: Array<{
          sku: string;
          quantity: number;
        }>;
        total: number;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .use(arrayMinLengthPlugin)
      .for<ComplexData>()
      .v("orders", (b) => b.array.required().minLength(1))
      .v("orders.orderId", (b) => b.string.required().min(5))
      .v("orders.total", (b) => b.number.required().min(0))
      .build();

    const validData: ComplexData = {
      orders: [
        {
          orderId: "ORD001",
          items: [
            { sku: "SKU123", quantity: 2 },
            { sku: "SKU456", quantity: 1 },
          ],
          total: 99.99,
        },
        {
          orderId: "ORD002",
          items: [{ sku: "SKU789", quantity: 5 }],
          total: 249.95,
        },
      ],
    };

    const result = validator.validate(validData);
    if (!result.isValid()) {
      console.error("Validation errors:", result.errors);
    }

    // Should pass validation
    if (!result.isValid()) {
      throw new Error("Validation should pass for valid data");
    }

    // Test invalid data
    const invalidData: ComplexData = {
      orders: [
        {
          orderId: "ORD", // Too short
          items: [],
          total: -10, // Negative not allowed
        },
      ],
    };

    const invalidResult = validator.validate(invalidData);
    if (invalidresult.isValid()) {
      throw new Error("Validation should fail for invalid data");
    }

    // Should have 2 errors
    if (invalidResult.errors.length !== 2) {
      throw new Error(`Expected 2 errors, got ${invalidResult.errors.length}`);
    }
  });
});
