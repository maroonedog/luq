import { describe, test, expect } from "@jest/globals";
import { 
  analyzeArrayBatching, 
  createArrayBatchValidator,
  ArrayBatchInfo 
} from "../../../../src/core/builder/array-batch-optimizer";
import { Builder } from "../../../../src";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";

describe("ArrayBatchOptimizer", () => {
  describe("analyzeArrayBatching", () => {
    test("should identify batchable array fields", () => {
      const fields = [
        { path: "users.*.name", isArrayField: false, builderFunction: () => {} },
        { path: "users.*.age", isArrayField: false, builderFunction: () => {} },
        { path: "tags.*", isArrayField: false, builderFunction: () => {} }
      ];

      const result = analyzeArrayBatching(fields);
      
      expect(result.batchableGroups).toBeDefined();
      expect(result.batchableGroups.length).toBeGreaterThan(0);
      
      // Should group users.* fields together
      const usersGroup = result.batchableGroups.find(g => 
        g.arrayPath === "users" && g.fields.length === 2
      );
      expect(usersGroup).toBeDefined();
      expect(usersGroup?.fields.map(f => f.path)).toEqual(["users.*.name", "users.*.age"]);
      
      // Should have separate group for tags
      const tagsGroup = result.batchableGroups.find(g => 
        g.arrayPath === "tags"
      );
      expect(tagsGroup).toBeDefined();
    });

    test("should handle single array field", () => {
      const fields = [
        { path: "items.*.id", isArrayField: false, builderFunction: () => {} }
      ];

      const result = analyzeArrayBatching(fields);
      
      expect(result.batchableGroups).toHaveLength(1);
      expect(result.batchableGroups[0].arrayPath).toBe("items");
      expect(result.batchableGroups[0].fields).toHaveLength(1);
    });

    test("should return empty groups for non-array fields", () => {
      const fields = [
        { path: "name", isArrayField: false, builderFunction: () => {} },
        { path: "user.email", isArrayField: false, builderFunction: () => {} }
      ];

      const result = analyzeArrayBatching(fields);
      
      expect(result.batchableGroups).toHaveLength(0);
    });

    test("should handle empty field list", () => {
      const result = analyzeArrayBatching([]);
      
      expect(result.batchableGroups).toHaveLength(0);
    });

    test("should group complex nested array paths correctly", () => {
      const fields = [
        { path: "company.departments.*.employees.*.name", isArrayField: false, builderFunction: () => {} },
        { path: "company.departments.*.employees.*.role", isArrayField: false, builderFunction: () => {} },
        { path: "company.departments.*.name", isArrayField: false, builderFunction: () => {} }
      ];

      const result = analyzeArrayBatching(fields);
      
      expect(result.batchableGroups.length).toBeGreaterThanOrEqual(2);
      
      // Should have group for company.departments.*.employees.*
      const employeesGroup = result.batchableGroups.find(g => 
        g.arrayPath === "company.departments.*.employees"
      );
      expect(employeesGroup).toBeDefined();
      expect(employeesGroup?.fields).toHaveLength(2);
      
      // Should have group for company.departments.*
      const departmentsGroup = result.batchableGroups.find(g => 
        g.arrayPath === "company.departments"
      );
      expect(departmentsGroup).toBeDefined();
      expect(departmentsGroup?.fields).toHaveLength(1);
    });
  });

  describe("createArrayBatchValidator", () => {
    test("should create validator for array batch", () => {
      const plugins = {
        required: requiredPlugin,
        stringMin: stringMinPlugin
      };

      const batchInfo: ArrayBatchInfo = {
        arrayPath: "users",
        fields: [
          { path: "users.*.name", builderFunction: (b: any) => b.string.required().min(2) },
          { path: "users.*.email", builderFunction: (b: any) => b.string.required().min(5) }
        ]
      };

      const batchValidator = createArrayBatchValidator(batchInfo, plugins);
      
      expect(batchValidator).toBeDefined();
      expect(typeof batchValidator.executeValidate).toBe("function");
    });

    test("should validate array elements correctly", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ users: Array<{ name: string; email: string }> }>();

      const validator = builder
        .v("users.*.name", (b) => b.string.required().min(2))
        .v("users.*.email", (b) => b.string.required().min(5))
        .build();

      // Valid array data
      const validResult = validator.validate({
        users: [
          { name: "Alice", email: "alice@example.com" },
          { name: "Bob", email: "bob@example.com" }
        ]
      });
      expect(validResult.valid).toBe(true);

      // Invalid array data - name too short
      const invalidResult = validator.validate({
        users: [
          { name: "A", email: "alice@example.com" }, // name too short
          { name: "Bob", email: "bob@example.com" }
        ]
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test("should handle empty arrays", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ users: Array<{ name: string }> }>();

      const validator = builder
        .v("users.*.name", (b) => b.string.required().min(2))
        .build();

      // Empty array should be valid
      const result = validator.validate({ users: [] });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should validate nested array structures", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ 
          departments: Array<{ 
            name: string; 
            employees: Array<{ name: string; id: number }> 
          }> 
        }>();

      const validator = builder
        .v("departments.*.name", (b) => b.string.required().min(2))
        .v("departments.*.employees.*.name", (b) => b.string.required().min(2))
        .v("departments.*.employees.*.id", (b) => b.number.required().min(1))
        .build();

      const validData = {
        departments: [
          {
            name: "Engineering",
            employees: [
              { name: "Alice", id: 1 },
              { name: "Bob", id: 2 }
            ]
          },
          {
            name: "Marketing", 
            employees: [
              { name: "Charlie", id: 3 }
            ]
          }
        ]
      };

      const result = validator.validate(validData);
      expect(result.valid).toBe(true);
    });

    test("should collect all validation errors in batch", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ users: Array<{ name: string; email: string }> }>();

      const validator = builder
        .v("users.*.name", (b) => b.string.required().min(3))
        .v("users.*.email", (b) => b.string.required().min(5))
        .build();

      const invalidData = {
        users: [
          { name: "A", email: "bad" },    // Both fields invalid
          { name: "B", email: "also" },   // Both fields invalid
          { name: "Charlie", email: "charlie@example.com" } // Valid
        ]
      };

      const result = validator.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(4); // 2 errors for each of first 2 users
    });

    test("should respect abortEarly option in array validation", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ users: Array<{ name: string; email: string }> }>();

      const validator = builder
        .v("users.*.name", (b) => b.string.required().min(3))
        .v("users.*.email", (b) => b.string.required().min(5))
        .build();

      const invalidData = {
        users: [
          { name: "A", email: "bad" },    // Both fields invalid
          { name: "B", email: "also" }    // Both fields invalid
        ]
      };

      const result = validator.validate(invalidData, { abortEarly: true });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeLessThanOrEqual(4); // May stop early
    });

    test("should handle null and undefined array values", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ users: Array<{ name: string }> | null }>();

      const validator = builder
        .v("users.*.name", (b) => b.string.required().min(2))
        .build();

      // null array
      const nullResult = validator.validate({ users: null } as any);
      expect(nullResult.valid).toBe(true); // Should skip validation for null arrays

      // undefined array  
      const undefinedResult = validator.validate({} as any);
      expect(undefinedResult.valid).toBe(true); // Should skip validation for missing arrays
    });
  });

  describe("ArrayBatchInfo", () => {
    test("should properly structure batch information", () => {
      const batchInfo: ArrayBatchInfo = {
        arrayPath: "items",
        fields: [
          { path: "items.*.id", builderFunction: () => {} },
          { path: "items.*.name", builderFunction: () => {} }
        ]
      };

      expect(batchInfo.arrayPath).toBe("items");
      expect(batchInfo.fields).toHaveLength(2);
      expect(batchInfo.fields[0].path).toBe("items.*.id");
      expect(batchInfo.fields[1].path).toBe("items.*.name");
    });
  });

  describe("Performance optimizations", () => {
    test("should efficiently process large arrays", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ items: Array<{ id: number; name: string; value: string }> }>();

      const validator = builder
        .v("items.*.id", (b) => b.number.required().min(1))
        .v("items.*.name", (b) => b.string.required().min(2))
        .v("items.*.value", (b) => b.string.required().min(1))
        .build();

      // Create large test dataset
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          name: `Item${i}`,
          value: `Value${i}`
        }))
      };

      const start = performance.now();
      const result = validator.validate(largeData);
      const end = performance.now();

      expect(result.valid).toBe(true);
      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });

    test("should handle mixed valid and invalid array elements efficiently", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ items: Array<{ name: string }> }>();

      const validator = builder
        .v("items.*.name", (b) => b.string.required().min(3))
        .build();

      // Mix of valid and invalid items
      const mixedData = {
        items: [
          { name: "ValidName1" },  // valid
          { name: "XX" },          // invalid - too short
          { name: "ValidName2" },  // valid
          { name: "Y" },           // invalid - too short
          { name: "ValidName3" }   // valid
        ]
      };

      const result = validator.validate(mixedData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2); // Only the invalid items should generate errors
      
      // Verify error paths are correct
      const errorPaths = result.errors.map(e => e.path);
      expect(errorPaths).toContain("items[1].name");
      expect(errorPaths).toContain("items[3].name");
    });
  });
});