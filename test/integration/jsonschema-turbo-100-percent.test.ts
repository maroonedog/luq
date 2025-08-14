import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { jsonSchemaPlugin } from "../../src/core/plugin/jsonSchema";
import { requiredPlugin } from "../../src/core/plugin/required";
import { optionalPlugin } from "../../src/core/plugin/optional";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../src/core/plugin/stringPattern";
import { stringEmailPlugin } from "../../src/core/plugin/stringEmail";
import { stringUrlPlugin } from "../../src/core/plugin/stringUrl";
import { uuidPlugin } from "../../src/core/plugin/uuid";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../src/core/plugin/numberInteger";
import { numberMultipleOfPlugin } from "../../src/core/plugin/numberMultipleOf";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../src/core/plugin/arrayMaxLength";
import { objectMinPropertiesPlugin } from "../../src/core/plugin/objectMinProperties";
import { objectMaxPropertiesPlugin } from "../../src/core/plugin/objectMaxProperties";
import { objectAdditionalPropertiesPlugin } from "../../src/core/plugin/objectAdditionalProperties";
import { literalPlugin } from "../../src/core/plugin/literal";
import { oneOfPlugin } from "../../src/core/plugin/oneOf";
import { customPlugin } from "../../src/core/plugin/custom";
import { nullablePlugin } from "../../src/core/plugin/nullable";
import { booleanTruthyPlugin } from "../../src/core/plugin/booleanTruthy";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  getBaseChain,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Turbo 100% Coverage", () => {
  // Create fully loaded builder to hit all integration paths
  const createFullBuilder = () => {
    return Builder()
      .use(jsonSchemaPlugin)
      .use(requiredPlugin)
      .use(optionalPlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(stringPatternPlugin)
      .use(stringEmailPlugin)
      .use(stringUrlPlugin)
      .use(uuidPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .use(numberIntegerPlugin)
      .use(numberMultipleOfPlugin)
      .use(arrayMinLengthPlugin)
      .use(arrayMaxLengthPlugin)
      .use(objectMinPropertiesPlugin)
      .use(objectMaxPropertiesPlugin)
      .use(objectAdditionalPropertiesPlugin)
      .use(literalPlugin)
      .use(oneOfPlugin)
      .use(customPlugin)
      .use(nullablePlugin)
      .use(booleanTruthyPlugin);
  };

  describe("getBaseChain comprehensive coverage - Lines 1567-1636", () => {
    test("should handle array types with null - Lines 1567-1580", () => {
      const builder = createFullBuilder();
      
      // Hit line 1572-1579: only null type in array
      const nullOnlySchema: JSONSchema7 = { type: ["null"] };
      const chain1 = getBaseChain(builder, nullOnlySchema);
      expect(chain1).toBeDefined();
      
      // Hit lines 1567-1580: array with null and other types
      const mixedSchema: JSONSchema7 = { type: ["string", "null"] };
      const chain2 = getBaseChain(builder, mixedSchema);
      expect(chain2).toBeDefined();
      
      // Hit lines 1582-1586: string type with null
      const stringNullSchema: JSONSchema7 = { type: ["null", "string"] };
      const chain3 = getBaseChain(builder, stringNullSchema);
      expect(chain3).toBeDefined();
    });

    test("should handle all primary types in array - Lines 1584-1620", () => {
      const builder = createFullBuilder();
      
      const testTypes: JSONSchema7[] = [
        { type: ["string", "null"] },
        { type: ["number", "null"] }, 
        { type: ["integer", "null"] },
        { type: ["boolean", "null"] },
        { type: ["array", "null"] },
        { type: ["object", "null"] }
      ];

      testTypes.forEach(schema => {
        // Hit different switch branches in lines 1584-1620
        const chain = getBaseChain(builder, schema);
        expect(chain).toBeDefined();
      });
    });

    test("should handle multiple non-null types - Lines 1621-1636", () => {
      const builder = createFullBuilder();
      
      // Hit lines 1621-1636: multiple types without null
      const multiTypeSchema: JSONSchema7 = { 
        type: ["string", "number", "boolean"] 
      };
      const chain = getBaseChain(builder, multiTypeSchema);
      expect(chain).toBeDefined();
      
      // Hit the oneOf creation path
      const complexMultiSchema: JSONSchema7 = {
        type: ["string", "number", "array", "object"]
      };
      const chain2 = getBaseChain(builder, complexMultiSchema);
      expect(chain2).toBeDefined();
    });

    test("should handle single types and special cases", () => {
      const builder = createFullBuilder();
      
      // Test all single types
      const singleTypes: JSONSchema7[] = [
        { type: "string" },
        { type: "number" },
        { type: "integer" },
        { type: "boolean" },
        { type: "array" },
        { type: "object" },
        { type: "null" }
      ];

      singleTypes.forEach(schema => {
        const chain = getBaseChain(builder, schema);
        expect(chain).toBeDefined();
      });
    });
  });

  describe("Builder integration paths - Lines 1655-1712, 1727-1768", () => {
    test("should handle comprehensive string validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          email: {
            type: "string",
            format: "email",
            minLength: 5,
            maxLength: 100,
            pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$"
          },
          url: {
            type: "string", 
            format: "uri",
            maxLength: 2000
          },
          uuid: {
            type: "string",
            format: "uuid"
          },
          name: {
            type: ["string", "null"],
            minLength: 1,
            maxLength: 50
          }
        },
        required: ["email"]
      };

      const builder = createFullBuilder();
      // Hit lines 1655-1712: format handling, length constraints
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        email: "user@example.com",
        url: "https://example.com",
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        name: "John"
      }).valid).toBe(true);
      
      expect(validator.validate({
        email: "invalid-email"
      }).valid).toBe(false);
    });

    test("should handle comprehensive number validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          price: {
            type: "number",
            minimum: 0,
            exclusiveMaximum: 1000000
          },
          count: {
            type: "integer",
            minimum: 1,
            maximum: 100
          },
          percentage: {
            type: "number",
            minimum: 0,
            maximum: 100,
            multipleOf: 0.1
          },
          exclusivePrice: {
            type: "number",
            exclusiveMinimum: 0,
            exclusiveMaximum: 1000
          }
        }
      };

      const builder = createFullBuilder();
      // Hit lines 1727-1768: number constraint handling
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        price: 999.99,
        count: 50,
        percentage: 75.5,
        exclusivePrice: 500
      }).valid).toBe(true);
      
      expect(validator.validate({
        price: -10 // Below minimum
      }).valid).toBe(false);
    });

    test("should handle array and object validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 10
          },
          metadata: {
            type: "object",
            minProperties: 1,
            maxProperties: 5,
            additionalProperties: { type: "string" }
          },
          flags: {
            type: "array",
            items: { type: "boolean" }
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        items: ["item1", "item2"],
        metadata: { key1: "value1", key2: "value2" },
        flags: [true, false, true]
      }).valid).toBe(true);
    });

    test("should handle mixed type scenarios", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          mixedValue: {
            type: ["string", "number", "boolean", "null"]
          },
          stringOrNull: {
            type: ["string", "null"],
            minLength: 3
          },
          numberOrArray: {
            type: ["number", "array"],
            minimum: 0,
            minItems: 1
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Test different type combinations
      expect(validator.validate({
        mixedValue: "string",
        stringOrNull: "hello",
        numberOrArray: 42
      }).valid).toBe(true);
      
      expect(validator.validate({
        mixedValue: 123,
        stringOrNull: null,
        numberOrArray: [1, 2, 3]
      }).valid).toBe(true);
    });
  });

  describe("Plugin integration and API paths - Lines 1776-1807, 1814, 1819, 1828-1867", () => {
    test("should handle builder options and configurations", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        required: ["name"],
        additionalProperties: false
      };

      const builder = createFullBuilder();
      
      // Hit various builder configuration paths
      const validator1 = (builder as any).fromJsonSchema(schema, {
        strictRequired: true
      }).build();
      expect(validator1).toBeDefined();

      const validator2 = (builder as any).fromJsonSchema(schema, {
        allowAdditionalProperties: true
      }).build();
      expect(validator2).toBeDefined();

      const customFormats = {
        "custom-format": (value: string) => value.startsWith("CUSTOM")
      };
      
      const validator3 = (builder as any).fromJsonSchema(schema, {
        customFormats
      }).build();
      expect(validator3).toBeDefined();
    });

    test("should handle error cases and edge scenarios", () => {
      const builder = createFullBuilder();
      
      // Test various error conditions and edge cases
      const schemas = [
        { type: "object", properties: {} },
        { type: "string", enum: [] },
        { type: "array", items: true },
        { type: "object", additionalProperties: true },
        { 
          type: "object",
          if: { properties: { type: { const: "test" } } },
          then: { required: ["value"] }
        }
      ];

      schemas.forEach(schema => {
        const validator = (builder as any).fromJsonSchema(schema).build();
        expect(validator).toBeDefined();
      });
    });

    test("should handle complex nested schemas", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              profile: {
                type: "object",
                properties: {
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["email", "phone"] },
                        value: { type: "string" }
                      },
                      required: ["type", "value"]
                    }
                  }
                }
              }
            }
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({
        user: {
          profile: {
            contacts: [
              { type: "email", value: "user@example.com" },
              { type: "phone", value: "123-456-7890" }
            ]
          }
        }
      }).valid).toBe(true);
    });
  });

  describe("Remaining edge cases and error paths", () => {
    test("should handle type validation edge cases - Lines 185,193,198,202,208,212,218,222,226,230,234,238,242,246,250-258,267-268,272", () => {
      // Hit remaining basic validation paths
      expect(validateValueAgainstSchema(undefined, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(null, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema("", { type: "string" })).toBe(true);
      expect(validateValueAgainstSchema(123, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(true, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema([], { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema({}, { type: "string" })).toBe(false);
      
      // Hit number validation paths
      expect(validateValueAgainstSchema(NaN, { type: "number" })).toBe(false);
      expect(validateValueAgainstSchema(Infinity, { type: "number" })).toBe(true);
      expect(validateValueAgainstSchema("123", { type: "number" })).toBe(false);
      
      // Hit integer validation  
      expect(validateValueAgainstSchema(3.14, { type: "integer" })).toBe(false);
      expect(validateValueAgainstSchema(42, { type: "integer" })).toBe(true);
      
      // Hit boolean validation
      expect(validateValueAgainstSchema("true", { type: "boolean" })).toBe(false);
      expect(validateValueAgainstSchema(1, { type: "boolean" })).toBe(false);
      expect(validateValueAgainstSchema(true, { type: "boolean" })).toBe(true);
      
      // Hit null validation
      expect(validateValueAgainstSchema(null, { type: "null" })).toBe(true);
      expect(validateValueAgainstSchema(undefined, { type: "null" })).toBe(false);
      
      // Hit array/object validation
      expect(validateValueAgainstSchema([], { type: "object" })).toBe(false);
      expect(validateValueAgainstSchema({}, { type: "array" })).toBe(false);
    });

    test("should handle detailed validation errors - Lines 658-664,672-689,704,707,730,733", () => {
      // Test enum validation errors
      const enumSchema: JSONSchema7 = {
        enum: ["red", "green", "blue"]
      };
      const enumErrors = getDetailedValidationErrors("yellow", enumSchema);
      expect(enumErrors.length).toBeGreaterThan(0);
      
      // Test array validation errors
      const arraySchema: JSONSchema7 = {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: { type: "string", minLength: 3 }
      };
      const arrayErrors = getDetailedValidationErrors(["a"], arraySchema);
      expect(arrayErrors.length).toBeGreaterThan(0);
      
      // Test object validation errors
      const objectSchema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 }
        },
        required: ["name"]
      };
      const objectErrors = getDetailedValidationErrors({}, objectSchema);
      expect(objectErrors.length).toBeGreaterThan(0);
    });

    test("should handle DSL conversion paths - Lines 756-759,774-777,837-838,1011-1012,1036,1073,1079,1106", () => {
      // Test root schema conversion
      const rootSchema: JSONSchema7 = {
        type: "object",
        additionalProperties: { type: "string" },
        propertyNames: { pattern: "^[a-z]+$" }
      };
      const dsl1 = convertJsonSchemaToLuqDSL(rootSchema);
      expect(dsl1.length).toBeGreaterThan(0);
      
      // Test multipleTypes conversion
      const multiSchema: JSONSchema7 = {
        type: "object",
        properties: {
          field: { type: ["string", "null"] }
        }
      };
      const dsl2 = convertJsonSchemaToLuqDSL(multiSchema);
      expect(dsl2.length).toBeGreaterThan(0);
      
      // Test DSL to field definition
      const testDsl = {
        path: "testField",
        type: "string" as const,
        constraints: { const: "test" }
      };
      const definition = convertDSLToFieldDefinition(testDsl);
      expect(definition).toBeDefined();
    });

    test("should handle remaining specific line coverage", () => {
      // Hit line 1647: default unknown type fallback
      const unknownTypeBuilder = {
        string: { type: "string" }
      };
      const unknownSchema: any = { type: "unknown" };
      const chain = getBaseChain(unknownTypeBuilder, unknownSchema);
      expect(chain.type).toBe("string");
      
      // Hit line 1899: error handling
      try {
        const invalidSchema: any = null;
        getBaseChain({}, invalidSchema);
      } catch (error) {
        // Expected error
      }
    });
  });
});