import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { 
  jsonSchemaPlugin,
  validateValueAgainstSchema,
  resolveRef,
  getDetailedValidationErrors,
  getSpecificValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  convertJsonSchemaToFieldDefinition,
  getBaseChain,
  applyConstraints
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

// Import all required plugins
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
import { arrayUniquePlugin } from "../../src/core/plugin/arrayUnique";
import { oneOfPlugin } from "../../src/core/plugin/oneOf";
import { literalPlugin } from "../../src/core/plugin/literal";
import { customPlugin } from "../../src/core/plugin/custom";
import { nullablePlugin } from "../../src/core/plugin/nullable";
import { requiredIfPlugin } from "../../src/core/plugin/requiredIf";
import { tupleBuilderPlugin } from "../../src/core/plugin/tupleBuilder";
import { objectMinPropertiesPlugin } from "../../src/core/plugin/objectMinProperties";
import { objectMaxPropertiesPlugin } from "../../src/core/plugin/objectMaxProperties";
import { objectAdditionalPropertiesPlugin } from "../../src/core/plugin/objectAdditionalProperties";
import { objectPropertyNamesPlugin } from "../../src/core/plugin/objectPropertyNames";
import { objectPatternPropertiesPlugin } from "../../src/core/plugin/objectPatternProperties";
import { objectDependentRequiredPlugin } from "../../src/core/plugin/objectDependentRequired";
import { objectDependentSchemasPlugin } from "../../src/core/plugin/objectDependentSchemas";

describe("JsonSchema Plugin - Final 100% Coverage", () => {
  // Helper to create a fully-configured builder
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
      .use(arrayUniquePlugin)
      .use(objectMinPropertiesPlugin)
      .use(objectMaxPropertiesPlugin)
      .use(objectAdditionalPropertiesPlugin)
      .use(objectPropertyNamesPlugin)
      .use(objectPatternPropertiesPlugin)
      .use(objectDependentRequiredPlugin)
      .use(objectDependentSchemasPlugin)
      .use(oneOfPlugin)
      .use(literalPlugin)
      .use(customPlugin)
      .use(nullablePlugin)
      .use(requiredIfPlugin)
      .use(tupleBuilderPlugin);
  };

  describe("exclusiveMinimum/Maximum as boolean (draft-04 compatibility)", () => {
    test("should handle exclusiveMinimum as boolean true", () => {
      const schema: any = {
        type: "number",
        minimum: 10,
        exclusiveMinimum: true
      };
      
      // Line 302: if (value <= schema.minimum) return false;
      expect(validateValueAgainstSchema(10.1, schema)).toBe(true);
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
      expect(validateValueAgainstSchema(9.9, schema)).toBe(false);
    });

    test("should handle exclusiveMaximum as boolean true", () => {
      const schema: any = {
        type: "number",
        maximum: 100,
        exclusiveMaximum: true
      };
      
      // Line 320: if (value >= schema.maximum) return false;
      expect(validateValueAgainstSchema(99.9, schema)).toBe(true);
      expect(validateValueAgainstSchema(100, schema)).toBe(false);
      expect(validateValueAgainstSchema(100.1, schema)).toBe(false);
    });
  });

  describe("getDetailedValidationErrors - complete coverage", () => {
    test("should handle if/then validation with required fields", () => {
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
      
      const result = getDetailedValidationErrors(
        { type: "special", value: "test" },
        schema
      );
      
      expect(result.length).toBeGreaterThan(0);
      // Check for required field error in conditional context
      const hasRequiredError = result.some(e => 
        e.path.includes("extra") && 
        (e.code === "REQUIRED_IF" || e.message.includes("required"))
      );
      expect(hasRequiredError).toBe(true);
    });

    test("should handle if/else validation", () => {
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
      
      const result = getDetailedValidationErrors(
        { type: "string", value: "hi" },
        schema
      );
      
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Complex array validation", () => {
    test("should validate tuple arrays correctly", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          coords: {
            type: "array",
            items: [
              { type: "number" },
              { type: "number" },
              { type: "string" }
            ],
            additionalItems: false
          }
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid tuple
      expect(validator.validate({
        coords: [10, 20, "label"]
      }).valid).toBe(true);
      
      // Invalid: wrong type in tuple
      expect(validator.validate({
        coords: ["10", 20, "label"]
      }).valid).toBe(false);
      
      // Invalid: extra items when additionalItems is false
      expect(validator.validate({
        coords: [10, 20, "label", "extra"]
      }).valid).toBe(false);
    });

    test("should handle array contains constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          numbers: {
            type: "array",
            contains: {
              type: "number",
              minimum: 100
            }
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const numbersDsl = dsl.find(d => d.path === "numbers");
      expect(numbersDsl?.constraints?.contains).toBeDefined();
    });
  });

  describe("Object validation features", () => {
    test("should handle propertyNames with enum", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          enum: ["name", "age", "email"]
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid: all property names in enum
      expect(validator.validate({
        name: "John",
        age: 30
      }).valid).toBe(true);
      
      // Invalid: property name not in enum
      expect(validator.validate({
        name: "John",
        unknown: "value"
      }).valid).toBe(false);
    });

    test("should handle patternProperties correctly", () => {
      const schema: JSONSchema7 = {
        type: "object",
        patternProperties: {
          "^str_": { type: "string" },
          "^num_": { type: "number" },
          "^bool_": { type: "boolean" }
        },
        additionalProperties: false
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid
      expect(validator.validate({
        str_name: "value",
        num_count: 42,
        bool_active: true
      }).valid).toBe(true);
      
      // Invalid: wrong type for pattern
      expect(validator.validate({
        str_name: 123
      }).valid).toBe(false);
      
      // Invalid: property doesn't match any pattern
      expect(validator.validate({
        unknown: "value"
      }).valid).toBe(false);
    });

    test("should handle dependencies correctly", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          creditCard: { type: "string" },
          billingAddress: { type: "string" },
          cvv: { type: "string" }
        },
        dependencies: {
          creditCard: ["billingAddress", "cvv"]
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid: has creditCard and all dependencies
      expect(validator.validate({
        creditCard: "1234-5678",
        billingAddress: "123 Main St",
        cvv: "123"
      }).valid).toBe(true);
      
      // Valid: no creditCard, so dependencies don't apply
      expect(validator.validate({
        name: "John"
      }).valid).toBe(true);
      
      // Invalid: has creditCard but missing dependencies
      expect(validator.validate({
        creditCard: "1234-5678"
      }).valid).toBe(false);
    });

    test("should handle dependencies as schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        dependencies: {
          name: {
            properties: {
              age: { type: "number", minimum: 18 }
            },
            required: ["age"]
          }
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid: has name and valid age
      expect(validator.validate({
        name: "John",
        age: 25
      }).valid).toBe(true);
      
      // Invalid: has name but age too young
      expect(validator.validate({
        name: "John",
        age: 10
      }).valid).toBe(false);
      
      // Invalid: has name but missing age
      expect(validator.validate({
        name: "John"
      }).valid).toBe(false);
    });
  });

  describe("Schema composition - complete", () => {
    test("should validate complex allOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: {
            allOf: [
              { type: "string" },
              { minLength: 5 },
              { maxLength: 10 },
              { pattern: "^[a-z]+$" }
            ]
          }
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid
      expect(validator.validate({
        value: "hello"
      }).valid).toBe(true);
      
      // Invalid: too short
      expect(validator.validate({
        value: "hi"
      }).valid).toBe(false);
      
      // Invalid: contains uppercase
      expect(validator.validate({
        value: "Hello"
      }).valid).toBe(false);
    });

    test("should validate nested anyOf/oneOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            anyOf: [
              {
                allOf: [
                  { type: "string" },
                  { minLength: 10 }
                ]
              },
              {
                allOf: [
                  { type: "number" },
                  { minimum: 100 }
                ]
              }
            ]
          }
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid string
      expect(validator.validate({
        field: "long string here"
      }).valid).toBe(true);
      
      // Valid number
      expect(validator.validate({
        field: 150
      }).valid).toBe(true);
      
      // Invalid: string too short
      expect(validator.validate({
        field: "short"
      }).valid).toBe(false);
      
      // Invalid: number too small
      expect(validator.validate({
        field: 50
      }).valid).toBe(false);
    });

    test("should validate not schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          notString: {
            not: { type: "string" }
          },
          notPattern: {
            not: {
              type: "string",
              pattern: "^test"
            }
          }
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid: not a string
      expect(validator.validate({
        notString: 123,
        notPattern: "hello"
      }).valid).toBe(true);
      
      // Invalid: is a string
      expect(validator.validate({
        notString: "text"
      }).valid).toBe(false);
      
      // Invalid: matches the not pattern
      expect(validator.validate({
        notPattern: "test123"
      }).valid).toBe(false);
    });
  });

  describe("Custom formats and refinements", () => {
    test("should handle multiple custom formats", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          ssn: { type: "string", format: "ssn" },
          phone: { type: "string", format: "phone" },
          postalCode: { type: "string", format: "postal-code" }
        }
      };
      
      const customFormats = {
        ssn: (v: string) => /^\d{3}-\d{2}-\d{4}$/.test(v),
        phone: (v: string) => /^\(\d{3}\) \d{3}-\d{4}$/.test(v),
        "postal-code": (v: string) => /^\d{5}(-\d{4})?$/.test(v)
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema, { customFormats }).build();
      
      // Valid
      expect(validator.validate({
        ssn: "123-45-6789",
        phone: "(555) 123-4567",
        postalCode: "12345"
      }).valid).toBe(true);
      
      // Valid with extended postal code
      expect(validator.validate({
        postalCode: "12345-6789"
      }).valid).toBe(true);
      
      // Invalid formats
      expect(validator.validate({
        ssn: "123456789"
      }).valid).toBe(false);
      
      expect(validator.validate({
        phone: "555-123-4567"
      }).valid).toBe(false);
    });
  });

  describe("Builder options and configuration", () => {
    test("should handle strictRequired option", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        required: ["name"]
      };
      
      const builder = createFullBuilder();
      
      // With strictRequired: true
      const strictValidator = (builder as any).fromJsonSchema(schema, {
        strictRequired: true
      }).build();
      
      // Should require the field
      expect(strictValidator.validate({}).valid).toBe(false);
      expect(strictValidator.validate({ name: "John" }).valid).toBe(true);
      
      // With strictRequired: false
      const lenientValidator = (builder as any).fromJsonSchema(schema, {
        strictRequired: false
      }).build();
      
      // Should be more lenient
      expect(lenientValidator.validate({}).valid).toBe(false); // Still requires 'name'
      expect(lenientValidator.validate({ name: "" }).valid).toBe(false); // Empty string not valid
    });

    test("should handle allowAdditionalProperties option", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        }
      };
      
      const builder = createFullBuilder();
      
      // Default: allows additional properties
      const defaultValidator = (builder as any).fromJsonSchema(schema).build();
      expect(defaultValidator.validate({
        name: "John",
        extra: "allowed"
      }).valid).toBe(true);
      
      // With allowAdditionalProperties: false
      const strictValidator = (builder as any).fromJsonSchema(schema, {
        allowAdditionalProperties: false
      }).build();
      
      expect(strictValidator.validate({
        name: "John",
        extra: "not allowed"
      }).valid).toBe(false);
    });
  });

  describe("Special edge cases", () => {
    test("should handle circular references gracefully", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          parent: { $ref: "#" }
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid: simple case
      expect(validator.validate({
        name: "Item"
      }).valid).toBe(true);
      
      // Valid: one level of nesting
      expect(validator.validate({
        name: "Parent",
        parent: {
          name: "GrandParent"
        }
      }).valid).toBe(true);
    });

    test("should handle empty arrays and objects", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          emptyArray: {
            type: "array",
            maxItems: 0
          },
          emptyObject: {
            type: "object",
            maxProperties: 0
          }
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid
      expect(validator.validate({
        emptyArray: [],
        emptyObject: {}
      }).valid).toBe(true);
      
      // Invalid
      expect(validator.validate({
        emptyArray: [1]
      }).valid).toBe(false);
      
      expect(validator.validate({
        emptyObject: { key: "value" }
      }).valid).toBe(false);
    });

    test("should handle root schema with additionalProperties and properties", () => {
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

    test("should handle mixed validation contexts", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          data: {
            oneOf: [
              { type: "string", minLength: 5 },
              { type: "number", minimum: 10 },
              { type: "array", minItems: 2 },
              { type: "object", minProperties: 1 }
            ]
          }
        }
      };
      
      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid cases
      expect(validator.validate({ data: "hello" }).valid).toBe(true);
      expect(validator.validate({ data: 15 }).valid).toBe(true);
      expect(validator.validate({ data: [1, 2] }).valid).toBe(true);
      expect(validator.validate({ data: { key: "value" } }).valid).toBe(true);
      
      // Invalid cases
      expect(validator.validate({ data: "hi" }).valid).toBe(false);
      expect(validator.validate({ data: 5 }).valid).toBe(false);
      expect(validator.validate({ data: [1] }).valid).toBe(false);
      expect(validator.validate({ data: {} }).valid).toBe(false);
    });
  });
});
