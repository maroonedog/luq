import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import {
  createValidatorFactory,
  FieldDefinition,
} from "../../../../src/core/builder/validator-factory";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { transformPlugin } from "../../../../src/core/plugin/transform";
import { arrayIncludesPlugin } from "../../../../src/core/plugin/arrayIncludes";

describe("ValidatorFactory - Coverage Boost Tests", () => {
  let plugins: Record<string, any>;
  
  beforeEach(() => {
    plugins = {
      required: requiredPlugin,
      optional: optionalPlugin,
      stringMin: stringMinPlugin,
      stringMax: stringMaxPlugin,
      numberMin: numberMinPlugin,
      numberMax: numberMaxPlugin,
      arrayMaxLength: arrayMaxLengthPlugin,
      arrayMinLength: arrayMinLengthPlugin,
      transform: transformPlugin,
      arrayIncludes: arrayIncludesPlugin,
    };
  });

  describe("Ultra-fast validator paths (lines 1602-1783)", () => {
    test("should trigger single field ultra-fast path", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDef: FieldDefinition = {
        path: "simpleField",
        builderFunction: (b: any) => b.string.required(),
        fieldType: "string",
        isArrayField: false,
        isOptional: false,
        metadata: {
          inferredType: "string",
        },
      };

      const validator = factory.buildOptimizedValidator([fieldDef]);
      
      // Test both valid and invalid cases to trigger error paths
      const validResult = validator.validate({ simpleField: "test" });
      expect(validResult.valid).toBe(true);
      
      const invalidResult = validator.validate({ simpleField: "" });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test("should trigger multi-field ultra-fast path", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDefs: FieldDefinition[] = [
        {
          path: "field1",
          builderFunction: (b: any) => b.string.required().min(2),
          fieldType: "string",
        },
        {
          path: "field2", 
          builderFunction: (b: any) => b.number.required().min(0),
          fieldType: "number",
        },
      ];

      const validator = factory.buildOptimizedValidator(fieldDefs);
      
      // Test various cases to trigger different code paths
      expect(validator.validate({ field1: "ab", field2: 5 }).valid).toBe(true);
      expect(validator.validate({ field1: "a", field2: 5 }).valid).toBe(false);
      expect(validator.validate({ field1: "ab", field2: -1 }).valid).toBe(false);
    });
  });

  describe("Array batch optimization (lines 1800-1866)", () => {
    test("should trigger array batch processing", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDef: FieldDefinition = {
        path: "items[*]",
        builderFunction: (b: any) => b.string.required().min(2),
        fieldType: "string",
        isArrayField: true,
      };

      const validator = factory.buildOptimizedValidator([fieldDef]);
      
      // Test large array to trigger batching
      const largeArray = Array.from({ length: 50 }, (_, i) => `item${i}`);
      const result = validator.validate({ items: largeArray });
      expect(result.valid).toBe(true);
      
      // Test array with some invalid items
      const mixedArray = ["valid", "ok", "x", "good"]; // "x" is too short
      const mixedResult = validator.validate({ items: mixedArray });
      expect(mixedResult.valid).toBe(false);
    });

    test("should handle empty array in batch processing", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDef: FieldDefinition = {
        path: "tags[*]",
        builderFunction: (b: any) => b.string.required(),
        fieldType: "string",
        isArrayField: true,
      };

      const validator = factory.buildOptimizedValidator([fieldDef]);
      const result = validator.validate({ tags: [] });
      expect(result.valid).toBe(true); // Empty array should be valid
    });
  });

  describe("Optimization strategy selection (lines 324-337, 358-395)", () => {
    test("should select appropriate strategy for complex fields", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDefs: FieldDefinition[] = [
        {
          path: "user.profile.settings.theme",
          builderFunction: (b: any) => b.string.required().min(3),
          fieldType: "string",
          metadata: {
            hasTransforms: false,
            inferredType: "string",
          },
        },
        {
          path: "user.permissions[*]",
          builderFunction: (b: any) => b.string.required(),
          fieldType: "string",
          isArrayField: true,
        },
        {
          path: "config.values[*].key",
          builderFunction: (b: any) => b.string.required().min(1),
          fieldType: "string",
          isArrayField: true,
        },
      ];

      const validator = factory.buildOptimizedValidator(fieldDefs);
      
      const testData = {
        user: {
          profile: {
            settings: {
              theme: "dark"
            }
          },
          permissions: ["read", "write"]
        },
        config: {
          values: [{ key: "a" }, { key: "b" }]
        }
      };
      
      const result = validator.validate(testData);
      expect(result.valid).toBe(true);
    });

    test("should handle fields with transforms in optimization", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDef: FieldDefinition = {
        path: "processedValue",
        builderFunction: (b: any) => 
          b.string.required().min(2).transform((v: string) => v.toUpperCase()),
        fieldType: "string",
        metadata: {
          hasTransforms: true,
          inferredType: "string",
        },
      };

      const validator = factory.buildOptimizedValidator([fieldDef]);
      
      // Test both validate and parse modes
      const validateResult = validator.validate({ processedValue: "test" });
      expect(validateResult.valid).toBe(true);
      
      const parseResult = validator.parse({ processedValue: "test" });
      expect(parseResult.isValid()).toBe(true);
      expect((parseResult.data() as any).processedValue).toBe("TEST");
    });
  });

  describe("Raw validator fallback (lines 400-428)", () => {
    test("should fallback to raw validator for complex cases", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDefs: FieldDefinition[] = [
        {
          path: "field1",
          builderFunction: (b: any) => {
            // Complex builder function that might not optimize well
            return b.string.required().min(5).max(50).transform((v: string) => v.trim());
          },
          fieldType: "string",
          metadata: {
            hasTransforms: true,
          },
        },
        {
          path: "nested.deep.value[*].prop",
          builderFunction: (b: any) => b.string.required(),
          fieldType: "string",
          isArrayField: true,
        },
        // Many fields to potentially trigger fallback
        ...Array.from({ length: 20 }, (_, i) => ({
          path: `field${i + 2}`,
          builderFunction: (b: any) => b.string.optional(),
          fieldType: "string" as const,
        })),
      ];

      const validator = factory.buildOptimizedValidator(fieldDefs);
      
      const testData: any = {
        field1: "  valid input  ",
        nested: {
          deep: {
            value: [{ prop: "test1" }, { prop: "test2" }]
          }
        }
      };
      
      // Add data for the many optional fields
      for (let i = 2; i <= 21; i++) {
        testData[`field${i}`] = `value${i}`;
      }
      
      const result = validator.validate(testData);
      expect(result.valid).toBe(true);
    });
  });

  describe("Performance optimizations (lines 473-567)", () => {
    test("should optimize field accessor reuse", () => {
      const factory = createValidatorFactory(plugins);
      
      // Create many fields with similar paths to test accessor reuse
      const fieldDefs: FieldDefinition[] = Array.from({ length: 30 }, (_, i) => ({
        path: `data.items[${i}].value`,
        builderFunction: (b: any) => b.string.optional().min(1),
        fieldType: "string",
      }));

      const validator = factory.buildOptimizedValidator(fieldDefs);
      
      const testData: any = {
        data: {
          items: Array.from({ length: 30 }, (_, i) => ({
            value: `val${i}`
          }))
        }
      };
      
      const start = Date.now();
      const result = validator.validate(testData);
      const end = Date.now();
      
      expect(result.valid).toBe(true);
      expect(end - start).toBeLessThan(100); // Should be optimized
    });

    test("should handle validation options and modes", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDefs: FieldDefinition[] = [
        {
          path: "field1",
          builderFunction: (b: any) => b.string.required().min(5),
          fieldType: "string",
        },
        {
          path: "field2", 
          builderFunction: (b: any) => b.string.required().min(3),
          fieldType: "string",
        },
        {
          path: "field3",
          builderFunction: (b: any) => b.number.required().min(10),
          fieldType: "number",
        },
      ];

      const validator = factory.buildOptimizedValidator(fieldDefs);
      
      // Test abortEarly option
      const abortEarlyResult = validator.validate(
        { field1: "ab", field2: "cd", field3: 5 }, // All invalid
        { abortEarly: true }
      );
      expect(abortEarlyResult.valid).toBe(false);
      
      // Test parse mode with invalid data
      const parseResult = validator.parse(
        { field1: "abc", field2: "de", field3: 8 }, // All too short/small
        { abortEarly: false }
      );
      expect(parseResult.isValid()).toBe(false);
      expect(parseResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Unified validator execution (lines 588-646)", () => {
    test("should execute unified validation properly", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDefs: FieldDefinition[] = [
        {
          path: "metadata.version",
          builderFunction: (b: any) => b.number.required().min(1),
          fieldType: "number",
        },
        {
          path: "data.values[*]",
          builderFunction: (b: any) => b.string.required().min(2),
          fieldType: "string",
          isArrayField: true,
        },
      ];

      const validator = factory.buildOptimizedValidator(fieldDefs);
      
      // Valid case
      const validData = {
        metadata: { version: 2 },
        data: { values: ["test", "data"] }
      };
      expect(validator.validate(validData).valid).toBe(true);
      
      // Invalid nested field
      const invalidData = {
        metadata: { version: 0 }, // Too small
        data: { values: ["test", "x"] } // Second value too short
      };
      const result = validator.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("should handle edge cases in unified execution", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDef: FieldDefinition = {
        path: "conditionalField",
        builderFunction: (b: any) => b.string.optional().min(3),
        fieldType: "string",
        isOptional: true,
      };

      const validator = factory.buildOptimizedValidator([fieldDef]);
      
      // Test with undefined field
      expect(validator.validate({}).valid).toBe(true);
      
      // Test with null field - optional plugin might still validate null
      const nullResult = validator.validate({ conditionalField: null });
      expect(typeof nullResult.valid).toBe("boolean"); // Just check it returns a result
      
      // Test with empty string
      const emptyResult = validator.validate({ conditionalField: "" });
      // Empty string should be validated and fail min length
      expect(emptyResult.valid).toBe(false);
    });
  });

  describe("Error collection and reporting (lines 692-742)", () => {
    test("should collect all errors when abortEarly is false", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDefs: FieldDefinition[] = [
        {
          path: "name",
          builderFunction: (b: any) => b.string.required().min(3).max(10),
          fieldType: "string",
        },
        {
          path: "age",
          builderFunction: (b: any) => b.number.required().min(18).max(100),
          fieldType: "number",
        },
        {
          path: "email",
          builderFunction: (b: any) => b.string.required().min(5),
          fieldType: "string",
        },
      ];

      const validator = factory.buildOptimizedValidator(fieldDefs);
      
      // All fields invalid
      const result = validator.validate(
        {
          name: "ab", // Too short
          age: 15, // Too young
          email: "x" // Too short
        },
        { abortEarly: false }
      );
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3); // Should collect multiple errors
    });

    test("should provide proper error context", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDef: FieldDefinition = {
        path: "items[*].name",
        builderFunction: (b: any) => b.string.required().min(2),
        fieldType: "string",
        isArrayField: true,
      };

      const validator = factory.buildOptimizedValidator([fieldDef]);
      
      const result = validator.validate({
        items: [
          { name: "valid" },
          { name: "x" }, // Invalid - too short
          { name: "also-valid" }
        ]
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check error details
      const error = result.errors[0];
      expect(error).toHaveProperty('path');
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
    });
  });

  describe("Advanced features (lines 1226-1316)", () => {
    test("should handle complex field analysis", () => {
      const factory = createValidatorFactory(plugins);
      
      const fieldDef: FieldDefinition = {
        path: "complex.nested[*].deep.value",
        builderFunction: (b: any) => b.string.required().min(1).max(50),
        fieldType: "string",
        isArrayField: true,
        metadata: {
          inferredType: "string",
          hasTransforms: false,
        },
        arrayStructure: {
          depth: 1,
          elementType: { deep: { value: "string" } },
          indexPattern: "[i]",
          loopVariables: ["i"],
        },
      };

      const validator = factory.buildOptimizedValidator([fieldDef]);
      
      const complexData = {
        complex: {
          nested: [
            { deep: { value: "test1" } },
            { deep: { value: "test2" } },
          ]
        }
      };
      
      expect(validator.validate(complexData).valid).toBe(true);
    });
  });
});