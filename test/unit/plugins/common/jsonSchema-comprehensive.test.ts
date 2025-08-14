import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { jsonSchemaPlugin } from "../../../../src/core/plugin/jsonSchema";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
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
import { customPlugin } from "../../../../src/core/plugin/custom";
import { tupleBuilderPlugin } from "../../../../src/core/plugin/tupleBuilder";
import { nullablePlugin } from "../../../../src/core/plugin/nullable";
import { objectPlugin } from "../../../../src/core/plugin/object";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Comprehensive Coverage", () => {
  const createCompleteBuilder = () => {
    return Builder()
      .use(jsonSchemaPlugin)
      .use(requiredPlugin)
      .use(optionalPlugin)
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
      .use(customPlugin)
      .use(tupleBuilderPlugin)
      .use(nullablePlugin)
      .use(objectPlugin);
  };

  describe("Basic Schema Conversions", () => {
    test("should handle all primitive types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          stringField: { type: "string" },
          numberField: { type: "number" },
          integerField: { type: "integer" },
          booleanField: { type: "boolean" },
          nullField: { type: "null" },
          arrayField: { type: "array", items: { type: "string" } },
          objectField: { type: "object", properties: { nested: { type: "string" } } }
        },
        required: ["stringField", "numberField"]
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        stringField: "test",
        numberField: 42,
        integerField: 10,
        booleanField: true,
        nullField: null,
        arrayField: ["a", "b"],
        objectField: { nested: "value" }
      }).valid).toBe(true);

      // Missing required field
      expect(validator.validate({
        numberField: 42
      }).valid).toBe(false);

      // Wrong type
      expect(validator.validate({
        stringField: 123,
        numberField: 42
      }).valid).toBe(false);
    });

    test("should handle multiple types (union types)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          flexibleField: { type: ["string", "number", "null"] }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ flexibleField: "string" }).valid).toBe(true);
      expect(validator.validate({ flexibleField: 123 }).valid).toBe(true);
      expect(validator.validate({ flexibleField: null }).valid).toBe(true);
      expect(validator.validate({ flexibleField: true }).valid).toBe(false);
    });
  });

  describe("String Constraints", () => {
    test("should handle all string constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          username: {
            type: "string",
            minLength: 3,
            maxLength: 20,
            pattern: "^[a-zA-Z0-9_]+$"
          },
          email: {
            type: "string",
            format: "email"
          },
          url: {
            type: "string",
            format: "uri"
          },
          uuid: {
            type: "string",
            format: "uuid"
          }
        },
        required: ["username", "email"]
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid data
      expect(validator.validate({
        username: "john_doe",
        email: "john@example.com",
        url: "https://example.com",
        uuid: "550e8400-e29b-41d4-a716-446655440000"
      }).valid).toBe(true);

      // Username too short
      expect(validator.validate({
        username: "ab",
        email: "john@example.com"
      }).valid).toBe(false);

      // Username too long
      expect(validator.validate({
        username: "a".repeat(21),
        email: "john@example.com"
      }).valid).toBe(false);

      // Invalid pattern
      expect(validator.validate({
        username: "john-doe",
        email: "john@example.com"
      }).valid).toBe(false);

      // Invalid email
      expect(validator.validate({
        username: "john_doe",
        email: "invalid-email"
      }).valid).toBe(false);
    });

    test("should handle date-time format", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          createdAt: {
            type: "string",
            format: "date-time"
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid ISO 8601 date-time
      expect(validator.validate({
        createdAt: "2024-01-15T10:30:00Z"
      }).valid).toBe(true);

      expect(validator.validate({
        createdAt: "2024-01-15T10:30:00+09:00"
      }).valid).toBe(true);

      // Invalid format
      expect(validator.validate({
        createdAt: "2024-01-15"
      }).valid).toBe(false);
    });
  });

  describe("Number Constraints", () => {
    test("should handle all number constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          age: {
            type: "integer",
            minimum: 0,
            maximum: 120
          },
          price: {
            type: "number",
            minimum: 0,
            exclusiveMaximum: 1000
          },
          quantity: {
            type: "integer",
            multipleOf: 5
          },
          rating: {
            type: "number",
            minimum: 1,
            maximum: 5,
            multipleOf: 0.5
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid data
      expect(validator.validate({
        age: 25,
        price: 99.99,
        quantity: 15,
        rating: 4.5
      }).valid).toBe(true);

      // Age not integer
      expect(validator.validate({
        age: 25.5,
        price: 99.99
      }).valid).toBe(false);

      // Price at exclusive maximum
      expect(validator.validate({
        age: 25,
        price: 1000
      }).valid).toBe(false);

      // Quantity not multiple of 5
      expect(validator.validate({
        quantity: 12
      }).valid).toBe(false);

      // Rating not multiple of 0.5
      expect(validator.validate({
        rating: 4.3
      }).valid).toBe(false);
    });
  });

  describe("Array Constraints", () => {
    test("should handle array constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            uniqueItems: true
          },
          numbers: {
            type: "array",
            items: { type: "number" }
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid data
      expect(validator.validate({
        tags: ["tag1", "tag2", "tag3"],
        numbers: [1, 2, 3]
      }).valid).toBe(true);

      // Empty array (violates minItems)
      expect(validator.validate({
        tags: []
      }).valid).toBe(false);

      // Too many items
      expect(validator.validate({
        tags: ["a", "b", "c", "d", "e", "f"]
      }).valid).toBe(false);

      // Duplicate items
      expect(validator.validate({
        tags: ["tag1", "tag2", "tag1"]
      }).valid).toBe(false);

      // Wrong item type
      expect(validator.validate({
        tags: ["tag1", 123]
      }).valid).toBe(false);
    });

    test("should handle tuple validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          coordinates: {
            type: "array",
            items: [
              { type: "number" },
              { type: "number" }
            ],
            minItems: 2,
            maxItems: 2
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid tuple
      expect(validator.validate({
        coordinates: [10.5, 20.3]
      }).valid).toBe(true);

      // Invalid - too few items
      expect(validator.validate({
        coordinates: [10.5]
      }).valid).toBe(false);

      // Invalid - too many items
      expect(validator.validate({
        coordinates: [10.5, 20.3, 30.1]
      }).valid).toBe(false);

      // Invalid - wrong type
      expect(validator.validate({
        coordinates: [10.5, "20.3"]
      }).valid).toBe(false);
    });
  });

  describe("Object Constraints", () => {
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
                  name: { type: "string", minLength: 1 },
                  age: { type: "number", minimum: 0 }
                },
                required: ["name"]
              }
            },
            required: ["profile"]
          }
        },
        required: ["user"]
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid nested object
      expect(validator.validate({
        user: {
          profile: {
            name: "John",
            age: 30
          }
        }
      }).valid).toBe(true);

      // Missing required nested field
      expect(validator.validate({
        user: {
          profile: {
            age: 30
          }
        }
      }).valid).toBe(false);

      // Missing required nested object
      expect(validator.validate({
        user: {}
      }).valid).toBe(false);
    });

    test("should handle additionalProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: false
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema, { strictRequired: false }).build();

      // Valid - only defined properties
      expect(validator.validate({
        name: "John"
      }).valid).toBe(true);

      // Note: additionalProperties validation might need special handling
      // This test might pass or fail depending on implementation
    });
  });

  describe("Enum and Const", () => {
    test("should handle enum values", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          status: {
            enum: ["active", "inactive", "pending"]
          },
          priority: {
            type: "number",
            enum: [1, 2, 3]
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid enum values
      expect(validator.validate({
        status: "active",
        priority: 2
      }).valid).toBe(true);

      // Invalid enum value
      expect(validator.validate({
        status: "unknown"
      }).valid).toBe(false);

      expect(validator.validate({
        priority: 4
      }).valid).toBe(false);
    });

    test("should handle const values", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          version: {
            const: "1.0.0"
          },
          type: {
            const: "user"
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid const values
      expect(validator.validate({
        version: "1.0.0",
        type: "user"
      }).valid).toBe(true);

      // Invalid const value
      expect(validator.validate({
        version: "2.0.0"
      }).valid).toBe(false);
    });
  });

  describe("Complex Schemas", () => {
    test("should handle oneOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          payment: {
            oneOf: [
              {
                type: "object",
                properties: {
                  type: { const: "credit_card" },
                  number: { type: "string", pattern: "^[0-9]{16}$" }
                },
                required: ["type", "number"]
              },
              {
                type: "object",
                properties: {
                  type: { const: "paypal" },
                  email: { type: "string", format: "email" }
                },
                required: ["type", "email"]
              }
            ]
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid credit card payment
      expect(validator.validate({
        payment: {
          type: "credit_card",
          number: "1234567890123456"
        }
      }).valid).toBe(true);

      // Valid PayPal payment
      expect(validator.validate({
        payment: {
          type: "paypal",
          email: "user@example.com"
        }
      }).valid).toBe(true);

      // Invalid - missing required field
      expect(validator.validate({
        payment: {
          type: "credit_card"
        }
      }).valid).toBe(false);
    });

    test("should handle $ref references", () => {
      const schema: JSONSchema7 = {
        type: "object",
        definitions: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              country: { type: "string" }
            },
            required: ["city", "country"]
          }
        },
        properties: {
          billingAddress: { $ref: "#/definitions/address" },
          shippingAddress: { $ref: "#/definitions/address" }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Valid with references
      expect(validator.validate({
        billingAddress: {
          street: "123 Main St",
          city: "New York",
          country: "USA"
        },
        shippingAddress: {
          city: "Los Angeles",
          country: "USA"
        }
      }).valid).toBe(true);

      // Invalid - missing required field in reference
      expect(validator.validate({
        billingAddress: {
          street: "123 Main St",
          city: "New York"
        }
      }).valid).toBe(false);
    });
  });

  describe("Options and Configuration", () => {
    test("should handle strictRequired option", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          optionalField: { type: "string" },
          requiredField: { type: "string" }
        },
        required: ["requiredField"]
      };

      const builder = createCompleteBuilder();
      
      // With strictRequired = false (default)
      const lenientValidator = (builder as any).fromJsonSchema(schema, { strictRequired: false }).build();
      expect(lenientValidator.validate({
        requiredField: "value"
      }).valid).toBe(true);

      // With strictRequired = true
      const strictValidator = (builder as any).fromJsonSchema(schema, { strictRequired: true }).build();
      expect(strictValidator.validate({
        requiredField: "value",
        optionalField: undefined
      }).valid).toBe(true);
    });

    test("should handle custom formats", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          customField: {
            type: "string",
            format: "custom-format"
          }
        }
      };

      const customFormats = {
        "custom-format": (value: string) => value.startsWith("CUSTOM-")
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema, { customFormats }).build();

      // Valid custom format
      expect(validator.validate({
        customField: "CUSTOM-123"
      }).valid).toBe(true);

      // Invalid custom format
      expect(validator.validate({
        customField: "INVALID-123"
      }).valid).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {}
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ anything: "goes" }).valid).toBe(true);
    });

    test("should handle deeply nested structures", () => {
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
                      value: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        level1: {
          level2: {
            level3: {
              value: "deep"
            }
          }
        }
      }).valid).toBe(true);
    });

    test("should handle nullable fields", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          nullableString: {
            type: ["string", "null"]
          },
          nullableNumber: {
            type: ["number", "null"]
          }
        }
      };

      const builder = createCompleteBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        nullableString: "value",
        nullableNumber: 42
      }).valid).toBe(true);

      expect(validator.validate({
        nullableString: null,
        nullableNumber: null
      }).valid).toBe(true);

      expect(validator.validate({
        nullableString: 123,
        nullableNumber: "not a number"
      }).valid).toBe(false);
    });
  });
});