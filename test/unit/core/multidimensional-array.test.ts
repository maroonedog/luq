import { describe, test, expect } from "@jest/globals";
import {
  BuildTimeArrayAnalyzer,
  ArrayDepth,
  ArrayElementType,
} from "../../../src/types/array-type-analysis";

describe("Multi-dimensional Array Build-time Analysis", () => {
  test("should correctly analyze array depth at compile time", () => {
    // Type-level tests - these should compile correctly
    type SimpleArray = string[];
    type DoubleArray = string[][];
    type TripleArray = string[][][];
    type ComplexArray = Array<Array<{ id: number; data: string }[]>>;

    // Runtime verification of the type analysis
    // The actual depth calculation is done at runtime by BuildTimeArrayAnalyzer
    const simpleArray = ["a", "b"];
    const doubleArray = [
      ["a", "b"],
      ["c", "d"],
    ];
    const tripleArray = [[["a", "b"]], [["c", "d"]]];

    const simpleStructure = BuildTimeArrayAnalyzer.analyzeArrayStructure(
      "simple",
      simpleArray
    );
    const doubleStructure = BuildTimeArrayAnalyzer.analyzeArrayStructure(
      "double",
      doubleArray
    );
    const tripleStructure = BuildTimeArrayAnalyzer.analyzeArrayStructure(
      "triple",
      tripleArray
    );

    expect(simpleStructure.depth).toBe(1);
    expect(doubleStructure.depth).toBe(2);
    expect(tripleStructure.depth).toBe(3);

    // Type-level compilation tests (these should not produce TypeScript errors)
    type TestSimpleDepth = ArrayDepth<SimpleArray>;
    type TestDoubleDepth = ArrayDepth<DoubleArray>;
    type TestTripleDepth = ArrayDepth<TripleArray>;

    // These type assertions verify that the types compile correctly
    const _simpleDepthTypeCheck: TestSimpleDepth = 1;
    const _doubleDepthTypeCheck: TestDoubleDepth = 2;
    const _tripleDepthTypeCheck: TestTripleDepth = 3;

    expect(_simpleDepthTypeCheck).toBe(1);
    expect(_doubleDepthTypeCheck).toBe(2);
    expect(_tripleDepthTypeCheck).toBe(3);
  });

  test("should extract element types correctly", () => {
    type SimpleArray = { name: string }[];
    type DoubleArray = { name: string }[][];
    type TripleArray = { name: string }[][][];

    // Type-level element extraction
    const simpleElement: ArrayElementType<SimpleArray> = { name: "test" };
    const doubleElement: ArrayElementType<DoubleArray> = { name: "test" };
    const tripleElement: ArrayElementType<TripleArray> = { name: "test" };

    expect(simpleElement.name).toBe("test");
    expect(doubleElement.name).toBe("test");
    expect(tripleElement.name).toBe("test");
  });

  test("should analyze runtime array structure", () => {
    // Test single-dimensional array
    const singleArray = ["a", "b", "c"];
    const singleStructure = BuildTimeArrayAnalyzer.analyzeArrayStructure(
      "items",
      singleArray
    );

    expect(singleStructure.depth).toBe(1);
    expect(singleStructure.loopVariables).toEqual(["i"]);
    expect(singleStructure.indexPattern).toBe("[i]");

    // Test double-dimensional array
    const doubleArray = [
      ["a", "b"],
      ["c", "d"],
    ];
    const doubleStructure = BuildTimeArrayAnalyzer.analyzeArrayStructure(
      "matrix",
      doubleArray
    );

    expect(doubleStructure.depth).toBe(2);
    expect(doubleStructure.loopVariables).toEqual(["i", "j"]);
    expect(doubleStructure.indexPattern).toBe("[i][j]");

    // Test triple-dimensional array
    const tripleArray = [
      [
        ["a", "b"],
        ["c", "d"],
      ],
      [
        ["e", "f"],
        ["g", "h"],
      ],
    ];
    const tripleStructure = BuildTimeArrayAnalyzer.analyzeArrayStructure(
      "cube",
      tripleArray
    );

    expect(tripleStructure.depth).toBe(3);
    expect(tripleStructure.loopVariables).toEqual(["i", "j", "k"]);
    expect(tripleStructure.indexPattern).toBe("[i][j][k]");
  });

  test("should generate optimized validator for 2D arrays", () => {
    const structure = {
      depth: 2,
      elementType: { r: 0, g: 0, b: 0 },
      indexPattern: "[i][j]",
      loopVariables: ["i", "j"] as const,
    };

    const elementValidator = (element: any, path: string) => ({
      valid: element && typeof element.r === "number",
      errors:
        element && typeof element.r === "number"
          ? []
          : [
              {
                path,
                code: "INVALID_PIXEL",
                message: "Invalid pixel data",
                paths: () => [path],
              },
            ],
    });

    const validator = BuildTimeArrayAnalyzer.generateOptimizedValidator(
      structure,
      "imageData",
      elementValidator
    );

    // Test with valid 2D array
    const validImageData = [
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
      ],
      [
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 255, b: 255 },
      ],
    ];

    const validResult = validator(validImageData);
    expect(validresult.isValid()).toBe(true);
    expect(validResult.errors).toEqual([]);

    // Test with invalid data
    const invalidImageData = [
      [{ r: "invalid", g: 0, b: 0 }],
      [{ r: 0, g: 255, b: 255 }],
    ];

    const invalidResult = validator(invalidImageData);
    expect(invalidresult.isValid()).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  test("should generate optimized validator for 3D arrays", () => {
    const structure = {
      depth: 3,
      elementType: { value: 0 },
      indexPattern: "[i][j][k]",
      loopVariables: ["i", "j", "k"] as const,
    };

    const elementValidator = (element: any, path: string) => ({
      valid: element && typeof element.value === "number",
      errors:
        element && typeof element.value === "number"
          ? []
          : [
              {
                path,
                code: "INVALID_VALUE",
                message: "Invalid value",
                paths: () => [path],
              },
            ],
    });

    const validator = BuildTimeArrayAnalyzer.generateOptimizedValidator(
      structure,
      "tensor",
      elementValidator
    );

    // Test with valid 3D array (2x2x2 tensor)
    const validTensor = [
      [
        [{ value: 1 }, { value: 2 }],
        [{ value: 3 }, { value: 4 }],
      ],
      [
        [{ value: 5 }, { value: 6 }],
        [{ value: 7 }, { value: 8 }],
      ],
    ];

    const validResult = validator(validTensor);
    expect(validresult.isValid()).toBe(true);
    expect(validResult.errors).toEqual([]);

    // Test with invalid structure (not an array at second level)
    const invalidTensor = [
      "not an array",
      [
        [{ value: 5 }, { value: 6 }],
        [{ value: 7 }, { value: 8 }],
      ],
    ];

    const invalidResult = validator(invalidTensor);
    expect(invalidresult.isValid()).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  test("should handle 4D+ arrays with generic loop variables", () => {
    const structure = {
      depth: 5,
      elementType: { data: "test" },
      indexPattern: "[i][j][k][l][m]",
      loopVariables: ["i", "j", "k", "l", "m"] as const,
    };

    const elementValidator = (element: any, path: string) => ({
      valid: true,
      errors: [],
    });

    const validator = BuildTimeArrayAnalyzer.generateOptimizedValidator(
      structure,
      "hyperTensor",
      elementValidator
    );

    // Test with valid 5D array (minimal size for testing)
    const hyperTensor = [[[[[{ data: "test" }]]]]];

    const result = validator(hyperTensor);
    expect(result.isValid()).toBe(true);
  });

  test("should handle error propagation in nested loops", () => {
    const structure = {
      depth: 2,
      elementType: { required: true },
      indexPattern: "[i][j]",
      loopVariables: ["i", "j"] as const,
    };

    const elementValidator = (element: any, path: string) => {
      if (!element || !element.required) {
        return {
          valid: false,
          errors: [
            {
              path,
              code: "MISSING_REQUIRED",
              message: "Required field is missing",
              paths: () => [path],
            },
          ],
        };
      }
      return { valid: true, errors: [] };
    };

    const validator = BuildTimeArrayAnalyzer.generateOptimizedValidator(
      structure,
      "data",
      elementValidator
    );

    // Array with multiple errors at different positions
    const dataWithErrors = [
      [{ required: true }, { required: false }], // Error at [0][1]
      [{ required: true }, null], // Error at [1][1]
    ];

    const result = validator(dataWithErrors);
    expect(result.isValid()).toBe(false);
    expect(result.errors.length).toBe(2);

    // Check that error paths are correctly generated
    const errorPaths = result.errors.map((e) => e.path);
    expect(errorPaths).toContain("data[0][1]");
    expect(errorPaths).toContain("data[1][1]");
  });
});
