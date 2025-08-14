import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  getSpecificValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  applyConstraints
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Ultra Final 266 Lines", () => {
  describe("Basic validation edge cases - Lines 185,193,198,202,208,212,218,222,226,230,234,238,242,246,250-258,267-268,272-278", () => {
    test("should hit specific type validation branches", () => {
      // Hit undefined/null type checking branches
      expect(validateValueAgainstSchema(undefined, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(null, { type: "string" })).toBe(false);
      
      // Hit array vs object type checking
      expect(validateValueAgainstSchema([], { type: "object" })).toBe(false);
      expect(validateValueAgainstSchema({}, { type: "array" })).toBe(false);
      
      // Hit boolean type checking
      expect(validateValueAgainstSchema("true", { type: "boolean" })).toBe(false);
      expect(validateValueAgainstSchema(1, { type: "boolean" })).toBe(false);
      expect(validateValueAgainstSchema(true, { type: "boolean" })).toBe(true);
      expect(validateValueAgainstSchema(false, { type: "boolean" })).toBe(true);
      
      // Hit null type checking
      expect(validateValueAgainstSchema(null, { type: "null" })).toBe(true);
      expect(validateValueAgainstSchema(undefined, { type: "null" })).toBe(false);
      expect(validateValueAgainstSchema("", { type: "null" })).toBe(false);
      
      // Hit integer vs number distinctions
      expect(validateValueAgainstSchema(3.14, { type: "integer" })).toBe(false);
      expect(validateValueAgainstSchema(3.0, { type: "integer" })).toBe(true);
      expect(validateValueAgainstSchema(-5, { type: "integer" })).toBe(true);
      
      // Hit NaN validation
      expect(validateValueAgainstSchema(NaN, { type: "number" })).toBe(false);
      expect(validateValueAgainstSchema(NaN, { type: "integer" })).toBe(false);
      
      // Hit string length edge cases
      expect(validateValueAgainstSchema("", { type: "string", minLength: 1 })).toBe(false);
      expect(validateValueAgainstSchema("a", { type: "string", maxLength: 0 })).toBe(false);
      expect(validateValueAgainstSchema("", { type: "string", maxLength: 0 })).toBe(true);
      
      // Hit multipleOf edge cases
      expect(validateValueAgainstSchema(0.1 + 0.2, { type: "number", multipleOf: 0.1 })).toBe(false); // floating point precision
      expect(validateValueAgainstSchema(0, { type: "number", multipleOf: 5 })).toBe(true);
      expect(validateValueAgainstSchema(-10, { type: "number", multipleOf: 5 })).toBe(true);
    });
    
    test("should handle array type specifications with edge cases", () => {
      // Hit multiple types with null
      expect(validateValueAgainstSchema(null, { type: ["string", "null"] })).toBe(true);
      expect(validateValueAgainstSchema("", { type: ["string", "null"] })).toBe(true);
      expect(validateValueAgainstSchema(123, { type: ["string", "null"] })).toBe(false);
      
      // Hit complex array type scenarios
      expect(validateValueAgainstSchema(true, { type: ["string", "number", "boolean"] })).toBe(true);
      expect(validateValueAgainstSchema([], { type: ["string", "number", "boolean"] })).toBe(false);
    });
  });

  describe("Enum validation error generation - Lines 658-664", () => {
    test("should generate enum validation errors", () => {
      const schema: JSONSchema7 = {
        type: "string",
        enum: ["red", "green", "blue"]
      };

      // Hit lines 658-664: enum error generation
      const errors = getDetailedValidationErrors("yellow", schema);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("ENUM");
      expect(errors[0].message).toContain("Must be one of");
    });
    
    test("should handle complex enum values", () => {
      const schema: JSONSchema7 = {
        enum: [
          { type: "A", value: 1 },
          { type: "B", value: 2 },
          ["array", "value"],
          null,
          42,
          true
        ]
      };

      // Test enum with objects
      expect(validateValueAgainstSchema({ type: "A", value: 1 }, schema)).toBe(true);
      expect(validateValueAgainstSchema({ type: "A", value: 2 }, schema)).toBe(false);
      
      // Test enum with arrays
      expect(validateValueAgainstSchema(["array", "value"], schema)).toBe(true);
      expect(validateValueAgainstSchema(["different", "value"], schema)).toBe(false);
      
      // Test enum with primitives
      expect(validateValueAgainstSchema(null, schema)).toBe(true);
      expect(validateValueAgainstSchema(42, schema)).toBe(true);
      expect(validateValueAgainstSchema(true, schema)).toBe(true);
      expect(validateValueAgainstSchema(false, schema)).toBe(false);
    });
  });

  describe("Array validation error generation - Lines 672-689,704,707,710-719", () => {
    test("should generate array validation errors", () => {
      const schema: JSONSchema7 = {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string", minLength: 2 },
        uniqueItems: true
      };

      // Hit array validation error paths
      const errors1 = getDetailedValidationErrors(["a"], schema); // too few items, item too short
      expect(errors1.length).toBeGreaterThan(0);
      
      const errors2 = getDetailedValidationErrors([
        "aa", "bb", "cc", "dd", "ee", "ff"
      ], schema); // too many items
      expect(errors2.length).toBeGreaterThan(0);
      
      const errors3 = getDetailedValidationErrors([
        "aa", "bb", "aa"
      ], schema); // duplicate items
      expect(errors3.length).toBeGreaterThan(0);
      
      const errors4 = getDetailedValidationErrors([
        "aa", "b", "cc"
      ], schema); // item validation failure
      expect(errors4.length).toBeGreaterThan(0);
    });
    
    test("should handle nested array validation errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          matrix: {
            type: "array",
            items: {
              type: "array",
              items: { type: "number", minimum: 0 },
              minItems: 2
            }
          }
        }
      };

      const errors = getDetailedValidationErrors({
        matrix: [
          [1, 2, 3], // valid
          [-1], // invalid: negative number, too few items
          [0, 5] // valid
        ]
      }, schema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("Object validation error generation - Lines 730,733", () => {
    test("should generate object property validation errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 },
          age: { type: "number", minimum: 0 },
          email: { type: "string", format: "email" }
        },
        required: ["name"],
        additionalProperties: false
      };

      const errors = getDetailedValidationErrors({
        name: "Jo", // too short
        age: -5, // negative
        email: "invalid-email", // bad format
        extra: "not allowed" // additional property
      }, schema);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.path.includes("name"))).toBe(true);
      expect(errors.some(e => e.path.includes("age"))).toBe(true);
    });
  });

  describe("DSL conversion - Lines 756-759,774-777,837-838,882-886,920,931", () => {
    test("should convert root schema with additionalProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: { type: "number" }
      };

      // Hit lines 756-759: root schema additionalProperties handling
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.length).toBeGreaterThan(0);
    });
    
    test("should convert propertyNames constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          pattern: "^[a-z]+$",
          minLength: 3
        }
      };

      // Hit lines 774-777: propertyNames conversion
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.length).toBeGreaterThan(0);
    });
    
    test("should handle multipleTypes with null in DSL", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          optionalField: {
            type: ["string", "null"],
            minLength: 5
          },
          multiField: {
            type: ["string", "number", "null"]
          }
        }
      };

      // Hit lines 837-838,882-886: multipleTypes with null handling
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const optionalField = dsl.find(d => d.path === "optionalField");
      const multiField = dsl.find(d => d.path === "multiField");
      
      expect(optionalField?.nullable).toBe(true);
      expect(optionalField?.type).toBe("string");
      expect(multiField?.nullable).toBe(true);
      expect(multiField?.multipleTypes).toBeDefined();
    });
    
    test("should handle draft-04 exclusive constraints in DSL", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          minField: {
            type: "number",
            minimum: 10,
            exclusiveMinimum: true as any
          },
          maxField: {
            type: "number", 
            maximum: 100,
            exclusiveMaximum: true as any
          }
        }
      };

      // Hit lines 920,931: draft-04 exclusive handling
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const minField = dsl.find(d => d.path === "minField");
      const maxField = dsl.find(d => d.path === "maxField");
      
      expect(minField?.constraints?.exclusiveMin).toBe(true);
      expect(maxField?.constraints?.exclusiveMax).toBe(true);
    });
  });

  describe("Field definition conversion - Lines 1011-1012,1036,1073,1079,1106,1120-1125,1131-1145", () => {
    test("should handle literal constraints", () => {
      const dsl = {
        path: "constField",
        type: "string" as const,
        constraints: {
          const: "exact-value"
        }
      };

      // Hit line 1036: literal handling
      const definition = convertDSLToFieldDefinition(dsl);
      const mockBuilder = {
        literal: jest.fn().mockReturnThis()
      };
      
      definition(mockBuilder);
      expect(mockBuilder.literal).toHaveBeenCalledWith("exact-value");
    });
    
    test("should handle custom formats", () => {
      const customFormats = {
        "custom-id": (value: string) => /^ID\d{6}$/.test(value)
      };
      
      const dsl = {
        path: "idField", 
        type: "string" as const,
        constraints: {
          format: "custom-id"
        }
      };

      // Hit lines 1120-1125,1131-1145: custom format handling
      const definition = convertDSLToFieldDefinition(dsl, customFormats);
      const mockBuilder = {
        string: {
          refine: jest.fn().mockReturnThis()
        }
      };
      
      definition(mockBuilder);
      expect(mockBuilder.string.refine).toHaveBeenCalledWith(customFormats["custom-id"]);
    });
    
    test("should handle multipleTypes scenarios", () => {
      const dsl = {
        path: "unionField",
        type: "string" as const,
        multipleTypes: ["string", "number", "boolean"],
        constraints: {}
      };

      // Hit lines 1011-1012: multipleTypes handling
      const definition = convertDSLToFieldDefinition(dsl);
      const mockBuilder = {
        oneOf: jest.fn().mockReturnThis()
      };
      
      definition(mockBuilder);
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });
  });

  describe("Constraint application - Lines 1274-1280,1294-1300,1360-1362,1370-1374,1407,1421-1429,1449", () => {
    test("should apply exclusive min/max constraints", () => {
      const constraints: any = {
        exclusiveMin: true,
        min: 10,
        exclusiveMax: false,
        max: 100
      };

      const mockChain = {
        min: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis()
      };

      // Hit lines 1274-1280: exclusive constraint application
      applyConstraints(mockChain, constraints);
      expect(mockChain.min).toHaveBeenCalledWith(10, { exclusive: true });
      expect(mockChain.max).toHaveBeenCalledWith(100);
    });
    
    test("should apply object property constraints", () => {
      const constraints: any = {
        minProperties: 1,
        maxProperties: 5,
        additionalProperties: { type: "string" }
      };

      const mockChain = {
        minProperties: jest.fn().mockReturnThis(),
        maxProperties: jest.fn().mockReturnThis(),
        additionalProperties: jest.fn().mockReturnThis()
      };

      // Hit lines 1294-1300: object property constraints
      applyConstraints(mockChain, constraints);
      expect(mockChain.minProperties).toHaveBeenCalledWith(1);
      expect(mockChain.maxProperties).toHaveBeenCalledWith(5);
      expect(mockChain.additionalProperties).toHaveBeenCalled();
    });
    
    test("should apply propertyNames constraints", () => {
      const constraints: any = {
        propertyNames: {
          pattern: "^[a-z]+$",
          enum: ["name", "age", "email"]
        }
      };

      const mockChain = {
        propertyNames: jest.fn().mockReturnThis()
      };

      // Hit lines 1370-1374: propertyNames constraints
      applyConstraints(mockChain, constraints);
      expect(mockChain.propertyNames).toHaveBeenCalled();
    });
    
    test("should apply schema composition constraints", () => {
      const allOfConstraints: any = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 10 }
        ]
      };

      const mockChain1 = {
        custom: jest.fn().mockReturnThis()
      };

      // Hit line 1407: allOf handling
      applyConstraints(mockChain1, allOfConstraints);
      expect(mockChain1.custom).toHaveBeenCalled();
      
      const oneOfConstraints: any = {
        oneOf: [
          { type: "string", maxLength: 3 },
          { type: "number", minimum: 10 }
        ]
      };

      const mockChain2 = {
        custom: jest.fn().mockReturnThis()
      };

      // Hit line 1449: oneOf handling  
      applyConstraints(mockChain2, oneOfConstraints);
      expect(mockChain2.custom).toHaveBeenCalled();
    });
  });

  describe("Line 514: if/then/else final return", () => {
    test("should hit line 514: return true when no then/else applies", () => {
      const schema: JSONSchema7 = {
        type: "object",
        if: {
          properties: {
            trigger: { const: "activate" }
          }
        },
        then: {
          properties: {
            value: { type: "string" }
          }
        }
        // No else clause
      };

      // Hit line 514: return true (if condition false, no else)
      expect(validateValueAgainstSchema({
        trigger: "inactive", // if condition is false
        anything: "allowed"
      }, schema)).toBe(true);
    });
  });

  describe("Remaining specific validation paths", () => {
    test("should handle pattern validation edge cases", () => {
      const schema: JSONSchema7 = {
        type: "string",
        pattern: "^[a-zA-Z0-9]+$"
      };

      expect(validateValueAgainstSchema("Valid123", schema)).toBe(true);
      expect(validateValueAgainstSchema("Invalid-char!", schema)).toBe(false);
      expect(validateValueAgainstSchema("", schema)).toBe(false); // empty string doesn't match ^[a-zA-Z0-9]+$ (+ requires at least one char)
    });
    
    test("should handle const validation edge cases", () => {
      const schema: JSONSchema7 = {
        const: { nested: { value: [1, 2, 3] } }
      };

      expect(validateValueAgainstSchema(
        { nested: { value: [1, 2, 3] } }, 
        schema
      )).toBe(true);
      
      expect(validateValueAgainstSchema(
        { nested: { value: [1, 2] } }, 
        schema
      )).toBe(false);
    });
    
    test("should handle format validation with custom formats", () => {
      const customFormats = {
        "phone": (value: string) => /^\d{3}-\d{3}-\d{4}$/.test(value)
      };
      
      const schema: JSONSchema7 = {
        type: "string",
        format: "phone"
      };

      expect(validateValueAgainstSchema(
        "123-456-7890", 
        schema, 
        customFormats
      )).toBe(true);
      
      expect(validateValueAgainstSchema(
        "invalid-phone", 
        schema, 
        customFormats
      )).toBe(false);
    });
  });
});