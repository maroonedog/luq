import { describe, test, expect } from "@jest/globals";
import { 
  jsonSchemaPlugin,
  validateValueAgainstSchema,
  resolveRef,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  getDetailedValidationErrors,
  getSpecificValidationErrors,
  // convertJsonSchemaToFieldDefinition, // Not exported
  // getBaseChain, // Not exported
  applyConstraints
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { optionalPlugin } from "../../src/core/plugin/optional";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../src/core/plugin/stringPattern";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../src/core/plugin/numberInteger";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../src/core/plugin/arrayMaxLength";
import { arrayUniquePlugin } from "../../src/core/plugin/arrayUnique";
import { oneOfPlugin } from "../../src/core/plugin/oneOf";
import { literalPlugin } from "../../src/core/plugin/literal";
import { customPlugin } from "../../src/core/plugin/custom";

describe("JsonSchema Plugin - Uncovered Lines Coverage", () => {
  describe("exclusiveMinimum/Maximum as boolean (draft-04 compat)", () => {
    test("should handle exclusiveMinimum as boolean true", () => {
      // Line 302: if (value <= schema.minimum) return false;
      const schema: any = {
        type: "number",
        minimum: 10,
        exclusiveMinimum: true
      };
      
      expect(validateValueAgainstSchema(10.1, schema)).toBe(true);
      expect(validateValueAgainstSchema(10, schema)).toBe(false); // Covers line 302
      expect(validateValueAgainstSchema(9.9, schema)).toBe(false);
    });

    test("should handle exclusiveMaximum as boolean true", () => {
      // Line 320: if (value >= schema.maximum) return false;
      const schema: any = {
        type: "number",
        maximum: 100,
        exclusiveMaximum: true
      };
      
      expect(validateValueAgainstSchema(99.9, schema)).toBe(true);
      expect(validateValueAgainstSchema(100, schema)).toBe(false); // Covers line 320
      expect(validateValueAgainstSchema(100.1, schema)).toBe(false);
    });
  });

  describe("getDetailedValidationErrors - if/then/else coverage", () => {
    test("should handle if/then with required fields", () => {
      // Lines 531-553: if/then validation with required fields
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
          required: ["extra"]
        }
      };
      
      const errors = getDetailedValidationErrors(
        { type: "special", value: "test" },
        schema
      );
      
      expect(errors.some(e => e.code === "REQUIRED_IF")).toBe(true);
      expect(errors.some(e => e.path === "extra")).toBe(true);
    });

    test("should handle if/then validation failure", () => {
      // Lines 556-562: if/then validation failed
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: { type: "number" }
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
        }
      };
      
      const errors = getDetailedValidationErrors(
        { type: "number", value: 5 },
        schema
      );
      
      expect(errors.some(e => e.code === "IF_THEN_FAILED")).toBe(true);
    });

    test("should handle if/else validation", () => {
      // Lines 572-580: else branch validation
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: { type: "string" }
        },
        if: {
          properties: {
            type: { const: "number" }
          }
        },
        else: {
          properties: {
            value: { type: "string", minLength: 5 }
          }
        }
      };
      
      const errors = getDetailedValidationErrors(
        { type: "string", value: "hi" }, // type !== "number", so else branch applies
        schema
      );
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].path).toContain("value");
    });

    test("should handle nested then schema validation errors", () => {
      // Lines 565-571: then schema detailed errors
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          details: {
            type: "object",
            properties: {
              level: { type: "number" }
            }
          }
        },
        if: {
          properties: {
            type: { const: "advanced" }
          }
        },
        then: {
          properties: {
            details: {
              type: "object",
              properties: {
                level: { type: "number", minimum: 5 }
              },
              required: ["level"]
            }
          }
        }
      };
      
      const errors = getDetailedValidationErrors(
        { type: "advanced", details: { level: 2 } },
        schema
      );
      
      expect(errors.some(e => e.path.includes("details.level"))).toBe(true);
    });
  });

  describe("getSpecificValidationErrors - uncovered paths", () => {
    test("should handle nested object validation for specific path", () => {
      // Lines 658-689: nested validation with specific path
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          deeply: {
            type: "object",
            properties: {
              nested: {
                type: "object",
                properties: {
                  field: { type: "string", minLength: 5 }
                }
              }
            }
          }
        }
      };
      
      const errors = getSpecificValidationErrors(
        { deeply: { nested: { field: "hi" } } },
        schema,
        "/deeply/nested"
      );
      
      expect(errors.some(e => e.path === "/deeply/nested/field")).toBe(true);
    });

    test("should handle array item validation for specific path", () => {
      // Lines 672-689: array validation
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: { type: "number", minimum: 10 }
              }
            }
          }
        }
      };
      
      const errors = getSpecificValidationErrors(
        { items: [{ value: 5 }, { value: 15 }] },
        schema,
        "/items"
      );
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.path.includes("/items/0"))).toBe(true);
    });
  });

  describe("convertJsonSchemaToLuqDSL - uncovered branches", () => {
    test("should handle additionalProperties in root schema", () => {
      // Lines 756-759: additionalProperties handling
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: { type: "number" }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      const rootConstraints = dsl.find(d => d.path === "");
      expect(rootConstraints).toBeDefined();
      expect(rootConstraints?.constraints?.additionalProperties).toBeDefined();
    });

    test("should handle propertyNames constraint", () => {
      // Lines 774-777: propertyNames handling
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          pattern: "^[a-z]+$"
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      const rootConstraints = dsl.find(d => d.path === "");
      expect(rootConstraints?.constraints?.propertyNames).toBeDefined();
    });

    test("should handle tuple array items", () => {
      // Lines 837-838, 920, 931: tuple handling
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          coords: {
            type: "array",
            items: [
              { type: "number" },
              { type: "number" }
            ],
            additionalItems: false
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      const coordsDsl = dsl.find(d => d.path === "coords");
      expect(coordsDsl?.constraints?.items).toBeInstanceOf(Array);
      expect((coordsDsl?.constraints as any)?.additionalItems).toBe(false);
    });

    test("should handle nested conditional validation", () => {
      // Lines 965-980: nested conditional validation
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          nested: {
            type: "object",
            properties: {
              value: { type: "string" }
            },
            if: {
              properties: {
                value: { const: "special" }
              }
            },
            then: {
              properties: {
                extra: { type: "string" }
              },
              required: ["extra"]
            }
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      const nestedDsl = dsl.find(d => d.path === "nested.extra");
      expect(nestedDsl).toBeDefined();
    });
  });

  describe("convertDSLToFieldDefinition - uncovered branches", () => {
    test("should handle multipleTypes with oneOf", () => {
      // Lines 1011-1012: multiple types handling
      const dsl = {
        path: "field",
        type: "string" as const,
        multipleTypes: ["string", "number", "boolean"],
        constraints: {}
      };
      
      const mockBuilder = {
        oneOf: jest.fn().mockReturnThis()
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });

    test("should handle const constraint with literal", () => {
      // Lines 1036, 1073, 1079: literal/const handling
      const dsl = {
        path: "field",
        type: "string" as const,
        constraints: {
          const: "exact-value"
        }
      };
      
      const mockBuilder = {
        literal: jest.fn().mockReturnThis()
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.literal).toHaveBeenCalledWith("exact-value");
    });

    test("should handle custom format with refine", () => {
      // Lines 1120-1125, 1131-1145: custom format refine
      const dsl = {
        path: "ssn",
        type: "string" as const,
        constraints: {
          format: "ssn"
        }
      };
      
      const customFormats = {
        ssn: jest.fn((v: string) => /^\d{3}-\d{2}-\d{4}$/.test(v))
      };
      
      const mockBuilder = {
        string: {
          refine: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl, customFormats);
      definition(mockBuilder);
      
      expect(mockBuilder.string.refine).toHaveBeenCalledWith(customFormats.ssn);
    });

    test("should handle object constraints", () => {
      // Lines 1237, 1274-1280, 1294-1300: object constraints
      const dsl: any = {
        path: "config",
        type: "object",
        constraints: {
          minProperties: 2,
          maxProperties: 10,
          propertyNames: { pattern: "^[a-zA-Z]+$" },
          additionalProperties: { type: "string" }
        }
      };
      
      const mockBuilder = {
        object: {
          minProperties: jest.fn().mockReturnThis(),
          maxProperties: jest.fn().mockReturnThis(),
          propertyNames: jest.fn().mockReturnThis(),
          additionalProperties: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.object.minProperties).toHaveBeenCalledWith(2);
      expect(mockBuilder.object.maxProperties).toHaveBeenCalledWith(10);
    });

    test("should handle tuple builder", () => {
      // Line 1186: tuple builder
      const dsl: any = {
        path: "tuple",
        type: "array",
        constraints: {
          items: [
            { type: "string" },
            { type: "number" }
          ]
        }
      };
      
      const mockBuilder = {
        tupleBuilder: jest.fn().mockReturnValue({
          tuple: jest.fn().mockReturnThis()
        })
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.tupleBuilder).toHaveBeenCalled();
    });
  });

  describe("applyConstraints - complex cases", () => {
    test("should handle propertyNames with enum", () => {
      // Lines 1370-1374: propertyNames enum
      const constraints: any = {
        propertyNames: {
          enum: ["firstName", "lastName", "email"]
        }
      };
      
      const mockChain = {
        propertyNames: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      
      expect(mockChain.propertyNames).toHaveBeenCalledWith(
        expect.objectContaining({
          validator: expect.any(Function)
        })
      );
      
      // Test the validator function
      const call = mockChain.propertyNames.mock.calls[0][0];
      expect(call.validator("firstName")).toBe(true);
      expect(call.validator("unknown")).toBe(false);
    });

    test("should handle patternProperties", () => {
      // Lines 1381-1389: patternProperties
      const constraints: any = {
        patternProperties: {
          "^num_": { type: "number" },
          "^str_": { type: "string" }
        }
      };
      
      const mockChain = {
        patternProperties: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      
      expect(mockChain.patternProperties).toHaveBeenCalled();
      const patternValidators = mockChain.patternProperties.mock.calls[0][0];
      expect(patternValidators["^num_"]).toBeDefined();
      expect(patternValidators["^str_"]).toBeDefined();
    });

    test("should handle dependentRequired", () => {
      // Lines 1393-1394: dependentRequired
      const constraints: any = {
        dependentRequired: {
          creditCard: ["cardNumber", "cvv"],
          email: ["emailVerified"]
        }
      };
      
      const mockChain = {
        dependentRequired: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      
      expect(mockChain.dependentRequired).toHaveBeenCalledWith({
        creditCard: ["cardNumber", "cvv"],
        email: ["emailVerified"]
      });
    });

    test("should validate allOf schemas", () => {
      // Lines 1404-1407: allOf validation
      const constraints: any = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 10 }
        ]
      };
      
      const mockChain = {
        custom: jest.fn((validator) => {
          // Test valid cases
          expect(validator("hello")).toBe(true);
          expect(validator("hello123")).toBe(true);
          
          // Test invalid cases - line 1407
          expect(validator("hi")).toBe(false); // Too short
          expect(validator("verylongstring")).toBe(false); // Too long
          
          return mockChain;
        })
      };
      
      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should validate anyOf schemas", () => {
      // Lines 1421-1429: anyOf validation
      const constraints: any = {
        anyOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      const mockChain = {
        custom: jest.fn((validator) => {
          // Valid cases
          expect(validator("long string")).toBe(true);
          expect(validator(150)).toBe(true);
          
          // Invalid cases - none match
          expect(validator("short")).toBe(false);
          expect(validator(50)).toBe(false);
          
          return mockChain;
        })
      };
      
      applyConstraints(mockChain, constraints);
    });

    test("should validate oneOf schemas", () => {
      // Line 1449: oneOf validation
      const constraints: any = {
        oneOf: [
          { type: "string", maxLength: 5 },
          { type: "string", minLength: 10 }
        ]
      };
      
      const mockChain = {
        custom: jest.fn((validator) => {
          // Exactly one matches
          expect(validator("hi")).toBe(true);
          expect(validator("verylongstring")).toBe(true);
          
          // Both match or none match - line 1449
          expect(validator("medium")).toBe(false);
          
          return mockChain;
        })
      };
      
      applyConstraints(mockChain, constraints);
    });

    test("should handle conditional validation", () => {
      // Lines 1519-1535: conditional validation
      const constraints: any = {
        conditionalValidation: {
          if: { properties: { type: { const: "A" } } },
          then: { properties: { value: { type: "number" } } },
          else: { properties: { value: { type: "string" } } }
        }
      };
      
      const mockChain = {
        custom: jest.fn((validator) => {
          // If matches, then applies
          expect(validator({ type: "A", value: 42 })).toBe(true);
          expect(validator({ type: "A", value: "string" })).toBe(false);
          
          // If doesn't match, else applies
          expect(validator({ type: "B", value: "string" })).toBe(true);
          expect(validator({ type: "B", value: 42 })).toBe(false);
          
          return mockChain;
        })
      };
      
      applyConstraints(mockChain, constraints);
    });

    test("should handle if/then with requiredIf", () => {
      // Lines 1484-1490, 1506: requiredIf in conditional
      const constraints: any = {
        if: {
          properties: {
            hasAccount: { const: true }
          }
        },
        then: {
          required: ["username", "password"]
        }
      };
      
      const mockChain = {
        custom: jest.fn().mockReturnThis(),
        requiredIf: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      
      expect(mockChain.custom).toHaveBeenCalled();
    });
  });

  describe.skip("getBaseChain - edge cases", () => { // getBaseChain not exported
    test("should handle multiple types without null", () => {
      // Lines 1589-1604: oneOf builder for multiple types
      const schema: JSONSchema7 = {
        type: ["string", "number", "boolean"]
      };
      
      const mockBuilder = {
        oneOf: jest.fn(() => ({ type: "oneOf" }))
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });

    test("should handle only null type", () => {
      // Line 1579: null type only
      const schema: JSONSchema7 = {
        type: "null"
      };
      
      const mockBuilder = {
        literal: jest.fn((val) => ({ type: "literal", value: val }))
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.literal).toHaveBeenCalledWith(null);
    });

    test("should handle date builder when available", () => {
      // Lines 1631-1634: date builder
      const schema: any = {
        type: "string",
        format: "date"
      };
      
      const mockBuilder = {
        date: { type: "date" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("date");
    });

    test("should default to string for unknown type", () => {
      // Line 1647: default case
      const schema: any = {
        type: "unknown"
      };
      
      const mockBuilder = {
        string: { type: "string" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("string");
    });
  });

  describe("Complex nested compositions", () => {
    test("should handle deeply nested allOf/anyOf/oneOf", () => {
      // Lines 1680-1708: complex composition handling
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            allOf: [
              {
                anyOf: [
                  { type: "string", pattern: "^test" },
                  { type: "number", multipleOf: 5 }
                ]
              },
              {
                not: {
                  const: "forbidden"
                }
              }
            ]
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.constraints?.allOf).toBeDefined();
    });

    test("should handle dependencies as schema", () => {
      // Lines 1728-1739: dependencies with schema
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        dependencies: {
          name: {
            properties: {
              age: { type: "number", minimum: 0 }
            },
            required: ["age"]
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const rootDsl = dsl.find(d => d.path === "");
      expect((rootDsl?.constraints as any)?.dependencies).toBeDefined();
    });

    test("should handle dependencies as array", () => {
      // Lines 1748-1759: dependencies with array
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          email: { type: "string" }
        },
        dependencies: {
          email: ["emailVerified", "emailNotifications"]
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const rootDsl = dsl.find(d => d.path === "");
      expect((rootDsl?.constraints as any)?.dependencies).toEqual({
        email: ["emailVerified", "emailNotifications"]
      });
    });
  });

  describe("Builder extension edge cases", () => {
    test("should handle root level constraints", () => {
      // Lines 1924-1945: root level constraints
      const schema: any = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        dependentRequired: {
          name: ["email"]
        },
        additionalProperties: false,
        minProperties: 1,
        maxProperties: 5
      };
      
      const builder = Builder()
        .use(jsonSchemaPlugin)
        .use(requiredPlugin);
      
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Test that root constraints are applied
      expect(validator.validate({ name: "John" }).valid).toBe(false); // Missing email when name present
      expect(validator.validate({ name: "John", email: "john@example.com" }).valid).toBe(true);
    });

    test("should handle strictRequired option", () => {
      // Lines 1948-1950: strictRequired handling
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: { type: "string" }
        },
        additionalProperties: false
      };
      
      const builder = Builder()
        .use(jsonSchemaPlugin)
        .use(requiredPlugin);
      
      const validator = (builder as any).fromJsonSchema(schema, {
        strictRequired: true
      }).build();
      
      expect(validator).toBeDefined();
    });
  });
});