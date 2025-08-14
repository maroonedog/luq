/**
 * @jest-environment node
 */

import {
  fromContextPlugin,
  conditionalRequiredCheck,
} from "../../../../src/core/async.experimental/from-context-plugin";
import type { ValidationContext } from "../../../../src/core/plugin/types";

// Mock the async-context module
jest.mock("../../../../src/core/async.experimental/async-context", () => ({
  getAsyncContext: jest.fn(),
  getContextValue: jest.fn(),
}));

import { getAsyncContext } from "../../../../src/core/async.experimental/async-context";

describe("fromContextPlugin", () => {
  const mockGetAsyncContext = getAsyncContext as jest.MockedFunction<
    typeof getAsyncContext
  >;

  beforeEach(() => {
    mockGetAsyncContext.mockClear();
  });

  describe("plugin metadata", () => {
    it("should have correct plugin metadata", () => {
      expect(fromContextPlugin.name).toBe("fromContext");
      expect(fromContextPlugin.methodName).toBe("fromContext");
      expect(fromContextPlugin.allowedTypes).toEqual([
        "string",
        "number",
        "boolean",
        "object",
        "array",
      ]);
      expect(fromContextPlugin.pluginType).toBe("validation");
      expect(fromContextPlugin.category).toBe("context");
    });

    it("should create method function", () => {
      const createMethod = fromContextPlugin.createMethod();
      expect(typeof createMethod).toBe("function");
    });
  });

  describe("validation function", () => {
    it("should validate using async context", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: string, context: { minLength: number }) => ({
          valid: value.length >= context.minLength,
          message: `Minimum length is ${context.minLength}`,
        }),
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { minLength: 5 };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction("test", mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Minimum length is 5");
      expect(mockGetAsyncContext).toHaveBeenCalledWith(mockContext);
    });

    it("should fall back to allValues when no async context", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: string, context: { prefix: string }) => ({
          valid: value.startsWith(context.prefix),
        }),
        required: false,
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: { prefix: "test" },
      } as any;

      mockGetAsyncContext.mockReturnValue(undefined);

      const result = validationMethod.validationFunction(
        "testValue",
        mockContext
      );

      expect(result.valid).toBe(true);
    });

    it("should return error when required context is missing", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: () => ({ valid: true }),
        required: true,
        errorMessage: "Context is required",
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue(undefined);

      const result = validationMethod.validationFunction("value", mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Context is required");
    });

    it("should return valid when context missing and not required", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: () => ({ valid: true }),
        required: false,
        fallbackToValid: true,
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue(undefined);

      const result = validationMethod.validationFunction("value", mockContext);

      expect(result.valid).toBe(true);
    });

    it("should return invalid when fallbackToValid is false", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: () => ({ valid: true }),
        required: false,
        fallbackToValid: false,
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue(undefined);

      const result = validationMethod.validationFunction("value", mockContext);

      expect(result.valid).toBe(false);
    });

    it("should handle validation errors gracefully", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: () => {
          throw new Error("Validation failed");
        },
        errorMessage: "Custom error",
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { data: "test" };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction("value", mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Custom error");
    });

    it("should use default error message when custom error and validation message are missing", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: () => {
          throw new Error("Validation failed");
        },
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { data: "test" };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction("value", mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toContain("Context validation error");
      expect(result.message).toContain("Validation failed");
    });

    it("should prefer validation result message over custom error message", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: () => ({
          valid: false,
          message: "Validation specific error",
        }),
        errorMessage: "Custom error message",
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { data: "test" };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction("value", mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Validation specific error");
    });

    it("should use custom error message when validation result has no message", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: () => ({
          valid: false,
        }),
        errorMessage: "Custom error message",
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { data: "test" };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction("value", mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Custom error message");
    });

    it("should pass allValues to validation function", () => {
      const validateSpy = jest.fn(() => ({ valid: true }));
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: validateSpy,
      });

      const allValues = { otherField: "otherValue" };
      const mockContext: ValidationContext<any, any> = {
        allValues,
      } as any;

      const asyncContext = { contextData: "test" };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      validationMethod.validationFunction(
        "value",
        mockContext
      );

      expect(validateSpy).toHaveBeenCalledWith("value", asyncContext, allValues);
    });
  });

  describe("conditionalRequiredCheck", () => {
    it("should return required validation when condition is true", () => {
      const conditionFn = jest.fn(
        (context: { shouldRequire: boolean }) => context.shouldRequire
      );
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: { otherField: "value" },
      } as any;

      const asyncContext = { shouldRequire: true };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction("", mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "This field is required based on current context"
      );
      expect(conditionFn).toHaveBeenCalledWith(
        asyncContext,
        mockContext.allValues
      );
    });

    it("should return valid when condition is false", () => {
      const conditionFn = jest.fn(
        (context: { shouldRequire: boolean }) => context.shouldRequire
      );
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: { otherField: "value" },
      } as any;

      const asyncContext = { shouldRequire: false };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction("", mockContext);

      expect(result.valid).toBe(true);
      expect(conditionFn).toHaveBeenCalledWith(
        asyncContext,
        mockContext.allValues
      );
    });

    it("should return valid when value is provided and condition is true", () => {
      const conditionFn = jest.fn(() => true);
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { shouldRequire: true };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction(
        "some value",
        mockContext
      );

      expect(result.valid).toBe(true);
    });

    it("should treat null as empty value", () => {
      const conditionFn = jest.fn(() => true);
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { shouldRequire: true };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction(null, mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "This field is required based on current context"
      );
    });

    it("should treat undefined as empty value", () => {
      const conditionFn = jest.fn(() => true);
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { shouldRequire: true };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction(
        undefined,
        mockContext
      );

      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "This field is required based on current context"
      );
    });

    it("should accept 0 as valid value", () => {
      const conditionFn = jest.fn(() => true);
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { shouldRequire: true };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction(0, mockContext);

      expect(result.valid).toBe(true);
    });

    it("should accept false as valid value", () => {
      const conditionFn = jest.fn(() => true);
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const asyncContext = { shouldRequire: true };
      mockGetAsyncContext.mockReturnValue(asyncContext);

      const result = validationMethod.validationFunction(false, mockContext);

      expect(result.valid).toBe(true);
    });

    it("should fallback to valid when no async context and not required", () => {
      const conditionFn = jest.fn(() => true);
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue(undefined);

      const result = validationMethod.validationFunction("", mockContext);

      expect(result.valid).toBe(true);
      expect(conditionFn).not.toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should work with complex validation logic", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (
          value: string,
          context: { userRole: string; permissions: string[] },
          allValues: any
        ) => {
          if (context.userRole === "admin") {
            return { valid: true };
          }

          if (context.permissions.includes("write") && value.length > 0) {
            return { valid: true };
          }

          return {
            valid: false,
            message: `Insufficient permissions for role: ${context.userRole}`,
          };
        },
        required: true,
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: { otherField: "test" },
      } as any;

      // Test admin user
      mockGetAsyncContext.mockReturnValue({
        userRole: "admin",
        permissions: ["read"],
      });

      let result = validationMethod.validationFunction(
        "any value",
        mockContext
      );
      expect(result.valid).toBe(true);

      // Test user with write permission
      mockGetAsyncContext.mockReturnValue({
        userRole: "user",
        permissions: ["read", "write"],
      });

      result = validationMethod.validationFunction("some value", mockContext);
      expect(result.valid).toBe(true);

      // Test user without proper permissions
      mockGetAsyncContext.mockReturnValue({
        userRole: "user",
        permissions: ["read"],
      });

      result = validationMethod.validationFunction("value", mockContext);
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Insufficient permissions for role: user");
    });

    it("should handle validation with both async context and allValues", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (
          value: string,
          context: { prefix: string },
          allValues: { suffix: string }
        ) => {
          const expectedValue = context.prefix + value + allValues.suffix;
          return {
            valid: value === expectedValue,
            message: `Expected: ${expectedValue}`,
          };
        },
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: { suffix: "_end" },
      } as any;

      mockGetAsyncContext.mockReturnValue({ prefix: "start_" });

      const result = validationMethod.validationFunction(
        "start_middle_end",
        mockContext
      );

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Expected: start_start_middle_end_end");
    });
  });

  describe("edge cases and additional scenarios", () => {
    it("should handle validation with complex nested context", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: any, context: any) => {
          const nestedValue = context?.deeply?.nested?.value;
          return {
            valid: value === nestedValue,
            message: `Expected ${nestedValue}`,
          };
        },
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue({
        deeply: { nested: { value: "expected" } },
      });

      const result = validationMethod.validationFunction(
        "expected",
        mockContext
      );

      expect(result.valid).toBe(true);
    });

    it("should handle validation with array context", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: string, context: { allowedValues: string[] }) => ({
          valid: context.allowedValues.includes(value),
          message: `Value must be one of: ${context.allowedValues.join(", ")}`,
        }),
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue({
        allowedValues: ["option1", "option2", "option3"],
      });

      let result = validationMethod.validationFunction("option2", mockContext);
      expect(result.valid).toBe(true);

      result = validationMethod.validationFunction("invalid", mockContext);
      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "Value must be one of: option1, option2, option3"
      );
    });

    it("should handle validation with boolean context values", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: any, context: { isStrict: boolean }) => ({
          valid: context.isStrict ? typeof value === "string" : true,
          message: "Strict mode requires string value",
        }),
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      // Test strict mode
      mockGetAsyncContext.mockReturnValue({ isStrict: true });
      let result = validationMethod.validationFunction(123, mockContext);
      expect(result.valid).toBe(false);

      // Test non-strict mode
      mockGetAsyncContext.mockReturnValue({ isStrict: false });
      result = validationMethod.validationFunction(123, mockContext);
      expect(result.valid).toBe(true);
    });

    it("should handle validation with numeric context values", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: number, context: { min: number; max: number }) => ({
          valid: value >= context.min && value <= context.max,
          message: `Value must be between ${context.min} and ${context.max}`,
        }),
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue({ min: 10, max: 100 });

      let result = validationMethod.validationFunction(50, mockContext);
      expect(result.valid).toBe(true);

      result = validationMethod.validationFunction(5, mockContext);
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Value must be between 10 and 100");
    });

    it("should handle validation with Date context values", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: Date, context: { cutoffDate: Date }) => {
          const isAfterCutoff = value.getTime() > context.cutoffDate.getTime();
          return {
            valid: isAfterCutoff,
            message: `Date must be after ${context.cutoffDate.toISOString()}`,
          };
        },
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const cutoffDate = new Date("2024-01-01");
      mockGetAsyncContext.mockReturnValue({ cutoffDate });

      let result = validationMethod.validationFunction(
        new Date("2024-06-01"),
        mockContext
      );
      expect(result.valid).toBe(true);

      result = validationMethod.validationFunction(
        new Date("2023-06-01"),
        mockContext
      );
      expect(result.valid).toBe(false);
    });

    it("should handle validation with RegExp context", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: string, context: { pattern: RegExp }) => ({
          valid: context.pattern.test(value),
          message: `Value must match pattern: ${context.pattern}`,
        }),
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue({ pattern: /^[A-Z][a-z]+$/ });

      let result = validationMethod.validationFunction("Hello", mockContext);
      expect(result.valid).toBe(true);

      result = validationMethod.validationFunction("hello", mockContext);
      expect(result.valid).toBe(false);
    });

    it("should handle conditional required with complex conditions", () => {
      const conditionFn = jest.fn((context: any, allValues: any) => {
        return context.mode === "strict" && allValues.type === "required";
      });
      const validationMethod = conditionalRequiredCheck(conditionFn);

      const mockContext: ValidationContext<any, any> = {
        allValues: { type: "required" },
      } as any;

      // Test strict mode with required type
      mockGetAsyncContext.mockReturnValue({ mode: "strict" });
      let result = validationMethod.validationFunction("", mockContext);
      expect(result.valid).toBe(false);

      // Test strict mode with optional type
      mockContext.allValues = { type: "optional" };
      result = validationMethod.validationFunction("", mockContext);
      expect(result.valid).toBe(true);

      // Test lenient mode with required type
      mockGetAsyncContext.mockReturnValue({ mode: "lenient" });
      mockContext.allValues = { type: "required" };
      result = validationMethod.validationFunction("", mockContext);
      expect(result.valid).toBe(true);
    });

    it("should handle validation with null and undefined context values", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: any, context: any) => ({
          valid: value === context.expectedValue,
          message: `Expected ${context.expectedValue}`,
        }),
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      // Test with null
      mockGetAsyncContext.mockReturnValue({ expectedValue: null });
      let result = validationMethod.validationFunction(null, mockContext);
      expect(result.valid).toBe(true);

      // Test with undefined
      mockGetAsyncContext.mockReturnValue({ expectedValue: undefined });
      result = validationMethod.validationFunction(undefined, mockContext);
      expect(result.valid).toBe(true);
    });

    it("should handle validation errors with non-Error objects", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: () => {
          throw { code: "CUSTOM_ERROR", message: "Custom error object" };
        },
        errorMessage: "Fallback error",
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue({ data: "test" });

      const result = validationMethod.validationFunction("value", mockContext);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Fallback error");
    });

    it("should handle validation with circular reference in context", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: string, context: any) => ({
          valid: value === context.name,
          message: "Value must match context name",
        }),
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      const circularContext: any = { name: "test" };
      circularContext.self = circularContext;
      mockGetAsyncContext.mockReturnValue(circularContext);

      const result = validationMethod.validationFunction("test", mockContext);

      expect(result.valid).toBe(true);
    });

    it("should handle empty arrays in context", () => {
      const createMethod = fromContextPlugin.createMethod();
      const validationMethod = createMethod({
        validate: (value: string, context: { allowedValues: string[] }) => ({
          valid:
            context.allowedValues.length === 0 ||
            context.allowedValues.includes(value),
          message: "No values allowed",
        }),
      });

      const mockContext: ValidationContext<any, any> = {
        allValues: {},
      } as any;

      mockGetAsyncContext.mockReturnValue({ allowedValues: [] });

      const result = validationMethod.validationFunction(
        "anything",
        mockContext
      );

      expect(result.valid).toBe(true);
    });
  });
});

