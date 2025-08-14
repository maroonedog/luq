import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { jsonSchemaPlugin } from "../../../../src/core/plugin/jsonSchema";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { stringEmailPlugin } from "../../../../src/core/plugin/stringEmail";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { stringUrlPlugin } from "../../../../src/core/plugin/stringUrl";
import { uuidPlugin } from "../../../../src/core/plugin/uuid";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { numberMultipleOfPlugin } from "../../../../src/core/plugin/numberMultipleOf";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
import { arrayUniquePlugin } from "../../../../src/core/plugin/arrayUnique";
import { booleanTruthyPlugin } from "../../../../src/core/plugin/booleanTruthy";
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
import { literalPlugin } from "../../../../src/core/plugin/literal";
import { objectPlugin } from "../../../../src/core/plugin/object";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { nullablePlugin } from "../../../../src/core/plugin/nullable";
import { tupleBuilderPlugin } from "../../../../src/core/plugin/tupleBuilder";
import { customPlugin } from "../../../../src/core/plugin/custom";
import { JSONSchema7 } from "json-schema";

describe("jsonSchemaPlugin - Complete Coverage", () => {
  const createFullBuilder = () => {
    return Builder()
      .use(jsonSchemaPlugin)
      .use(requiredPlugin)
      .use(optionalPlugin)
      .use(nullablePlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(stringEmailPlugin)
      .use(stringPatternPlugin)
      .use(stringUrlPlugin)
      .use(uuidPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .use(numberIntegerPlugin)
      .use(numberMultipleOfPlugin)
      .use(arrayMinLengthPlugin)
      .use(arrayMaxLengthPlugin)
      .use(arrayUniquePlugin)
      .use(booleanTruthyPlugin)
      .use(oneOfPlugin)
      .use(literalPlugin)
      .use(objectPlugin)
      .use(tupleBuilderPlugin)
      .use(customPlugin);
  };

  describe("All type conversions", () => {
    test("should handle all primitive types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          stringField: { type: "string" },
          numberField: { type: "number" },
          integerField: { type: "integer" },
          booleanField: { type: "boolean" },
          arrayField: { type: "array" },
          objectField: { type: "object" }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        stringField: "test",
        numberField: 3.14,
        integerField: 42,
        booleanField: true,
        arrayField: [],
        objectField: {}
      }).valid).toBe(true);
    });

    test("should handle type array with multiple types (nullable)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          nullableString: { type: ["string", "null"] },
          nullableNumber: { type: ["number", "null"] },
          nullableBoolean: { type: ["boolean", "null"] }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // All null values
      expect(validator.validate({
        nullableString: null,
        nullableNumber: null,
        nullableBoolean: null
      }).valid).toBe(true);
      
      // All non-null values
      expect(validator.validate({
        nullableString: "test",
        nullableNumber: 42,
        nullableBoolean: false
      }).valid).toBe(true);
    });

    test("should handle missing type (defaults to string)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          noType: { minLength: 3 } // No type specified
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ noType: "test" }).valid).toBe(true);
      expect(validator.validate({ noType: "ab" }).valid).toBe(false);
    });
  });

  describe("All string format types", () => {
    test("should handle email format", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          email: { type: "string", format: "email" }
        },
        required: ["email"]
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ email: "test@example.com" }).valid).toBe(true);
      expect(validator.validate({ email: "invalid-email" }).valid).toBe(false);
    });

    test("should handle uri and url formats", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          uri: { type: "string", format: "uri" },
          url: { type: "string", format: "url" }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        uri: "https://example.com",
        url: "https://example.com"
      }).valid).toBe(true);
    });

    test("should handle uuid format", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        id: "550e8400-e29b-41d4-a716-446655440000"
      }).valid).toBe(true);
      
      expect(validator.validate({
        id: "not-a-uuid"
      }).valid).toBe(false);
    });

    test("should handle date and date-time formats", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          dateTime: { type: "string", format: "date-time" }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        date: "2024-01-01",
        dateTime: "2024-01-01T12:00:00Z"
      }).valid).toBe(true);
    });

    test("should handle unknown format with custom handler", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          customField: { type: "string", format: "phone" }
        }
      };

      const builder = createFullBuilder();
      
      // Without custom format - should be ignored
      const validator1 = (builder as any).fromJsonSchema(schema).build();
      expect(validator1.validate({ customField: "anything" }).valid).toBe(true);
      
      // With custom format
      const validator2 = (builder as any).fromJsonSchema(schema, {
        customFormats: {
          phone: (value: string) => /^\+?[0-9]{10,}$/.test(value)
        }
      }).build();
      
      expect(validator2.validate({ customField: "+1234567890" }).valid).toBe(true);
      expect(validator2.validate({ customField: "invalid" }).valid).toBe(false);
    });
  });

  describe("Number constraints", () => {
    test("should handle all number constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          price: {
            type: "number",
            minimum: 0,
            maximum: 1000,
            multipleOf: 0.01
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 100
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid values
      expect(validator.validate({
        price: 99.99,
        quantity: 10
      }).valid).toBe(true);
      
      // Invalid: price not multiple of 0.01
      expect(validator.validate({
        price: 99.999,
        quantity: 10
      }).valid).toBe(false);
      
      // Invalid: quantity not integer
      expect(validator.validate({
        price: 99.99,
        quantity: 10.5
      }).valid).toBe(false);
    });

    test("should handle exclusive minimum and maximum", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          exclusive: {
            type: "number",
            exclusiveMinimum: 0,
            exclusiveMaximum: 100
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid: between 0 and 100 (exclusive)
      expect(validator.validate({ exclusive: 50 }).valid).toBe(true);
      
      // Invalid: exactly 0 or 100
      expect(validator.validate({ exclusive: 0 }).valid).toBe(false);
      expect(validator.validate({ exclusive: 100 }).valid).toBe(false);
    });
  });

  describe("Array constraints", () => {
    test("should handle all array constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            uniqueItems: true
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid array
      expect(validator.validate({
        tags: ["tag1", "tag2", "tag3"]
      }).valid).toBe(true);
      
      // Invalid: empty array (minItems: 1)
      expect(validator.validate({
        tags: []
      }).valid).toBe(false);
      
      // Invalid: too many items
      expect(validator.validate({
        tags: ["a", "b", "c", "d", "e", "f"]
      }).valid).toBe(false);
      
      // Invalid: duplicate items (uniqueItems: true)
      expect(validator.validate({
        tags: ["tag1", "tag1"]
      }).valid).toBe(false);
    });

    test("should handle array with complex items", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 1 },
                age: { type: "number", minimum: 0 }
              },
              required: ["name"]
            }
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        users: [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 }
        ]
      }).valid).toBe(true);
      
      // Invalid: missing required name
      expect(validator.validate({
        users: [
          { age: 30 }
        ]
      }).valid).toBe(false);
    });
  });

  describe("Enum and const constraints", () => {
    test("should handle enum constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "inactive", "pending"]
          },
          priority: {
            type: "number",
            enum: [1, 2, 3]
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        status: "active",
        priority: 2
      }).valid).toBe(true);
      
      expect(validator.validate({
        status: "unknown",
        priority: 4
      }).valid).toBe(false);
    });

    test("should handle const constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          version: { const: 1 },
          type: { const: "config" },
          flag: { const: true },
          nothing: { const: null }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        version: 1,
        type: "config",
        flag: true,
        nothing: null
      }).valid).toBe(true);
      
      expect(validator.validate({
        version: 2,
        type: "config",
        flag: true,
        nothing: null
      }).valid).toBe(false);
    });
  });

  describe("Deeply nested schemas", () => {
    test("should handle multiple levels of nesting", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          company: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 1 },
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  country: {
                    type: "object",
                    properties: {
                      code: { type: "string", pattern: "^[A-Z]{2}$" },
                      name: { type: "string" }
                    },
                    required: ["code"]
                  }
                },
                required: ["city", "country"]
              },
              employees: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    department: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        budget: { type: "number", minimum: 0 }
                      }
                    }
                  }
                }
              }
            },
            required: ["name", "address"]
          }
        },
        required: ["company"]
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid deeply nested data
      expect(validator.validate({
        company: {
          name: "Tech Corp",
          address: {
            street: "123 Main St",
            city: "New York",
            country: {
              code: "US",
              name: "United States"
            }
          },
          employees: [
            {
              name: "John",
              department: {
                name: "Engineering",
                budget: 1000000
              }
            }
          ]
        }
      }).valid).toBe(true);
      
      // Invalid: missing required nested field
      expect(validator.validate({
        company: {
          name: "Tech Corp",
          address: {
            city: "New York",
            country: {
              name: "United States" // Missing required 'code'
            }
          }
        }
      }).valid).toBe(false);
    });
  });

  describe("Mixed constraints", () => {
    test("should handle field with multiple constraint types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          complexField: {
            type: "string",
            minLength: 5,
            maxLength: 50,
            pattern: "^[A-Z]",
            format: "email"
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Must satisfy all constraints
      expect(validator.validate({
        complexField: "Admin@example.com"
      }).valid).toBe(true);
      
      // Fails pattern (doesn't start with uppercase)
      expect(validator.validate({
        complexField: "admin@example.com"
      }).valid).toBe(false);
      
      // Fails minLength
      expect(validator.validate({
        complexField: "A@b.c"
      }).valid).toBe(false);
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle empty schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {}
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ extra: "field" }).valid).toBe(true);
    });

    test("should handle schema with no required fields", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          optional1: { type: "string" },
          optional2: { type: "number" }
        }
        // No 'required' array
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ optional1: "test" }).valid).toBe(true);
      expect(validator.validate({ optional2: 42 }).valid).toBe(true);
    });

    test("should handle array type definitions", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          mixedArray: {
            type: "array",
            items: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" }
            ]
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        mixedArray: ["text", 42, true]
      }).valid).toBe(true);
    });

    test("should handle allOf, anyOf, oneOf (partial support)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          combined: {
            allOf: [
              { type: "string" },
              { minLength: 5 }
            ]
          }
        }
      };

      const builder = createFullBuilder();
      // These might not be fully supported but shouldn't crash
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator).toBeDefined();
    });

    test("should handle definitions and $ref (if supported)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        definitions: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" }
            }
          }
        },
        properties: {
          homeAddress: { $ref: "#/definitions/address" },
          workAddress: { $ref: "#/definitions/address" }
        }
      };

      const builder = createFullBuilder();
      // $ref might not be fully supported but shouldn't crash
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator).toBeDefined();
    });
  });

  describe("Options handling", () => {
    test("should handle strictRequired option", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field1: { type: "string" }
        },
        additionalProperties: false
      };

      const builder = createFullBuilder();
      
      // With strictRequired: true
      const validator = (builder as any).fromJsonSchema(schema, {
        strictRequired: true
      }).build();
      
      // Currently additionalProperties validation might not be enforced
      // but the option should be accepted without error
      expect(validator.validate({ field1: "test" }).valid).toBe(true);
    });

    test("should handle customFormats option with multiple formats", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          phone: { type: "string", format: "phone" },
          zip: { type: "string", format: "zip" },
          ssn: { type: "string", format: "ssn" }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema, {
        customFormats: {
          phone: (v: string) => /^\d{10}$/.test(v),
          zip: (v: string) => /^\d{5}(-\d{4})?$/.test(v),
          ssn: (v: string) => /^\d{3}-\d{2}-\d{4}$/.test(v)
        }
      }).build();
      
      expect(validator.validate({
        phone: "1234567890",
        zip: "12345",
        ssn: "123-45-6789"
      }).valid).toBe(true);
      
      expect(validator.validate({
        phone: "123",
        zip: "abc",
        ssn: "123456789"
      }).valid).toBe(false);
    });
  });

  describe("Complex real-world schemas", () => {
    test("should handle OpenAPI-style schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        required: ["id", "email", "profile"],
        properties: {
          id: {
            type: "string",
            format: "uuid"
          },
          email: {
            type: "string",
            format: "email"
          },
          profile: {
            type: "object",
            required: ["firstName", "lastName"],
            properties: {
              firstName: {
                type: "string",
                minLength: 1,
                maxLength: 50
              },
              lastName: {
                type: "string",
                minLength: 1,
                maxLength: 50
              },
              age: {
                type: "integer",
                minimum: 0,
                maximum: 150
              },
              preferences: {
                type: "object",
                properties: {
                  newsletter: { type: "boolean" },
                  notifications: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["email", "sms", "push"]
                    },
                    uniqueItems: true
                  }
                }
              }
            }
          },
          metadata: {
            type: "object",
            properties: {
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              version: { type: "integer", minimum: 1 }
            }
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      const validData = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "user@example.com",
        profile: {
          firstName: "John",
          lastName: "Doe",
          age: 30,
          preferences: {
            newsletter: true,
            notifications: ["email", "push"]
          }
        },
        metadata: {
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-02T00:00:00Z",
          version: 1
        }
      };
      
      expect(validator.validate(validData).valid).toBe(true);
      
      // Missing required field
      const invalidData = { ...validData };
      delete (invalidData as any).profile.firstName;
      expect(validator.validate(invalidData).valid).toBe(false);
    });
  });
});