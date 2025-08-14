import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { jsonSchemaPlugin } from "../../../../src/core/plugin/jsonSchema";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { nullablePlugin } from "../../../../src/core/plugin/nullable";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { literalPlugin } from "../../../../src/core/plugin/literal";
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
import { objectPlugin } from "../../../../src/core/plugin/object";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
import { objectMinPropertiesPlugin } from "../../../../src/core/plugin/objectMinProperties";
import { objectMaxPropertiesPlugin } from "../../../../src/core/plugin/objectMaxProperties";
import { objectAdditionalPropertiesPlugin } from "../../../../src/core/plugin/objectAdditionalProperties";
import { dynamicPlugin } from "../../../../src/core/plugin/dynamic";
import { JSONSchema7 } from "json-schema";

describe("JSON Schema Draft-07 Compliance", () => {
  const createBuilder = () => {
    return Builder()
      .use(jsonSchemaPlugin)
      .use(requiredPlugin)
      .use(nullablePlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .use(literalPlugin)
      .use(oneOfPlugin)
      .use(objectPlugin)
      .use(objectMinPropertiesPlugin)
      .use(objectMaxPropertiesPlugin)
.use(objectAdditionalPropertiesPlugin)
      .use(arrayMinLengthPlugin)
      .use(arrayMaxLengthPlugin)
      .use(dynamicPlugin);
  };

  describe("Phase 1: null type support", () => {
    test("should handle null type", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          nullField: { type: "null" }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // null型の場合はnull値のみ有効
      expect(validator.validate({ nullField: null }).valid).toBe(true);
      expect(validator.validate({ nullField: "string" }).valid).toBe(false);
      expect(validator.validate({ nullField: 0 }).valid).toBe(false);
      expect(validator.validate({ nullField: undefined }).valid).toBe(false);
    });

    test("should handle multiple types with null (nullable)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          nullableString: { type: ["string", "null"] },
          nullableNumber: { type: ["number", "null"] },
          nullableBoolean: { type: ["boolean", "null"] }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // All null values should be valid
      expect(validator.validate({
        nullableString: null,
        nullableNumber: null,
        nullableBoolean: null
      }).valid).toBe(true);
      
      // Regular values should be valid
      expect(validator.validate({
        nullableString: "test",
        nullableNumber: 42,
        nullableBoolean: true
      }).valid).toBe(true);
      
      // Wrong types should be invalid
      expect(validator.validate({
        nullableString: 123,
        nullableNumber: "not a number",
        nullableBoolean: "not a boolean"
      }).valid).toBe(false);
    });

    test("should handle required nullable fields", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          requiredNullable: { type: ["string", "null"] }
        },
        required: ["requiredNullable"]
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ requiredNullable: "test" }).valid).toBe(true);
      expect(validator.validate({ requiredNullable: null }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(false); // Missing required field
    });
  });

  describe("Phase 1: exclusiveMinimum and exclusiveMaximum", () => {
    test("should handle exclusiveMinimum (Draft-07 style)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          score: {
            type: "number",
            exclusiveMinimum: 0
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ score: 0.1 }).valid).toBe(true);
      expect(validator.validate({ score: 1 }).valid).toBe(true);
      expect(validator.validate({ score: 0 }).valid).toBe(false); // Equal to exclusive minimum
      expect(validator.validate({ score: -0.1 }).valid).toBe(false);
    });

    test("should handle exclusiveMaximum (Draft-07 style)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          score: {
            type: "number",
            exclusiveMaximum: 100
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ score: 99.9 }).valid).toBe(true);
      expect(validator.validate({ score: 50 }).valid).toBe(true);
      expect(validator.validate({ score: 100 }).valid).toBe(false); // Equal to exclusive maximum
      expect(validator.validate({ score: 100.1 }).valid).toBe(false);
    });

    test("should handle both exclusiveMinimum and exclusiveMaximum", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          percentage: {
            type: "number",
            exclusiveMinimum: 0,
            exclusiveMaximum: 100
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ percentage: 50 }).valid).toBe(true);
      expect(validator.validate({ percentage: 0.1 }).valid).toBe(true);
      expect(validator.validate({ percentage: 99.9 }).valid).toBe(true);
      expect(validator.validate({ percentage: 0 }).valid).toBe(false);
      expect(validator.validate({ percentage: 100 }).valid).toBe(false);
    });

    test("should handle Draft-06 style exclusive boundaries", () => {
      const schema: any = {
        type: "object",
        properties: {
          temperature: {
            type: "number",
            minimum: -273.15,
            exclusiveMinimum: true,
            maximum: 1000,
            exclusiveMaximum: true
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ temperature: 0 }).valid).toBe(true);
      expect(validator.validate({ temperature: -273 }).valid).toBe(true);
      expect(validator.validate({ temperature: 999 }).valid).toBe(true);
      expect(validator.validate({ temperature: -273.15 }).valid).toBe(false);
      expect(validator.validate({ temperature: 1000 }).valid).toBe(false);
    });
  });

  describe("Phase 1: Object constraints", () => {
    test("should handle minProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            minProperties: 2
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ 
        metadata: { a: 1, b: 2 } 
      }).valid).toBe(true);
      
      expect(validator.validate({ 
        metadata: { a: 1, b: 2, c: 3 } 
      }).valid).toBe(true);
      
      expect(validator.validate({ 
        metadata: { a: 1 } 
      }).valid).toBe(false);
      
      expect(validator.validate({ 
        metadata: {} 
      }).valid).toBe(false);
    });

    test("should handle maxProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            maxProperties: 3
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ 
        metadata: { a: 1, b: 2 } 
      }).valid).toBe(true);
      
      expect(validator.validate({ 
        metadata: { a: 1, b: 2, c: 3 } 
      }).valid).toBe(true);
      
      expect(validator.validate({ 
        metadata: { a: 1, b: 2, c: 3, d: 4 } 
      }).valid).toBe(false);
    });

    test("should handle additionalProperties: false", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" }
            },
            additionalProperties: false
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ 
        user: { name: "John", age: 30 } 
      }).valid).toBe(true);
      
      // Now implemented: additionalProperties: false validation
      expect(validator.validate({ 
        user: { name: "John", age: 30, extra: "field" } 
      }).valid).toBe(false);
      
      expect(validator.validate({ 
        user: { name: "John", age: 30, role: "admin", status: "active" } 
      }).valid).toBe(false);
    });
    
    test("should handle additionalProperties with schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "number" }
            },
            additionalProperties: {
              type: "string",
              minLength: 1
            }
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid: additional properties are valid strings
      expect(validator.validate({ 
        config: { 
          name: "app", 
          version: 1, 
          description: "test app",
          category: "utility"
        } 
      }).valid).toBe(true);
      
      // Invalid: additional property is not a string
      expect(validator.validate({ 
        config: { 
          name: "app", 
          version: 1, 
          count: 123  // should be string
        } 
      }).valid).toBe(false);
      
      // Invalid: additional string property too short
      expect(validator.validate({ 
        config: { 
          name: "app", 
          version: 1, 
          tag: ""  // empty string, violates minLength: 1
        } 
      }).valid).toBe(false);
    });
  });

  describe("Complex scenarios", () => {
    test("should handle nullable with constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          optionalAge: {
            type: ["number", "null"],
            minimum: 0,
            maximum: 150
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ optionalAge: null }).valid).toBe(true);
      expect(validator.validate({ optionalAge: 30 }).valid).toBe(true);
      expect(validator.validate({ optionalAge: 0 }).valid).toBe(true);
      expect(validator.validate({ optionalAge: 150 }).valid).toBe(true);
      expect(validator.validate({ optionalAge: -1 }).valid).toBe(false);
      expect(validator.validate({ optionalAge: 151 }).valid).toBe(false);
    });

    test("should handle nullable with exclusive boundaries", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          nullableScore: {
            type: ["number", "null"],
            exclusiveMinimum: 0,
            exclusiveMaximum: 100
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ nullableScore: null }).valid).toBe(true);
      expect(validator.validate({ nullableScore: 50 }).valid).toBe(true);
      expect(validator.validate({ nullableScore: 0 }).valid).toBe(false);
      expect(validator.validate({ nullableScore: 100 }).valid).toBe(false);
    });

    test("should handle const with null", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          constantNull: { const: null },
          constantValue: { const: "fixed" }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ 
        constantNull: null,
        constantValue: "fixed"
      }).valid).toBe(true);
      
      expect(validator.validate({ 
        constantNull: "not null",
        constantValue: "fixed"
      }).valid).toBe(false);
      
      expect(validator.validate({ 
        constantNull: null,
        constantValue: "different"
      }).valid).toBe(false);
    });

    test("should handle enum with null", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          status: {
            type: ["string", "null"],
            enum: ["active", "inactive", "pending", null]
          }
        }
      };

      const builder = createBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      expect(validator.validate({ status: "active" }).valid).toBe(true);
      expect(validator.validate({ status: "inactive" }).valid).toBe(true);
      expect(validator.validate({ status: null }).valid).toBe(true);
      expect(validator.validate({ status: "unknown" }).valid).toBe(false);
    });
  });
});