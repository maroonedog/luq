import { describe, test, expect } from "@jest/globals";
import { createRawValidator, RawValidator } from "../../../../src/core/builder/raw-validator";
import { createUnifiedValidator } from "../../../../src/core/optimization/unified-validator";
import { Result } from "../../../../src/types/result";

describe("RawValidator", () => {
  describe("createRawValidator - empty validator", () => {
    test("should create empty validator when no validators provided", () => {
      const rawValidator = createRawValidator(new Map());
      
      expect(rawValidator).toBeDefined();
      expect(typeof rawValidator.validateRaw).toBe("function");
      expect(typeof rawValidator.parseRaw).toBe("function");
      expect(typeof rawValidator.validate).toBe("function");
      expect(typeof rawValidator.parse).toBe("function");
    });

    test("empty validator should always return true for validateRaw", () => {
      const rawValidator = createRawValidator(new Map());
      
      expect(rawValidator.validateRaw({})).toBe(true);
      expect(rawValidator.validateRaw({ any: "data" })).toBe(true);
      expect(rawValidator.validateRaw(null)).toBe(true);
    });

    test("empty validator should return valid result for parseRaw", () => {
      const rawValidator = createRawValidator(new Map());
      
      const testData = { some: "data" };
      const result = rawValidator.parseRaw(testData);
      
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(testData);
      expect(result.error).toBeUndefined();
    });

    test("empty validator should return Result.ok for compatibility methods", () => {
      const rawValidator = createRawValidator(new Map());
      
      const testData = { test: "data" };
      
      const validateResult = rawValidator.validate(testData);
      expect(validateResult.isValid()).toBe(true);
      expect(validateResult.data()).toEqual(testData);
      
      const parseResult = rawValidator.parse(testData);
      expect(parseResult.isValid()).toBe(true);
      expect(parseResult.data()).toEqual(testData);
    });
  });

  describe("createRawValidator - single field validator", () => {
    test("should handle single simple field validation", () => {
      const mockValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 3) {
            return { valid: true, errors: [] };
          }
          return { 
            valid: false, 
            errors: [{ path: "name", message: "Too short", code: "MIN_LENGTH" }] 
          };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 3) {
            return { valid: true, errors: [], data: value };
          }
          return { 
            valid: false, 
            errors: [{ path: "name", message: "Too short", code: "MIN_LENGTH" }] 
          };
        },
        fieldPath: "name"
      };

      const validators = new Map([["name", mockValidator as any]]);
      const rawValidator = createRawValidator(validators);

      // Valid case
      expect(rawValidator.validateRaw({ name: "Alice" })).toBe(true);
      
      // Invalid case
      expect(rawValidator.validateRaw({ name: "AB" })).toBe(false);
      
      // Missing field
      expect(rawValidator.validateRaw({})).toBe(false);
    });

    test("should handle single simple field parsing", () => {
      const mockValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 3) {
            return { valid: true, errors: [] };
          }
          return { 
            valid: false, 
            errors: [{ path: "name", message: "Too short", code: "MIN_LENGTH" }] 
          };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 3) {
            return { valid: true, errors: [], data: value.toUpperCase() };
          }
          return { 
            valid: false, 
            errors: [{ path: "name", message: "Too short", code: "MIN_LENGTH" }] 
          };
        },
        fieldPath: "name"
      };

      const validators = new Map([["name", mockValidator as any]]);
      const rawValidator = createRawValidator(validators);

      // Valid parse
      const validResult = rawValidator.parseRaw({ name: "alice" });
      expect(validResult.valid).toBe(true);
      expect(validResult.data).toBeDefined();

      // Invalid parse
      const invalidResult = rawValidator.parseRaw({ name: "AB" });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });

    test("should handle single nested field validation", () => {
      const mockValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 2) {
            return { valid: true, errors: [] };
          }
          return { 
            valid: false, 
            errors: [{ path: "user.name", message: "Invalid nested field", code: "NESTED_ERROR" }] 
          };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 2) {
            return { valid: true, errors: [], data: value };
          }
          return { 
            valid: false, 
            errors: [{ path: "user.name", message: "Invalid nested field", code: "NESTED_ERROR" }] 
          };
        },
        fieldPath: "user.name"
      };

      const validators = new Map([["user.name", mockValidator as any]]);
      const rawValidator = createRawValidator(validators);

      // Valid nested
      expect(rawValidator.validateRaw({ user: { name: "Alice" } })).toBe(true);
      
      // Invalid nested
      expect(rawValidator.validateRaw({ user: { name: "A" } })).toBe(false);
      
      // Missing nested structure
      expect(rawValidator.validateRaw({ user: {} })).toBe(false);
      expect(rawValidator.validateRaw({})).toBe(false);
    });
  });

  describe("createRawValidator - multiple field validators", () => {
    test("should handle multiple field validation", () => {
      const nameValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 2) {
            return { valid: true, errors: [] };
          }
          return { valid: false, errors: [{ path: "name", message: "Name too short", code: "NAME_ERROR" }] };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 2) {
            return { valid: true, errors: [], data: value };
          }
          return { valid: false, errors: [{ path: "name", message: "Name too short", code: "NAME_ERROR" }] };
        },
        fieldPath: "name"
      };

      const ageValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "number" && value >= 18) {
            return { valid: true, errors: [] };
          }
          return { valid: false, errors: [{ path: "age", message: "Age too young", code: "AGE_ERROR" }] };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "number" && value >= 18) {
            return { valid: true, errors: [], data: value };
          }
          return { valid: false, errors: [{ path: "age", message: "Age too young", code: "AGE_ERROR" }] };
        },
        fieldPath: "age"
      };

      const validators = new Map([
        ["name", nameValidator as any],
        ["age", ageValidator as any]
      ]);
      const rawValidator = createRawValidator(validators);

      // Valid case - both fields valid
      expect(rawValidator.validateRaw({ name: "Alice", age: 25 })).toBe(true);
      
      // Invalid case - one field invalid
      expect(rawValidator.validateRaw({ name: "Alice", age: 15 })).toBe(false);
      
      // Invalid case - both fields invalid
      expect(rawValidator.validateRaw({ name: "A", age: 15 })).toBe(false);
      
      // Missing fields
      expect(rawValidator.validateRaw({})).toBe(false);
    });

    test("should handle multiple field parsing with transformations", () => {
      const nameValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 2) {
            return { valid: true, errors: [] };
          }
          return { valid: false, errors: [{ path: "name", message: "Name error", code: "NAME_ERROR" }] };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 2) {
            return { valid: true, errors: [], data: value.trim() };
          }
          return { valid: false, errors: [{ path: "name", message: "Name error", code: "NAME_ERROR" }] };
        },
        fieldPath: "name"
      };

      const ageValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && !isNaN(Number(value))) {
            return { valid: true, errors: [] };
          }
          return { valid: false, errors: [{ path: "age", message: "Age error", code: "AGE_ERROR" }] };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && !isNaN(Number(value))) {
            return { valid: true, errors: [], data: Number(value) };
          }
          return { valid: false, errors: [{ path: "age", message: "Age error", code: "AGE_ERROR" }] };
        },
        fieldPath: "age"
      };

      const validators = new Map([
        ["name", nameValidator as any],
        ["age", ageValidator as any]
      ]);
      const rawValidator = createRawValidator(validators);

      // Valid transformation
      const result = rawValidator.parseRaw({ name: "  Alice  ", age: "25" });
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();

      // Invalid transformation
      const invalidResult = rawValidator.parseRaw({ name: "A", age: "not-a-number" });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });
  });

  describe("createRawValidator - nested and complex fields", () => {
    test("should handle nested object validation", () => {
      const nestedValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.includes("@")) {
            return { valid: true, errors: [] };
          }
          return { valid: false, errors: [{ path: "profile.email", message: "Invalid email", code: "EMAIL_ERROR" }] };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.includes("@")) {
            return { valid: true, errors: [], data: value };
          }
          return { valid: false, errors: [{ path: "profile.email", message: "Invalid email", code: "EMAIL_ERROR" }] };
        },
        fieldPath: "profile.email"
      };

      const validators = new Map([["profile.email", nestedValidator as any]]);
      const rawValidator = createRawValidator(validators);

      // Valid nested
      expect(rawValidator.validateRaw({ 
        profile: { email: "test@example.com" } 
      })).toBe(true);
      
      // Invalid nested value
      expect(rawValidator.validateRaw({ 
        profile: { email: "invalid-email" } 
      })).toBe(false);
      
      // Missing nested structure
      expect(rawValidator.validateRaw({ profile: {} })).toBe(false);
      expect(rawValidator.validateRaw({})).toBe(false);
    });

    test("should handle array element validation", () => {
      const arrayValidator = {
        validate: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 2) {
            return { valid: true, errors: [] };
          }
          return { valid: false, errors: [{ path: "items", message: "Invalid item", code: "ITEM_ERROR" }] };
        },
        parse: (value: any, rootData: any, options?: any) => {
          if (typeof value === "string" && value.length >= 2) {
            return { valid: true, errors: [], data: value };
          }
          return { valid: false, errors: [{ path: "items", message: "Invalid item", code: "ITEM_ERROR" }] };
        },
        fieldPath: "items.*"
      };

      const validators = new Map([["items.*", arrayValidator as any]]);
      const rawValidator = createRawValidator(validators);

      // Valid array
      expect(rawValidator.validateRaw({ 
        items: ["item1", "item2", "item3"] 
      })).toBe(true);
      
      // Invalid array element
      expect(rawValidator.validateRaw({ 
        items: ["item1", "X", "item3"] 
      })).toBe(false);
      
      // Empty array
      expect(rawValidator.validateRaw({ items: [] })).toBe(true);
      
      // Missing array
      expect(rawValidator.validateRaw({})).toBe(false);
    });
  });

  describe("createRawValidator - performance optimizations", () => {
    test("should handle large number of fields efficiently", () => {
      const validators = new Map();
      const testData: Record<string, string> = {};
      
      // Create 100 field validators
      for (let i = 0; i < 100; i++) {
        const fieldName = `field${i}`;
        const validator = {
          validate: (value: any) => {
            return typeof value === "string" && value.length >= 1
              ? { valid: true, errors: [] }
              : { valid: false, errors: [{ path: fieldName, message: "Invalid", code: "ERROR" }] };
          },
          fieldPath: fieldName
        };
        validators.set(fieldName, validator);
        testData[fieldName] = `value${i}`;
      }

      const rawValidator = createRawValidator(validators);

      const start = performance.now();
      const result = rawValidator.validateRaw(testData);
      const end = performance.now();

      expect(result).toBe(true);
      expect(end - start).toBeLessThan(50); // Should complete within 50ms
    });

    test("should reuse field accessors for performance", () => {
      const validators = new Map();
      
      // Create validators for similar nested paths
      for (let i = 0; i < 10; i++) {
        const fieldPath = `users[${i}].name`;
        const validator = {
          validate: (value: any) => ({ valid: typeof value === "string", errors: [] }),
          fieldPath
        };
        validators.set(fieldPath, validator);
      }

      const rawValidator = createRawValidator(validators);

      const testData = {
        users: Array.from({ length: 10 }, (_, i) => ({ name: `User${i}` }))
      };

      expect(rawValidator.validateRaw(testData)).toBe(true);
    });
  });

  describe("createRawValidator - options handling", () => {
    test("should pass validation options to validators", () => {
      let receivedOptions: any = null;
      
      const validator = {
        validate: (value: any, rootData: any, options?: any) => {
          receivedOptions = options;
          return { valid: true, errors: [] };
        },
        parse: (value: any, rootData: any, options?: any) => {
          receivedOptions = options;
          return { valid: true, errors: [], data: value };
        },
        fieldPath: "test"
      };

      const validators = new Map([["test", validator as any]]);
      const rawValidator = createRawValidator(validators);

      const options = { abortEarly: true, customParam: "test" };
      rawValidator.validateRaw({ test: "value" }, options);

      expect(receivedOptions).toEqual(options);
    });

    test("should handle abortEarly option in validation", () => {
      const failingValidator1 = {
        validate: () => ({ 
          valid: false, 
          errors: [{ path: "field1", message: "Error 1", code: "ERROR_1" }] 
        }),
        fieldPath: "field1"
      };

      const failingValidator2 = {
        validate: () => ({ 
          valid: false, 
          errors: [{ path: "field2", message: "Error 2", code: "ERROR_2" }] 
        }),
        fieldPath: "field2"
      };

      const validators = new Map([
        ["field1", failingValidator1 as any],
        ["field2", failingValidator2 as any]
      ]);
      const rawValidator = createRawValidator(validators);

      // Without abortEarly - should check all fields
      const resultFull = rawValidator.validateRaw({ field1: "test", field2: "test" });
      expect(resultFull).toBe(false);

      // With abortEarly - may stop at first error
      const resultEarly = rawValidator.validateRaw(
        { field1: "test", field2: "test" }, 
        { abortEarly: true }
      );
      expect(resultEarly).toBe(false);
    });
  });

  describe("createRawValidator - compatibility methods", () => {
    test("should provide Result wrapper compatibility for validate", () => {
      const validator = {
        validate: (value: any) => {
          return typeof value === "string" && value.length >= 3
            ? { valid: true, errors: [] }
            : { valid: false, errors: [{ path: "test", message: "Too short", code: "SHORT" }] };
        },
        fieldPath: "test"
      };

      const validators = new Map([["test", validator as any]]);
      const rawValidator = createRawValidator(validators);

      // Valid case
      const validResult = rawValidator.validate({ test: "Alice" });
      expect(validResult).toBeInstanceOf(Result);
      expect(validResult.isValid()).toBe(true);

      // Invalid case
      const invalidResult = rawValidator.validate({ test: "AB" });
      expect(invalidResult).toBeInstanceOf(Result);
      expect(invalidResult.isValid()).toBe(false);
    });

    test("should provide Result wrapper compatibility for parse", () => {
      const validator = {
        validate: (value: any) => {
          return typeof value === "string" && value.length >= 3
            ? { valid: true, errors: [], transformedValue: value.toUpperCase() }
            : { valid: false, errors: [{ path: "test", message: "Too short", code: "SHORT" }] };
        },
        fieldPath: "test"
      };

      const validators = new Map([["test", validator as any]]);
      const rawValidator = createRawValidator(validators);

      // Valid parse
      const validResult = rawValidator.parse({ test: "alice" });
      expect(validResult).toBeInstanceOf(Result);
      expect(validResult.isValid()).toBe(true);

      // Invalid parse
      const invalidResult = rawValidator.parse({ test: "AB" });
      expect(invalidResult).toBeInstanceOf(Result);
      expect(invalidResult.isValid()).toBe(false);
    });
  });

  describe("createRawValidator - edge cases", () => {
    test("should handle null and undefined input gracefully", () => {
      const validator = {
        validate: (value: any) => ({ 
          valid: value != null, 
          errors: value == null ? [{ path: "test", message: "Required", code: "REQUIRED" }] : [] 
        }),
        fieldPath: "test"
      };

      const validators = new Map([["test", validator as any]]);
      const rawValidator = createRawValidator(validators);

      expect(rawValidator.validateRaw(null)).toBe(false);
      expect(rawValidator.validateRaw(undefined)).toBe(false);
    });

    test("should handle validator throwing exceptions", () => {
      const throwingValidator = {
        validate: () => {
          throw new Error("Validator error");
        },
        fieldPath: "test"
      };

      const validators = new Map([["test", throwingValidator as any]]);
      const rawValidator = createRawValidator(validators);

      // Should not crash, should return false
      expect(() => {
        const result = rawValidator.validateRaw({ test: "value" });
        expect(result).toBe(false);
      }).not.toThrow();
    });

    test("should handle malformed validator responses", () => {
      const malformedValidator = {
        validate: () => {
          return null; // Invalid response format
        },
        fieldPath: "test"
      };

      const validators = new Map([["test", malformedValidator as any]]);
      const rawValidator = createRawValidator(validators);

      expect(() => {
        const result = rawValidator.validateRaw({ test: "value" });
        expect(typeof result).toBe("boolean");
      }).not.toThrow();
    });
  });
});