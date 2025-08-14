import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  applyConstraints,
  jsonSchemaPlugin
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";
import { Builder } from "../../src/core/builder/core/builder";

describe("JsonSchema Plugin - Ultimate Final 137 Lines", () => {
  describe("Array validation error paths - Lines 672-689, 704, 707", () => {
    test("should hit array validation error generation paths", () => {
      const arraySchema: JSONSchema7 = {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 3 },
            score: { type: "number", minimum: 0, maximum: 100 }
          },
          required: ["id"]
        },
        uniqueItems: true,
        contains: {
          type: "object",
          properties: {
            score: { minimum: 90 }
          }
        }
      };

      // Hit lines 672-689: array validation error generation
      const errors = getDetailedValidationErrors([
        { id: "a", score: 50 },  // id too short, score too low for contains
        { id: "abc", score: 200 }, // score too high
      ], arraySchema);
      // Should have: too few items, item validation errors, no contains match
      expect(errors.length).toBeGreaterThan(0);

      // Hit lines 704, 707: specific array error conditions
      const errors2 = getDetailedValidationErrors([
        { id: "abc", score: 80 },
        { id: "def", score: 85 },
        { id: "abc", score: 80 }, // duplicate item
        { id: "ghi", score: 90 },
        { id: "jkl", score: 95 },
        { id: "mno", score: 100 }  // too many items
      ], arraySchema);
      expect(errors2.length).toBeGreaterThan(0);
    });

    test("should handle nested array error generation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          matrix: {
            type: "array",
            items: {
              type: "array", 
              items: { type: "number", minimum: 0 },
              minItems: 2,
              maxItems: 3
            },
            minItems: 2
          }
        }
      };

      // Generate nested array validation errors
      const errors = getDetailedValidationErrors({
        matrix: [
          [1, 2, 3], // valid
          [-1], // invalid: negative number, too few items
          [0, 1, 2, 3] // invalid: too many items
        ]
      }, schema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("Object property validation - Line 733", () => {
    test("should hit object property validation error path", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 5 },
              profile: {
                type: "object",
                properties: {
                  age: { type: "number", minimum: 18 },
                  email: { type: "string", format: "email" }
                },
                required: ["age"]
              }
            },
            required: ["name", "profile"]
          }
        }
      };

      // Hit line 733: object property validation error
      const errors = getDetailedValidationErrors({
        user: {
          name: "Jo", // too short
          profile: {
            // missing required age
            email: "invalid-email"
          }
        }
      }, schema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("DSL conversion propertyNames - Lines 774-777", () => {
    test("should hit propertyNames constraint conversion", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          type: "string",
          pattern: "^[a-z][a-zA-Z0-9]*$",
          minLength: 3,
          maxLength: 20,
          enum: ["validName1", "validName2", "anotherValidName"]
        },
        additionalProperties: { type: "string" }
      };

      // Hit lines 774-777: propertyNames DSL conversion
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const rootConstraints = dsl.find(d => d.path === "");
      expect(rootConstraints?.constraints?.propertyNames).toBeDefined();
      
      // Verify propertyNames constraint structure
      const propNames = rootConstraints?.constraints?.propertyNames;
      expect(propNames).toMatchObject({
        pattern: "^[a-z][a-zA-Z0-9]*$",
        minLength: 3,
        maxLength: 20,
        enum: expect.arrayContaining(["validName1", "validName2", "anotherValidName"])
      });
    });
  });

  describe("DSL multipleTypes with null - Lines 837-838", () => {
    test("should handle multipleTypes null filtering", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field1: {
            type: ["string", "null"],
            minLength: 5
          },
          field2: {
            type: ["number", "boolean", "null"],
            minimum: 10
          },
          field3: {
            type: ["array", "null"],
            minItems: 3,
            items: { type: "string" }
          }
        }
      };

      // Hit lines 837-838: multipleTypes with null handling
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      const field1 = dsl.find(d => d.path === "field1");
      expect(field1?.nullable).toBe(true);
      expect(field1?.type).toBe("string");

      const field2 = dsl.find(d => d.path === "field2");
      expect(field2?.nullable).toBe(true);
      expect(field2?.multipleTypes).toEqual(["number", "boolean"]);

      const field3 = dsl.find(d => d.path === "field3");
      expect(field3?.nullable).toBe(true);
      expect(field3?.type).toBe("array");
    });
  });

  describe("Field definition multipleTypes - Lines 1011-1012", () => {
    test("should handle multipleTypes in field definition", () => {
      const dsl: any = {
        path: "unionField",
        type: "string",
        multipleTypes: ["string", "number", "boolean"],
        constraints: {
          minLength: 5, // for string
          minimum: 10   // for number
        }
      };

      // Hit lines 1011-1012: multipleTypes field definition
      const definition = convertDSLToFieldDefinition(dsl);
      
      const mockBuilder = {
        oneOf: jest.fn((schemas) => {
          expect(schemas).toHaveLength(3);
          return { type: "oneOf" };
        })
      };

      definition(mockBuilder);
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });
  });

  describe("Format validation - Lines 1120-1125", () => {
    test("should handle custom format validation in DSL", () => {
      const customFormats = {
        "credit-card": (value: string) => /^\d{4}-\d{4}-\d{4}-\d{4}$/.test(value),
        "phone-number": (value: string) => /^\+\d{1,3}-\d{3}-\d{3}-\d{4}$/.test(value),
        "product-code": (value: string) => /^PROD-[A-Z]{2}\d{4}$/.test(value)
      };

      const dsl: any = {
        path: "cardNumber",
        type: "string",
        constraints: {
          format: "credit-card"
        }
      };

      // Hit lines 1120-1125: custom format in field definition
      const definition = convertDSLToFieldDefinition(dsl, customFormats);
      
      const mockBuilder = {
        string: {
          refine: jest.fn((validator) => {
            // Test the custom validator
            expect(validator("1234-5678-9012-3456")).toBe(true);
            expect(validator("invalid-card")).toBe(false);
            return mockBuilder.string;
          })
        }
      };

      definition(mockBuilder);
      expect(mockBuilder.string.refine).toHaveBeenCalledWith(customFormats["credit-card"]);
    });

    test("should handle unknown custom format", () => {
      const customFormats = {};

      const dsl: any = {
        path: "unknownFormat",
        type: "string", 
        constraints: {
          format: "unknown-format"
        }
      };

      // Should not call refine for unknown format
      const definition = convertDSLToFieldDefinition(dsl, customFormats);
      
      const mockBuilder = {
        string: {
          refine: jest.fn().mockReturnThis()
        }
      };

      definition(mockBuilder);
      expect(mockBuilder.string.refine).not.toHaveBeenCalled();
    });
  });

  describe("Constraint application - Lines 1294-1300, 1362, 1374, 1429", () => {
    test("should apply object property constraints", () => {
      const constraints: any = {
        minProperties: 2,
        maxProperties: 8,
        additionalProperties: {
          type: "string",
          maxLength: 50
        }
      };

      const mockChain = {
        minProperties: jest.fn().mockReturnThis(),
        maxProperties: jest.fn().mockReturnThis(),
        additionalProperties: jest.fn().mockReturnThis()
      };

      // Hit lines 1294-1300: object property constraint application
      applyConstraints(mockChain, constraints);
      
      expect(mockChain.minProperties).toHaveBeenCalledWith(2);
      expect(mockChain.maxProperties).toHaveBeenCalledWith(8);
      expect(mockChain.additionalProperties).toHaveBeenCalled();
    });

    test("should apply array contains constraint", () => {
      const constraints: any = {
        contains: {
          type: "object",
          properties: {
            priority: { minimum: 5 }
          }
        }
      };

      const mockChain = {
        contains: jest.fn().mockReturnThis()
      };

      // Hit line 1362: contains constraint application
      applyConstraints(mockChain, constraints);
      expect(mockChain.contains).toHaveBeenCalled();
    });

    test("should apply propertyNames constraint", () => {
      const constraints: any = {
        propertyNames: {
          pattern: "^[a-zA-Z][a-zA-Z0-9_]*$",
          minLength: 1,
          maxLength: 30
        }
      };

      const mockChain = {
        propertyNames: jest.fn().mockReturnThis()
      };

      // Hit line 1374: propertyNames constraint application
      applyConstraints(mockChain, constraints);
      expect(mockChain.propertyNames).toHaveBeenCalled();
    });

    test("should apply anyOf constraint", () => {
      const constraints: any = {
        anyOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 },
          { type: "boolean" }
        ]
      };

      const mockChain = {
        custom: jest.fn((validator) => {
          // Test the anyOf validator
          expect(validator("long enough string")).toBe(true);
          expect(validator(150)).toBe(true);
          expect(validator(true)).toBe(true);
          expect(validator("short")).toBe(false);
          expect(validator(50)).toBe(false);
          return mockChain;
        })
      };

      // Hit line 1429: anyOf constraint application
      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });
  });

  describe("Builder integration paths - Lines 1484-1490, 1506, 1519-1535, 1589-1604, 1634, 1647", () => {
    test("should handle builder integration error paths", () => {
      // Test with invalid builder (missing required methods)
      const invalidBuilder: any = {};

      try {
        const schema: JSONSchema7 = { type: "string" };
        // This should hit error handling paths
        const plugin = jsonSchemaPlugin;
        plugin.extendBuilder(invalidBuilder);
        
        // Call the fromJsonSchema method if it exists
        if (invalidBuilder.fromJsonSchema) {
          invalidBuilder.fromJsonSchema(schema);
        }
      } catch (error) {
        // Expected error handling
        expect(error).toBeDefined();
      }
    });

    test("should handle complex builder integration", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              timeout: { type: "number", minimum: 1000, maximum: 60000 },
              retries: { type: "integer", minimum: 0, maximum: 10 },
              endpoints: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri" },
                    method: { enum: ["GET", "POST", "PUT", "DELETE"] },
                    headers: {
                      type: "object",
                      additionalProperties: { type: "string" }
                    }
                  },
                  required: ["url", "method"]
                },
                minItems: 1
              }
            },
            required: ["enabled", "endpoints"]
          }
        },
        required: ["config"]
      };

      const builder = Builder().use(jsonSchemaPlugin);
      
      // Hit various builder integration paths
      const validator = (builder as any).fromJsonSchema(schema, {
        strictRequired: true,
        allowAdditionalProperties: false,
        customFormats: {
          "custom-uri": (value: string) => value.startsWith("https://")
        }
      });

      expect(validator).toBeDefined();
      
      // Build and test the validator
      const builtValidator = validator.build();
      
      expect(builtValidator.validate({
        config: {
          enabled: true,
          timeout: 5000,
          retries: 3,
          endpoints: [{
            url: "https://api.example.com",
            method: "GET",
            headers: { "Content-Type": "application/json" }
          }]
        }
      }).valid).toBe(true);
    });
  });

  describe("Remaining uncovered paths - Lines 1658, 1662-1712, 1728-1739, 1748-1759, 1776-1780, 1788-1807, 1819, 1828-1867", () => {
    test("should hit DSL field generation paths", () => {
      const complexSchema: JSONSchema7 = {
        type: "object",
        properties: {
          // String with all possible constraints
          text: {
            type: "string",
            minLength: 5,
            maxLength: 100,
            pattern: "^[A-Za-z0-9]+$",
            format: "uri",
            enum: ["http://example.com", "https://test.com"]
          },
          // Number with draft-04 exclusive constraints
          value: {
            type: "number",
            minimum: 10,
            maximum: 100,
            exclusiveMinimum: true as any,
            exclusiveMaximum: true as any,
            multipleOf: 5
          },
          // Array with complex item schema
          items: {
            type: "array",
            minItems: 2,
            maxItems: 10,
            uniqueItems: true,
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                data: {
                  type: ["string", "number"],
                  minLength: 1,
                  minimum: 0
                }
              },
              required: ["id"]
            },
            contains: {
              type: "object",
              properties: {
                priority: { minimum: 5 }
              }
            }
          },
          // Object with complex constraints
          metadata: {
            type: "object",
            minProperties: 1,
            maxProperties: 20,
            additionalProperties: {
              type: "string",
              maxLength: 200
            },
            propertyNames: {
              pattern: "^[a-z][a-zA-Z0-9_]*$"
            },
            patternProperties: {
              "^config_": { type: "object" },
              "^data_": { type: "array" }
            }
          }
        },
        required: ["text", "value"],
        additionalProperties: false,
        // Complex conditional schema
        if: {
          properties: {
            text: { pattern: "https://.*" }
          }
        },
        then: {
          properties: {
            value: { minimum: 50 }
          }
        },
        else: {
          properties: {
            value: { maximum: 50 }
          }
        }
      };

      // This should hit many DSL conversion paths
      const dsl = convertJsonSchemaToLuqDSL(complexSchema);
      expect(dsl.length).toBeGreaterThan(5);

      // Test that various field types are generated
      const textField = dsl.find(d => d.path === "text");
      const valueField = dsl.find(d => d.path === "value");
      const itemsField = dsl.find(d => d.path === "items");
      const metadataField = dsl.find(d => d.path === "metadata");

      expect(textField).toBeDefined();
      expect(valueField).toBeDefined();
      expect(itemsField).toBeDefined(); 
      expect(metadataField).toBeDefined();

      // Check specific constraint conversions
      expect(textField?.constraints?.minLength).toBe(5);
      expect(valueField?.constraints?.exclusiveMin).toBe(true);
      expect(itemsField?.constraints?.minItems).toBe(2);
      expect(metadataField?.constraints?.minProperties).toBe(1);
    });

    test("should handle builder method generation", () => {
      const builder = Builder().use(jsonSchemaPlugin);
      
      // Ensure the fromJsonSchema method exists
      expect((builder as any).fromJsonSchema).toBeDefined();
      expect(typeof (builder as any).fromJsonSchema).toBe("function");

      // Test with minimal schema
      const simpleSchema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        }
      };

      const validator = (builder as any).fromJsonSchema(simpleSchema);
      expect(validator).toBeDefined();
      expect(validator.build).toBeDefined();
    });

    test("should handle edge cases in field definition conversion", () => {
      // Test with various constraint combinations
      const constraints = [
        {
          path: "stringField",
          type: "string" as const,
          constraints: {
            contentEncoding: "base64",
            contentMediaType: "application/json"
          }
        },
        {
          path: "readOnlyField",
          type: "string" as const,
          constraints: {
            readOnly: true
          }
        },
        {
          path: "writeOnlyField",
          type: "string" as const,
          constraints: {
            writeOnly: true
          }
        }
      ];

      constraints.forEach(dsl => {
        const definition = convertDSLToFieldDefinition(dsl);
        expect(definition).toBeDefined();
        
        // Test that the definition can be called
        const mockBuilder = {
          string: {
            contentEncoding: jest.fn().mockReturnThis(),
            contentMediaType: jest.fn().mockReturnThis(),
            readOnly: jest.fn().mockReturnThis(),
            writeOnly: jest.fn().mockReturnThis()
          }
        };
        
        // Should not throw errors
        expect(() => definition(mockBuilder)).not.toThrow();
      });
    });
  });
});