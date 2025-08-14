import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  getSpecificValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  getBaseChain,
  applyConstraints,
  resolveRef
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Precision Coverage", () => {
  describe("validateValueAgainstSchema - Exact Line Coverage", () => {
    test("should hit line 302: exclusiveMinimum boolean validation failure", () => {
      const schema: any = {
        type: "number",
        minimum: 10,
        exclusiveMinimum: true
      };
      
      // This should hit line 302: if (value <= schema.minimum) return false;
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
      expect(validateValueAgainstSchema(9.5, schema)).toBe(false);
    });

    test("should hit line 312: exclusiveMinimum number validation failure", () => {
      const schema: JSONSchema7 = {
        type: "number",
        exclusiveMinimum: 10
      };
      
      // This should hit line 312: if (value <= schema.exclusiveMinimum) return false;
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
      expect(validateValueAgainstSchema(9.9, schema)).toBe(false);
    });

    test("should hit line 320: exclusiveMaximum boolean validation failure", () => {
      const schema: any = {
        type: "number",
        maximum: 100,
        exclusiveMaximum: true
      };
      
      // This should hit line 320: if (value >= schema.maximum) return false;
      expect(validateValueAgainstSchema(100, schema)).toBe(false);
      expect(validateValueAgainstSchema(100.1, schema)).toBe(false);
    });

    test("should hit line 330: exclusiveMaximum number validation failure", () => {
      const schema: JSONSchema7 = {
        type: "number",
        exclusiveMaximum: 100
      };
      
      // This should hit line 330: if (value >= schema.exclusiveMaximum) return false;
      expect(validateValueAgainstSchema(100, schema)).toBe(false);
      expect(validateValueAgainstSchema(100.1, schema)).toBe(false);
    });

    test("should hit line 334: multipleOf validation failure", () => {
      const schema: JSONSchema7 = {
        type: "number",
        multipleOf: 3
      };
      
      // This should hit line 334: if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) return false;
      expect(validateValueAgainstSchema(7, schema)).toBe(false); // 7 % 3 !== 0
      expect(validateValueAgainstSchema(10, schema)).toBe(false); // 10 % 3 !== 0
    });

    test("should hit line 352-353: uniqueItems validation failure", () => {
      const schema: JSONSchema7 = {
        type: "array",
        uniqueItems: true
      };
      
      // This should hit lines 352-353: if (seen.has(key)) return false;
      expect(validateValueAgainstSchema([1, 2, 1], schema)).toBe(false);
      expect(validateValueAgainstSchema(["a", "b", "a"], schema)).toBe(false);
      expect(validateValueAgainstSchema([{a: 1}, {a: 1}], schema)).toBe(false);
    });

    test("should hit line 372: minProperties validation failure", () => {
      const schema: JSONSchema7 = {
        type: "object",
        minProperties: 2
      };
      
      // This should hit line 372: return false;
      expect(validateValueAgainstSchema({}, schema)).toBe(false);
      expect(validateValueAgainstSchema({a: 1}, schema)).toBe(false);
    });

    test("should hit line 377: maxProperties validation failure", () => {
      const schema: JSONSchema7 = {
        type: "object",
        maxProperties: 2
      };
      
      // This should hit line 377: return false;
      expect(validateValueAgainstSchema({a: 1, b: 2, c: 3}, schema)).toBe(false);
    });

    test("should hit line 397: property validation failure", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 5 }
        }
      };
      
      // This should hit line 397: return false;
      expect(validateValueAgainstSchema({name: "hi"}, schema)).toBe(false);
    });

    test("should hit lines 404-406: additionalProperties false validation failure", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: false
      };
      
      // This should hit lines 404-406: if (!allowedKeys.includes(key)) return false;
      expect(validateValueAgainstSchema({name: "John", extra: "value"}, schema)).toBe(false);
    });

    test("should hit lines 430-438: allOf validation failure", () => {
      const schema: JSONSchema7 = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 3 } // impossible: min 5 and max 3
        ]
      };
      
      // This should hit line 438: return false;
      expect(validateValueAgainstSchema("test", schema)).toBe(false);
    });

    test("should hit line 457: anyOf validation failure", () => {
      const schema: JSONSchema7 = {
        anyOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      // This should hit line 457: if (!anyValid) return false;
      expect(validateValueAgainstSchema("short", schema)).toBe(false);
      expect(validateValueAgainstSchema(50, schema)).toBe(false);
    });

    test("should hit line 471: oneOf validation failure (multiple matches)", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", minLength: 1 },
          { type: "string", maxLength: 10 }
        ]
      };
      
      // This should hit line 471: if (validCount > 1) return false;
      expect(validateValueAgainstSchema("hello", schema)).toBe(false); // matches both
    });

    test("should hit line 474: oneOf validation failure (no matches)", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      // This should hit line 474: if (validCount !== 1) return false;
      expect(validateValueAgainstSchema("short", schema)).toBe(false);
    });

    test("should hit lines 478-485: not validation failure", () => {
      const schema: JSONSchema7 = {
        not: { type: "string" }
      };
      
      // This should hit line 485: return false;
      expect(validateValueAgainstSchema("string value", schema)).toBe(false);
    });

    test("should hit lines 491-514: if/then/else conditional validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: {}
        },
        if: {
          properties: {
            type: { const: "number" }
          }
        },
        then: {
          properties: {
            value: { type: "number", minimum: 10 }
          }
        },
        else: {
          properties: {
            value: { type: "string", minLength: 5 }
          }
        }
      };
      
      // This should hit the if/then path (lines 497-503)
      expect(validateValueAgainstSchema({
        type: "number",
        value: 5 // fails minimum: 10
      }, schema)).toBe(false);
      
      // This should hit the if/else path (lines 504-511)
      expect(validateValueAgainstSchema({
        type: "string", 
        value: "hi" // fails minLength: 5
      }, schema)).toBe(false);
    });
  });

  describe("getDetailedValidationErrors - Exact Line Coverage", () => {
    test("should hit lines 531-580: if/then/else error generation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: { type: "string" },
          extra: { type: "string" }
        },
        if: {
          properties: {
            type: { const: "special" }
          }
        },
        then: {
          required: ["extra"],
          properties: {
            value: { type: "string", minLength: 10 }
          }
        },
        else: {
          properties: {
            value: { type: "string", minLength: 5 }
          }
        }
      };
      
      // This should hit the if/then error generation path
      const errors1 = getDetailedValidationErrors(
        { type: "special", value: "test" }, // missing extra, value too short
        schema
      );
      expect(errors1.length).toBeGreaterThan(0);
      expect(errors1.some(e => e.code === "REQUIRED_IF")).toBe(true);
      
      // This should hit the else error generation path
      const errors2 = getDetailedValidationErrors(
        { type: "other", value: "hi" }, // else branch, value too short
        schema
      );
      expect(errors2.length).toBeGreaterThan(0);
    });
  });

  describe("convertJsonSchemaToLuqDSL - Exact Line Coverage", () => {
    test("should hit lines 756-759: array type with null handling", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            allOf: [
              { type: ["string", "null"] } // This should trigger nonNullType logic
            ]
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.length).toBeGreaterThan(0);
    });

    test("should hit lines 837-838: multipleTypes with null", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            type: ["string", "null"] // This should set nullable = true
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.nullable).toBe(true);
    });

    test("should hit lines 882-886: multipleTypes primary type selection", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            type: ["null", "string"] // null first, string second
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.type).toBe("string"); // primary type should be string
      expect(fieldDsl?.nullable).toBe(true);
    });

    test("should hit line 920: exclusiveMinimum boolean handling", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            type: "number",
            minimum: 10,
            exclusiveMinimum: true as any // draft-04 style
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.constraints?.exclusiveMin).toBe(true);
    });

    test("should hit line 931: exclusiveMaximum boolean handling", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            type: "number",
            maximum: 100,
            exclusiveMaximum: true as any // draft-04 style
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.constraints?.exclusiveMax).toBe(true);
    });
  });

  describe("convertDSLToFieldDefinition - Exact Line Coverage", () => {
    test("should hit lines 1011-1012: multipleTypes oneOf handling", () => {
      const dsl = {
        path: "field",
        type: "string" as const,
        multipleTypes: ["string", "number"],
        constraints: {}
      };
      
      const mockBuilder = {
        oneOf: jest.fn().mockReturnThis()
      };
      
      // Mock hasMixedTypes to return true for oneOf handling
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      // This should trigger the mixed types logic
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });

    test("should hit line 1036: literal plugin error", () => {
      const dsl = {
        path: "field",
        type: "null" as const,
        constraints: {}
      };
      
      const mockBuilder = {
        string: {} // No literal method
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      
      expect(() => {
        definition(mockBuilder);
      }).toThrow("literal plugin is required for null type validation");
    });

    test("should hit line 1073: required chain for tuple", () => {
      const dsl: any = {
        path: "field",
        type: "tuple" as const,
        constraints: {
          required: true,
          items: [
            { type: "string" },
            { type: "number" }
          ]
        }
      };
      
      const mockBuilder = {
        tuple: {
          builder: jest.fn().mockReturnValue({
            required: jest.fn().mockReturnThis()
          })
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.tuple.builder).toHaveBeenCalled();
    });

    test("should hit line 1079: tupleBuilder plugin error", () => {
      const dsl: any = {
        path: "field",
        type: "tuple" as const,
        constraints: {
          items: [{ type: "string" }]
        }
      };
      
      const mockBuilder = {}; // No tuple builder
      
      const definition = convertDSLToFieldDefinition(dsl);
      
      expect(() => {
        definition(mockBuilder);
      }).toThrow("tupleBuilder plugin is required for tuple type validation");
    });

    test("should hit lines 1274-1280: exclusiveMin boolean handling", () => {
      const dsl = {
        path: "field",
        type: "number" as const,
        constraints: {
          exclusiveMin: true,
          min: 10
        }
      };
      
      const mockBuilder = {
        number: {
          min: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.number.min).toHaveBeenCalledWith(10, { exclusive: true });
    });

    test("should hit lines 1370-1374: propertyNames enum handling", () => {
      const dsl = {
        path: "field",
        type: "object" as const,
        constraints: {
          propertyNames: {
            enum: ["name", "age", "email"]
          }
        }
      };
      
      const mockBuilder = {
        object: {
          propertyNames: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.object.propertyNames).toHaveBeenCalledWith(
        expect.objectContaining({
          validator: expect.any(Function)
        })
      );
    });

    test("should hit line 1407: allOf validation failure", () => {
      const dsl: any = {
        path: "field",
        type: "string" as const,
        constraints: {
          allOf: [
            { type: "string", minLength: 10 },
            { type: "string", maxLength: 5 } // impossible constraint
          ]
        }
      };
      
      const mockBuilder = {
        string: {
          custom: jest.fn((validator) => {
            // Test the validator directly
            expect(validator("test")).toBe(false); // Should hit line 1407
            return mockBuilder.string;
          })
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
    });

    test("should hit line 1449: oneOf validation failure", () => {
      const dsl: any = {
        path: "field",
        type: "string" as const,
        constraints: {
          oneOf: [
            { type: "string", minLength: 1 },
            { type: "string", maxLength: 10 }
          ]
        }
      };
      
      const mockBuilder = {
        string: {
          custom: jest.fn((validator) => {
            // This should match both schemas, triggering line 1449
            expect(validator("hello")).toBe(false);
            return mockBuilder.string;
          })
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
    });
  });

  describe("Error Resolution and Edge Cases", () => {
    test("should hit line 109: resolveRef error for unresolvable references", () => {
      expect(() => {
        resolveRef("#/definitions/nonexistent", {});
      }).toThrow("Cannot resolve $ref: #/definitions/nonexistent");
    });

    test("should hit lines 126-127: $ref resolution in validation", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          stringType: {
            type: "string",
            minLength: 5
          }
        }
      };
      
      const schema: JSONSchema7 = {
        $ref: "#/definitions/stringType"
      };
      
      // This should resolve the $ref and validate
      expect(validateValueAgainstSchema("hello", schema, undefined, rootSchema)).toBe(true);
      expect(validateValueAgainstSchema("hi", schema, undefined, rootSchema)).toBe(false);
    });

    test("should cover format validation fallback paths", () => {
      const customFormats = {
        "custom-format": (value: string) => value.startsWith("CUSTOM")
      };
      
      const schema: JSONSchema7 = {
        type: "string",
        format: "custom-format"
      };
      
      // This should use the custom format validator
      expect(validateValueAgainstSchema("CUSTOM-123", schema, customFormats)).toBe(true);
      expect(validateValueAgainstSchema("INVALID-123", schema, customFormats)).toBe(false);
    });
  });
});
