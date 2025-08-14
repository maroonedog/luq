import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { jsonSchemaPlugin, convertJsonSchemaToLuqDSL, resolveRef } from "../../../../src/core/plugin/jsonSchema";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { stringEmailPlugin } from "../../../../src/core/plugin/stringEmail";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { literalPlugin } from "../../../../src/core/plugin/literal";
import { customPlugin } from "../../../../src/core/plugin/custom";
import { tupleBuilderPlugin } from "../../../../src/core/plugin/tupleBuilder";
import { nullablePlugin } from "../../../../src/core/plugin/nullable";
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Advanced Features", () => {
  const createAdvancedBuilder = () => {
    return Builder()
      .use(jsonSchemaPlugin)
      .use(requiredPlugin)
      .use(optionalPlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(stringEmailPlugin)
      .use(stringPatternPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .use(numberIntegerPlugin)
      .use(literalPlugin)
      .use(customPlugin)
      .use(tupleBuilderPlugin)
      .use(nullablePlugin)
      .use(oneOfPlugin);
  };

  describe("convertJsonSchemaToLuqDSL function", () => {
    test("should convert simple object to DSL", () => {
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
      
      // Should generate nested paths
      const paths = dsl.map(d => d.path);
      expect(paths).toContain("user");
      expect(paths).toContain("user.profile");
      expect(paths).toContain("user.profile.name");
    });

    test("should handle array items", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string", minLength: 2 }
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl).toHaveLength(1);
      expect(dsl[0]).toMatchObject({
        path: "tags",
        type: "array",
        constraints: {
          items: { type: "string", minLength: 2 }
        }
      });
    });

    test("should handle with parent path", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: { type: "string" }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema, "parent");
      
      expect(dsl[0].path).toBe("parent.field");
    });

    test("should handle enum constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          status: {
            enum: ["active", "inactive", "pending"]
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl[0]).toMatchObject({
        path: "status",
        constraints: {
          enum: ["active", "inactive", "pending"]
        }
      });
    });

    test("should handle const constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          version: {
            const: "1.0.0"
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl[0]).toMatchObject({
        path: "version",
        constraints: {
          const: "1.0.0"
        }
      });
    });

    test("should handle multiple types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          mixed: {
            type: ["string", "number", "null"]
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl[0]).toMatchObject({
        path: "mixed",
        multipleTypes: ["string", "number", "null"]
      });
    });

    test("should handle integer type", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          count: {
            type: "integer"
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      
      expect(dsl[0]).toMatchObject({
        path: "count",
        type: "number",
        constraints: {
          integer: true
        }
      });
    });
  });

  describe("resolveRef function", () => {
    test("should resolve simple reference", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          address: {
            type: "object",
            properties: {
              city: { type: "string" }
            }
          }
        }
      };

      const resolved = resolveRef("#/definitions/address", rootSchema);
      
      expect(resolved).toEqual({
        type: "object",
        properties: {
          city: { type: "string" }
        }
      });
    });

    test("should throw error for external references", () => {
      const rootSchema: JSONSchema7 = {};
      
      expect(() => {
        resolveRef("http://example.com/schema", rootSchema);
      }).toThrow("External $ref not supported");
    });

    test("should throw error for unresolvable references", () => {
      const rootSchema: JSONSchema7 = {};
      
      expect(() => {
        resolveRef("#/definitions/nonexistent", rootSchema);
      }).toThrow("Cannot resolve $ref");
    });
  });

  describe("Schema Composition", () => {
    test("should handle allOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            allOf: [
              { type: "string" },
              { minLength: 5 },
              { maxLength: 10 }
            ]
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ field: "hello" }).valid).toBe(true);
      expect(validator.validate({ field: "hi" }).valid).toBe(false); // Too short
      expect(validator.validate({ field: "hello world!" }).valid).toBe(false); // Too long
    });

    test("should handle anyOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: {
            anyOf: [
              { type: "string", minLength: 5 },
              { type: "number", minimum: 10 }
            ]
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ value: "hello" }).valid).toBe(true);
      expect(validator.validate({ value: 15 }).valid).toBe(true);
      expect(validator.validate({ value: "hi" }).valid).toBe(false);
      expect(validator.validate({ value: 5 }).valid).toBe(false);
    });

    test("should handle not", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          notString: {
            not: { type: "string" }
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ notString: 123 }).valid).toBe(true);
      expect(validator.validate({ notString: true }).valid).toBe(true);
      expect(validator.validate({ notString: "string" }).valid).toBe(false);
    });
  });

  describe("Conditional Schemas", () => {
    test("should handle if/then/else", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: { type: "string" }
        },
        if: {
          properties: {
            type: { const: "email" }
          }
        },
        then: {
          properties: {
            value: { format: "email" }
          }
        },
        else: {
          properties: {
            value: { minLength: 1 }
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // When type is "email", value must be email format
      expect(validator.validate({
        type: "email",
        value: "test@example.com"
      }).valid).toBe(true);

      expect(validator.validate({
        type: "email",
        value: "not-an-email"
      }).valid).toBe(false);

      // When type is not "email", value just needs minLength 1
      expect(validator.validate({
        type: "other",
        value: "x"
      }).valid).toBe(true);
    });
  });

  describe("String Formats", () => {
    test("should handle date format", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          date: {
            type: "string",
            format: "date"
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ date: "2024-01-15" }).valid).toBe(true);
      expect(validator.validate({ date: "2024-13-01" }).valid).toBe(false); // Invalid month
      expect(validator.validate({ date: "not-a-date" }).valid).toBe(false);
    });

    test("should handle time format", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          time: {
            type: "string",
            format: "time"
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ time: "10:30:00" }).valid).toBe(true);
      expect(validator.validate({ time: "10:30:00Z" }).valid).toBe(true);
      expect(validator.validate({ time: "25:00:00" }).valid).toBe(false); // Invalid hour
    });

    test("should handle IPv4 format", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          ip: {
            type: "string",
            format: "ipv4"
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ ip: "192.168.1.1" }).valid).toBe(true);
      expect(validator.validate({ ip: "256.256.256.256" }).valid).toBe(false); // Out of range
      expect(validator.validate({ ip: "not-an-ip" }).valid).toBe(false);
    });

    test("should handle IPv6 format", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          ip: {
            type: "string",
            format: "ipv6"
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334" }).valid).toBe(true);
      expect(validator.validate({ ip: "::1" }).valid).toBe(true);
      expect(validator.validate({ ip: "not-an-ipv6" }).valid).toBe(false);
    });
  });

  describe("Exclusive Min/Max", () => {
    test("should handle exclusiveMinimum and exclusiveMaximum", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          exclusive: {
            type: "number",
            exclusiveMinimum: 0,
            exclusiveMaximum: 10
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ exclusive: 5 }).valid).toBe(true);
      expect(validator.validate({ exclusive: 0 }).valid).toBe(false); // Equal to exclusive min
      expect(validator.validate({ exclusive: 10 }).valid).toBe(false); // Equal to exclusive max
      expect(validator.validate({ exclusive: 0.1 }).valid).toBe(true);
      expect(validator.validate({ exclusive: 9.9 }).valid).toBe(true);
    });
  });

  describe("Array Contains", () => {
    test("should handle contains constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            contains: {
              type: "number",
              minimum: 10
            }
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // At least one item must match contains schema
      expect(validator.validate({ items: [5, 15, 8] }).valid).toBe(true); // 15 matches
      expect(validator.validate({ items: [1, 2, 3] }).valid).toBe(false); // None match
    });
  });

  describe("Object Property Constraints", () => {
    test("should handle minProperties and maxProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          config: {
            type: "object",
            minProperties: 2,
            maxProperties: 5
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        config: { a: 1, b: 2, c: 3 }
      }).valid).toBe(true);

      expect(validator.validate({
        config: { a: 1 }
      }).valid).toBe(false); // Too few properties

      expect(validator.validate({
        config: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }
      }).valid).toBe(false); // Too many properties
    });

    test("should handle patternProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          settings: {
            type: "object",
            patternProperties: {
              "^env_": { type: "string" },
              "^num_": { type: "number" }
            }
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        settings: {
          env_var: "value",
          num_count: 42
        }
      }).valid).toBe(true);

      expect(validator.validate({
        settings: {
          env_var: 123 // Wrong type for env_ pattern
        }
      }).valid).toBe(false);
    });

    test("should handle dependentRequired", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          form: {
            type: "object",
            properties: {
              creditCard: { type: "string" },
              cardNumber: { type: "string" },
              cvv: { type: "string" }
            },
            dependentRequired: {
              creditCard: ["cardNumber", "cvv"]
            }
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // If creditCard is present, cardNumber and cvv are required
      expect(validator.validate({
        form: {
          creditCard: "yes",
          cardNumber: "1234",
          cvv: "123"
        }
      }).valid).toBe(true);

      expect(validator.validate({
        form: {
          creditCard: "yes"
          // Missing required dependent fields
        }
      }).valid).toBe(false);

      // If creditCard is not present, dependent fields are not required
      expect(validator.validate({
        form: {}
      }).valid).toBe(true);
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid schema gracefully", () => {
      const builder = createAdvancedBuilder();
      
      // Schema without type or properties
      const invalidSchema: any = {
        invalidField: "value"
      };

      expect(() => {
        (builder as any).fromJsonSchema(invalidSchema);
      }).not.toThrow();
    });

    test("should handle circular references", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          node: {
            type: "object",
            properties: {
              value: { type: "string" },
              next: { $ref: "#/properties/node" }
            }
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        node: {
          value: "first",
          next: {
            value: "second",
            next: {
              value: "third"
            }
          }
        }
      }).valid).toBe(true);
    });
  });

  describe("Default Values", () => {
    test("should handle default values in schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          withDefault: {
            type: "string",
            default: "defaultValue"
          }
        }
      };

      const builder = createAdvancedBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Note: default values are typically applied during parsing, not validation
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ withDefault: "custom" }).valid).toBe(true);
    });
  });
});