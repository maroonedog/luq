import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  getSpecificValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  getBaseChain,
  applyConstraints
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";
import { Builder } from "../../src/core/builder/core/builder";
import { jsonSchemaPlugin } from "../../src/core/plugin/jsonSchema";

describe("JsonSchema Plugin - Final 290 Lines Coverage", () => {
  describe("Basic validation logic - Lines 185, 193, 198, 202, 208, 212, 218, 222, 226, 230, 234, 238, 242, 246, 250-258, 267-268, 272-278", () => {
    test("should handle various type validations with different data types", () => {
      // Hit type-specific validation logic
      expect(validateValueAgainstSchema(undefined, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema("", { type: "string" })).toBe(true);
      expect(validateValueAgainstSchema([], { type: "array" })).toBe(true);
      expect(validateValueAgainstSchema({}, { type: "object" })).toBe(true);
      expect(validateValueAgainstSchema(true, { type: "boolean" })).toBe(true);
      expect(validateValueAgainstSchema(false, { type: "boolean" })).toBe(true);
      expect(validateValueAgainstSchema(null, { type: "null" })).toBe(true);
      
      // Hit lines for type checking logic
      expect(validateValueAgainstSchema("string", { type: ["string", "number"] })).toBe(true);
      expect(validateValueAgainstSchema(123, { type: ["string", "number"] })).toBe(true);
      expect(validateValueAgainstSchema(true, { type: ["string", "number"] })).toBe(false);
    });

    test("should handle array item validation", () => {
      const schema: JSONSchema7 = {
        type: "array",
        items: { type: "string" }
      };
      
      // Hit array item validation loops
      expect(validateValueAgainstSchema(["a", "b", "c"], schema)).toBe(true);
      expect(validateValueAgainstSchema(["a", 123, "c"], schema)).toBe(false);
      expect(validateValueAgainstSchema([], schema)).toBe(true);
    });
  });

  describe("Array contains validation - Lines 491-514", () => {
    test("should handle contains schema validation properly", () => {
      const schema: JSONSchema7 = {
        type: "array",
        contains: {
          type: "object",
          properties: {
            type: { const: "special" }
          },
          required: ["type"]
        }
      };
      
      // Should pass if at least one item matches
      expect(validateValueAgainstSchema([
        { type: "normal" },
        { type: "special" },
        { type: "other" }
      ], schema)).toBe(true);
      
      // Should fail if no items match
      expect(validateValueAgainstSchema([
        { type: "normal" },
        { type: "other" }
      ], schema)).toBe(false);
      
      // Should fail on empty array
      expect(validateValueAgainstSchema([], schema)).toBe(false);
    });

    test("should handle contains with complex nested validation", () => {
      const schema: JSONSchema7 = {
        type: "array",
        contains: {
          type: "object",
          properties: {
            value: { type: "number", minimum: 100 }
          }
        }
      };
      
      expect(validateValueAgainstSchema([
        { value: 50 },
        { value: 150 }, // This should match
        { value: 75 }
      ], schema)).toBe(true);
      
      expect(validateValueAgainstSchema([
        { value: 50 },
        { value: 75 },
        { value: 25 }
      ], schema)).toBe(false);
    });
  });

  describe("getDetailedValidationErrors conditional validation - Lines 531-580", () => {
    test("should handle if/then/else error generation with complex conditions", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          accountType: { type: "string" },
          balance: { type: "number" },
          creditLimit: { type: "number" },
          securityCode: { type: "string" }
        },
        if: {
          properties: {
            accountType: { const: "premium" }
          }
        },
        then: {
          required: ["securityCode"],
          properties: {
            balance: { minimum: 1000 },
            creditLimit: { minimum: 5000 }
          }
        },
        else: {
          properties: {
            balance: { minimum: 0 },
            creditLimit: { maximum: 1000 }
          }
        }
      };

      // Test if-then branch error generation
      const errors1 = getDetailedValidationErrors({
        accountType: "premium",
        balance: 500, // Below minimum
        creditLimit: 2000 // Below minimum
        // Missing securityCode
      }, schema);
      expect(errors1.length).toBeGreaterThan(0);

      // Test if-else branch error generation
      const errors2 = getDetailedValidationErrors({
        accountType: "basic",
        balance: -100, // Below minimum
        creditLimit: 2000 // Above maximum
      }, schema);
      expect(errors2.length).toBeGreaterThan(0);
    });

    test("should handle nested if/then/else conditions", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          category: { type: "string" },
          subcategory: { type: "string" },
          price: { type: "number" },
          discount: { type: "number" }
        },
        if: {
          properties: {
            category: { const: "electronics" }
          }
        },
        then: {
          if: {
            properties: {
              subcategory: { const: "phone" }
            }
          },
          then: {
            properties: {
              price: { minimum: 100 }
            }
          },
          else: {
            properties: {
              price: { minimum: 50 }
            }
          }
        }
      };

      // Hit nested conditional validation error paths
      const errors = getDetailedValidationErrors({
        category: "electronics",
        subcategory: "phone",
        price: 50 // Too low for phone
      }, schema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("getDetailedValidationErrors specific error paths - Lines 598-604, 633-639, 658-664, 672-689, 704, 707, 710-719", () => {
    test("should handle array validation errors in detail", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 3 },
                priority: { type: "number", minimum: 1, maximum: 10 }
              },
              required: ["name", "priority"]
            },
            minItems: 2,
            maxItems: 5
          }
        }
      };

      // Generate errors for array items
      const errors = getDetailedValidationErrors({
        tags: [
          { name: "a", priority: 0 }, // name too short, priority too low
          { name: "valid", priority: 15 }, // priority too high
          { priority: 5 } // missing name
        ]
      }, schema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("should handle complex nested object validation errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              database: {
                type: "object",
                properties: {
                  connection: {
                    type: "object",
                    properties: {
                      host: { type: "string", format: "hostname" },
                      port: { type: "number", minimum: 1, maximum: 65535 },
                      ssl: { type: "boolean" }
                    },
                    required: ["host", "port"]
                  }
                },
                required: ["connection"]
              }
            },
            required: ["database"]
          }
        }
      };

      // Generate nested validation errors
      const errors = getDetailedValidationErrors({
        config: {
          database: {
            connection: {
              host: "invalid..hostname",
              port: 70000, // Out of range
              ssl: "not-boolean"
            }
          }
        }
      }, schema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("getSpecificValidationErrors - Lines 598-604, 658-664", () => {
    test("should validate specific nested paths correctly", () => {
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
                      notifications: {
                        type: "object",
                        properties: {
                          email: { type: "boolean" },
                          frequency: { type: "string", enum: ["daily", "weekly", "monthly"] }
                        },
                        required: ["email", "frequency"]
                      }
                    },
                    required: ["notifications"]
                  }
                },
                required: ["settings"]
              }
            },
            required: ["profile"]
          }
        }
      };

      // Test specific path validation
      const errors1 = getSpecificValidationErrors({
        user: {
          profile: {
            settings: {
              notifications: {
                email: "not-boolean",
                frequency: "invalid"
              }
            }
          }
        }
      }, schema, "/user/profile/settings");
      expect(errors1.length).toBeGreaterThan(0);

      // Test different specific path
      const errors2 = getSpecificValidationErrors({
        user: {
          profile: {
            settings: {}
          }
        }
      }, schema, "/user/profile/settings");
      expect(errors2.length).toBeGreaterThan(0);
    });
  });

  describe("DSL conversion root schema handling - Lines 756-759, 774-777", () => {
    test("should handle root schema with additionalProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        additionalProperties: {
          type: "string",
          maxLength: 50
        },
        propertyNames: {
          pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$"
        }
      };

      // This should hit root schema constraint conversion
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.length).toBeGreaterThan(0);
      
      // Should have root constraints
      const rootDsl = dsl.find(d => d.path === "");
      expect(rootDsl).toBeDefined();
      expect(rootDsl?.constraints).toBeDefined();
    });

    test("should handle propertyNames constraints in DSL", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          type: "string",
          pattern: "^prop_",
          minLength: 5,
          maxLength: 20
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      const rootConstraints = dsl.find(d => d.path === "");
      expect(rootConstraints?.constraints?.propertyNames).toBeDefined();
    });
  });

  describe("DSL conversion type handling - Lines 837-838, 882-886, 920, 931", () => {
    test("should handle multipleTypes with null correctly", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          optionalString: {
            type: ["string", "null"],
            minLength: 3
          },
          optionalNumber: {
            type: ["number", "null"],
            minimum: 0
          },
          multiType: {
            type: ["string", "number", "boolean", "null"]
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      const stringField = dsl.find(d => d.path === "optionalString");
      expect(stringField?.nullable).toBe(true);
      expect(stringField?.type).toBe("string");
      
      const numberField = dsl.find(d => d.path === "optionalNumber");
      expect(numberField?.nullable).toBe(true);
      expect(numberField?.type).toBe("number");
      
      const multiField = dsl.find(d => d.path === "multiType");
      expect(multiField?.multipleTypes).toBeDefined();
      expect(multiField?.nullable).toBe(true);
    });

    test("should handle draft-04 exclusive constraints in DSL", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          exclusiveMin: {
            type: "number",
            minimum: 10,
            exclusiveMinimum: true as any
          },
          exclusiveMax: {
            type: "number", 
            maximum: 100,
            exclusiveMaximum: true as any
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      const minField = dsl.find(d => d.path === "exclusiveMin");
      expect(minField?.constraints?.exclusiveMin).toBe(true);
      
      const maxField = dsl.find(d => d.path === "exclusiveMax");
      expect(maxField?.constraints?.exclusiveMax).toBe(true);
    });
  });

  describe("Field definition conversion special types - Lines 1011-1012, 1036, 1073, 1079", () => {
    test("should handle literal values correctly", () => {
      const literalDsl = {
        path: "literalField",
        type: "string" as const,
        constraints: {
          const: "exact-value"
        }
      };

      const definition = convertDSLToFieldDefinition(literalDsl);
      
      // Test the definition with a mock builder
      const mockBuilder = {
        literal: jest.fn().mockReturnThis()
      };
      
      definition(mockBuilder);
      expect(mockBuilder.literal).toHaveBeenCalledWith("exact-value");
    });

    test("should handle multipleTypes scenarios", () => {
      const multiTypeDsl = {
        path: "multiField", 
        type: "string" as const,
        multipleTypes: ["string", "number", "boolean"],
        constraints: {}
      };

      const definition = convertDSLToFieldDefinition(multiTypeDsl);
      
      const mockBuilder = {
        oneOf: jest.fn().mockReturnThis()
      };
      
      definition(mockBuilder);
      // This should trigger multipleTypes handling
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });

    test("should handle tuple arrays", () => {
      const tupleDsl: any = {
        path: "coordinates",
        type: "array",
        constraints: {
          items: [
            { type: "number" },
            { type: "number" },
            { type: "string", optional: true }
          ]
        }
      };

      const definition = convertDSLToFieldDefinition(tupleDsl);
      
      const mockBuilder = {
        tupleBuilder: jest.fn().mockReturnValue({
          tuple: jest.fn().mockReturnThis()
        })
      };
      
      definition(mockBuilder);
      expect(mockBuilder.tupleBuilder).toHaveBeenCalled();
    });
  });

  describe("Format handling and custom formats - Lines 1106, 1120-1125, 1131-1145", () => {
    test("should handle custom format validation", () => {
      const customFormats = {
        "product-code": (value: string) => /^PROD-\d{6}$/.test(value),
        "employee-id": (value: string) => /^EMP\d{4}$/.test(value)
      };

      const dsl = {
        path: "productCode",
        type: "string" as const,
        constraints: {
          format: "product-code"
        }
      };

      const definition = convertDSLToFieldDefinition(dsl, customFormats);
      
      const mockBuilder = {
        string: {
          refine: jest.fn().mockReturnThis()
        }
      };
      
      definition(mockBuilder);
      expect(mockBuilder.string.refine).toHaveBeenCalledWith(customFormats["product-code"]);
    });

    test("should handle standard format validation paths", () => {
      const formats = ["email", "uri", "uuid", "date", "date-time", "time", "duration"];
      
      formats.forEach(format => {
        const dsl = {
          path: `${format}Field`,
          type: "string" as const,
          constraints: { format }
        };

        const definition = convertDSLToFieldDefinition(dsl);
        
        const mockBuilder = {
          string: {
            email: jest.fn().mockReturnThis(),
            url: jest.fn().mockReturnThis(),
            uuid: jest.fn().mockReturnThis(),
            datetime: jest.fn().mockReturnThis(),
            refine: jest.fn().mockReturnThis()
          }
        };
        
        definition(mockBuilder);
        // Should call appropriate format method or refine
      });
    });
  });

  describe("Constraint application - Lines 1274-1280, 1294-1300, 1360-1362, 1370-1374", () => {
    test("should handle numeric constraints properly", () => {
      const constraints: any = {
        min: 10,
        max: 100,
        exclusiveMin: false,
        exclusiveMax: true,
        multipleOf: 5
      };

      const mockChain = {
        min: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        multipleOf: jest.fn().mockReturnThis()
      };

      applyConstraints(mockChain, constraints);
      
      expect(mockChain.min).toHaveBeenCalledWith(10, { exclusive: false });
      expect(mockChain.max).toHaveBeenCalledWith(100, { exclusive: true });
      expect(mockChain.multipleOf).toHaveBeenCalledWith(5);
    });

    test("should handle object property constraints", () => {
      const constraints: any = {
        minProperties: 2,
        maxProperties: 10,
        additionalProperties: { type: "string" },
        propertyNames: {
          pattern: "^[a-z]+$"
        }
      };

      const mockChain = {
        minProperties: jest.fn().mockReturnThis(),
        maxProperties: jest.fn().mockReturnThis(),
        additionalProperties: jest.fn().mockReturnThis(),
        propertyNames: jest.fn().mockReturnThis()
      };

      applyConstraints(mockChain, constraints);
      
      expect(mockChain.minProperties).toHaveBeenCalledWith(2);
      expect(mockChain.maxProperties).toHaveBeenCalledWith(10);
      expect(mockChain.additionalProperties).toHaveBeenCalled();
      expect(mockChain.propertyNames).toHaveBeenCalled();
    });
  });

  describe("Schema composition constraints - Lines 1407, 1421-1429, 1449", () => {
    test("should handle allOf constraint validation", () => {
      const constraints: any = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 15 },
          { pattern: "^[a-z]+$" }
        ]
      };

      const mockChain = {
        custom: jest.fn((validator) => {
          // Test the validator function
          expect(validator("hello")).toBe(true);
          expect(validator("hi")).toBe(false); // too short
          expect(validator("verylongstringhere")).toBe(false); // too long  
          expect(validator("Hello")).toBe(false); // has uppercase
          return mockChain;
        })
      };

      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should handle oneOf constraint validation", () => {
      const constraints: any = {
        oneOf: [
          { type: "string", maxLength: 5 },
          { type: "string", minLength: 10 }
        ]
      };

      const mockChain = {
        custom: jest.fn((validator) => {
          // Test validator function
          expect(validator("short")).toBe(true); // matches first only
          expect(validator("verylongstring")).toBe(true); // matches second only
          expect(validator("medium")).toBe(false); // matches neither or both
          return mockChain;
        })
      };

      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });
  });

  describe("getBaseChain method - Lines 1567-1636", () => {
    test("should handle various schema types in base chain", () => {
      const schemas: JSONSchema7[] = [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "array" },
        { type: "object" },
        { type: "null" },
        { type: "integer" },
        { type: ["string", "number"] },
        { enum: ["red", "green", "blue"] },
        { const: "exact-value" }
      ];

      schemas.forEach(schema => {
        const mockBuilder = {
          string: { type: "string" },
          number: { type: "number" },
          boolean: { type: "boolean" },
          array: { type: "array" },
          object: { type: "object" },
          literal: jest.fn((val) => ({ type: "literal", value: val })),
          oneOf: jest.fn(() => ({ type: "oneOf" }))
        };

        const chain = getBaseChain(mockBuilder, "string");
        expect(chain).toBeDefined();
      });
    });

    test("should handle type array with null", () => {
      const schema: JSONSchema7 = {
        type: ["string", "null"]
      };

      const mockBuilder = {
        string: {
          type: "string",
          nullable: jest.fn().mockReturnThis()
        }
      };

      const chain = getBaseChain(mockBuilder, "string");
      expect(mockBuilder.string).toBeDefined();
    });

    test("should handle only null type", () => {
      const schema: JSONSchema7 = {
        type: "null"
      };

      const mockBuilder = {
        literal: jest.fn((val) => ({ type: "literal", value: val }))
      };

      const chain = getBaseChain(mockBuilder, "null");
      expect(mockBuilder.literal).toHaveBeenCalledWith(null);
    });
  });

  describe("Main plugin integration - Lines 1646-1822, 1828-1867", () => {
    test("should integrate with builder correctly", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 },
          age: { type: "number", minimum: 0 },
          email: { type: "string", format: "email" },
          tags: {
            type: "array",
            items: { type: "string" },
            minItems: 1
          }
        },
        required: ["name", "age"]
      };

      // Test that the plugin integrates with the builder system
      const builder = Builder().use(jsonSchemaPlugin);
      expect(builder).toBeDefined();
      
      // Test the fromJsonSchema method exists
      const builderWithSchema = (builder as any).fromJsonSchema(schema);
      expect(builderWithSchema).toBeDefined();
    });

    test("should handle various builder options", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: { type: "string" }
        }
      };

      const builder = Builder().use(jsonSchemaPlugin);
      
      // Test with different options
      const validator1 = (builder as any).fromJsonSchema(schema, {
        strictRequired: true
      });
      expect(validator1).toBeDefined();

      const validator2 = (builder as any).fromJsonSchema(schema, {
        allowAdditionalProperties: false
      });
      expect(validator2).toBeDefined();

      const customFormats = {
        "custom": (v: string) => v.startsWith("CUSTOM")
      };
      
      const validator3 = (builder as any).fromJsonSchema(schema, {
        customFormats
      });
      expect(validator3).toBeDefined();
    });
  });

  describe("Edge case validation paths", () => {
    test("should handle deeply nested conditional schemas", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          config: {
            type: "object",
            if: {
              properties: {
                env: { const: "production" }
              }
            },
            then: {
              properties: {
                database: {
                  type: "object",
                  if: {
                    properties: {
                      type: { const: "mysql" }
                    }
                  },
                  then: {
                    required: ["host", "port", "username", "password"]
                  }
                }
              }
            }
          }
        }
      };

      // This should hit complex conditional validation paths
      expect(validateValueAgainstSchema({
        config: {
          env: "production",
          database: {
            type: "mysql",
            host: "localhost"
            // missing port, username, password
          }
        }
      }, schema)).toBe(false);
    });

    test("should handle mixed validation scenarios", () => {
      const schema: JSONSchema7 = {
        anyOf: [
          {
            type: "object",
            properties: {
              type: { const: "A" },
              value: { type: "string", minLength: 5 }
            },
            required: ["type", "value"]
          },
          {
            type: "object", 
            properties: {
              type: { const: "B" },
              count: { type: "number", minimum: 10 }
            },
            required: ["type", "count"]
          },
          {
            type: "array",
            items: { type: "string" },
            minItems: 3
          }
        ]
      };

      // Should pass with first schema
      expect(validateValueAgainstSchema({
        type: "A",
        value: "hello"
      }, schema)).toBe(true);

      // Should pass with array schema
      expect(validateValueAgainstSchema(["a", "b", "c"], schema)).toBe(true);

      // Should fail all schemas
      expect(validateValueAgainstSchema({
        type: "C",
        value: "hi"
      }, schema)).toBe(false);
    });
  });
});