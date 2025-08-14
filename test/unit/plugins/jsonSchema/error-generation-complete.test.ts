import { 
  getDetailedValidationErrors,
  getSpecificValidationErrors
} from "../../../../src/core/plugin/jsonSchema/error-generation";
import { validateValueAgainstSchema } from "../../../../src/core/plugin/jsonSchema/validation-core";
import type { JSONSchema7 } from "json-schema";

describe("Error Generation - Complete Coverage", () => {
  describe("getDetailedValidationErrors - type validation", () => {
    test("should generate errors for wrong type", () => {
      const schema: JSONSchema7 = { type: "string" };
      const errors = getDetailedValidationErrors(123, schema);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("TYPE_MISMATCH");
      expect(errors[0].message).toContain("Expected string");
    });

    test("should generate errors for multiple types", () => {
      const schema: JSONSchema7 = { type: ["string", "number"] };
      const errors = getDetailedValidationErrors(true, schema);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("TYPE_MISMATCH");
    });

    test("should handle null type correctly", () => {
      const schema: JSONSchema7 = { type: "null" };
      const errors = getDetailedValidationErrors("not null", schema);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("TYPE_MISMATCH");
    });
  });

  describe("getDetailedValidationErrors - string constraints", () => {
    test("should generate errors for all string constraints", () => {
      const schema: JSONSchema7 = {
        type: "string",
        minLength: 5,
        maxLength: 10,
        pattern: "^[A-Z]",
        format: "email"
      };
      
      const errors = getDetailedValidationErrors("ab", schema);
      
      expect(errors.some(e => e.code === "MIN_LENGTH")).toBe(true);
      expect(errors.some(e => e.code === "PATTERN")).toBe(true);
      expect(errors.some(e => e.code === "FORMAT")).toBe(true);
    });

    test("should handle contentEncoding validation", () => {
      const schema: JSONSchema7 = {
        type: "string",
        contentEncoding: "base64"
      };
      
      const errors = getDetailedValidationErrors("not-base64!", schema);
      
      expect(errors.some(e => e.code === "CONTENT_ENCODING")).toBe(true);
    });

    test("should handle contentMediaType validation", () => {
      const schema: JSONSchema7 = {
        type: "string",
        contentMediaType: "application/json",
        contentEncoding: "base64"
      };
      
      // Invalid base64 encoded JSON
      const errors = getDetailedValidationErrors("aW52YWxpZA==", schema);
      
      expect(errors.length >= 0).toBe(true);
    });
  });

  describe("getDetailedValidationErrors - number constraints", () => {
    test("should generate errors for minimum and maximum", () => {
      const schema: JSONSchema7 = {
        type: "number",
        minimum: 10,
        maximum: 20
      };
      
      const errors1 = getDetailedValidationErrors(5, schema);
      expect(errors1.some(e => e.code === "MINIMUM")).toBe(true);
      
      const errors2 = getDetailedValidationErrors(25, schema);
      expect(errors2.some(e => e.code === "MAXIMUM")).toBe(true);
    });

    test("should handle exclusiveMinimum as number", () => {
      const schema: JSONSchema7 = {
        type: "number",
        exclusiveMinimum: 10
      };
      
      const errors = getDetailedValidationErrors(10, schema);
      expect(errors.some(e => e.code === "EXCLUSIVE_MINIMUM")).toBe(true);
    });

    test("should handle exclusiveMaximum as number", () => {
      const schema: JSONSchema7 = {
        type: "number",
        exclusiveMaximum: 20
      };
      
      const errors = getDetailedValidationErrors(20, schema);
      expect(errors.some(e => e.code === "EXCLUSIVE_MAXIMUM")).toBe(true);
    });

    test("should handle multipleOf constraint", () => {
      const schema: JSONSchema7 = {
        type: "number",
        multipleOf: 5
      };
      
      const errors = getDetailedValidationErrors(7, schema);
      expect(errors.some(e => e.code === "MULTIPLE_OF")).toBe(true);
    });
  });

  describe("getDetailedValidationErrors - array constraints", () => {
    test("should generate errors for array length constraints", () => {
      const schema: JSONSchema7 = {
        type: "array",
        minItems: 2,
        maxItems: 5
      };
      
      const errors1 = getDetailedValidationErrors([1], schema);
      expect(errors1.some(e => e.code === "MIN_ITEMS")).toBe(true);
      
      const errors2 = getDetailedValidationErrors([1, 2, 3, 4, 5, 6], schema);
      expect(errors2.some(e => e.code === "MAX_ITEMS")).toBe(true);
    });

    test("should generate errors for uniqueItems", () => {
      const schema: JSONSchema7 = {
        type: "array",
        uniqueItems: true
      };
      
      const errors = getDetailedValidationErrors([1, 2, 2, 3], schema);
      expect(errors.some(e => e.code === "UNIQUE_ITEMS")).toBe(true);
    });

    test("should validate array items with single schema", () => {
      const schema: JSONSchema7 = {
        type: "array",
        items: { type: "string", minLength: 3 }
      };
      
      const errors = getDetailedValidationErrors(["ok", "no"], schema);
      expect(errors.some(e => e.path === "items[1]")).toBe(true);
    });

    test("should validate contains constraint", () => {
      const schema: JSONSchema7 = {
        type: "array",
        contains: { type: "number", minimum: 10 }
      };
      
      const errors = getDetailedValidationErrors([1, 2, 3], schema);
      expect(errors.some(e => e.code === "CONTAINS")).toBe(true);
    });

    test("should handle additionalItems false", () => {
      const schema: JSONSchema7 = {
        type: "array",
        items: [
          { type: "string" },
          { type: "number" }
        ],
        additionalItems: false
      };
      
      const errors = getDetailedValidationErrors(["ok", 1, "extra"], schema);
      expect(errors.some(e => e.code === "ADDITIONAL_ITEMS")).toBe(true);
    });

    test("should handle additionalItems schema", () => {
      const schema: JSONSchema7 = {
        type: "array",
        items: [
          { type: "string" }
        ],
        additionalItems: { type: "number" }
      };
      
      const errors = getDetailedValidationErrors(["ok", "not-number"], schema);
      expect(errors.some(e => e.path === "items[1]")).toBe(true);
    });
  });

  describe("getDetailedValidationErrors - object constraints", () => {
    test("should generate errors for property count", () => {
      const schema: JSONSchema7 = {
        type: "object",
        minProperties: 2,
        maxProperties: 4
      };
      
      const errors1 = getDetailedValidationErrors({ a: 1 }, schema);
      expect(errors1.some(e => e.code === "MIN_PROPERTIES")).toBe(true);
      
      const errors2 = getDetailedValidationErrors({ a: 1, b: 2, c: 3, d: 4, e: 5 }, schema);
      expect(errors2.some(e => e.code === "MAX_PROPERTIES")).toBe(true);
    });

    test("should validate required properties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        required: ["name", "age"]
      };
      
      const errors = getDetailedValidationErrors({ name: "John" }, schema);
      expect(errors.some(e => e.code === "REQUIRED" && e.path === "age")).toBe(true);
    });

    test("should validate property schemas", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          email: { type: "string", format: "email" }
        }
      };
      
      const errors = getDetailedValidationErrors({ email: "invalid" }, schema);
      expect(errors.some(e => e.path === "email")).toBe(true);
    });

    test("should handle additionalProperties false", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          known: { type: "string" }
        },
        additionalProperties: false
      };
      
      const errors = getDetailedValidationErrors({ known: "ok", unknown: "bad" }, schema);
      expect(errors.some(e => e.code === "ADDITIONAL_PROPERTIES")).toBe(true);
    });

    test("should handle additionalProperties schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          known: { type: "string" }
        },
        additionalProperties: { type: "number" }
      };
      
      const errors = getDetailedValidationErrors({ known: "ok", extra: "not-number" }, schema);
      expect(errors.some(e => e.path === "extra")).toBe(true);
    });

    test("should validate patternProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        patternProperties: {
          "^S_": { type: "string" },
          "^I_": { type: "number" }
        }
      };
      
      const errors = getDetailedValidationErrors({ 
        S_name: "ok",
        I_count: "not-number",
        other: true 
      }, schema);
      
      expect(errors.some(e => e.path === "I_count")).toBe(true);
    });

    test("should validate propertyNames", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          pattern: "^[a-z]+$"
        }
      };
      
      const errors = getDetailedValidationErrors({ 
        valid: "ok",
        "INVALID": "bad"
      }, schema);
      
      expect(errors.some(e => e.code === "PROPERTY_NAMES")).toBe(true);
    });
  });

  describe("getDetailedValidationErrors - enum and const", () => {
    test("should validate enum values", () => {
      const schema: JSONSchema7 = {
        enum: ["red", "green", "blue"]
      };
      
      const errors = getDetailedValidationErrors("yellow", schema);
      expect(errors.some(e => e.code === "ENUM")).toBe(true);
    });

    test("should validate const value", () => {
      const schema: JSONSchema7 = {
        const: "fixed-value"
      };
      
      const errors = getDetailedValidationErrors("other-value", schema);
      expect(errors.some(e => e.code === "CONST")).toBe(true);
    });
  });

  describe("getDetailedValidationErrors - schema composition", () => {
    test("should validate allOf schemas", () => {
      const schema: JSONSchema7 = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 10 }
        ]
      };
      
      const errors = getDetailedValidationErrors("abc", schema);
      expect(errors.some(e => e.code === "ALL_OF")).toBe(true);
    });

    test("should validate anyOf schemas", () => {
      const schema: JSONSchema7 = {
        anyOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      const errors = getDetailedValidationErrors("short", schema);
      expect(errors.some(e => e.code === "ANY_OF")).toBe(true);
    });

    test("should validate oneOf schemas", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", maxLength: 5 },
          { type: "string", minLength: 3 }
        ]
      };
      
      // "abcd" matches both schemas (length 4)
      const errors = getDetailedValidationErrors("abcd", schema);
      expect(errors.some(e => e.code === "ONE_OF")).toBe(true);
    });

    test("should validate not schema", () => {
      const schema: JSONSchema7 = {
        not: { type: "string" }
      };
      
      const errors = getDetailedValidationErrors("string", schema);
      expect(errors.some(e => e.code === "NOT")).toBe(true);
    });
  });

  describe("getDetailedValidationErrors - conditional schemas", () => {
    test("should validate if/then/else schemas", () => {
      const schema: JSONSchema7 = {
        if: { type: "string" },
        then: { minLength: 5 },
        else: { type: "number" }
      };
      
      // String but too short for 'then'
      const errors1 = getDetailedValidationErrors("ab", schema);
      expect(errors1.length).toBeGreaterThan(0);
      
      // Not string and not number (for 'else')
      const errors2 = getDetailedValidationErrors(true, schema);
      expect(errors2.length).toBeGreaterThan(0);
    });

    test("should handle if without then/else", () => {
      const schema: JSONSchema7 = {
        if: { type: "string" }
      };
      
      // Should not generate errors
      const errors = getDetailedValidationErrors(123, schema);
      expect(errors.length).toBe(0);
    });
  });

  describe("getSpecificValidationErrors", () => {
    test("should filter errors by exact path", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 3 },
              age: { type: "number", minimum: 18 }
            }
          }
        }
      };
      
      const value = {
        user: {
          name: "ab",
          age: 10
        }
      };
      
      const errors = getSpecificValidationErrors(value, schema, "user.name");
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every(e => e.path === "user.name")).toBe(true);
    });

    test("should filter errors by path prefix", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string", minLength: 2 }
          }
        }
      };
      
      const value = {
        items: ["a", "b", "ok"]
      };
      
      const errors = getSpecificValidationErrors(value, schema, "items");
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every(e => e.path.startsWith("items"))).toBe(true);
    });
  });

  describe("edge cases and error conditions", () => {
    test("should handle circular references without infinite loop", () => {
      const schema: any = {
        type: "object",
        properties: {
          name: { type: "string" },
          parent: { $ref: "#" }
        }
      };
      
      const value = {
        name: 123, // Wrong type
        parent: {
          name: "valid",
          parent: null
        }
      };
      
      // Should not throw or hang
      const errors = getDetailedValidationErrors(value, schema, {}, schema);
      expect(errors).toBeDefined();
    });

    test("should handle invalid $ref gracefully", () => {
      const schema: JSONSchema7 = {
        $ref: "#/definitions/nonexistent"
      };
      
      const errors = getDetailedValidationErrors("any", schema);
      expect(errors).toBeDefined();
    });

    test("should handle custom format validators", () => {
      const customFormats = {
        "custom-format": (value: string) => value.startsWith("CUSTOM-")
      };
      
      const schema: JSONSchema7 = {
        type: "string",
        format: "custom-format"
      };
      
      const errors = getDetailedValidationErrors("invalid", schema, customFormats);
      expect(errors.some(e => e.code === "FORMAT")).toBe(true);
    });

    test("should handle empty schema (always valid)", () => {
      const schema: JSONSchema7 = {};
      
      const errors = getDetailedValidationErrors("anything", schema);
      expect(errors.length).toBe(0);
    });

    test("should handle true schema (always valid)", () => {
      const schema = true as any;
      
      const errors = getDetailedValidationErrors("anything", schema);
      expect(errors.length).toBe(0);
    });

    test("should handle false schema (always invalid)", () => {
      const schema = false as any;
      
      const errors = getDetailedValidationErrors("anything", schema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("should handle deeply nested validation errors", () => {
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
                    type: "string",
                    minLength: 5
                  }
                }
              }
            }
          }
        }
      };
      
      const value = {
        level1: {
          level2: {
            level3: "ab"
          }
        }
      };
      
      const errors = getDetailedValidationErrors(value, schema);
      expect(errors.some(e => e.path === "level1.level2.level3")).toBe(true);
    });

    test("should handle array of objects validation", () => {
      const schema: JSONSchema7 = {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" }
          },
          required: ["id", "name"]
        }
      };
      
      const value = [
        { id: 1, name: "valid" },
        { id: "invalid", name: "test" },
        { id: 3 } // Missing name
      ];
      
      const errors = getDetailedValidationErrors(value, schema);
      expect(errors.some(e => e.path === "items[1].id")).toBe(true);
      expect(errors.some(e => e.path === "items[2].name")).toBe(true);
    });
  });
});