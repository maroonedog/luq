import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  validateType,
  validateMultipleTypes,
  validateStringConstraints,
  validateNumberConstraints,
  validateArrayConstraints,
  validateObjectConstraints
} from "../../../../src/core/plugin/jsonSchema/validation-core";
import type { JSONSchema7 } from "json-schema";

describe("Validation Core", () => {
  describe("validateType", () => {
    test("should validate null type", () => {
      expect(validateType(null, "null")).toBe(true);
      expect(validateType(undefined, "null")).toBe(false);
      expect(validateType("", "null")).toBe(false);
    });

    test("should validate boolean type", () => {
      expect(validateType(true, "boolean")).toBe(true);
      expect(validateType(false, "boolean")).toBe(true);
      expect(validateType("true", "boolean")).toBe(false);
      expect(validateType(1, "boolean")).toBe(false);
    });

    test("should validate string type", () => {
      expect(validateType("hello", "string")).toBe(true);
      expect(validateType("", "string")).toBe(true);
      expect(validateType(123, "string")).toBe(false);
      expect(validateType(null, "string")).toBe(false);
    });

    test("should validate number type", () => {
      expect(validateType(123, "number")).toBe(true);
      expect(validateType(3.14, "number")).toBe(true);
      expect(validateType(0, "number")).toBe(true);
      expect(validateType(-5, "number")).toBe(true);
      expect(validateType(NaN, "number")).toBe(false);
      expect(validateType("123", "number")).toBe(false);
    });

    test("should validate integer type", () => {
      expect(validateType(123, "integer")).toBe(true);
      expect(validateType(0, "integer")).toBe(true);
      expect(validateType(-5, "integer")).toBe(true);
      expect(validateType(3.14, "integer")).toBe(false);
      expect(validateType(NaN, "integer")).toBe(false);
      expect(validateType("123", "integer")).toBe(false);
    });

    test("should validate array type", () => {
      expect(validateType([], "array")).toBe(true);
      expect(validateType([1, 2, 3], "array")).toBe(true);
      expect(validateType({}, "array")).toBe(false);
      expect(validateType("[]", "array")).toBe(false);
    });

    test("should validate object type", () => {
      expect(validateType({}, "object")).toBe(true);
      expect(validateType({ a: 1 }, "object")).toBe(true);
      expect(validateType([], "object")).toBe(false);
      expect(validateType(null, "object")).toBe(false);
    });
  });

  describe("validateMultipleTypes", () => {
    test("should validate when value matches any type", () => {
      expect(validateMultipleTypes("hello", ["string", "number"])).toBe(true);
      expect(validateMultipleTypes(123, ["string", "number"])).toBe(true);
      expect(validateMultipleTypes(true, ["string", "number"])).toBe(false);
    });

    test("should handle null in type array", () => {
      expect(validateMultipleTypes(null, ["string", "null"])).toBe(true);
      expect(validateMultipleTypes("hello", ["string", "null"])).toBe(true);
      expect(validateMultipleTypes(123, ["string", "null"])).toBe(false);
    });

    test("should return false when no types match", () => {
      expect(validateMultipleTypes({}, ["string", "number", "boolean"])).toBe(false);
    });
  });

  describe("validateStringConstraints", () => {
    test("should validate minLength constraint", () => {
      const schema: JSONSchema7 = { minLength: 5 };
      expect(validateStringConstraints("hello", schema)).toBe(true);
      expect(validateStringConstraints("hi", schema)).toBe(false);
      expect(validateStringConstraints("", schema)).toBe(false);
    });

    test("should validate maxLength constraint", () => {
      const schema: JSONSchema7 = { maxLength: 3 };
      expect(validateStringConstraints("hi", schema)).toBe(true);
      expect(validateStringConstraints("hello", schema)).toBe(false);
      expect(validateStringConstraints("", schema)).toBe(true);
    });

    test("should validate pattern constraint", () => {
      const schema: JSONSchema7 = { pattern: "^[a-z]+$" };
      expect(validateStringConstraints("hello", schema)).toBe(true);
      expect(validateStringConstraints("Hello", schema)).toBe(false);
      expect(validateStringConstraints("123", schema)).toBe(false);
    });

    test("should handle multiple constraints together", () => {
      const schema: JSONSchema7 = {
        minLength: 3,
        maxLength: 10,
        pattern: "^[a-zA-Z]+$"
      };
      expect(validateStringConstraints("hello", schema)).toBe(true);
      expect(validateStringConstraints("hi", schema)).toBe(false); // too short
      expect(validateStringConstraints("verylongstring", schema)).toBe(false); // too long
      expect(validateStringConstraints("hello123", schema)).toBe(false); // pattern mismatch
    });
  });

  describe("validateNumberConstraints", () => {
    test("should validate minimum constraint", () => {
      const schema: JSONSchema7 = { minimum: 10 };
      expect(validateNumberConstraints(15, schema)).toBe(true);
      expect(validateNumberConstraints(10, schema)).toBe(true);
      expect(validateNumberConstraints(5, schema)).toBe(false);
    });

    test("should validate maximum constraint", () => {
      const schema: JSONSchema7 = { maximum: 100 };
      expect(validateNumberConstraints(50, schema)).toBe(true);
      expect(validateNumberConstraints(100, schema)).toBe(true);
      expect(validateNumberConstraints(150, schema)).toBe(false);
    });

    test("should validate exclusiveMinimum (number)", () => {
      const schema: JSONSchema7 = { exclusiveMinimum: 10 };
      expect(validateNumberConstraints(15, schema)).toBe(true);
      expect(validateNumberConstraints(10, schema)).toBe(false);
      expect(validateNumberConstraints(5, schema)).toBe(false);
    });

    test("should validate exclusiveMaximum (number)", () => {
      const schema: JSONSchema7 = { exclusiveMaximum: 100 };
      expect(validateNumberConstraints(50, schema)).toBe(true);
      expect(validateNumberConstraints(100, schema)).toBe(false);
      expect(validateNumberConstraints(150, schema)).toBe(false);
    });

    test("should validate exclusiveMinimum (boolean - Draft 04 style)", () => {
      const schema: JSONSchema7 = { 
        minimum: 10, 
        exclusiveMinimum: true as any 
      };
      expect(validateNumberConstraints(15, schema)).toBe(true);
      expect(validateNumberConstraints(10, schema)).toBe(false);
      expect(validateNumberConstraints(5, schema)).toBe(false);
    });

    test("should validate exclusiveMaximum (boolean - Draft 04 style)", () => {
      const schema: JSONSchema7 = { 
        maximum: 100, 
        exclusiveMaximum: true as any 
      };
      expect(validateNumberConstraints(50, schema)).toBe(true);
      expect(validateNumberConstraints(100, schema)).toBe(false);
      expect(validateNumberConstraints(150, schema)).toBe(false);
    });

    test("should validate multipleOf constraint", () => {
      const schema: JSONSchema7 = { multipleOf: 5 };
      expect(validateNumberConstraints(10, schema)).toBe(true);
      expect(validateNumberConstraints(15, schema)).toBe(true);
      expect(validateNumberConstraints(0, schema)).toBe(true);
      expect(validateNumberConstraints(7, schema)).toBe(false);
      expect(validateNumberConstraints(-10, schema)).toBe(true);
    });

    test("should handle floating point multipleOf", () => {
      const schema: JSONSchema7 = { multipleOf: 0.1 };
      expect(validateNumberConstraints(1.0, schema)).toBe(true);
      expect(validateNumberConstraints(1.1, schema)).toBe(true);
      expect(validateNumberConstraints(1.05, schema)).toBe(false); // floating point precision issue
    });
  });

  describe("validateArrayConstraints", () => {
    test("should validate minItems constraint", () => {
      const schema: JSONSchema7 = { minItems: 2 };
      expect(validateArrayConstraints([1, 2, 3], schema)).toBe(true);
      expect(validateArrayConstraints([1, 2], schema)).toBe(true);
      expect(validateArrayConstraints([1], schema)).toBe(false);
      expect(validateArrayConstraints([], schema)).toBe(false);
    });

    test("should validate maxItems constraint", () => {
      const schema: JSONSchema7 = { maxItems: 2 };
      expect(validateArrayConstraints([], schema)).toBe(true);
      expect(validateArrayConstraints([1], schema)).toBe(true);
      expect(validateArrayConstraints([1, 2], schema)).toBe(true);
      expect(validateArrayConstraints([1, 2, 3], schema)).toBe(false);
    });

    test("should validate uniqueItems constraint", () => {
      const schema: JSONSchema7 = { uniqueItems: true };
      expect(validateArrayConstraints([1, 2, 3], schema)).toBe(true);
      expect(validateArrayConstraints([1, 2, 1], schema)).toBe(false);
      expect(validateArrayConstraints([{a: 1}, {b: 2}], schema)).toBe(true);
      expect(validateArrayConstraints([{a: 1}, {a: 1}], schema)).toBe(false);
    });

    test("should validate items with single schema", () => {
      const schema: JSONSchema7 = {
        items: { type: "string" }
      };
      expect(validateArrayConstraints(["a", "b", "c"], schema)).toBe(true);
      expect(validateArrayConstraints(["a", "b", 1], schema)).toBe(false);
      expect(validateArrayConstraints([], schema)).toBe(true);
    });

    test("should validate items with tuple schema", () => {
      const schema: JSONSchema7 = {
        items: [
          { type: "string" },
          { type: "number" }
        ]
      };
      expect(validateArrayConstraints(["hello", 123], schema)).toBe(true);
      expect(validateArrayConstraints(["hello", "world"], schema)).toBe(false);
      expect(validateArrayConstraints(["hello"], schema)).toBe(true); // additional items allowed by default
    });

    test("should validate additionalItems false", () => {
      const schema: JSONSchema7 = {
        items: [{ type: "string" }],
        additionalItems: false
      };
      expect(validateArrayConstraints(["hello"], schema)).toBe(true);
      expect(validateArrayConstraints(["hello", "extra"], schema)).toBe(false);
    });

    test("should validate additionalItems with schema", () => {
      const schema: JSONSchema7 = {
        items: [{ type: "string" }],
        additionalItems: { type: "number" }
      };
      expect(validateArrayConstraints(["hello", 123], schema)).toBe(true);
      expect(validateArrayConstraints(["hello", "invalid"], schema)).toBe(false);
    });

    test("should validate contains constraint", () => {
      const schema: JSONSchema7 = {
        contains: { type: "string", minLength: 6 }  // Changed to 6 to make test clearer
      };
      expect(validateArrayConstraints(["short", "verylongstring", "hi"], schema)).toBe(true);
      expect(validateArrayConstraints(["short", "hi", "bye"], schema)).toBe(false);
      expect(validateArrayConstraints([], schema)).toBe(false);
    });
  });

  describe("validateObjectConstraints", () => {
    test("should validate minProperties constraint", () => {
      const schema: JSONSchema7 = { minProperties: 2 };
      expect(validateObjectConstraints({ a: 1, b: 2, c: 3 }, schema)).toBe(true);
      expect(validateObjectConstraints({ a: 1, b: 2 }, schema)).toBe(true);
      expect(validateObjectConstraints({ a: 1 }, schema)).toBe(false);
      expect(validateObjectConstraints({}, schema)).toBe(false);
    });

    test("should validate maxProperties constraint", () => {
      const schema: JSONSchema7 = { maxProperties: 2 };
      expect(validateObjectConstraints({}, schema)).toBe(true);
      expect(validateObjectConstraints({ a: 1 }, schema)).toBe(true);
      expect(validateObjectConstraints({ a: 1, b: 2 }, schema)).toBe(true);
      expect(validateObjectConstraints({ a: 1, b: 2, c: 3 }, schema)).toBe(false);
    });

    test("should validate required properties", () => {
      const schema: JSONSchema7 = {
        required: ["name", "age"]
      };
      expect(validateObjectConstraints({ name: "John", age: 30, extra: "ok" }, schema)).toBe(true);
      expect(validateObjectConstraints({ name: "John" }, schema)).toBe(false);
      expect(validateObjectConstraints({ age: 30 }, schema)).toBe(false);
      expect(validateObjectConstraints({}, schema)).toBe(false);
    });

    test("should validate properties with schemas", () => {
      const schema: JSONSchema7 = {
        properties: {
          name: { type: "string", minLength: 2 },
          age: { type: "number", minimum: 0 }
        }
      };
      expect(validateObjectConstraints({ name: "John", age: 30 }, schema)).toBe(true);
      expect(validateObjectConstraints({ name: "J", age: 30 }, schema)).toBe(false); // name too short
      expect(validateObjectConstraints({ name: "John", age: -5 }, schema)).toBe(false); // age negative
    });

    test("should validate additionalProperties false", () => {
      const schema: JSONSchema7 = {
        properties: {
          name: { type: "string" }
        },
        additionalProperties: false
      };
      expect(validateObjectConstraints({ name: "John" }, schema)).toBe(true);
      expect(validateObjectConstraints({ name: "John", age: 30 }, schema)).toBe(false);
    });

    test("should validate additionalProperties with schema", () => {
      const schema: JSONSchema7 = {
        properties: {
          name: { type: "string" }
        },
        additionalProperties: { type: "number" }
      };
      expect(validateObjectConstraints({ name: "John", age: 30 }, schema)).toBe(true);
      expect(validateObjectConstraints({ name: "John", age: "30" }, schema)).toBe(false); // age should be number
    });

    test("should validate pattern properties", () => {
      const schema: JSONSchema7 = {
        patternProperties: {
          "^str_": { type: "string" },
          "^num_": { type: "number" }
        }
      };
      expect(validateObjectConstraints({ str_name: "John", num_age: 30 }, schema)).toBe(true);
      expect(validateObjectConstraints({ str_name: 123 }, schema)).toBe(false); // wrong type
      expect(validateObjectConstraints({ other_prop: "anything" }, schema)).toBe(true); // no pattern match, allowed
    });

    test("should validate propertyNames constraint", () => {
      const schema: JSONSchema7 = {
        propertyNames: { pattern: "^[a-z]+$" }
      };
      expect(validateObjectConstraints({ name: "John", age: 30 }, schema)).toBe(true);
      expect(validateObjectConstraints({ "Invalid-Name": "John" }, schema)).toBe(false);
    });
  });

  describe("validateValueAgainstSchema - integration", () => {
    test("should handle null and undefined values", () => {
      expect(validateValueAgainstSchema(null, { type: "null" })).toBe(true);
      expect(validateValueAgainstSchema(null, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(undefined, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(null, { type: ["string", "null"] })).toBe(true);
    });

    test("should validate const values", () => {
      const schema: JSONSchema7 = { const: "exact-value" };
      expect(validateValueAgainstSchema("exact-value", schema)).toBe(true);
      expect(validateValueAgainstSchema("different-value", schema)).toBe(false);
      
      const objectSchema: JSONSchema7 = { const: { a: 1, b: 2 } };
      expect(validateValueAgainstSchema({ a: 1, b: 2 }, objectSchema)).toBe(true);
      expect(validateValueAgainstSchema({ a: 1, b: 3 }, objectSchema)).toBe(false);
    });

    test("should validate enum values", () => {
      const schema: JSONSchema7 = { enum: ["red", "green", "blue"] };
      expect(validateValueAgainstSchema("red", schema)).toBe(true);
      expect(validateValueAgainstSchema("yellow", schema)).toBe(false);
      
      const mixedEnum: JSONSchema7 = { enum: ["string", 123, { object: true }, null] };
      expect(validateValueAgainstSchema("string", mixedEnum)).toBe(true);
      expect(validateValueAgainstSchema(123, mixedEnum)).toBe(true);
      expect(validateValueAgainstSchema({ object: true }, mixedEnum)).toBe(true);
      expect(validateValueAgainstSchema(null, mixedEnum)).toBe(true);
      expect(validateValueAgainstSchema("other", mixedEnum)).toBe(false);
    });

    test("should validate allOf schema composition", () => {
      const schema: JSONSchema7 = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 10 },
          { pattern: "^[a-z]+$" }
        ]
      };
      expect(validateValueAgainstSchema("hello", schema)).toBe(true);
      expect(validateValueAgainstSchema("hi", schema)).toBe(false); // too short
      expect(validateValueAgainstSchema("verylongstring", schema)).toBe(false); // too long
      expect(validateValueAgainstSchema("Hello", schema)).toBe(false); // pattern mismatch
    });

    test("should validate anyOf schema composition", () => {
      const schema: JSONSchema7 = {
        anyOf: [
          { type: "string", maxLength: 5 },
          { type: "number", minimum: 10 }
        ]
      };
      expect(validateValueAgainstSchema("short", schema)).toBe(true);
      expect(validateValueAgainstSchema(15, schema)).toBe(true);
      expect(validateValueAgainstSchema("toolongstring", schema)).toBe(false);
      expect(validateValueAgainstSchema(5, schema)).toBe(false);
    });

    test("should validate oneOf schema composition", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", maxLength: 5 },
          { type: "number", minimum: 10 }
        ]
      };
      expect(validateValueAgainstSchema("short", schema)).toBe(true);
      expect(validateValueAgainstSchema(15, schema)).toBe(true);
      expect(validateValueAgainstSchema("toolong", schema)).toBe(false); // too long for string constraint
      expect(validateValueAgainstSchema(5, schema)).toBe(false); // too small for number constraint
    });

    test("should validate not schema", () => {
      const schema: JSONSchema7 = {
        not: { type: "string" }
      };
      expect(validateValueAgainstSchema(123, schema)).toBe(true);
      expect(validateValueAgainstSchema("string", schema)).toBe(false);
    });

    test("should validate conditional schemas (if/then/else)", () => {
      const schema: JSONSchema7 = {
        type: "object",
        if: {
          properties: { type: { const: "premium" } }
        },
        then: {
          properties: { features: { minItems: 5 } }
        },
        else: {
          properties: { features: { maxItems: 3 } }
        }
      };
      
      // Premium account - should have at least 5 features
      expect(validateValueAgainstSchema({
        type: "premium",
        features: [1, 2, 3, 4, 5]
      }, schema)).toBe(true);
      
      expect(validateValueAgainstSchema({
        type: "premium",
        features: [1, 2] // too few
      }, schema)).toBe(false);
      
      // Basic account - should have at most 3 features
      expect(validateValueAgainstSchema({
        type: "basic",
        features: [1, 2, 3]
      }, schema)).toBe(true);
      
      expect(validateValueAgainstSchema({
        type: "basic",
        features: [1, 2, 3, 4, 5] // too many
      }, schema)).toBe(false);
    });

    test("should handle boolean schema compositions comprehensively", () => {
      // Test boolean schemas in allOf
      expect(validateValueAgainstSchema("test", { 
        allOf: [true, { type: "string" }] 
      })).toBe(true);
      
      expect(validateValueAgainstSchema("test", { 
        allOf: [false, { type: "string" }] 
      })).toBe(false);

      // Test boolean schemas in anyOf  
      expect(validateValueAgainstSchema("test", { 
        anyOf: [true] 
      })).toBe(true);
      
      expect(validateValueAgainstSchema("test", { 
        anyOf: [false, { type: "string" }] 
      })).toBe(true);

      // Test boolean schemas in oneOf
      expect(validateValueAgainstSchema("test", { 
        oneOf: [true] 
      })).toBe(true);
      
      expect(validateValueAgainstSchema("test", { 
        oneOf: [true, true] 
      })).toBe(false); // More than one match

      // Test boolean not schema
      expect(validateValueAgainstSchema("test", { 
        not: true 
      })).toBe(false);
      
      expect(validateValueAgainstSchema("test", { 
        not: false 
      })).toBe(true);
    });

    test("should handle boolean if/then/else schemas", () => {
      // Boolean if schema
      expect(validateValueAgainstSchema("test", {
        if: true,
        then: { type: "string" }
      })).toBe(true);
      
      expect(validateValueAgainstSchema("test", {
        if: false,
        else: { type: "string" }
      })).toBe(true);

      // Boolean then schema
      expect(validateValueAgainstSchema("test", {
        if: { type: "string" },
        then: true
      })).toBe(true);
      
      expect(validateValueAgainstSchema("test", {
        if: { type: "string" },
        then: false
      })).toBe(false);

      // Boolean else schema
      expect(validateValueAgainstSchema(123, {
        if: { type: "string" },
        else: true
      })).toBe(true);
      
      expect(validateValueAgainstSchema(123, {
        if: { type: "string" },
        else: false
      })).toBe(false);
    });

    test("should handle boolean array and object constraints", () => {
      // Boolean contains schema
      expect(validateArrayConstraints([1, 2, 3], { 
        contains: true 
      })).toBe(true);
      
      expect(validateArrayConstraints([1, 2, 3], { 
        contains: false 
      })).toBe(false);

      // Boolean propertyNames schema
      expect(validateObjectConstraints({ name: "test", age: 30 }, { 
        propertyNames: true 
      })).toBe(true);
      
      expect(validateObjectConstraints({ name: "test", age: 30 }, { 
        propertyNames: false 
      })).toBe(false);
    });
  });
});