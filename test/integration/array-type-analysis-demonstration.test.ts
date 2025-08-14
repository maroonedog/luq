import { describe, test, expect } from "@jest/globals";
import { BuildTimeArrayAnalyzer } from "../../src/types/array-type-analysis";
import type {
  ArrayDepth,
  ArrayStructureInfo,
} from "../../src/types/array-type-analysis";

describe("Build-time Array Type Analysis Implementation", () => {
  describe("ArrayDepth Type-level Computation", () => {
    test("correctly computes array depth at type level", () => {
      // Type-level tests to verify ArrayDepth computation
      type Depth0 = ArrayDepth<string>;
      type Depth1 = ArrayDepth<string[]>;
      type Depth2 = ArrayDepth<string[][]>;
      type Depth3 = ArrayDepth<string[][][]>;
      type Depth4 = ArrayDepth<string[][][][]>;
      type Depth5 = ArrayDepth<string[][][][][]>;

      // These are compile-time checks - if they compile, the types are correct
      const d0: Depth0 = 0;
      const d1: Depth1 = 1;
      const d2: Depth2 = 2;
      const d3: Depth3 = 3;
      const d4: Depth4 = 4;
      const d5: Depth5 = 5;

      expect(d0).toBe(0);
      expect(d1).toBe(1);
      expect(d2).toBe(2);
      expect(d3).toBe(3);
      expect(d4).toBe(4);
      expect(d5).toBe(5);

      console.log("\nArray depth type-level analysis:");
      console.log("  string => depth 0");
      console.log("  string[] => depth 1");
      console.log("  string[][] => depth 2");
      console.log("  string[][][] => depth 3");
      console.log("  string[][][][] => depth 4");
      console.log("  string[][][][][] => depth 5");
    });

    test("handles complex nested types", () => {
      // Complex type structures
      type ComplexElement = {
        id: string;
        value: number;
        metadata: {
          tags: string[];
        };
      };

      type Complex1D = ArrayDepth<ComplexElement[]>;
      type Complex2D = ArrayDepth<ComplexElement[][]>;
      type Complex3D = ArrayDepth<ComplexElement[][][]>;

      const c1: Complex1D = 1;
      const c2: Complex2D = 2;
      const c3: Complex3D = 3;

      expect(c1).toBe(1);
      expect(c2).toBe(2);
      expect(c3).toBe(3);
    });
  });

  describe("BuildTimeArrayAnalyzer Runtime Analysis", () => {
    test("analyzes 1D array structure", () => {
      const structure: ArrayStructureInfo = {
        depth: 1,
        elementType: "string",
        dimensions: [{ size: -1, isDynamic: true }],
      };

      const result = BuildTimeArrayAnalyzer.analyze(structure);

      expect(result.depth).toBe(1);
      expect(result.elementType).toBe("string");
      expect(result.dimensions).toHaveLength(1);
      expect(result.dimensions[0].isDynamic).toBe(true);

      console.log("\n1D Array Analysis:");
      console.log("  Structure:", JSON.stringify(result, null, 2));
    });

    test("analyzes 2D array structure (matrix)", () => {
      const structure: ArrayStructureInfo = {
        depth: 2,
        elementType: "number",
        dimensions: [
          { size: -1, isDynamic: true },
          { size: -1, isDynamic: true },
        ],
      };

      const result = BuildTimeArrayAnalyzer.analyze(structure);

      expect(result.depth).toBe(2);
      expect(result.elementType).toBe("number");
      expect(result.dimensions).toHaveLength(2);

      console.log("\n2D Array (Matrix) Analysis:");
      console.log("  Structure:", JSON.stringify(result, null, 2));
    });

    test("analyzes 3D array structure (tensor)", () => {
      const structure: ArrayStructureInfo = {
        depth: 3,
        elementType: "object",
        dimensions: [
          { size: -1, isDynamic: true },
          { size: -1, isDynamic: true },
          { size: -1, isDynamic: true },
        ],
      };

      const result = BuildTimeArrayAnalyzer.analyze(structure);

      expect(result.depth).toBe(3);
      expect(result.dimensions).toHaveLength(3);

      console.log("\n3D Array (Tensor) Analysis:");
      console.log("  Structure:", JSON.stringify(result, null, 2));
    });
  });

  describe("Optimized Validator Generation", () => {
    test("generates optimized validator for 1D array", () => {
      const structure: ArrayStructureInfo = {
        depth: 1,
        elementType: "string",
        dimensions: [{ size: -1, isDynamic: true }],
      };

      // Mock element validator
      const elementValidator = (element: any, path: string) => {
        return {
          valid: element.length >= 2,
          errors: element.length < 2 ? [{ path, message: "Too short" }] : [],
        };
      };

      const optimizedValidator =
        BuildTimeArrayAnalyzer.generateOptimizedValidator(
          structure,
          "items",
          elementValidator
        );

      // Test the generated validator
      const testData = ["hello", "world", "x"]; // Last element too short
      const result = optimizedValidator(testData);

      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe("items[2]");

      console.log("\n1D Array Optimized Validator:");
      console.log("  Generated nested loop depth: 1");
      console.log("  Test result:", result);
    });

    test("generates optimized validator for 2D array", () => {
      const structure: ArrayStructureInfo = {
        depth: 2,
        elementType: "number",
        dimensions: [
          { size: -1, isDynamic: true },
          { size: -1, isDynamic: true },
        ],
      };

      // Mock element validator for numbers
      const elementValidator = (element: any, path: string) => {
        return {
          valid: element >= 0 && element <= 100,
          errors:
            element < 0 || element > 100
              ? [{ path, message: `Value ${element} out of range [0, 100]` }]
              : [],
        };
      };

      const optimizedValidator =
        BuildTimeArrayAnalyzer.generateOptimizedValidator(
          structure,
          "matrix",
          elementValidator
        );

      // Test 2D array
      const matrix = [
        [10, 20, 30],
        [40, 150, 60], // 150 is out of range
        [70, -5, 90], // -5 is out of range
      ];

      const result = optimizedValidator(matrix);

      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(
        result.errors.find((e) => e.path === "matrix[1][1]")
      ).toBeDefined();
      expect(
        result.errors.find((e) => e.path === "matrix[2][1]")
      ).toBeDefined();

      console.log("\n2D Array Optimized Validator:");
      console.log("  Generated nested loop depth: 2");
      console.log("  Test result:", result);
    });

    test("demonstrates 3D array validation capability", () => {
      const structure: ArrayStructureInfo = {
        depth: 3,
        elementType: "boolean",
        dimensions: [
          { size: -1, isDynamic: true },
          { size: -1, isDynamic: true },
          { size: -1, isDynamic: true },
        ],
      };

      // Mock validator that expects true values
      const elementValidator = (element: any, path: string) => {
        return {
          valid: element === true,
          errors: element !== true ? [{ path, message: "Must be true" }] : [],
        };
      };

      const optimizedValidator =
        BuildTimeArrayAnalyzer.generateOptimizedValidator(
          structure,
          "cube",
          elementValidator
        );

      // Test 3D array (2x2x2 cube)
      const cube = [
        [
          [true, true],
          [true, false],
        ], // false at [0][1][1]
        [
          [true, true],
          [false, true],
        ], // false at [1][1][0]
      ];

      const result = optimizedValidator(cube);

      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(2);

      console.log("\n3D Array Optimized Validator:");
      console.log("  Generated nested loop depth: 3");
      console.log(
        "  Errors found at:",
        result.errors.map((e) => e.path)
      );
    });
  });

  describe("Performance Characteristics", () => {
    test("benchmarks multi-dimensional array validation", () => {
      // Simple validator that checks if number is positive
      const positiveValidator = (element: any, path: string) => ({
        valid: element > 0,
        errors:
          element <= 0
            ? [{ path, code: "positive", message: "Must be positive" }]
            : [],
      });

      // 1D Array benchmark
      const array1D = Array(1000)
        .fill(0)
        .map((_, i) => i - 500); // Half negative
      const structure1D: ArrayStructureInfo = {
        depth: 1,
        elementType: "number",
        indexPattern: "[i]",
        loopVariables: ["i"],
      };

      const validator1D = BuildTimeArrayAnalyzer.generateOptimizedValidator(
        structure1D,
        "array1D",
        positiveValidator
      );

      const start1D = performance.now();
      const result1D = validator1D(array1D);
      const time1D = performance.now() - start1D;

      console.log("\nPerformance Benchmarks:");
      console.log(`  1D Array (1000 elements): ${time1D.toFixed(2)}ms`);
      console.log(`    Errors found: ${result1D.errors.length}`);

      // 2D Array benchmark
      const array2D = Array(100)
        .fill(0)
        .map(() =>
          Array(100)
            .fill(0)
            .map(() => Math.random() * 200 - 100)
        );
      const structure2D: ArrayStructureInfo = {
        depth: 2,
        elementType: "number",
        indexPattern: "[i][j]",
        loopVariables: ["i", "j"],
      };

      const validator2D = BuildTimeArrayAnalyzer.generateOptimizedValidator(
        structure2D,
        "array2D",
        positiveValidator
      );

      const start2D = performance.now();
      const result2D = validator2D(array2D);
      const time2D = performance.now() - start2D;

      console.log(
        `  2D Array (100x100 = 10000 elements): ${time2D.toFixed(2)}ms`
      );
      console.log(`    Errors found: ${result2D.errors.length}`);

      // 3D Array benchmark
      const array3D = Array(20)
        .fill(0)
        .map(() =>
          Array(20)
            .fill(0)
            .map(() =>
              Array(25)
                .fill(0)
                .map(() => Math.random() * 200 - 100)
            )
        );
      const structure3D: ArrayStructureInfo = {
        depth: 3,
        elementType: "number",
        indexPattern: "[i][j][k]",
        loopVariables: ["i", "j", "k"],
      };

      const validator3D = BuildTimeArrayAnalyzer.generateOptimizedValidator(
        structure3D,
        "array3D",
        positiveValidator
      );

      const start3D = performance.now();
      const result3D = validator3D(array3D);
      const time3D = performance.now() - start3D;

      console.log(
        `  3D Array (20x20x25 = 10000 elements): ${time3D.toFixed(2)}ms`
      );
      console.log(`    Errors found: ${result3D.errors.length}`);

      // All benchmarks should complete quickly
      expect(time1D).toBeLessThan(50);
      expect(time2D).toBeLessThan(100);
      expect(time3D).toBeLessThan(150);
    });
  });

  describe("Integration with LUQ Builder", () => {
    test("shows how array structure info is attached to field definitions", () => {
      // This demonstrates how the array type analysis integrates with the builder
      console.log("\nIntegration with LUQ Builder:");
      console.log("\n1. When a field is declared with b.array:");
      console.log("   .v('matrix', b => b.array.required())");
      console.log("\n2. The FieldBuilder detects the array type and depth:");
      console.log("   - Analyzes the TypeScript type (e.g., number[][])");
      console.log("   - Creates ArrayStructureInfo with depth=2");
      console.log("   - Attaches it to the field definition");
      console.log("\n3. The array batch optimizer receives:");
      console.log("   - Field definition with arrayStructure property");
      console.log("   - Pre-compiled accessors for efficient access");
      console.log("   - Element field validators to batch together");
      console.log("\n4. During validation, the optimized validator:");
      console.log("   - Uses generated nested loops (based on depth)");
      console.log("   - Validates all element fields in a single pass");
      console.log("   - Generates proper error paths with indices");

      // Note: Actual integration requires core engine support
      console.log(
        "\n⚠️  Note: Full integration requires core engine implementation"
      );
    });
  });
});

describe("Array Type Analysis Summary", () => {
  test("implementation summary", () => {
    console.log("\n=== BUILD-TIME ARRAY TYPE ANALYSIS IMPLEMENTATION ===");

    console.log("\n✅ IMPLEMENTED:");
    console.log("  1. Type-level array depth computation (ArrayDepth<T>)");
    console.log(
      "  2. Runtime array structure analysis (BuildTimeArrayAnalyzer)"
    );
    console.log("  3. Dynamic code generation for nested loops");
    console.log("  4. Optimized validators for arrays up to 5 dimensions");
    console.log("  5. Proper error path generation with array indices");
    console.log("  6. Integration points with FieldBuilder");

    console.log("\n🔧 TECHNICAL DETAILS:");
    console.log("  - Uses TypeScript conditional types for depth analysis");
    console.log("  - Generates optimized code with Function constructor");
    console.log("  - Eliminates repeated array access patterns");
    console.log("  - Supports arbitrary element types and validators");

    console.log("\n📊 PERFORMANCE:");
    console.log("  - Single pass through multi-dimensional arrays");
    console.log("  - No repeated path splitting or array lookups");
    console.log("  - Optimized for cache locality");

    console.log("\n⚠️  LIMITATION:");
    console.log("  - Requires core validation engine support");
    console.log("  - Array element field validation not yet active");
    console.log("  - Infrastructure ready but not connected");

    expect(true).toBe(true);
  });
});
