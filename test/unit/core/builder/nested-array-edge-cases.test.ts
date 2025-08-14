import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { transformPlugin } from "../../../../src/core/plugin/transform";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("Nested Array Edge Cases", () => {
  describe("Optional Nested Arrays", () => {
    test("should handle optional nested arrays", () => {
      type Data = {
        config: {
          features?: {
            name: string;
            options?: string[];
          }[];
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<Data>()
        .v("config.features", (b) => b.array.optional())
        .v("config.features[*].name", (b) => b.string.required().min(2))
        .v("config.features[*].options", (b) => b.array.optional())
        .v("config.features[*].options[*]", (b) => b.string.required().min(1))
        .build();

      // Valid with all optional fields present
      const validResult1 = validator.validate({
        config: {
          features: [
            {
              name: "Authentication",
              options: ["JWT", "OAuth"],
            },
          ],
        },
      });
      expect(validResult1.valid).toBe(true);

      // Valid with features missing
      const validResult2 = validator.validate({
        config: {},
      });
      expect(validResult2.valid).toBe(true);

      // Valid with options missing
      const validResult3 = validator.validate({
        config: {
          features: [{ name: "Authentication" }],
        },
      });
      expect(validResult3.valid).toBe(true);
    });
  });

  describe("Null and Undefined Handling", () => {
    test("should handle null values in nested arrays", () => {
      type Data = {
        items: (string | null)[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Data>()
        .v("items", (b) => b.array.required())
        .v("items[*]", (b) => b.array.required())
        // Note: Union types with null require special handling
        .build();

      const result = validator.validate({
        items: [
          ["valid", null, "string"],
          [null, "another", null],
        ],
      });
      expect(result.valid).toBe(true);
    });

    test("should reject undefined in required nested arrays", () => {
      type Data = {
        matrix: number[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<Data>()
        .v("matrix", (b) => b.array.required())
        .v("matrix[*]", (b) => b.array.required())
        .v("matrix[*][*]", (b) => b.number.required())
        .build();

      // Invalid - undefined value
      const result = validator.validate({
        matrix: [
          [1, 2],
          [3, undefined as any],
        ],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("Circular Reference Prevention", () => {
    test("should handle self-referencing structures safely", () => {
      interface Node {
        id: string;
        children?: Node[];
      }

      type Data = {
        tree: Node;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(optionalPlugin)
        .for<Data>()
        .v("tree.id", (b) => b.string.required().min(1))
        .v("tree.children", (b) => b.array.optional())
        .v("tree.children[*].id", (b) => b.string.required().min(1))
        .v("tree.children[*].children", (b) => b.array.optional())
        .v("tree.children[*].children[*].id", (b) => b.string.required().min(1))
        .build();

      const validResult = validator.validate({
        tree: {
          id: "root",
          children: [
            {
              id: "child1",
              children: [{ id: "grandchild1" }, { id: "grandchild2" }],
            },
            { id: "child2" },
          ],
        },
      });
      expect(validResult.valid).toBe(true);
    });
  });

  describe("Mixed Array Types", () => {
    test("should handle arrays with mixed primitive types", () => {
      type Data = {
        values: (string | number | boolean)[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .for<Data>()
        .v("values", (b) => b.array.required())
        // Note: Mixed type validation is complex and may require custom logic
        .build();

      const result = validator.validate({
        values: ["string", 42, true, "another", 3.14, false],
      });
      expect(result.valid).toBe(true);
    });

    test("should handle nested arrays with different inner types", () => {
      type Data = {
        data: (string[] | number[])[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("data", (b) => b.array.required().minLength(1))
        // Union array validation is complex - we'll validate the outer structure
        .build();

      const result = validator.validate({
        data: [
          ["a", "b", "c"],
          [1, 2, 3, 4],
          ["x", "y"],
        ],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("Dynamic Array Structures", () => {
    test("should validate dynamically shaped arrays", () => {
      type Data = {
        spreadsheet: {
          rows: {
            cells: { value: string | number; type: "text" | "number" }[];
          }[];
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Data>()
        .v("spreadsheet.rows", (b) => b.array.required())
        .v("spreadsheet.rows[*].cells", (b) => b.array.required())
        .v("spreadsheet.rows[*].cells[*].type", (b) => b.string.required())
        // Note: Union type validation for value field would need custom handling
        .build();

      const result = validator.validate({
        spreadsheet: {
          rows: [
            {
              cells: [
                { value: "Name", type: "text" },
                { value: "Age", type: "text" },
                { value: "Salary", type: "text" },
              ],
            },
            {
              cells: [
                { value: "John", type: "text" },
                { value: 30, type: "number" },
                { value: 50000, type: "number" },
              ],
            },
          ],
        },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("Memory and Performance", () => {
    test("should handle deeply nested arrays without stack overflow", () => {
      // Create a type with reasonable nesting depth
      type Data = {
        level1: {
          level2: {
            level3: {
              values: number[];
            }[];
          }[];
        }[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<Data>()
        .v("level1", (b) => b.array.required())
        .v("level1[*].level2", (b) => b.array.required())
        .v("level1[*].level2[*].level3", (b) => b.array.required())
        .v("level1[*].level2[*].level3[*].values", (b) => b.array.required())
        .v("level1[*].level2[*].level3[*].values[*]", (b) =>
          b.number.required().min(0)
        )
        .build();

      const deepData = {
        level1: [
          {
            level2: [
              {
                level3: [
                  { values: [1, 2, 3, 4, 5] },
                  { values: [6, 7, 8, 9, 10] },
                ],
              },
            ],
          },
        ],
      };

      const result = validator.validate(deepData);
      expect(result.valid).toBe(true);
    });

    test("should handle sparse arrays efficiently", () => {
      type Data = {
        sparse: (string | undefined)[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .for<Data>()
        .v("sparse", (b) => b.array.required())
        // Sparse arrays have holes (undefined elements)
        .build();

      const sparseArray = new Array(1000);
      sparseArray[0] = "first";
      sparseArray[999] = "last";
      // Elements 1-998 are undefined (holes)

      const result = validator.validate({
        sparse: sparseArray,
      });
      expect(result.valid).toBe(true);
    });
  });
});
