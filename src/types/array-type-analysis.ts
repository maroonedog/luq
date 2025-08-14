/**
 * Build-time TypeScript type analysis for multi-dimensional arrays
 * Enables Array<Array<Array>> pattern optimization through compile-time type inspection
 */

import { isArray } from "../core/utils/type-guards";

/**
 * Extract array depth from a type at compile time
 * Array<string> → 1
 * Array<Array<string>> → 2
 * Array<Array<Array<string>>> → 3
 *
 * Note: TypeScript's type system has limitations with recursive arithmetic,
 * so we use a more practical approach with explicit depth levels
 */
export type ArrayDepth<T> = T extends readonly (infer U)[]
  ? U extends readonly (infer V)[]
    ? V extends readonly (infer W)[]
      ? W extends readonly (infer X)[]
        ? X extends readonly (infer Y)[]
          ? 5 // Maximum depth supported
          : 4
        : 3
      : 2
    : 1
  : 0;

/**
 * Extract the final element type from nested arrays
 * Array<Array<{name: string}>> → {name: string}
 */
export type ArrayElementType<T> = T extends readonly (infer U)[]
  ? ArrayElementType<U>
  : T;

/**
 * Generate path pattern for nested array access
 * Depth 1 → "[i]"
 * Depth 2 → "[i][j]"
 * Depth 3 → "[i][j][k]"
 */
export type ArrayIndexPattern<Depth extends number> = Depth extends 1
  ? "[i]"
  : Depth extends 2
    ? "[i][j]"
    : Depth extends 3
      ? "[i][j][k]"
      : Depth extends 4
        ? "[i][j][k][l]"
        : Depth extends 5
          ? "[i][j][k][l][m]"
          : string; // For deeper nesting

/**
 * Array structure information resolved at build time
 */
export interface ArrayStructureInfo<T = any> {
  readonly depth: number;
  readonly elementType: T;
  readonly indexPattern: string;
  readonly loopVariables: readonly string[];
}

/**
 * Resolve array structure at compile time
 */
export type ResolveArrayStructure<T> = {
  readonly depth: ArrayDepth<T>;
  readonly elementType: ArrayElementType<T>;
  readonly indexPattern: ArrayIndexPattern<ArrayDepth<T>>;
  readonly loopVariables: ArrayDepth<T> extends 1
    ? readonly ["i"]
    : ArrayDepth<T> extends 2
      ? readonly ["i", "j"]
      : ArrayDepth<T> extends 3
        ? readonly ["i", "j", "k"]
        : ArrayDepth<T> extends 4
          ? readonly ["i", "j", "k", "l"]
          : ArrayDepth<T> extends 5
            ? readonly ["i", "j", "k", "l", "m"]
            : readonly string[];
};

/**
 * Generate loop variable names for arbitrary depth
 */
const LOOP_VARIABLE_NAMES = [
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
] as const;

/**
 * Build-time array structure analyzer
 * Creates optimized validation functions based on TypeScript type information
 */
export class BuildTimeArrayAnalyzer {
  /**
   * Analyze array structure from TypeScript type at build time
   * This is called during field builder analysis phase
   */
  static analyzeArrayStructure<T>(
    fieldPath: string,
    sampleValue?: T
  ): ArrayStructureInfo<ArrayElementType<T>> {
    const depth = this.calculateArrayDepth(sampleValue);
    const loopVariables = LOOP_VARIABLE_NAMES.slice(0, depth);
    const indexPattern = loopVariables.map((v) => `[${v}]`).join("");

    return {
      depth,
      elementType: this.extractElementType(sampleValue),
      indexPattern,
      loopVariables,
    };
  }

  /**
   * Calculate array depth at runtime (fallback for type analysis)
   */
  private static calculateArrayDepth(value: any, currentDepth = 0): number {
    if (!isArray(value)) {
      return currentDepth;
    }

    // Check first element to determine if it's a nested array
    const firstElement = value[0];
    if (isArray(firstElement)) {
      return this.calculateArrayDepth(firstElement, currentDepth + 1);
    }

    return currentDepth + 1;
  }

  /**
   * Extract element type (for validation purposes)
   */
  private static extractElementType(value: any): any {
    if (!isArray(value)) {
      return value;
    }

    let current = value;
    while (isArray(current) && current.length > 0) {
      current = current[0];
    }

    return current;
  }

  /**
   * Generate optimized validation function for multi-dimensional arrays
   */
  static generateOptimizedValidator<T>(
    structure: ArrayStructureInfo<T>,
    fieldPath: string,
    elementValidator: (element: T, path: string) => ValidationResult
  ): (array: any) => ValidationResult {
    const { depth, loopVariables } = structure;

    // Generate function dynamically based on array depth
    return this.createNestedLoopValidator(
      depth,
      loopVariables,
      fieldPath,
      elementValidator
    );
  }

  /**
   * Create nested loop validator with arbitrary depth
   */
  private static createNestedLoopValidator<T>(
    depth: number,
    loopVariables: readonly string[],
    fieldPath: string,
    elementValidator: (element: T, path: string) => ValidationResult
  ): (array: any) => ValidationResult {
    // Build nested loop function dynamically
    const loopCode = this.generateNestedLoopCode(
      depth,
      loopVariables,
      fieldPath
    );

    // Create optimized function using Function constructor with proper closure
    // This avoids the overhead of recursive function calls
    const generatedFunction = new Function(
      "elementValidator",
      `
      return function validateArray(array) {
        const errors = [];
        
        ${loopCode}
        
        return {
          valid: errors.length === 0,
          errors: errors,
          transformedData: array
        };
      };
      `
    );

    return generatedFunction(elementValidator) as any;
  }

  /**
   * Generate nested loop code string
   */
  private static generateNestedLoopCode(
    depth: number,
    loopVariables: readonly string[],
    fieldPath: string
  ): string {
    let code = "";
    let arrayAccess = "array";
    let pathBuilder = `"${fieldPath}"`;

    // Generate nested for loops
    for (let d = 0; d < depth; d++) {
      const loopVar = loopVariables[d] || `idx${d}`;
      const indent = "  ".repeat(d + 1);

      // Add array check
      code += `${indent}if (!Array.isArray(${arrayAccess})) {\n`;
      code += `${indent}  errors.push({\n`;
      code += `${indent}    path: ${pathBuilder},\n`;
      code += `${indent}    code: 'INVALID_ARRAY',\n`;
      code += `${indent}    message: 'Expected array at depth ${d + 1}',\n`;
      code += `${indent}    paths: () => [${pathBuilder}]\n`;
      code += `${indent}  });\n`;
      code += `${indent}  return { valid: false, errors: errors, transformedData: array };\n`;
      code += `${indent}}\n`;

      code += `${indent}for (let ${loopVar} = 0; ${loopVar} < ${arrayAccess}.length; ${loopVar}++) {\n`;

      arrayAccess += `[${loopVar}]`;
      pathBuilder += ` + "[" + ${loopVar} + "]"`;
    }

    // Add validation call at innermost loop
    const indent = "  ".repeat(depth + 1);
    code += `${indent}const element = ${arrayAccess};\n`;
    code += `${indent}const elementPath = ${pathBuilder};\n`;
    code += `${indent}try {\n`;
    code += `${indent}  const result = elementValidator(element, elementPath);\n`;
    code += `${indent}  if (!result.isValid()) {\n`;
    code += `${indent}    errors.push(...result.errors);\n`;
    code += `${indent}  }\n`;
    code += `${indent}} catch (e) {\n`;
    code += `${indent}  errors.push({\n`;
    code += `${indent}    path: elementPath,\n`;
    code += `${indent}    code: 'VALIDATION_ERROR',\n`;
    code += `${indent}    message: 'Validation failed: ' + e.message,\n`;
    code += `${indent}    paths: () => [elementPath]\n`;
    code += `${indent}  });\n`;
    code += `${indent}}\n`;

    // Close all loops
    for (let d = depth - 1; d >= 0; d--) {
      const indent = "  ".repeat(d + 1);
      code += `${indent}}\n`;
    }

    return code;
  }
}

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    code: string;
    message: string;
  }>;
}

/**
 * Type-safe array field validator generator
 * Uses TypeScript type information to create optimized validators
 */
export function createTypedArrayValidator<T>(
  fieldPath: string,
  elementValidator: (
    element: ArrayElementType<T>,
    path: string
  ) => ValidationResult
) {
  return function validateTypedArray(value: T): ValidationResult {
    // Analyze array structure at runtime
    const structure = BuildTimeArrayAnalyzer.analyzeArrayStructure(
      fieldPath,
      value
    );

    // Generate optimized validator
    const validator = BuildTimeArrayAnalyzer.generateOptimizedValidator(
      structure,
      fieldPath,
      elementValidator as any
    );

    return validator(value);
  };
}

/**
 * Compile-time type testing
 */
export type Test_ArrayDepth = {
  Simple: ArrayDepth<string[]>; // Should be 1
  Double: ArrayDepth<string[][]>; // Should be 2
  Triple: ArrayDepth<string[][][]>; // Should be 3
  Complex: ArrayDepth<Array<Array<{ id: number; name: string }[]>>>; // Should be 3
};

export type Test_ElementType = {
  Simple: ArrayElementType<{ name: string }[]>; // Should be {name: string}
  Double: ArrayElementType<{ name: string }[][]>; // Should be {name: string}
  Triple: ArrayElementType<{ name: string }[][][]>; // Should be {name: string}
};
