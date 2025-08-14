import { Builder } from "../../../../src/core/builder/core/builder";
import { jsonSchemaPlugin } from "../../../../src/core/plugin/jsonSchema";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
import { customPlugin } from "../../../../src/core/plugin/custom";
import { literalPlugin } from "../../../../src/core/plugin/literal";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { anyPlugin } from "../../../../src/core/plugin/any";
import { JSONSchema7 } from "json-schema";

describe("JSON Schema Composition (allOf/anyOf/oneOf/not)", () => {
  const createBuilder = () => {
    return Builder()
      .use(jsonSchemaPlugin)
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .use(numberIntegerPlugin)
      .use(oneOfPlugin)
      .use(customPlugin)
      .use(literalPlugin)
      .use(stringPatternPlugin)
      .use(anyPlugin);
  };

  describe("allOf", () => {
    test("should validate when all schemas are satisfied", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: {
            allOf: [
              { type: "string", minLength: 3 },
              { type: "string", maxLength: 10 },
              { pattern: "^[a-z]+$" }
            ]
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ value: "hello" }).valid).toBe(true);
      expect(validator.validate({ value: "hi" }).valid).toBe(false); // Too short
      expect(validator.validate({ value: "verylongstring" }).valid).toBe(false); // Too long
      expect(validator.validate({ value: "Hello" }).valid).toBe(false); // Capital letter
    });

    test("should handle multiple type constraints with allOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          age: {
            allOf: [
              { type: "number", minimum: 0 },
              { type: "number", maximum: 120 },
              { type: "integer" }
            ]
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ age: 25 }).valid).toBe(true);
      expect(validator.validate({ age: 25.5 }).valid).toBe(false); // Not integer
      expect(validator.validate({ age: -5 }).valid).toBe(false); // Below minimum
      expect(validator.validate({ age: 150 }).valid).toBe(false); // Above maximum
    });
  });

  describe("anyOf", () => {
    test("should validate when at least one schema is satisfied", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          contact: {
            anyOf: [
              { type: "string", pattern: "^\\d{10}$" }, // Phone number
              { type: "string", pattern: "^[\\w.]+@[\\w.]+$" } // Email
            ]
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ contact: "1234567890" }).valid).toBe(true); // Valid phone
      expect(validator.validate({ contact: "user@example.com" }).valid).toBe(true); // Valid email
      expect(validator.validate({ contact: "invalid" }).valid).toBe(false); // Neither
    });

    test("should handle mixed types with anyOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: {
            anyOf: [
              { type: "string", minLength: 5 },
              { type: "number", minimum: 1000 }
            ]
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ id: "ABC123" }).valid).toBe(true); // Valid string
      expect(validator.validate({ id: 2000 }).valid).toBe(true); // Valid number
      expect(validator.validate({ id: "AB" }).valid).toBe(false); // String too short
      expect(validator.validate({ id: 500 }).valid).toBe(false); // Number too small
    });
  });

  describe("oneOf", () => {
    test("should validate when exactly one schema is satisfied", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: {
            oneOf: [
              { type: "string", minLength: 5 },
              { type: "string", maxLength: 3 }
            ]
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ value: "hi" }).valid).toBe(true); // Only matches maxLength: 3
      expect(validator.validate({ value: "hello" }).valid).toBe(true); // Only matches minLength: 5
      expect(validator.validate({ value: "abc" }).valid).toBe(true); // Only matches maxLength: 3 (not minLength: 5)
      expect(validator.validate({ value: "abcd" }).valid).toBe(false); // Matches neither
    });

    test("should handle type discrimination with oneOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          data: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" }
            ]
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ data: "text" }).valid).toBe(true);
      expect(validator.validate({ data: 123 }).valid).toBe(true);
      expect(validator.validate({ data: true }).valid).toBe(true);
      expect(validator.validate({ data: null }).valid).toBe(false); // Not one of the types
      expect(validator.validate({ data: [] }).valid).toBe(false); // Not one of the types
    });
  });

  describe("not", () => {
    test("should validate when schema is NOT satisfied", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: {
            not: {
              type: "string",
              pattern: "^admin"
            }
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ value: "user123" }).valid).toBe(true);
      expect(validator.validate({ value: 12345 }).valid).toBe(true);
      expect(validator.validate({ value: "admin123" }).valid).toBe(false); // Matches the NOT pattern
      expect(validator.validate({ value: "administrator" }).valid).toBe(false); // Matches the NOT pattern
    });

    test("should handle complex not conditions", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          score: {
            not: {
              allOf: [
                { type: "number", minimum: 0 },
                { type: "number", maximum: 100 }
              ]
            }
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ score: -10 }).valid).toBe(true); // Outside range
      expect(validator.validate({ score: 150 }).valid).toBe(true); // Outside range
      expect(validator.validate({ score: 50 }).valid).toBe(false); // Inside range (0-100)
      expect(validator.validate({ score: "N/A" }).valid).toBe(true); // Different type
    });
  });

  describe("Combined composition", () => {
    test("should handle nested composition schemas", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          status: {
            allOf: [
              {
                oneOf: [
                  { const: "active" },
                  { const: "pending" },
                  { const: "inactive" }
                ]
              },
              {
                not: {
                  const: "deleted"
                }
              }
            ]
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ status: "active" }).valid).toBe(true);
      expect(validator.validate({ status: "pending" }).valid).toBe(true);
      expect(validator.validate({ status: "inactive" }).valid).toBe(true);
      expect(validator.validate({ status: "deleted" }).valid).toBe(false);
      expect(validator.validate({ status: "unknown" }).valid).toBe(false);
    });
  });
});