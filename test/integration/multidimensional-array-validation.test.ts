import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../src/core/plugin/numberMax";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";

describe("Multi-dimensional Array Validation Integration Tests", () => {
  describe("2D Array Validation (Matrix)", () => {
    test("should validate 2D number matrix with constraints", () => {
      // Define a 2D matrix type
      type Matrix2D = {
        imageData: number[][];
        metadata: {
          width: number;
          height: number;
        };
      };

      // Build validator
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(arrayMinLengthPlugin)
        .for<Matrix2D>()
        .v("imageData", (b) => b.array.required().minLength(1))
        // For 2D array: imageData is array of arrays, so we need to validate each sub-array
        // Note: Current API doesn't support direct nested array notation,
        // but the optimizer should detect this pattern
        .v("metadata.width", (b) => b.number.required().min(1))
        .v("metadata.height", (b) => b.number.required().min(1))
        .build();

      // Valid data
      const validData: Matrix2D = {
        imageData: [
          [255, 128, 0],
          [100, 200, 50],
          [0, 0, 255],
        ],
        metadata: {
          width: 3,
          height: 3,
        },
      };

      const validResult = validator.validate(validData);
      expect(validresult.isValid()).toBe(true);

      // Invalid data - pixel value out of range
      const invalidData: Matrix2D = {
        imageData: [
          [255, 128, 300], // 300 > 255
          [100, -10, 50], // -10 < 0
        ],
        metadata: {
          width: 3,
          height: 2,
        },
      };

      const invalidResult = validator.validate(invalidData);
      expect(invalidresult.isValid()).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);

      // Check error paths
      const errorPaths = invalidResult.errors.map((e) => e.path);
      expect(errorPaths).toContain("imageData[0][2]"); // 300 > 255
      expect(errorPaths).toContain("imageData[1][1]"); // -10 < 0
    });

    test("should validate string matrix (2D array)", () => {
      type StringGrid = {
        grid: string[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<StringGrid>()
        .v("grid", (b) => b.array.required())
        .build();

      const validGrid: StringGrid = {
        grid: [
          ["A", "B", "C"],
          ["D", "E", "F"],
        ],
      };

      expect(validator.validate(validGrid).valid).toBe(true);

      const invalidGrid: StringGrid = {
        grid: [
          ["A", "", "C"], // Empty string
          ["D", "E", "F"],
        ],
      };

      const result = validator.validate(invalidGrid);
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].path).toBe("grid[0][1]");
    });
  });

  describe("3D Array Validation (Tensor)", () => {
    test("should validate 3D tensor with complex constraints", () => {
      type Tensor3D = {
        name: string;
        data: {
          value: number;
          label: string;
        }[][][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Tensor3D>()
        .v("name", (b) => b.string.required().min(1))
        .v("data", (b) => b.array.required().minLength(1))
        // Note: For deep nested arrays, current API limitations mean we can't directly
        // validate inner array structures, but our optimizer should handle this
        .build();

      // Valid 3D tensor (2x2x2)
      const validTensor: Tensor3D = {
        name: "Neural Network Weights",
        data: [
          [
            [
              { value: 0.5, label: "w1" },
              { value: -0.3, label: "w2" },
            ],
            [
              { value: 0.8, label: "w3" },
              { value: -0.9, label: "w4" },
            ],
          ],
          [
            [
              { value: 0.1, label: "w5" },
              { value: -0.2, label: "w6" },
            ],
            [
              { value: 0.7, label: "w7" },
              { value: -0.6, label: "w8" },
            ],
          ],
        ],
      };

      const validResult = validator.validate(validTensor);
      expect(validresult.isValid()).toBe(true);

      // Invalid tensor - values out of range
      const invalidTensor: Tensor3D = {
        name: "Invalid Tensor",
        data: [
          [
            [
              { value: 1.5, label: "w1" },
              { value: -2.0, label: "w2" },
            ], // Both out of range
            [{ value: 0.8, label: "" }], // Empty label
          ],
        ],
      };

      const invalidResult = validator.validate(invalidTensor);
      expect(invalidresult.isValid()).toBe(false);

      const errors = invalidResult.errors;
      expect(errors.length).toBeGreaterThanOrEqual(3);

      // Verify error paths for 3D array
      const errorPaths = errors.map((e) => e.path);
      expect(errorPaths).toContain("data[0][0][0].value"); // 1.5 > 1
      expect(errorPaths).toContain("data[0][0][1].value"); // -2.0 < -1
      expect(errorPaths).toContain("data[0][1][0].label"); // Empty string
    });
  });

  describe("4D Array Validation", () => {
    test("should validate 4D array structure", () => {
      type Tensor4D = {
        hyperCube: number[][][][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<Tensor4D>()
        .v("hyperCube", (b) => b.array.required())
        // 4D arrays are a special case that tests our multi-dimensional optimization
        .build();

      // Valid 4D array (2x2x2x2)
      const valid4D: Tensor4D = {
        hyperCube: [
          [
            [
              [1, 2],
              [3, 4],
            ],
            [
              [5, 6],
              [7, 8],
            ],
          ],
          [
            [
              [9, 10],
              [11, 12],
            ],
            [
              [13, 14],
              [15, 16],
            ],
          ],
        ],
      };

      expect(validator.validate(valid4D).valid).toBe(true);

      // Invalid 4D array with negative number
      const invalid4D: Tensor4D = {
        hyperCube: [
          [
            [
              [1, -2],
              [3, 4],
            ], // -2 < 0
            [
              [5, 6],
              [7, 8],
            ],
          ],
          [
            [
              [9, 10],
              [11, 12],
            ],
            [
              [13, 14],
              [-15, 16],
            ], // -15 < 0
          ],
        ],
      };

      const result = validator.validate(invalid4D);
      expect(result.isValid()).toBe(false);

      const errorPaths = result.errors.map((e) => e.path);
      expect(errorPaths).toContain("hyperCube[0][0][0][1]"); // -2
      expect(errorPaths).toContain("hyperCube[1][1][1][0]"); // -15
    });
  });

  describe("Mixed Array Depths", () => {
    test("should validate structure with arrays at different depths", () => {
      type ComplexStructure = {
        simple: string[];
        matrix: number[][];
        deep: {
          tensor: boolean[][][];
          metadata: string;
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<ComplexStructure>()
        .v("simple", (b) => b.array.required())
        .v("matrix", (b) => b.array.required())
        .v("deep.tensor", (b) => b.array.required())
        .v("deep.metadata", (b) => b.string.required().min(1))
        .build();

      const validData: ComplexStructure = {
        simple: ["a", "b", "c"],
        matrix: [
          [1, 2],
          [3, 4],
        ],
        deep: {
          tensor: [
            [
              [true, false],
              [false, true],
            ],
            [
              [false, false],
              [true, true],
            ],
          ],
          metadata: "test",
        },
      };

      expect(validator.validate(validData).valid).toBe(true);

      // Test with various invalid data points
      const invalidData: ComplexStructure = {
        simple: ["a", "", "c"], // Empty string in simple array
        matrix: [
          [1, -2],
          [3, 4],
        ], // Negative number in matrix
        deep: {
          tensor: [
            [
              [true, false],
              [false, true],
            ],
            [
              [false, false],
              [true, true],
            ],
          ],
          metadata: "", // Empty metadata
        },
      };

      const result = validator.validate(invalidData);
      expect(result.isValid()).toBe(false);

      const errorPaths = result.errors.map((e) => e.path);
      expect(errorPaths).toContain("simple[1]");
      expect(errorPaths).toContain("matrix[0][1]");
      expect(errorPaths).toContain("deep.metadata");
    });
  });

  describe("Performance Tests", () => {
    test("should efficiently validate large 3D arrays", () => {
      type LargeData = {
        tensor: number[][][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<LargeData>()
        .v("tensor", (b) => b.array.required())
        .build();

      // Generate large 3D array (10x10x10 = 1000 elements)
      const largeData: LargeData = {
        tensor: Array(10)
          .fill(0)
          .map(() =>
            Array(10)
              .fill(0)
              .map(() =>
                Array(10)
                  .fill(0)
                  .map(() => Math.floor(Math.random() * 101))
              )
          ),
      };

      const startTime = performance.now();
      const result = validator.validate(largeData);
      const endTime = performance.now();

      expect(result.isValid()).toBe(true);

      // Performance assertion - should complete in reasonable time
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms

      console.log(`Validated 1000 elements in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty arrays at various levels", () => {
      type EdgeCase = {
        emptyOuter: any[][];
        emptyInner: number[][];
        mixed: string[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .for<EdgeCase>()
        .v("emptyOuter", (b) => b.array.required())
        .v("emptyInner", (b) => b.array.required())
        .v("mixed", (b) => b.array.required())
        .build();

      const data: EdgeCase = {
        emptyOuter: [], // Empty outer array
        emptyInner: [[], [], []], // Empty inner arrays
        mixed: [["a"], [], ["b", "c"]], // Mixed empty/non-empty
      };

      const result = validator.validate(data);
      expect(result.isValid()).toBe(true);
    });

    test("should handle null/undefined in multi-dimensional arrays", () => {
      type NullableArray = {
        data: (number | null | undefined)[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<NullableArray>()
        .v("data", (b) => b.array.required())
        .build();

      const data: NullableArray = {
        data: [
          [1, null, 3],
          [undefined, 5, 6],
          [7, 8, null],
        ],
      };

      // This should validate successfully as we didn't mark individual elements as required
      const result = validator.validate(data);
      expect(result.isValid()).toBe(true);
    });
  });
});
