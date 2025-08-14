import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { transformPlugin } from "../../../../src/core/plugin/transform";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";

describe("Nested Array - Comprehensive Test Cases", () => {
  describe("Multi-dimensional Array Patterns", () => {
    test("should validate 2D number arrays with [*][*] pattern", () => {
      type Data = {
        matrix: number[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<Data>()
        .v("matrix", (b) => b.array.required().minLength(2))
        .v("matrix[*]", (b) => b.array.required().minLength(3))
        .v("matrix[*][*]", (b) => b.number.required().min(0).max(100))
        .build();

      // Valid 2D array
      const validResult = validator.validate({
        matrix: [
          [1, 2, 3],
          [4, 5, 6]
        ]
      });
      expect(validResult.valid).toBe(true);

      // Invalid - number out of range
      const invalidResult = validator.validate({
        matrix: [
          [1, 2, 101], // 101 > max(100)
          [4, 5, 6]
        ]
      });
      expect(invalidResult.valid).toBe(false);
    });

    test("should validate 3D number arrays with [*][*][*] pattern", () => {
      type Data = {
        cube: number[][][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(numberMinPlugin)
        .for<Data>()
        .v("cube", (b) => b.array.required().minLength(1))
        .v("cube[*]", (b) => b.array.required().minLength(2))
        .v("cube[*][*]", (b) => b.array.required().minLength(2))
        .v("cube[*][*][*]" as any, (b) => b.number.required().min(0))
        .build();

      // Valid 3D array
      const validResult = validator.validate({
        cube: [
          [
            [1, 2], 
            [3, 4]
          ],
          [
            [5, 6], 
            [7, 8]
          ]
        ]
      });
      expect(validResult.valid).toBe(true);

      // Invalid - negative number
      const invalidResult = validator.validate({
        cube: [
          [
            [1, -1], // -1 < min(0)
            [3, 4]
          ]
        ]
      });
      expect(invalidResult.valid).toBe(false);
    });

    test("should handle mixed depth arrays (jagged arrays)", () => {
      type Data = {
        items: (string | string[])[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Data>()
        .v("items", (b) => b.array.required())
        // Note: This is a complex case - elements can be either string or string[]
        // We'll validate this as a union type scenario
        .build();

      const validResult = validator.validate({
        items: ["simple", ["nested", "array"], "another"]
      });
      expect(validResult.valid).toBe(true);
    });
  });

  describe("Nested Arrays with Objects", () => {
    test("should validate array of objects with nested arrays", () => {
      type Data = {
        departments: {
          name: string;
          teams: {
            name: string;
            members: string[];
            projects: {
              title: string;
              tags: string[];
            }[];
          }[];
        }[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("departments", (b) => b.array.required().minLength(1))
        .v("departments[*].name", (b) => b.string.required().min(2))
        .v("departments[*].teams", (b) => b.array.required().minLength(1))
        .v("departments[*].teams[*].name", (b) => b.string.required().min(2))
        .v("departments[*].teams[*].members", (b) => b.array.required().minLength(1))
        .v("departments[*].teams[*].members[*]", (b) => b.string.required().min(2))
        .v("departments[*].teams[*].projects", (b) => b.array.required().minLength(1))
        .v("departments[*].teams[*].projects[*].title", (b) => b.string.required().min(3))
        .v("departments[*].teams[*].projects[*].tags", (b) => b.array.required().minLength(1))
        .v("departments[*].teams[*].projects[*].tags[*]", (b) => b.string.required().min(2))
        .build();

      const validResult = validator.validate({
        departments: [
          {
            name: "Engineering",
            teams: [
              {
                name: "Frontend",
                members: ["Alice", "Bob"],
                projects: [
                  {
                    title: "Web App",
                    tags: ["React", "TypeScript"]
                  }
                ]
              }
            ]
          }
        ]
      });
      expect(validResult.valid).toBe(true);

      // Invalid - tag too short
      const invalidResult = validator.validate({
        departments: [
          {
            name: "Engineering",
            teams: [
              {
                name: "Frontend",
                members: ["Alice", "Bob"],
                projects: [
                  {
                    title: "Web App",
                    tags: ["R"] // Too short (min 2)
                  }
                ]
              }
            ]
          }
        ]
      });
      expect(invalidResult.valid).toBe(false);
    });

    test("should validate nested arrays with transformations", () => {
      type Data = {
        categories: {
          name: string;
          subcategories: {
            name: string;
            items: string[];
          }[];
        }[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("categories", (b) => b.array.required())
        .v("categories[*].name", (b) => 
          b.string.required().transform((v) => v.toUpperCase())
        )
        .v("categories[*].subcategories", (b) => b.array.required())
        .v("categories[*].subcategories[*].name", (b) => 
          b.string.required().transform((v) => v.toLowerCase())
        )
        .v("categories[*].subcategories[*].items", (b) => b.array.required().minLength(1))
        .v("categories[*].subcategories[*].items[*]", (b) => 
          b.string.required().transform((v) => v.trim())
        )
        .build();

      const parseResult = validator.parse({
        categories: [
          {
            name: "electronics",
            subcategories: [
              {
                name: "PHONES",
                items: ["  iPhone  ", "  Android  "]
              }
            ]
          }
        ]
      });

      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.categories[0].name).toBe("ELECTRONICS");
        expect(data?.categories[0].subcategories[0].name).toBe("phones");
        expect(data?.categories[0].subcategories[0].items[0]).toBe("iPhone");
        expect(data?.categories[0].subcategories[0].items[1]).toBe("Android");
      }
    });
  });

  describe("Complex Nested Patterns", () => {
    test("should validate matrix of objects", () => {
      type Data = {
        grid: {
          x: number;
          y: number;
          value: string;
        }[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("grid", (b) => b.array.required().minLength(2))
        .v("grid[*]", (b) => b.array.required().minLength(2))
        .v("grid[*][*].x", (b) => b.number.required().min(0))
        .v("grid[*][*].y", (b) => b.number.required().min(0))
        .v("grid[*][*].value", (b) => b.string.required().min(1))
        .build();

      const validResult = validator.validate({
        grid: [
          [
            { x: 0, y: 0, value: "A" },
            { x: 0, y: 1, value: "B" }
          ],
          [
            { x: 1, y: 0, value: "C" },
            { x: 1, y: 1, value: "D" }
          ]
        ]
      });
      expect(validResult.valid).toBe(true);

      // Invalid - negative coordinate
      const invalidResult = validator.validate({
        grid: [
          [
            { x: -1, y: 0, value: "A" }, // x < 0
            { x: 0, y: 1, value: "B" }
          ]
        ]
      });
      expect(invalidResult.valid).toBe(false);
    });

    test("should validate deeply nested arrays with mixed types", () => {
      type Data = {
        data: {
          sections: {
            title: string;
            rows: {
              cells: (string | number | boolean)[];
            }[];
          }[];
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("data.sections", (b) => b.array.required().minLength(1))
        .v("data.sections[*].title", (b) => b.string.required().min(3))
        .v("data.sections[*].rows", (b) => b.array.required().minLength(1))
        .v("data.sections[*].rows[*].cells", (b) => b.array.required().minLength(1))
        // Note: Union types in arrays are complex - we'll validate presence
        .build();

      const validResult = validator.validate({
        data: {
          sections: [
            {
              title: "Summary",
              rows: [
                { cells: ["Name", "Age", true] },
                { cells: ["John", 25, false] }
              ]
            }
          ]
        }
      });
      expect(validResult.valid).toBe(true);
    });

    test("should handle empty nested arrays correctly", () => {
      type Data = {
        levels: {
          items: string[][];
        }[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayMaxLengthPlugin)
        .for<Data>()
        .v("levels", (b) => b.array.required())
        .v("levels[*].items", (b) => b.array.required())
        // Allow empty inner arrays but require at least one item in items array
        .v("levels[*].items[*]", (b) => b.array.required().minLength(0).maxLength(10))
        .build();

      // Valid - empty inner arrays are allowed
      const validResult = validator.validate({
        levels: [
          { items: [[], ["a", "b"], []] }
        ]
      });
      expect(validResult.valid).toBe(true);

      // Invalid - too many items in inner array
      const invalidResult = validator.validate({
        levels: [
          { items: [["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]] } // 11 > max(10)
        ]
      });
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe("Performance and Edge Cases", () => {
    test("should handle large nested arrays efficiently", () => {
      type Data = {
        data: number[][][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("data", (b) => b.array.required())
        .v("data[*]", (b) => b.array.required())
        .v("data[*][*]", (b) => b.array.required().minLength(1))
        .v("data[*][*][*]" as any, (b) => b.number.required().min(0))
        .build();

      // Create a reasonably large 3D array
      const largeData = {
        data: Array(5).fill(0).map(() => 
          Array(5).fill(0).map(() => 
            Array(5).fill(0).map((_, i) => i)
          )
        )
      };

      const start = Date.now();
      const result = validator.validate(largeData);
      const duration = Date.now() - start;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(100); // Should validate within 100ms
    });

    test("should provide accurate error paths for nested arrays", () => {
      type Data = {
        matrix: {
          value: number;
        }[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<Data>()
        .v("matrix", (b) => b.array.required())
        .v("matrix[*]", (b) => b.array.required())
        .v("matrix[*][*].value", (b) => b.number.required().min(10))
        .build();

      const result = validator.validate({
        matrix: [
          [{ value: 15 }, { value: 5 }], // value: 5 < min(10)
          [{ value: 20 }, { value: 8 }]  // value: 8 < min(10)
        ]
      }, { abortEarly: false });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that error paths are accurate
      const errorPaths = result.errors.map(e => e.path);
      expect(errorPaths.some(path => path.includes("matrix[0][1]"))).toBe(true);
      expect(errorPaths.some(path => path.includes("matrix[1][1]"))).toBe(true);
    });
  });

  describe("Array Validation with Pick", () => {
    test("should pick nested array fields correctly", () => {
      type Data = {
        users: {
          profile: {
            tags: string[];
            scores: number[][];
          };
        }[];
        metadata: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("users", (b) => b.array.required())
        .v("users[*].profile.tags", (b) => b.array.required().minLength(1))
        .v("users[*].profile.tags[*]", (b) => b.string.required().min(2))
        .v("users[*].profile.scores", (b) => b.array.required())
        .v("users[*].profile.scores[*]", (b) => b.array.required().minLength(1))
        .v("users[*].profile.scores[*][*]", (b) => b.number.required().min(0))
        .v("metadata", (b) => b.string.required())
        .build();

      // Pick the users array
      const usersPicker = validator.pick("users");
      
      const validResult = usersPicker.validate([
        {
          profile: {
            tags: ["developer", "senior"],
            scores: [[85, 90], [75, 88]]
          }
        }
      ]);
      expect(validResult.valid).toBe(true);

      // Invalid nested array data - empty tags array violates minLength(1)
      const invalidResult = usersPicker.validate([
        {
          profile: {
            tags: [], // Empty array violates minLength(1)
            scores: [[85, 90], [75, 88]]
          }
        }
      ]);
      expect(invalidResult.valid).toBe(false);
    });
  });
});