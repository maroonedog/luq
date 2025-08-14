import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  applyConstraints,
  getBaseChain
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Final Push to 100%", () => {
  describe("Error paths and edge cases", () => {
    test("should handle invalid date format", () => {
      const schema: JSONSchema7 = {
        type: "string",
        format: "date"
      };
      
      // Hit the format validation error path
      expect(validateValueAgainstSchema("invalid-date", schema)).toBe(false);
      expect(validateValueAgainstSchema("2024-13-45", schema)).toBe(false);
      expect(validateValueAgainstSchema("not-a-date", schema)).toBe(false);
    });

    test("should handle invalid datetime format", () => {
      const schema: JSONSchema7 = {
        type: "string",
        format: "date-time"
      };
      
      expect(validateValueAgainstSchema("invalid-datetime", schema)).toBe(false);
      expect(validateValueAgainstSchema("2024-01-01", schema)).toBe(false); // no time
    });

    test("should handle various format validation failures", () => {
      const formats = [
        { format: "email", invalid: "not-an-email" },
        { format: "uri", invalid: "not a uri" },
        { format: "uuid", invalid: "not-a-uuid" },
        { format: "ipv4", invalid: "300.300.300.300" },
        { format: "ipv6", invalid: "not-ipv6" },
        { format: "hostname", invalid: "-invalid.host" },
        { format: "time", invalid: "25:00:00" },
        { format: "duration", invalid: "not-duration" },
        { format: "json-pointer", invalid: "no-leading-slash" },
        { format: "relative-json-pointer", invalid: "/absolute" },
        { format: "iri", invalid: "not valid iri with spaces" },
        { format: "uri-template", invalid: "/users/{unclosed" }
      ];
      
      formats.forEach(({ format, invalid }) => {
        const schema: JSONSchema7 = {
          type: "string",
          format
        };
        expect(validateValueAgainstSchema(invalid, schema)).toBe(false);
      });
    });

    test("should handle number validation edge cases", () => {
      // NaN handling
      const schema: JSONSchema7 = { type: "number" };
      expect(validateValueAgainstSchema(NaN, schema)).toBe(false);
      expect(validateValueAgainstSchema(Infinity, schema)).toBe(true);
      expect(validateValueAgainstSchema(-Infinity, schema)).toBe(true);
    });

    test("should handle integer validation", () => {
      const schema: JSONSchema7 = { type: "integer" };
      expect(validateValueAgainstSchema(3.14, schema)).toBe(false);
      expect(validateValueAgainstSchema(42, schema)).toBe(true);
    });

    test("should handle array uniqueItems validation", () => {
      const schema: JSONSchema7 = {
        type: "array",
        uniqueItems: true
      };
      
      expect(validateValueAgainstSchema([1, 2, 1], schema)).toBe(false);
      expect(validateValueAgainstSchema([{a: 1}, {a: 1}], schema)).toBe(false);
      expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(true);
    });
  });

  describe("Complex schema compositions - error paths", () => {
    test("should validate complex allOf that fails", () => {
      const schema: JSONSchema7 = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 3 } // impossible constraint
        ]
      };
      
      expect(validateValueAgainstSchema("test", schema)).toBe(false);
    });

    test("should validate anyOf where none match", () => {
      const schema: JSONSchema7 = {
        anyOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      expect(validateValueAgainstSchema("short", schema)).toBe(false);
      expect(validateValueAgainstSchema(50, schema)).toBe(false);
    });

    test("should validate oneOf where multiple or none match", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", minLength: 1 },
          { type: "string", maxLength: 10 } // both will match "hello"
        ]
      };
      
      expect(validateValueAgainstSchema("hello", schema)).toBe(false); // matches both
    });

    test("should validate not schema that matches", () => {
      const schema: JSONSchema7 = {
        not: { type: "string" }
      };
      
      expect(validateValueAgainstSchema("string", schema)).toBe(false);
    });
  });

  describe("DSL conversion edge cases", () => {
    test("should handle empty schema conversion", () => {
      const schema: JSONSchema7 = {};
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(Array.isArray(dsl)).toBe(true);
    });

    test("should handle schema with only type", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: { type: "string" }
        }
      };
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.find(d => d.path === "field")).toBeDefined();
    });

    test("should handle deeply nested objects", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  level3: {
                    type: "object",
                    properties: {
                      field: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.find(d => d.path === "level1.level2.level3.field")).toBeDefined();
    });
  });

  describe("Constraint application edge cases", () => {
    test("should handle unknown constraints gracefully", () => {
      const constraints: any = {
        unknownConstraint: "value",
        anotherUnknown: 123
      };
      
      const mockChain = {
        custom: jest.fn().mockReturnThis()
      };
      
      // Should not throw error for unknown constraints
      expect(() => {
        applyConstraints(mockChain, constraints);
      }).not.toThrow();
    });

    test("should handle constraints with null/undefined values", () => {
      const constraints: any = {
        minLength: null,
        maxLength: undefined,
        pattern: ""
      };
      
      const mockChain = {
        min: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        pattern: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      
      // Should not call methods with null/undefined/empty values
      expect(mockChain.min).not.toHaveBeenCalled();
      expect(mockChain.max).not.toHaveBeenCalled();
      expect(mockChain.pattern).not.toHaveBeenCalled();
    });

    test("should handle empty arrays in constraints", () => {
      const constraints: any = {
        enum: [],
        allOf: [],
        anyOf: [],
        oneOf: []
      };
      
      const mockChain = {
        oneOf: jest.fn().mockReturnThis(),
        custom: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      
      // Empty enum should call oneOf with empty array
      expect(mockChain.oneOf).toHaveBeenCalledWith([]);
    });
  });

  describe("Base chain edge cases", () => {
    test("should handle schema with both enum and type", () => {
      const schema: JSONSchema7 = {
        type: "string",
        enum: ["red", "green", "blue"]
      };
      
      const mockBuilder = {
        oneOf: jest.fn(() => ({ type: "oneOf" })),
        string: { type: "string" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });

    test("should handle schema with both const and type", () => {
      const schema: JSONSchema7 = {
        type: "string",
        const: "exact"
      };
      
      const mockBuilder = {
        literal: jest.fn(() => ({ type: "literal" })),
        string: { type: "string" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.literal).toHaveBeenCalled();
    });

    test("should handle array type variations", () => {
      const arraySchema: JSONSchema7 = { type: ["null"] };
      const mixedSchema: JSONSchema7 = { type: ["string", "null"] };
      
      const mockBuilder = {
        literal: jest.fn(() => ({ type: "literal" })),
        string: { 
          type: "string",
          nullable: jest.fn().mockReturnThis()
        },
        oneOf: jest.fn(() => ({ type: "oneOf" }))
      };
      
      // Only null type
      getBaseChain(mockBuilder, arraySchema);
      expect(mockBuilder.literal).toHaveBeenCalledWith(null);
      
      // String with null
      getBaseChain(mockBuilder, mixedSchema);
      expect(mockBuilder.string.nullable).toHaveBeenCalled();
    });
  });

  describe("Format validation comprehensive", () => {
    test("should validate all string formats with edge cases", () => {
      const testCases = [
        {
          format: "email",
          valid: ["test@example.com", "user.name+tag@domain.co.uk"],
          invalid: ["@domain.com", "user@", "plain-text", "user space@domain.com"]
        },
        {
          format: "uri",
          valid: ["https://example.com", "ftp://files.example.com", "mailto:test@example.com"],
          invalid: ["not a uri", "://missing-scheme", "http://"]
        },
        {
          format: "uuid", 
          valid: ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"],
          invalid: ["550e8400-e29b-41d4-a716", "not-a-uuid", "550e8400e29b41d4a716446655440000"]
        }
      ];
      
      testCases.forEach(({ format, valid, invalid }) => {
        const schema: JSONSchema7 = { type: "string", format };
        
        valid.forEach(value => {
          expect(validateValueAgainstSchema(value, schema)).toBe(true);
        });
        
        invalid.forEach(value => {
          expect(validateValueAgainstSchema(value, schema)).toBe(false);
        });
      });
    });
  });

  describe("Detailed validation error generation", () => {
    test("should generate errors for deeply nested validation failures", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              profile: {
                type: "object",
                properties: {
                  settings: {
                    type: "object",
                    properties: {
                      theme: { type: "string", enum: ["light", "dark"] }
                    },
                    required: ["theme"]
                  }
                },
                required: ["settings"]
              }
            },
            required: ["profile"]
          }
        },
        required: ["user"]
      };
      
      const invalidData = {
        user: {
          profile: {
            settings: {
              theme: "invalid-theme"
            }
          }
        }
      };
      
      const errors = getDetailedValidationErrors(invalidData, schema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("should handle validation errors in arrays", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                value: { type: "number", minimum: 0 }
              },
              required: ["id", "value"]
            }
          }
        }
      };
      
      const invalidData = {
        items: [
          { id: "1", value: 10 }, // valid
          { id: "2", value: -5 }, // invalid: negative value
          { value: 15 }, // invalid: missing id
          { id: 3, value: "not-number" } // invalid: wrong types
        ]
      };
      
      const errors = getDetailedValidationErrors(invalidData, schema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
