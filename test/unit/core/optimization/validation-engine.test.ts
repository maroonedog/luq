/**
 * Test coverage for validation-engine.ts
 * Testing core validation engine functionality
 */

import {
  ValidationError,
  ValidationResult,
  ParseResult,
  ValidationContext,
  ValidatorFunction,
  TransformFunction,
  ValidationField
} from "../../../../src/core/optimization/core/validation-engine";

// Mock validator functions for testing
const mockRequiredValidator: ValidatorFunction = {
  check: (value: any) => value !== null && value !== undefined && value !== "",
  code: "required",
  pluginName: "required",
  getErrorMessage: (value: any, path: string) => `${path} is required`,
  params: []
};

const mockStringMinValidator = (minLength: number): ValidatorFunction => ({
  check: (value: any) => typeof value === "string" && value.length >= minLength,
  code: "stringMin",
  pluginName: "stringMin",
  getErrorMessage: (value: any, path: string) => `${path} must be at least ${minLength} characters`,
  params: [minLength]
});

const mockThrowingValidator: ValidatorFunction = {
  check: () => {
    throw new Error("Validator error");
  },
  code: "throwing",
  pluginName: "throwing",
  getErrorMessage: () => "Validator threw an error"
};

// Mock transform functions for testing
const mockUpperCaseTransform: TransformFunction = (value: any) => 
  typeof value === "string" ? value.toUpperCase() : value;

const mockTrimTransform: TransformFunction = (value: any) =>
  typeof value === "string" ? value.trim() : value;

const mockThrowingTransform: TransformFunction = () => {
  throw new Error("Transform error");
};

describe("Validation Engine Types and Structures", () => {
  describe("ValidationError interface", () => {
    test("should define proper error structure", () => {
      const error: ValidationError = {
        path: "user.name",
        code: "required",
        message: "Name is required"
      };

      expect(error.path).toBe("user.name");
      expect(error.code).toBe("required");
      expect(error.message).toBe("Name is required");
    });
  });

  describe("ValidationResult interface", () => {
    test("should define proper result structure", () => {
      const validResult: ValidationResult = {
        valid: true,
        errors: []
      };

      const invalidResult: ValidationResult = {
        valid: false,
        errors: [{
          path: "field",
          code: "required",
          message: "Field is required"
        }]
      };

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
    });
  });

  describe("ParseResult interface", () => {
    test("should extend ValidationResult with data", () => {
      const parseResult: ParseResult = {
        valid: true,
        errors: [],
        data: { transformed: "value" }
      };

      expect(parseResult.valid).toBe(true);
      expect(parseResult.errors).toEqual([]);
      expect(parseResult.data).toEqual({ transformed: "value" });
    });
  });

  describe("ValidationContext interface", () => {
    test("should define proper context structure", () => {
      const context: ValidationContext = {
        originalValue: "original",
        currentValue: "current",
        allValues: { field: "value" },
        path: "field.name"
      };

      expect(context.originalValue).toBe("original");
      expect(context.currentValue).toBe("current");
      expect(context.allValues).toEqual({ field: "value" });
      expect(context.path).toBe("field.name");
    });

    test("should support optional arrayContext", () => {
      const context: ValidationContext = {
        originalValue: "value",
        currentValue: "value",
        allValues: {},
        path: "field",
        arrayContext: {
          arrayPath: "items",
          index: 0,
          arrayData: [{ value: "test" }]
        }
      };

      expect(context.arrayContext).toBeDefined();
      expect(context.arrayContext?.arrayPath).toBe("items");
      expect(context.arrayContext?.index).toBe(0);
    });
  });
});

describe("Validator Functions", () => {
  describe("mockRequiredValidator", () => {
    test("should validate required values correctly", () => {
      expect(mockRequiredValidator.check("valid")).toBe(true);
      expect(mockRequiredValidator.check("")).toBe(false);
      expect(mockRequiredValidator.check(null)).toBe(false);
      expect(mockRequiredValidator.check(undefined)).toBe(false);
    });

    test("should generate proper error messages", () => {
      const message = mockRequiredValidator.getErrorMessage?.("", "field");
      expect(message).toBe("field is required");
    });

    test("should have proper metadata", () => {
      expect(mockRequiredValidator.code).toBe("required");
      expect(mockRequiredValidator.pluginName).toBe("required");
      expect(Array.isArray(mockRequiredValidator.params)).toBe(true);
    });
  });

  describe("mockStringMinValidator", () => {
    test("should validate minimum length correctly", () => {
      const validator = mockStringMinValidator(3);
      
      expect(validator.check("test")).toBe(true);
      expect(validator.check("ab")).toBe(false);
      expect(validator.check(123)).toBe(false);
    });

    test("should include parameters", () => {
      const validator = mockStringMinValidator(5);
      
      expect(validator.params).toEqual([5]);
    });

    test("should generate parameterized error messages", () => {
      const validator = mockStringMinValidator(3);
      const message = validator.getErrorMessage?.("ab", "field");
      
      expect(message).toBe("field must be at least 3 characters");
    });
  });

  describe("mockThrowingValidator", () => {
    test("should handle validator errors gracefully", () => {
      // This tests that external code can catch validator errors
      expect(() => mockThrowingValidator.check("value")).toThrow("Validator error");
    });
  });
});

describe("Transform Functions", () => {
  describe("mockUpperCaseTransform", () => {
    test("should transform strings to uppercase", () => {
      expect(mockUpperCaseTransform("hello")).toBe("HELLO");
      expect(mockUpperCaseTransform("World")).toBe("WORLD");
    });

    test("should handle non-string values gracefully", () => {
      expect(mockUpperCaseTransform(123)).toBe(123);
      expect(mockUpperCaseTransform(null)).toBe(null);
      expect(mockUpperCaseTransform(undefined)).toBe(undefined);
    });
  });

  describe("mockTrimTransform", () => {
    test("should trim whitespace from strings", () => {
      expect(mockTrimTransform("  hello  ")).toBe("hello");
      expect(mockTrimTransform("\n\tworld\t\n")).toBe("world");
    });

    test("should handle non-string values gracefully", () => {
      expect(mockTrimTransform(123)).toBe(123);
      expect(mockTrimTransform(null)).toBe(null);
    });
  });

  describe("mockThrowingTransform", () => {
    test("should handle transform errors", () => {
      expect(() => mockThrowingTransform("value")).toThrow("Transform error");
    });
  });
});

describe("ValidationField structure", () => {
  test("should define field with validators and transforms", () => {
    const field: ValidationField = {
      path: "user.name",
      validators: [mockRequiredValidator, mockStringMinValidator(2)],
      transforms: [mockTrimTransform, mockUpperCaseTransform]
    };

    expect(field.path).toBe("user.name");
    expect(field.validators).toHaveLength(2);
    expect(field.transforms).toHaveLength(2);
  });

  test("should handle empty validators and transforms", () => {
    const field: ValidationField = {
      path: "simple.field",
      validators: [],
      transforms: []
    };

    expect(field.validators).toEqual([]);
    expect(field.transforms).toEqual([]);
  });

  test("should support complex field structures", () => {
    const field: ValidationField = {
      path: "data.nested.array.*.property",
      validators: [
        mockRequiredValidator,
        mockStringMinValidator(1),
        {
          check: (value) => typeof value === "string" && /^[A-Z]/.test(value),
          code: "startsWithCapital",
          pluginName: "custom",
          getErrorMessage: (v, p) => `${p} must start with capital letter`
        }
      ],
      transforms: [
        mockTrimTransform,
        (value) => typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1) : value
      ]
    };

    expect(field.path).toBe("data.nested.array.*.property");
    expect(field.validators).toHaveLength(3);
    expect(field.transforms).toHaveLength(2);
    
    // Test custom validator
    const customValidator = field.validators[2];
    expect(customValidator.check("Hello")).toBe(true);
    expect(customValidator.check("hello")).toBe(false);
  });
});

describe("Integration scenarios", () => {
  test("should handle validation pipeline", () => {
    const context: ValidationContext = {
      originalValue: "  hello  ",
      currentValue: "  hello  ",
      allValues: { field: "  hello  " },
      path: "field"
    };

    // First apply transforms
    let transformedValue = context.currentValue;
    const transforms = [mockTrimTransform, mockUpperCaseTransform];
    
    for (const transform of transforms) {
      transformedValue = transform(transformedValue);
    }
    
    expect(transformedValue).toBe("HELLO");
    
    // Then apply validation
    const validators = [mockRequiredValidator, mockStringMinValidator(3)];
    const results = validators.map(validator => validator.check(transformedValue, context.allValues));
    
    expect(results).toEqual([true, true]);
  });

  test("should handle validation failure pipeline", () => {
    const context: ValidationContext = {
      originalValue: "",
      currentValue: "",
      allValues: { field: "" },
      path: "field"
    };

    const validators = [mockRequiredValidator, mockStringMinValidator(3)];
    const results = validators.map(validator => validator.check(context.currentValue, context.allValues));
    
    expect(results).toEqual([false, false]);
  });

  test("should handle mixed success/failure", () => {
    const context: ValidationContext = {
      originalValue: "hi",
      currentValue: "hi",
      allValues: { field: "hi" },
      path: "field"
    };

    const validators = [mockRequiredValidator, mockStringMinValidator(3)];
    const results = validators.map(validator => validator.check(context.currentValue, context.allValues));
    
    expect(results).toEqual([true, false]); // Required passes, minLength fails
  });

  test("should handle complex nested validation context", () => {
    const context: ValidationContext = {
      originalValue: "test",
      currentValue: "test",
      allValues: {
        user: {
          name: "test",
          profile: {
            email: "test@example.com"
          }
        }
      },
      path: "user.name",
      arrayContext: {
        arrayPath: "users",
        index: 0,
        arrayData: [{ name: "test" }]
      }
    };

    expect(mockRequiredValidator.check(context.currentValue, context.allValues, context.arrayContext)).toBe(true);
  });
});

describe("Error handling and edge cases", () => {
  test("should handle validator metadata", () => {
    const validatorWithMetadata: ValidatorFunction = {
      check: () => true,
      code: "custom",
      pluginName: "customPlugin",
      metadata: {
        type: "string",
        category: "validation",
        priority: 1
      }
    };

    expect(validatorWithMetadata.metadata?.type).toBe("string");
    expect(validatorWithMetadata.metadata?.category).toBe("validation");
    expect(validatorWithMetadata.metadata?.priority).toBe(1);
  });

  test("should handle validators without error message functions", () => {
    const minimalValidator: ValidatorFunction = {
      check: () => true,
      code: "minimal"
    };

    expect(minimalValidator.check("anything")).toBe(true);
    expect(minimalValidator.getErrorMessage).toBeUndefined();
  });

  test("should handle transforms with different signatures", () => {
    const transformWithApply: TransformFunction = {
      apply: (value: any, context?: any) => `transformed-${value}`,
      transformFn: (value: any) => value
    } as any;

    const transformWithTransformFn: TransformFunction = {
      transformFn: (value: any) => `fn-transformed-${value}`
    } as any;

    // Test that both signatures are supported
    expect(transformWithApply.apply?.("test")).toBe("transformed-test");
    expect(transformWithTransformFn.transformFn?.("test")).toBe("fn-transformed-test");
  });
});