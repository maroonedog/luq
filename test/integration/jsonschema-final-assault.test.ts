import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  getSpecificValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  getBaseChain,
  applyConstraints,
  jsonSchemaPlugin
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { optionalPlugin } from "../../src/core/plugin/optional";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";

describe("JsonSchema Plugin - Final Assault for 100%", () => {
  describe("Error path coverage - 残り224行", () => {
    test("should handle array contains validation errors", () => {
      // Hit contains validation logic paths
      const schema: JSONSchema7 = {
        type: "array",
        contains: {
          type: "object",
          properties: {
            status: { const: "active" }
          },
          required: ["status"]
        }
      };

      // Should pass - contains at least one matching item
      expect(validateValueAgainstSchema([
        { status: "inactive" },
        { status: "active" },
        { status: "pending" }
      ], schema)).toBe(true);

      // Should fail - no matching items
      expect(validateValueAgainstSchema([
        { status: "inactive" },
        { status: "pending" }
      ], schema)).toBe(false);

      // Should fail - empty array
      expect(validateValueAgainstSchema([], schema)).toBe(false);
    });

    test("should handle complex format validation failures", () => {
      // Hit all format validation error paths
      const formats = [
        "email", "uri", "uuid", "date", "date-time", "time", 
        "duration", "ipv4", "ipv6", "hostname", "json-pointer",
        "relative-json-pointer", "iri", "uri-template"
      ];

      formats.forEach(format => {
        const schema: JSONSchema7 = { type: "string", format };
        // Use values that will definitely fail validation
        expect(validateValueAgainstSchema("invalid", schema)).toBe(false);
        expect(validateValueAgainstSchema("", schema)).toBe(false);
        expect(validateValueAgainstSchema("123", schema)).toBe(false);
      });
    });

    test("should handle pattern property validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        patternProperties: {
          "^str_": { type: "string" },
          "^num_": { type: "number" }
        },
        additionalProperties: false
      };

      // Should pass
      expect(validateValueAgainstSchema({
        str_name: "hello",
        num_count: 42
      }, schema)).toBe(true);

      // Should fail - wrong type for pattern
      expect(validateValueAgainstSchema({
        str_name: 123
      }, schema)).toBe(false);

      // Should fail - additional property
      expect(validateValueAgainstSchema({
        str_name: "hello",
        invalid_prop: "value"
      }, schema)).toBe(false);
    });

    test("should handle additionalProperties schema validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: {
          type: "number",
          minimum: 0
        }
      };

      // Should pass
      expect(validateValueAgainstSchema({
        name: "John",
        score: 100,
        rating: 85
      }, schema)).toBe(true);

      // Should fail - additional property wrong type
      expect(validateValueAgainstSchema({
        name: "John",
        score: "invalid"
      }, schema)).toBe(false);

      // Should fail - additional property constraint violation
      expect(validateValueAgainstSchema({
        name: "John",
        score: -10
      }, schema)).toBe(false);
    });

    test("should handle propertyNames validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          pattern: "^[a-z]+$",
          minLength: 3,
          maxLength: 10
        }
      };

      // Should pass
      expect(validateValueAgainstSchema({
        name: "value",
        status: "active"
      }, schema)).toBe(true);

      // Should fail - invalid property name pattern
      expect(validateValueAgainstSchema({
        "Invalid-Name": "value"
      }, schema)).toBe(false);

      // Should fail - property name too short
      expect(validateValueAgainstSchema({
        ab: "value"
      }, schema)).toBe(false);

      // Should fail - property name too long
      expect(validateValueAgainstSchema({
        verylongpropertyname: "value"
      }, schema)).toBe(false);
    });

    test("should handle dependentRequired validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          creditCard: { type: "boolean" },
          billingAddress: { type: "string" },
          cvv: { type: "string" }
        },
        dependentRequired: {
          creditCard: ["billingAddress", "cvv"]
        }
      };

      // Should pass - creditCard false, no dependencies required
      expect(validateValueAgainstSchema({
        creditCard: false
      }, schema)).toBe(true);

      // Should pass - creditCard true with all dependencies
      expect(validateValueAgainstSchema({
        creditCard: true,
        billingAddress: "123 Main St",
        cvv: "123"
      }, schema)).toBe(true);

      // Should fail - creditCard true but missing dependencies
      expect(validateValueAgainstSchema({
        creditCard: true
      }, schema)).toBe(false);

      expect(validateValueAgainstSchema({
        creditCard: true,
        billingAddress: "123 Main St"
        // missing cvv
      }, schema)).toBe(false);
    });

    test("should handle dependentSchemas validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: { type: "number" },
          unit: { type: "string" }
        },
        dependentSchemas: {
          type: {
            properties: {
              value: { minimum: 0 },
              unit: { enum: ["kg", "lbs"] }
            },
            required: ["value", "unit"]
          }
        }
      };

      // Should pass - no dependent property
      expect(validateValueAgainstSchema({
        value: 10
      }, schema)).toBe(true);

      // Should pass - dependent property with valid schema
      expect(validateValueAgainstSchema({
        type: "weight",
        value: 70,
        unit: "kg"
      }, schema)).toBe(true);

      // Should fail - dependent property with invalid schema
      expect(validateValueAgainstSchema({
        type: "weight",
        value: -5,  // negative value
        unit: "invalid"  // invalid unit
      }, schema)).toBe(false);
    });
  });

  describe("Complex conditional validation paths", () => {
    test("should handle deeply nested if/then/else with errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          userType: { type: "string" },
          subscription: { type: "string" },
          features: { type: "array", items: { type: "string" } },
          limits: { type: "object" }
        },
        if: {
          properties: { userType: { const: "premium" } }
        },
        then: {
          if: {
            properties: { subscription: { const: "yearly" } }
          },
          then: {
            properties: {
              features: { minItems: 10 },
              limits: {
                type: "object",
                properties: {
                  storage: { minimum: 1000 }
                }
              }
            }
          },
          else: {
            properties: {
              features: { minItems: 5 }
            }
          }
        },
        else: {
          properties: {
            features: { maxItems: 3 }
          }
        }
      };

      // Generate errors for various nested conditional paths
      const errors1 = getDetailedValidationErrors({
        userType: "premium",
        subscription: "yearly",
        features: ["f1", "f2"],  // too few features
        limits: { storage: 100 }  // too low storage
      }, schema);
      expect(errors1.length).toBeGreaterThan(0);

      const errors2 = getDetailedValidationErrors({
        userType: "premium", 
        subscription: "monthly",
        features: ["f1", "f2"]  // too few features for premium monthly
      }, schema);
      expect(errors2.length).toBeGreaterThan(0);

      const errors3 = getDetailedValidationErrors({
        userType: "basic",
        features: ["f1", "f2", "f3", "f4"]  // too many features for basic
      }, schema);
      expect(errors3.length).toBeGreaterThan(0);
    });

    test("should handle allOf/anyOf/oneOf composition errors", () => {
      const complexSchema: JSONSchema7 = {
        allOf: [
          {
            anyOf: [
              { type: "string", minLength: 5 },
              { type: "number", minimum: 10 }
            ]
          },
          {
            oneOf: [
              { 
                type: "string", 
                pattern: "^[a-z]+$" 
              },
              {
                type: "number",
                multipleOf: 5
              }
            ]
          },
          {
            not: {
              enum: ["forbidden", 99]
            }
          }
        ]
      };

      // Generate detailed errors for various failure modes
      const errors1 = getDetailedValidationErrors("hi", complexSchema);  // too short
      expect(errors1.length).toBeGreaterThan(0);

      const errors2 = getDetailedValidationErrors("Hello", complexSchema);  // wrong pattern
      expect(errors2.length).toBeGreaterThan(0);

      const errors3 = getDetailedValidationErrors("forbidden", complexSchema);  // forbidden value
      expect(errors3.length).toBeGreaterThan(0);

      const errors4 = getDetailedValidationErrors(7, complexSchema);  // not multiple of 5
      expect(errors4.length).toBeGreaterThan(0);
    });
  });

  describe("DSL conversion edge cases", () => {
    test("should handle complex nested schema DSL conversion", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              database: {
                type: "object",
                properties: {
                  connections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        host: { type: "string", format: "hostname" },
                        port: { type: "integer", minimum: 1, maximum: 65535 },
                        ssl: { type: "boolean" },
                        auth: {
                          type: "object",
                          if: {
                            properties: { type: { const: "oauth" } }
                          },
                          then: {
                            properties: {
                              clientId: { type: "string" },
                              clientSecret: { type: "string" }
                            },
                            required: ["clientId", "clientSecret"]
                          },
                          else: {
                            properties: {
                              username: { type: "string" },
                              password: { type: "string" }
                            },
                            required: ["username", "password"]
                          }
                        }
                      },
                      required: ["host", "port"]
                    },
                    minItems: 1
                  }
                },
                required: ["connections"]
              }
            },
            required: ["database"]
          }
        },
        required: ["config"]
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.length).toBeGreaterThan(5);  // Should have many DSL entries

      // Check that deeply nested paths are generated
      const authTypeField = dsl.find(d => d.path.includes("auth.type"));
      const clientIdField = dsl.find(d => d.path.includes("clientId"));
      const usernameField = dsl.find(d => d.path.includes("username"));
      
      expect(authTypeField || clientIdField || usernameField).toBeDefined();
    });

    test("should handle multipleTypes with complex constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: {
            type: ["string", "number", "array"],
            minLength: 5,      // for string
            minimum: 100,      // for number
            minItems: 3,       // for array
            items: { type: "string" }  // for array
          },
          optional: {
            type: ["boolean", "null"],
            const: true  // should only apply to boolean
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      const valueField = dsl.find(d => d.path === "value");
      const optionalField = dsl.find(d => d.path === "optional");

      expect(valueField?.multipleTypes).toBeDefined();
      expect(optionalField?.nullable).toBe(true);
    });
  });

  describe("Field definition conversion edge cases", () => {
    test("should handle tuple array definitions", () => {
      const dsl: any = {
        path: "coordinates",
        type: "array",
        constraints: {
          items: [
            { type: "number", minimum: -180, maximum: 180 },  // longitude
            { type: "number", minimum: -90, maximum: 90 },    // latitude
            { type: "string", optional: true }                // label
          ],
          additionalItems: false
        }
      };

      const definition = convertDSLToFieldDefinition(dsl);
      
      // Mock builder to test tuple handling
      const mockBuilder = {
        tupleBuilder: jest.fn().mockReturnValue({
          tuple: jest.fn((items) => {
            expect(items).toHaveLength(3);
            return { type: "tuple" };
          })
        })
      };

      definition(mockBuilder);
      expect(mockBuilder.tupleBuilder).toHaveBeenCalled();
    });

    test("should handle contentEncoding/contentMediaType", () => {
      const dsl: any = {
        path: "encodedData",
        type: "string",
        constraints: {
          contentEncoding: "base64",
          contentMediaType: "image/png"
        }
      };

      const definition = convertDSLToFieldDefinition(dsl);

      const mockBuilder = {
        string: {
          contentEncoding: jest.fn().mockReturnThis(),
          contentMediaType: jest.fn().mockReturnThis()
        }
      };

      definition(mockBuilder);
      expect(mockBuilder.string.contentEncoding).toHaveBeenCalledWith("base64");
      expect(mockBuilder.string.contentMediaType).toHaveBeenCalledWith("image/png");
    });

    test("should handle readOnly/writeOnly constraints", () => {
      const readOnlyDsl: any = {
        path: "readOnlyField",
        type: "string",
        constraints: { readOnly: true }
      };

      const writeOnlyDsl: any = {
        path: "writeOnlyField", 
        type: "string",
        constraints: { writeOnly: true }
      };

      const readOnlyDef = convertDSLToFieldDefinition(readOnlyDsl);
      const writeOnlyDef = convertDSLToFieldDefinition(writeOnlyDsl);

      const mockBuilder = {
        string: {
          readOnly: jest.fn().mockReturnThis(),
          writeOnly: jest.fn().mockReturnThis()
        }
      };

      readOnlyDef(mockBuilder);
      expect(mockBuilder.string.readOnly).toHaveBeenCalledWith(true);

      writeOnlyDef(mockBuilder);
      expect(mockBuilder.string.writeOnly).toHaveBeenCalledWith(true);
    });
  });

  describe("Builder integration comprehensive", () => {
    test("should handle complete builder integration with all plugin types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", minLength: 1, maxLength: 100 },
          email: { type: "string", format: "email" },
          age: { type: "integer", minimum: 0, maximum: 150 },
          tags: {
            type: "array",
            items: { type: "string", pattern: "^[a-z]+$" },
            minItems: 1,
            maxItems: 10,
            uniqueItems: true
          },
          metadata: {
            type: "object",
            additionalProperties: { type: "string" },
            minProperties: 1
          },
          preferences: {
            type: "object",
            properties: {
              theme: { enum: ["light", "dark"] },
              notifications: { type: "boolean" }
            }
          },
          scores: {
            type: "array",
            items: { type: "number", minimum: 0, maximum: 100 },
            contains: { minimum: 90 }  // at least one score >= 90
          }
        },
        required: ["id", "name", "email"],
        additionalProperties: false
      };

      // Test full integration with builder
      const builder = Builder()
        .use(jsonSchemaPlugin)
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin);

      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Test valid data
      expect(validator.validate({
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        tags: ["developer", "typescript"],
        metadata: { team: "frontend" },
        preferences: {
          theme: "dark",
          notifications: true
        },
        scores: [85, 92, 78]  // contains 92 which is >= 90
      }).valid).toBe(true);

      // Test invalid data
      expect(validator.validate({
        id: "invalid-uuid",
        name: "",
        email: "invalid-email",
        age: -5,
        tags: ["Invalid-Tag"],
        scores: [85, 78]  // no score >= 90
      }).valid).toBe(false);
    });

    test("should handle builder options and configurations", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          data: { type: "string" }
        }
      };

      const builder = Builder().use(jsonSchemaPlugin);

      // Test with custom formats
      const customFormats = {
        "product-id": (value: string) => /^PROD-\d{6}$/.test(value)
      };

      const validator1 = (builder as any).fromJsonSchema(schema, {
        customFormats
      }).build();
      expect(validator1).toBeDefined();

      // Test with strictRequired option
      const validator2 = (builder as any).fromJsonSchema(schema, {
        strictRequired: true
      }).build();
      expect(validator2).toBeDefined();

      // Test with allowAdditionalProperties
      const validator3 = (builder as any).fromJsonSchema(schema, {
        allowAdditionalProperties: false
      }).build();
      expect(validator3).toBeDefined();
    });
  });

  describe("Error path coverage - specific uncovered lines", () => {
    test("should handle specific validation error generation paths", () => {
      // Test const validation error
      const constSchema: JSONSchema7 = { const: { complex: { object: [1, 2, 3] } } };
      expect(validateValueAgainstSchema({ different: "object" }, constSchema)).toBe(false);

      // Test enum with complex values
      const enumSchema: JSONSchema7 = {
        enum: [
          { type: "A", value: 1 },
          { type: "B", value: 2 },
          [1, 2, 3],
          null,
          "string",
          42,
          true
        ]
      };
      expect(validateValueAgainstSchema({ type: "C", value: 3 }, enumSchema)).toBe(false);

      // Test pattern validation failure
      const patternSchema: JSONSchema7 = {
        type: "string",
        pattern: "^[A-Z]{3}-\\d{3}$"
      };
      expect(validateValueAgainstSchema("invalid-pattern", patternSchema)).toBe(false);

      // Test multipleOf with floating point edge case
      const multipleOfSchema: JSONSchema7 = {
        type: "number",
        multipleOf: 0.01
      };
      expect(validateValueAgainstSchema(0.1 + 0.2, multipleOfSchema)).toBe(false);  // floating point precision
    });

    test("should handle edge cases in getBaseChain", () => {
      // Test unknown type fallback
      const unknownBuilder: any = {
        string: { type: "string" },
        number: { type: "number" }
      };

      // This should hit the default fallback case
      const chain1 = getBaseChain(unknownBuilder, { type: "unknown" as any });
      expect(chain1).toBe(unknownBuilder.string);

      // Test array with only null
      const chain2 = getBaseChain(unknownBuilder, { type: ["null"] });
      expect(chain2).toBeDefined();

      // Test multiple types without null
      const multiBuilder: any = {
        oneOf: jest.fn(() => ({ type: "oneOf" })),
        string: { type: "string" },
        number: { type: "number" }
      };

      const chain3 = getBaseChain(multiBuilder, { 
        type: ["string", "number", "boolean"] 
      });
      expect(multiBuilder.oneOf).toHaveBeenCalled();
    });

    test("should handle constraint application edge cases", () => {
      // Test exclusive constraints with explicit boolean values
      const constraints1: any = {
        min: 10,
        exclusiveMin: true,
        max: 100,
        exclusiveMax: false
      };

      const mockChain1 = {
        min: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis()
      };

      applyConstraints(mockChain1, constraints1);
      expect(mockChain1.min).toHaveBeenCalledWith(10, { exclusive: true });
      expect(mockChain1.max).toHaveBeenCalledWith(100, { exclusive: false });

      // Test anyOf constraint
      const anyOfConstraints: any = {
        anyOf: [
          { type: "string", minLength: 5 },
          { type: "number", minimum: 10 },
          { type: "boolean" }
        ]
      };

      const mockChain2 = {
        custom: jest.fn().mockReturnThis()
      };

      applyConstraints(mockChain2, anyOfConstraints);
      expect(mockChain2.custom).toHaveBeenCalled();
    });

    test("should handle remaining format validation paths", () => {
      // Test all remaining format types with invalid values
      const formatTests = [
        { format: "iri-reference", invalid: "not an iri reference" },
        { format: "uri-reference", invalid: "not uri ref" },
        { format: "regex", invalid: "[invalid regex" }
      ];

      formatTests.forEach(({ format, invalid }) => {
        const schema: JSONSchema7 = { type: "string", format };
        expect(validateValueAgainstSchema(invalid, schema)).toBe(false);
      });

      // Test custom format with undefined format function
      const customFormats = {
        "undefined-format": undefined as any
      };

      const schema: JSONSchema7 = { type: "string", format: "undefined-format" };
      expect(validateValueAgainstSchema("test", schema, customFormats)).toBe(true);
    });
  });
});