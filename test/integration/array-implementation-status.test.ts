import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";

describe("Array Implementation Status - What Works vs What Doesn't", () => {
  describe("Currently Working: Array-level validation", () => {
    test("array length validation works", () => {
      type Data = {
        items: string[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("items", (b) => b.array.required().minLength(2))
        .build();

      // Valid: has 2+ items
      expect(validator.validate({ items: ["a", "b"] }).valid).toBe(true);

      // Invalid: too few items
      const result = validator.validate({ items: ["a"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].path).toBe("items");
      expect(result.errors[0].code).toBe("arrayMinLength");
    });

    test("array required validation works", () => {
      type Data = {
        items?: string[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .for<Data>()
        .v("items", (b) => b.array.required())
        .build();

      // Valid: array exists
      expect(validator.validate({ items: [] }).valid).toBe(true);

      // Invalid: array missing
      const result = validator.validate({});
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].path).toBe("items");
      expect(result.errors[0].code).toBe("required");
    });
  });

  describe("NOT Working: Array element validation", () => {
    test("array element field validation does NOT work", () => {
      type Data = {
        users: Array<{
          name: string;
          age: number;
        }>;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<Data>()
        .v("users", (b) => b.array.required())
        // These field definitions are IGNORED by the current implementation
        .v("users.name", (b) => b.string.required().min(2))
        .v("users.age", (b) => b.number.required().min(18))
        .build();

      // This SHOULD be invalid but passes because element validation is ignored
      const invalidData: Data = {
        users: [
          { name: "A", age: 10 }, // name too short, age too young
          { name: "", age: -5 }, // name empty, age negative
        ],
      };

      const result = validator.validate(invalidData);
      console.log("Element validation result:", result.isValid());
      console.log("Element validation errors:", result.errors);

      // Currently this passes but it SHOULD fail
      expect(result.isValid()).toBe(true); // This demonstrates the limitation
    });

    test("nested array validation does NOT work", () => {
      type Data = {
        departments: Array<{
          name: string;
          employees: Array<{
            id: string;
            name: string;
          }>;
        }>;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("departments", (b) => b.array.required())
        // All these nested validations are IGNORED
        .v("departments.name", (b) => b.string.required().min(3))
        .v("departments.employees", (b) => b.array.required().minLength(1))
        .v("departments.employees.id", (b) => b.string.required().min(5))
        .v("departments.employees.name", (b) => b.string.required().min(2))
        .build();

      const invalidData: Data = {
        departments: [
          {
            name: "IT", // Too short (< 3)
            employees: [], // Empty array (< 1)
          },
          {
            name: "HR", // Too short (< 3)
            employees: [
              { id: "1", name: "X" }, // id too short, name too short
            ],
          },
        ],
      };

      const result = validator.validate(invalidData);

      // All invalid data passes because nested validation is not implemented
      expect(result.isValid()).toBe(true); // Shows the limitation
    });
  });

  describe("What the Array Batch Optimizer was supposed to do", () => {
    test("array batch optimizer analysis", () => {
      type Data = {
        products: Array<{
          id: string;
          name: string;
          price: number;
        }>;
      };

      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<Data>()
        .v("products", (b) => b.array.required())
        .v("products.id", (b) => b.string.required().min(3))
        .v("products.name", (b) => b.string.required().min(2))
        .v("products.price", (b) => b.number.required().min(0));

      // Get field definitions to see what the optimizer would receive
      const fieldDefs = (builder as any).getFieldDefinitions();
      console.log("\nField definitions passed to optimizer:");
      Array.from(fieldDefs.entries()).forEach(([path, def]) => {
        console.log(
          `  - ${path}: isArrayField=${def.isArrayField}, fieldType=${def.fieldType}`
        );
      });

      // The array batch optimizer should:
      // 1. Detect "products" as an array field
      // 2. Identify "products.id", "products.name", "products.price" as element fields
      // 3. Create a batch validator that processes all three fields together

      // But currently, element fields are not validated at all
      const validator = builder.build();

      const data: Data = {
        products: [
          { id: "P", name: "X", price: -100 }, // All invalid
        ],
      };

      const result = validator.validate(data);
      console.log(
        "\nValidation result for invalid product data:",
        result.isValid()
      );
      console.log("Errors:", result.errors);

      // Shows that array element validation is not implemented
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Summary: Current Implementation Gaps", () => {
    test("implementation status summary", () => {
      console.log("\n=== ARRAY VALIDATION IMPLEMENTATION STATUS ===");
      console.log("\n✅ WORKING:");
      console.log(
        "  - Array-level validation (required, minLength, maxLength, unique, includes)"
      );
      console.log(
        "  - Single-level object field validation (e.g., 'user.name')"
      );

      console.log("\n❌ NOT WORKING:");
      console.log(
        "  - Array element field validation (e.g., 'users.name' for users[])"
      );
      console.log(
        "  - Nested array validation (e.g., 'departments.employees.name')"
      );
      console.log("  - Multi-dimensional arrays (Array<Array<T>>)");

      console.log("\n📝 WHAT WAS IMPLEMENTED:");
      console.log(
        "  - BuildTimeArrayAnalyzer for multi-dimensional type analysis"
      );
      console.log("  - Array batch optimizer infrastructure");
      console.log("  - Field detection with isArrayField marking");

      console.log("\n⚠️  MISSING PIECE:");
      console.log(
        "  - The actual validation engine doesn't process array element fields"
      );
      console.log(
        "  - Field paths like 'items.name' are parsed but not executed"
      );
      console.log(
        "  - The validator factory needs to handle array element iteration"
      );

      console.log("\n💡 CONCLUSION:");
      console.log("  The infrastructure for array element validation exists,");
      console.log(
        "  but the core validation engine doesn't implement the actual"
      );
      console.log(
        "  array element processing logic. This is why all our tests"
      );
      console.log(
        "  show array element validation as 'passing' when it should fail."
      );

      expect(true).toBe(true); // Dummy assertion
    });
  });
});
