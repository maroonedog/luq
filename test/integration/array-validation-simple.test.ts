import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";

describe("Simple Array Validation Test", () => {
  test("should validate simple array of objects", () => {
    // Simple structure to test array validation
    type SimpleData = {
      items: Array<{
        name: string;
        value: number;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .use(arrayMinLengthPlugin)
      .for<SimpleData>()
      .v("items", (b) => b.array.required().minLength(1))
      .v("items.name", (b) => b.string.required().min(2))
      .v("items.value", (b) => b.number.required().min(0))
      .build();

    // Test 1: Valid data
    const validData: SimpleData = {
      items: [
        { name: "Item 1", value: 10 },
        { name: "Item 2", value: 20 },
      ],
    };

    console.log("Testing valid data...");
    const validResult = validator.validate(validData);
    console.log("Valid result:", validresult.isValid());
    console.log("Valid errors:", validResult.errors);

    expect(validresult.isValid()).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    // Test 2: Invalid data - short name
    const invalidData1: SimpleData = {
      items: [
        { name: "A", value: 10 }, // Name too short
        { name: "Item 2", value: 20 },
      ],
    };

    console.log("\nTesting invalid data (short name)...");
    const invalidResult1 = validator.validate(invalidData1);
    console.log("Invalid result:", invalidResult1.valid);
    console.log(
      "Invalid errors:",
      JSON.stringify(invalidResult1.errors, null, 2)
    );

    expect(invalidResult1.valid).toBe(false);
    expect(invalidResult1.errors.length).toBeGreaterThan(0);

    // Check if error path includes array index
    const errorPaths = invalidResult1.errors.map((e) => e.path);
    console.log("Error paths:", errorPaths);

    // This is the key test - does the error path include the array index?
    const hasArrayIndexInPath = errorPaths.some((path) => path.includes("[0]"));
    console.log("Has array index in path:", hasArrayIndexInPath);

    // Test 3: Multiple errors
    const invalidData2: SimpleData = {
      items: [
        { name: "X", value: -5 }, // Both invalid
        { name: "Y", value: -10 }, // Both invalid
        { name: "Valid Item", value: 30 }, // Valid
      ],
    };

    console.log("\nTesting multiple errors...");
    const invalidResult2 = validator.validate(invalidData2);
    console.log("Multiple errors result:", invalidResult2.valid);
    console.log("Multiple errors count:", invalidResult2.errors.length);
    console.log(
      "Multiple error paths:",
      invalidResult2.errors.map((e) => e.path)
    );

    expect(invalidResult2.valid).toBe(false);

    // We should have 4 errors: 2 name errors and 2 value errors
    expect(invalidResult2.errors.length).toBe(4);
  });

  test("should demonstrate array batching behavior", () => {
    type TestData = {
      users: Array<{
        id: string;
        name: string;
        email: string;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<TestData>()
      .v("users", (b) => b.array.required())
      .v("users.id", (b) => b.string.required().min(3))
      .v("users.name", (b) => b.string.required().min(2))
      .v("users.email", (b) => b.string.required().min(5))
      .build();

    const data: TestData = {
      users: [
        { id: "001", name: "Alice", email: "alice@example.com" },
        { id: "2", name: "B", email: "b@" }, // All fields invalid
        { id: "003", name: "Charlie", email: "charlie@test.com" },
      ],
    };

    console.log("\nTesting array batching...");
    const result = validator.validate(data);

    console.log("Result valid:", result.isValid());
    console.log(
      "Errors:",
      result.errors.map((e) => ({
        path: e.path,
        message: e.message,
      }))
    );

    expect(result.isValid()).toBe(false);

    // Should have 3 errors for user at index 1
    const userOneErrors = result.errors.filter((e) => e.path.includes("[1]"));
    console.log("Errors for user[1]:", userOneErrors.length);

    // Check specific error paths
    const expectedPaths = ["users[1].id", "users[1].name", "users[1].email"];
    for (const expectedPath of expectedPaths) {
      const hasPath = result.errors.some((e) => e.path === expectedPath);
      console.log(`Has error for ${expectedPath}:`, hasPath);
    }
  });

  test("should check if array batching optimization is active", () => {
    // This test checks if the array batch optimizer is being used

    type OptTest = {
      data: Array<{
        field1: string;
        field2: string;
        field3: string;
      }>;
    };

    console.log("\nChecking array batch optimization...");

    const builder = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<OptTest>();

    // Add array field
    builder.v("data", (b) => b.array.required());

    // Add multiple element fields - these should be batched
    builder.v("data.field1", (b) => b.string.required().min(1));
    builder.v("data.field2", (b) => b.string.required().min(1));
    builder.v("data.field3", (b) => b.string.required().min(1));

    const validator = builder.build();

    // Test with empty strings to trigger errors
    const testData: OptTest = {
      data: [
        { field1: "", field2: "", field3: "" },
        { field1: "a", field2: "b", field3: "c" },
      ],
    };

    const result = validator.validate(testData);
    console.log("Optimization test valid:", result.isValid());
    console.log(
      "Optimization test errors:",
      result.errors.map((e) => e.path)
    );

    // If array batching is working, we should get errors with array indices
    const hasIndexedPaths = result.errors.some((e) => /\[\d+\]/.test(e.path));
    console.log("Has indexed error paths:", hasIndexedPaths);

    // Log field definitions to see if they're detected as array fields
    const fieldDefs = (builder as any).getFieldDefinitions();
    console.log(
      "Field definitions:",
      Array.from(fieldDefs.entries()).map(([path, def]) => ({
        path,
        isArrayField: def.isArrayField,
      }))
    );
  });
});
