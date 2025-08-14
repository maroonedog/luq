import { describe, test, expect } from "@jest/globals";
import { 
  jsonSchemaPlugin,
  validateValueAgainstSchema,
  resolveRef,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  // convertJsonSchemaToFieldDefinition, // Does not exist
  // getBaseChain, // Not exported
  applyConstraints,
  getDetailedValidationErrors,
  getSpecificValidationErrors
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { optionalPlugin } from "../../src/core/plugin/optional";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../src/core/plugin/stringPattern";
import { stringEmailPlugin } from "../../src/core/plugin/stringEmail";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../src/core/plugin/numberInteger";
import { numberMultipleOfPlugin } from "../../src/core/plugin/numberMultipleOf";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../src/core/plugin/arrayMaxLength";
import { arrayUniquePlugin } from "../../src/core/plugin/arrayUnique";
import { oneOfPlugin } from "../../src/core/plugin/oneOf";
import { literalPlugin } from "../../src/core/plugin/literal";
import { nullablePlugin } from "../../src/core/plugin/nullable";
import { customPlugin } from "../../src/core/plugin/custom";
import { booleanTruthyPlugin } from "../../src/core/plugin/booleanTruthy";
import { objectPlugin } from "../../src/core/plugin/object";
import { tupleBuilderPlugin } from "../../src/core/plugin/tupleBuilder";

describe("JsonSchema Plugin - Comprehensive Coverage", () => {
  describe("getDetailedValidationErrors", () => {
    test("should return detailed errors for invalid data", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 },
          age: { type: "number", minimum: 18 }
        },
        required: ["name", "age"]
      };
      
      const errors = getDetailedValidationErrors(
        { name: "Jo", age: 10 },
        schema
      );
      
      expect(errors).toHaveLength(2);
      expect(errors).toContainEqual(expect.objectContaining({
        path: "/name",
        message: expect.stringContaining("minLength")
      }));
      expect(errors).toContainEqual(expect.objectContaining({
        path: "/age",
        message: expect.stringContaining("minimum")
      }));
    });

    test("should handle missing required fields", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        required: ["name"]
      };
      
      const errors = getDetailedValidationErrors({}, schema);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        path: "/name",
        message: expect.stringContaining("required")
      });
    });

    test("should handle type errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          count: { type: "number" }
        }
      };
      
      const errors = getDetailedValidationErrors(
        { count: "not a number" },
        schema
      );
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        path: "/count",
        message: expect.stringContaining("type")
      });
    });

    test("should handle nested object errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              email: { type: "string", format: "email" }
            }
          }
        }
      };
      
      const errors = getDetailedValidationErrors(
        { user: { email: "invalid" } },
        schema
      );
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        path: "/user/email",
        message: expect.stringContaining("format")
      });
    });

    test("should handle array item errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "number" }
          }
        }
      };
      
      const errors = getDetailedValidationErrors(
        { items: [1, "not a number", 3] },
        schema
      );
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        path: "/items/1",
        message: expect.stringContaining("type")
      });
    });
  });

  describe("getSpecificValidationErrors", () => {
    test("should get errors for specific path", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 3 },
              age: { type: "number" }
            }
          }
        }
      };
      
      const errors = getSpecificValidationErrors(
        { user: { name: "Jo", age: "not a number" } },
        schema,
        "/user"
      );
      
      expect(errors).toHaveLength(2);
      expect(errors.every(e => e.path.startsWith("/user"))).toBe(true);
    });

    test("should return empty array for valid path", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        }
      };
      
      const errors = getSpecificValidationErrors(
        { name: "John" },
        schema,
        "/name"
      );
      
      expect(errors).toHaveLength(0);
    });
  });

  describe.skip("convertJsonSchemaToFieldDefinition", () => { // Function not exported
    test("should convert simple string schema to field definition", () => {
      const schema: JSONSchema7 = {
        type: "string",
        minLength: 3,
        maxLength: 10
      };
      
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis(),
          min: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertJsonSchemaToFieldDefinition(schema, true);
      const result = definition(mockBuilder);
      
      expect(mockBuilder.string.required).toHaveBeenCalled();
      expect(mockBuilder.string.min).toHaveBeenCalledWith(3);
      expect(mockBuilder.string.max).toHaveBeenCalledWith(10);
    });

    test("should handle optional fields", () => {
      const schema: JSONSchema7 = {
        type: "string"
      };
      
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertJsonSchemaToFieldDefinition(schema, false);
      definition(mockBuilder);
      
      expect(mockBuilder.string.required).not.toHaveBeenCalled();
    });

    test("should handle number type with constraints", () => {
      const schema: JSONSchema7 = {
        type: "number",
        minimum: 0,
        maximum: 100,
        multipleOf: 5
      };
      
      const mockBuilder = {
        number: {
          min: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis(),
          multipleOf: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertJsonSchemaToFieldDefinition(schema, false);
      definition(mockBuilder);
      
      expect(mockBuilder.number.min).toHaveBeenCalledWith(0);
      expect(mockBuilder.number.max).toHaveBeenCalledWith(100);
      expect(mockBuilder.number.multipleOf).toHaveBeenCalledWith(5);
    });
  });

  describe.skip("getBaseChain", () => { // getBaseChain not exported
    test("should get string chain for string type", () => {
      const schema: JSONSchema7 = { type: "string" };
      const mockBuilder = {
        string: { type: "string" },
        number: { type: "number" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("string");
    });

    test("should get number chain for number type", () => {
      const schema: JSONSchema7 = { type: "number" };
      const mockBuilder = {
        string: { type: "string" },
        number: { type: "number" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("number");
    });

    test("should handle multiple types with null", () => {
      const schema: JSONSchema7 = { type: ["string", "null"] };
      const mockBuilder = {
        string: { 
          type: "string",
          nullable: jest.fn().mockReturnThis()
        }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("string");
      expect(mockBuilder.string.nullable).toHaveBeenCalled();
    });

    test("should handle array of types without null", () => {
      const schema: JSONSchema7 = { type: ["string", "number"] };
      const mockBuilder = {
        string: { type: "string" },
        number: { type: "number" },
        oneOf: jest.fn((types) => ({ type: "oneOf", types }))
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });

    test("should handle integer type", () => {
      const schema: JSONSchema7 = { type: "integer" };
      const mockBuilder = {
        number: { 
          type: "number",
          integer: jest.fn().mockReturnThis()
        }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("number");
      expect(mockBuilder.number.integer).toHaveBeenCalled();
    });

    test("should handle boolean type", () => {
      const schema: JSONSchema7 = { type: "boolean" };
      const mockBuilder = {
        boolean: { type: "boolean" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("boolean");
    });

    test("should handle array type", () => {
      const schema: JSONSchema7 = { type: "array" };
      const mockBuilder = {
        array: { type: "array" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("array");
    });

    test("should handle object type", () => {
      const schema: JSONSchema7 = { type: "object" };
      const mockBuilder = {
        object: { type: "object" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("object");
    });

    test("should handle only null type", () => {
      const schema: JSONSchema7 = { type: ["null"] };
      const mockBuilder = {
        literal: jest.fn((val) => ({ type: "literal", value: val })),
        string: { type: "string" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.literal).toHaveBeenCalledWith(null);
    });

    test("should handle enum constraint", () => {
      const schema: JSONSchema7 = { enum: ["red", "green", "blue"] };
      const mockBuilder = {
        oneOf: jest.fn((values) => ({ type: "oneOf", values })),
        string: { type: "string" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.oneOf).toHaveBeenCalledWith(["red", "green", "blue"]);
    });

    test("should handle const constraint", () => {
      const schema: JSONSchema7 = { const: "exact-value" };
      const mockBuilder = {
        literal: jest.fn((val) => ({ type: "literal", value: val })),
        string: { type: "string" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.literal).toHaveBeenCalledWith("exact-value");
    });

    test("should default to string when no type specified", () => {
      const schema: JSONSchema7 = {};
      const mockBuilder = {
        string: { type: "string" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("string");
    });
  });

  describe("applyConstraints", () => {
    test("should apply string constraints", () => {
      const constraints = {
        minLength: 3,
        maxLength: 10,
        pattern: "^[A-Z]",
        format: "email"
      };
      
      const mockChain = {
        min: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        pattern: jest.fn().mockReturnThis(),
        email: jest.fn().mockReturnThis()
      };
      
      const result = applyConstraints(mockChain, constraints);
      
      expect(mockChain.min).toHaveBeenCalledWith(3);
      expect(mockChain.max).toHaveBeenCalledWith(10);
      expect(mockChain.pattern).toHaveBeenCalledWith(/^[A-Z]/);
      expect(mockChain.email).toHaveBeenCalled();
    });

    test("should apply number constraints", () => {
      const constraints = {
        min: 0,
        max: 100,
        multipleOf: 5,
        integer: true
      };
      
      const mockChain = {
        min: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        multipleOf: jest.fn().mockReturnThis(),
        integer: jest.fn().mockReturnThis()
      };
      
      const result = applyConstraints(mockChain, constraints);
      
      expect(mockChain.min).toHaveBeenCalledWith(0);
      expect(mockChain.max).toHaveBeenCalledWith(100);
      expect(mockChain.multipleOf).toHaveBeenCalledWith(5);
      expect(mockChain.integer).toHaveBeenCalled();
    });

    test("should apply array constraints", () => {
      const constraints = {
        minItems: 1,
        maxItems: 10,
        uniqueItems: true
      };
      
      const mockChain = {
        minLength: jest.fn().mockReturnThis(),
        maxLength: jest.fn().mockReturnThis(),
        unique: jest.fn().mockReturnThis()
      };
      
      const result = applyConstraints(mockChain, constraints);
      
      expect(mockChain.minLength).toHaveBeenCalledWith(1);
      expect(mockChain.maxLength).toHaveBeenCalledWith(10);
      expect(mockChain.unique).toHaveBeenCalled();
    });

    test("should handle custom format with refine", () => {
      const constraints = {
        format: "custom"
      };
      
      const customFormats = {
        custom: jest.fn((v) => v.startsWith("CUSTOM-"))
      };
      
      const mockChain = {
        refine: jest.fn().mockReturnThis()
      };
      
      const result = applyConstraints(mockChain, constraints, customFormats);
      
      expect(mockChain.refine).toHaveBeenCalledWith(customFormats.custom);
    });

    test("should handle allOf composition", () => {
      const constraints = {
        allOf: [
          { minLength: 5 },
          { maxLength: 10 }
        ]
      };
      
      const mockChain = {
        custom: jest.fn().mockReturnThis()
      };
      
      const result = applyConstraints(mockChain, constraints);
      
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should handle anyOf composition", () => {
      const constraints: any = {
        anyOf: [
          { type: "string" },
          { type: "number" }
        ]
      };
      
      const mockChain = {
        custom: jest.fn().mockReturnThis()
      };
      
      const result = applyConstraints(mockChain, constraints);
      
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should handle oneOf composition", () => {
      const constraints: any = {
        oneOf: [
          { type: "string" },
          { type: "number" }
        ]
      };
      
      const mockChain = {
        custom: jest.fn().mockReturnThis()
      };
      
      const result = applyConstraints(mockChain, constraints);
      
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should handle not composition", () => {
      const constraints: any = {
        not: { type: "string" }
      };
      
      const mockChain = {
        custom: jest.fn().mockReturnThis()
      };
      
      const result = applyConstraints(mockChain, constraints);
      
      expect(mockChain.custom).toHaveBeenCalled();
    });
  });

  describe("convertJsonSchemaToLuqDSL", () => {
    test("should convert object schema to DSL", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 },
          age: { type: "number", minimum: 18 }
        },
        required: ["name"]
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl).toHaveLength(2);
      expect(dsl[0]).toMatchObject({
        path: "name",
        type: "string",
        constraints: {
          minLength: 3,
          required: true
        }
      });
      expect(dsl[1]).toMatchObject({
        path: "age",
        type: "number",
        constraints: {
          min: 18,
          required: false
        }
      });
    });

    test("should handle nested objects", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              profile: {
                type: "object",
                properties: {
                  name: { type: "string" }
                }
              }
            }
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl.find(d => d.path === "user.profile.name")).toBeDefined();
    });

    test("should handle array with items", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            uniqueItems: true
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl[0]).toMatchObject({
        path: "tags",
        type: "array",
        constraints: {
          minItems: 1,
          uniqueItems: true,
          items: { type: "string" }
        }
      });
    });

    test("should handle allOf composition", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            allOf: [
              { type: "string" },
              { minLength: 5 }
            ]
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl[0].constraints.allOf).toBeDefined();
      expect(dsl[0].constraints.allOf).toHaveLength(2);
    });

    test("should handle if/then/else conditionals", () => {
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
        then: {
          properties: {
            value: { type: "number" }
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      // Should include conditional validation
      const valueDsl = dsl.find(d => d.path === "value");
      expect(valueDsl).toBeDefined();
    });

    test("should handle $ref resolution", () => {
      const schema: JSONSchema7 = {
        type: "object",
        definitions: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" }
            }
          }
        },
        properties: {
          home: { $ref: "#/definitions/address" }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl.find(d => d.path === "home.street")).toBeDefined();
    });
  });

  describe("convertDSLToFieldDefinition", () => {
    test("should convert string DSL to field definition", () => {
      const dsl = {
        path: "name",
        type: "string" as const,
        constraints: {
          required: true,
          minLength: 3,
          maxLength: 50,
          pattern: "^[A-Z]"
        }
      };
      
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis(),
          min: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis(),
          pattern: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.string.required).toHaveBeenCalled();
      expect(mockBuilder.string.min).toHaveBeenCalledWith(3);
      expect(mockBuilder.string.max).toHaveBeenCalledWith(50);
      expect(mockBuilder.string.pattern).toHaveBeenCalledWith(/^[A-Z]/);
    });

    test("should convert number DSL to field definition", () => {
      const dsl = {
        path: "age",
        type: "number" as const,
        constraints: {
          required: false,
          min: 0,
          max: 120,
          integer: true
        }
      };
      
      const mockBuilder = {
        number: {
          min: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis(),
          integer: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.number.min).toHaveBeenCalledWith(0);
      expect(mockBuilder.number.max).toHaveBeenCalledWith(120);
      expect(mockBuilder.number.integer).toHaveBeenCalled();
    });

    test("should handle enum constraint", () => {
      const dsl = {
        path: "status",
        type: "string" as const,
        constraints: {
          enum: ["active", "inactive", "pending"]
        }
      };
      
      const mockBuilder = {
        string: {
          oneOf: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.string.oneOf).toHaveBeenCalledWith(["active", "inactive", "pending"]);
    });
  });

  describe("Builder integration", () => {
    test("should create validator from JSON Schema", () => {
      const builder = Builder()
        .use(jsonSchemaPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(numberIntegerPlugin)
        .use(oneOfPlugin)
        .use(literalPlugin);
      
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 3,
            maxLength: 50
          },
          age: {
            type: "integer",
            minimum: 0,
            maximum: 120
          },
          status: {
            enum: ["active", "inactive"]
          }
        },
        required: ["name", "age"]
      };
      
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid data
      expect(validator.validate({
        name: "John",
        age: 30,
        status: "active"
      }).valid).toBe(true);
      
      // Invalid: name too short
      expect(validator.validate({
        name: "Jo",
        age: 30
      }).valid).toBe(false);
      
      // Invalid: missing required field
      expect(validator.validate({
        name: "John"
      }).valid).toBe(false);
      
      // Invalid: wrong enum value
      expect(validator.validate({
        name: "John",
        age: 30,
        status: "unknown"
      }).valid).toBe(false);
    });

    test("should handle complex nested schema", () => {
      const builder = Builder()
        .use(jsonSchemaPlugin)
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(stringEmailPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayUniquePlugin)
        .use(objectPlugin);
      
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              email: {
                type: "string",
                format: "email"
              },
              profile: {
                type: "object",
                properties: {
                  firstName: {
                    type: "string",
                    minLength: 1
                  },
                  lastName: {
                    type: "string",
                    minLength: 1
                  }
                },
                required: ["firstName"]
              }
            },
            required: ["email", "profile"]
          },
          tags: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            uniqueItems: true
          }
        },
        required: ["user"]
      };
      
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid data
      expect(validator.validate({
        user: {
          email: "john@example.com",
          profile: {
            firstName: "John",
            lastName: "Doe"
          }
        },
        tags: ["tag1", "tag2"]
      }).valid).toBe(true);
      
      // Invalid: missing required nested field
      expect(validator.validate({
        user: {
          email: "john@example.com",
          profile: {
            lastName: "Doe"
          }
        }
      }).valid).toBe(false);
      
      // Invalid: duplicate array items
      expect(validator.validate({
        user: {
          email: "john@example.com",
          profile: {
            firstName: "John"
          }
        },
        tags: ["tag1", "tag1"]
      }).valid).toBe(false);
    });

    test("should handle custom formats", () => {
      const builder = Builder()
        .use(jsonSchemaPlugin)
        .use(requiredPlugin)
        .use(customPlugin);
      
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          phone: {
            type: "string",
            format: "phone"
          }
        }
      };
      
      const customFormats = {
        phone: (value: string) => /^\d{3}-\d{3}-\d{4}$/.test(value)
      };
      
      const validator = (builder as any).fromJsonSchema(schema, { customFormats }).build();
      
      expect(validator.validate({ phone: "123-456-7890" }).valid).toBe(true);
      expect(validator.validate({ phone: "1234567890" }).valid).toBe(false);
    });

    test("should throw error for non-object root schema", () => {
      const builder = Builder().use(jsonSchemaPlugin);
      
      const schema: JSONSchema7 = {
        type: "string"
      };
      
      expect(() => {
        (builder as any).fromJsonSchema(schema);
      }).toThrow("Root schema must be an object with properties");
    });

    test("should handle schema without properties", () => {
      const builder = Builder().use(jsonSchemaPlugin);
      
      const schema: JSONSchema7 = {
        type: "object"
      };
      
      expect(() => {
        (builder as any).fromJsonSchema(schema);
      }).toThrow("Root schema must be an object with properties");
    });
  });
});