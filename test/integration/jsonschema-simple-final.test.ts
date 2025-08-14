import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  resolveRef
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Simple Final Coverage", () => {
  describe("Core validation paths", () => {
    test("should handle boolean exclusiveMinimum", () => {
      const schema: any = {
        type: "number",
        minimum: 10,
        exclusiveMinimum: true
      };
      
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
      expect(validateValueAgainstSchema(11, schema)).toBe(true);
    });

    test("should handle boolean exclusiveMaximum", () => {
      const schema: any = {
        type: "number", 
        maximum: 100,
        exclusiveMaximum: true
      };
      
      expect(validateValueAgainstSchema(100, schema)).toBe(false);
      expect(validateValueAgainstSchema(99, schema)).toBe(true);
    });

    test("should handle number exclusiveMinimum", () => {
      const schema: JSONSchema7 = {
        type: "number",
        exclusiveMinimum: 10
      };
      
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
      expect(validateValueAgainstSchema(11, schema)).toBe(true);
    });

    test("should handle number exclusiveMaximum", () => {
      const schema: JSONSchema7 = {
        type: "number",
        exclusiveMaximum: 100
      };
      
      expect(validateValueAgainstSchema(100, schema)).toBe(false);
      expect(validateValueAgainstSchema(99, schema)).toBe(true);
    });

    test("should handle multipleOf", () => {
      const schema: JSONSchema7 = {
        type: "number",
        multipleOf: 3
      };
      
      expect(validateValueAgainstSchema(9, schema)).toBe(true);
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
    });

    test("should handle integer type", () => {
      const schema: JSONSchema7 = { type: "integer" };
      
      expect(validateValueAgainstSchema(42, schema)).toBe(true);
      expect(validateValueAgainstSchema(3.14, schema)).toBe(false);
    });

    test("should handle NaN", () => {
      const schema: JSONSchema7 = { type: "number" };
      
      expect(validateValueAgainstSchema(NaN, schema)).toBe(false);
      expect(validateValueAgainstSchema(42, schema)).toBe(true);
    });
  });

  describe("Object validation", () => {
    test("should handle minProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        minProperties: 2
      };
      
      expect(validateValueAgainstSchema({}, schema)).toBe(false);
      expect(validateValueAgainstSchema({a: 1}, schema)).toBe(false);
      expect(validateValueAgainstSchema({a: 1, b: 2}, schema)).toBe(true);
    });

    test("should handle maxProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        maxProperties: 2
      };
      
      expect(validateValueAgainstSchema({a: 1, b: 2, c: 3}, schema)).toBe(false);
      expect(validateValueAgainstSchema({a: 1, b: 2}, schema)).toBe(true);
    });

    test("should handle property validation failure", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 5 }
        }
      };
      
      expect(validateValueAgainstSchema({name: "hi"}, schema)).toBe(false);
      expect(validateValueAgainstSchema({name: "hello"}, schema)).toBe(true);
    });

    test("should handle additionalProperties false", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: false
      };
      
      expect(validateValueAgainstSchema({name: "John", extra: "value"}, schema)).toBe(false);
      expect(validateValueAgainstSchema({name: "John"}, schema)).toBe(true);
    });
  });

  describe("Array validation", () => {
    test("should handle uniqueItems", () => {
      const schema: JSONSchema7 = {
        type: "array",
        uniqueItems: true
      };
      
      expect(validateValueAgainstSchema([1, 2, 1], schema)).toBe(false);
      expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(true);
    });
  });

  describe("Schema composition", () => {
    test("should handle allOf failure", () => {
      const schema: JSONSchema7 = {
        allOf: [
          { type: "string", minLength: 10 },
          { type: "string", maxLength: 5 }
        ]
      };
      
      expect(validateValueAgainstSchema("test", schema)).toBe(false);
    });

    test("should handle anyOf failure", () => {
      const schema: JSONSchema7 = {
        anyOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      expect(validateValueAgainstSchema("short", schema)).toBe(false);
      expect(validateValueAgainstSchema(50, schema)).toBe(false);
      expect(validateValueAgainstSchema("very long string", schema)).toBe(true);
    });

    test("should handle oneOf multiple matches", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", minLength: 1 },
          { type: "string", maxLength: 10 }
        ]
      };
      
      expect(validateValueAgainstSchema("hello", schema)).toBe(false);
    });

    test("should handle oneOf no matches", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      expect(validateValueAgainstSchema("short", schema)).toBe(false);
    });

    test("should handle not schema", () => {
      const schema: JSONSchema7 = {
        not: { type: "string" }
      };
      
      expect(validateValueAgainstSchema("string", schema)).toBe(false);
      expect(validateValueAgainstSchema(123, schema)).toBe(true);
    });
  });

  describe("Format validation", () => {
    test("should handle format failures", () => {
      const formats: Array<{format: string, invalid: string}> = [
        { format: "email", invalid: "not-email" },
        { format: "uri", invalid: "not uri" },
        { format: "uuid", invalid: "not-uuid" },
        { format: "date", invalid: "not-date" },
        { format: "date-time", invalid: "not-datetime" },
        { format: "time", invalid: "25:00:00" },
        { format: "duration", invalid: "not-duration" },
        { format: "ipv4", invalid: "300.300.300.300" },
        { format: "ipv6", invalid: "not-ipv6" },
        { format: "hostname", invalid: "-invalid" },
        { format: "json-pointer", invalid: "no-slash" },
        { format: "relative-json-pointer", invalid: "/absolute" },
        { format: "iri", invalid: "not iri" },
        { format: "uri-template", invalid: "/users/{unclosed" }
      ];

      formats.forEach(({ format, invalid }) => {
        const schema: JSONSchema7 = { type: "string", format };
        expect(validateValueAgainstSchema(invalid, schema)).toBe(false);
      });
    });
  });

  describe("$ref resolution", () => {
    test("should resolve references", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          stringType: { type: "string", minLength: 3 }
        }
      };
      
      const schema: JSONSchema7 = { $ref: "#/definitions/stringType" };
      
      expect(validateValueAgainstSchema("hello", schema, undefined, rootSchema)).toBe(true);
      expect(validateValueAgainstSchema("hi", schema, undefined, rootSchema)).toBe(false);
    });

    test("should handle $defs references", () => {
      const rootSchema: JSONSchema7 = {
        $defs: {
          user: { type: "string" }
        }
      };

      const resolved = resolveRef("#/$defs/user", rootSchema);
      expect(resolved).toEqual({ type: "string" });
    });

    test("should throw for external references", () => {
      expect(() => {
        resolveRef("http://external.com/schema", {});
      }).toThrow("External $ref not supported");
    });

    test("should throw for unresolvable references", () => {
      expect(() => {
        resolveRef("#/definitions/nonexistent", {});
      }).toThrow("Cannot resolve $ref");
    });
  });

  describe("Error generation basic cases", () => {
    test("should generate basic validation errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 5 },
          age: { type: "number", minimum: 18 }
        },
        required: ["name"]
      };

      const errors = getDetailedValidationErrors({
        name: "hi", // too short
        age: 10     // too young  
      }, schema);

      expect(errors.length).toBeGreaterThan(0);
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
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("Pattern validation", () => {
    test("should handle string pattern failure", () => {
      const schema: JSONSchema7 = {
        type: "string",
        pattern: "^[a-z]+$"
      };
      
      expect(validateValueAgainstSchema("Hello123", schema)).toBe(false);
      expect(validateValueAgainstSchema("hello", schema)).toBe(true);
    });

    test("should handle const value failure", () => {
      const schema: JSONSchema7 = {
        const: "exact"
      };
      
      expect(validateValueAgainstSchema("different", schema)).toBe(false);
      expect(validateValueAgainstSchema("exact", schema)).toBe(true);
    });

    test("should handle enum failure", () => {
      const schema: JSONSchema7 = {
        enum: ["red", "green", "blue"]
      };
      
      expect(validateValueAgainstSchema("yellow", schema)).toBe(false);
      expect(validateValueAgainstSchema("red", schema)).toBe(true);
    });
  });

  describe("Numeric constraints", () => {
    test("should handle minimum/maximum", () => {
      const minSchema: JSONSchema7 = { type: "number", minimum: 10 };
      const maxSchema: JSONSchema7 = { type: "number", maximum: 100 };
      
      expect(validateValueAgainstSchema(5, minSchema)).toBe(false);
      expect(validateValueAgainstSchema(15, minSchema)).toBe(true);
      
      expect(validateValueAgainstSchema(105, maxSchema)).toBe(false);
      expect(validateValueAgainstSchema(95, maxSchema)).toBe(true);
    });

    test("should handle string length", () => {
      const minSchema: JSONSchema7 = { type: "string", minLength: 5 };
      const maxSchema: JSONSchema7 = { type: "string", maxLength: 10 };
      
      expect(validateValueAgainstSchema("hi", minSchema)).toBe(false);
      expect(validateValueAgainstSchema("hello", minSchema)).toBe(true);
      
      expect(validateValueAgainstSchema("very long string", maxSchema)).toBe(false);
      expect(validateValueAgainstSchema("short", maxSchema)).toBe(true);
    });

    test("should handle array length", () => {
      const minSchema: JSONSchema7 = { type: "array", minItems: 2 };
      const maxSchema: JSONSchema7 = { type: "array", maxItems: 3 };
      
      expect(validateValueAgainstSchema([1], minSchema)).toBe(false);
      expect(validateValueAgainstSchema([1, 2], minSchema)).toBe(true);
      
      expect(validateValueAgainstSchema([1, 2, 3, 4], maxSchema)).toBe(false);
      expect(validateValueAgainstSchema([1, 2, 3], maxSchema)).toBe(true);
    });
  });

  describe("Type validation", () => {
    test("should handle type mismatches", () => {
      expect(validateValueAgainstSchema("string", { type: "number" })).toBe(false);
      expect(validateValueAgainstSchema(123, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(true, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema([], { type: "object" })).toBe(false);
      expect(validateValueAgainstSchema({}, { type: "array" })).toBe(false);
      expect(validateValueAgainstSchema(null, { type: "string" })).toBe(false);
    });

    test("should handle null type", () => {
      const schema: JSONSchema7 = { type: "null" };
      expect(validateValueAgainstSchema(null, schema)).toBe(true);
      expect(validateValueAgainstSchema("not null", schema)).toBe(false);
    });

    test("should handle boolean type", () => {
      const schema: JSONSchema7 = { type: "boolean" };
      expect(validateValueAgainstSchema(true, schema)).toBe(true);
      expect(validateValueAgainstSchema(false, schema)).toBe(true);
      expect(validateValueAgainstSchema("true", schema)).toBe(false);
    });
  });
});