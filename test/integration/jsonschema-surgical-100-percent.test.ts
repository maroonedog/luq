import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Surgical 100% Coverage", () => {
  describe("if/then/else validation - Lines 491-514", () => {
    test("should hit line 497: if condition true, apply then schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: { type: "number" }
        },
        if: {
          properties: {
            type: { const: "number" }
          }
        },
        then: {
          properties: {
            value: { minimum: 10 }
          }
        }
      };

      // Hit line 497: if (ifResult && schema.then) - true path
      // Hit lines 499-503: return validateValueAgainstSchema for then
      expect(validateValueAgainstSchema({
        type: "number",
        value: 15
      }, schema)).toBe(true);

      // Hit then schema validation failure
      expect(validateValueAgainstSchema({
        type: "number", 
        value: 5 // fails minimum: 10
      }, schema)).toBe(false);
    });

    test("should hit line 504: if condition false, apply else schema", () => {
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
        then: {
          properties: {
            value: { type: "number" }
          }
        },
        else: {
          properties: {
            value: { minLength: 5 }
          }
        }
      };

      // Hit line 504: } else if (!ifResult && schema.else) - true path
      // Hit lines 506-510: return validateValueAgainstSchema for else
      expect(validateValueAgainstSchema({
        type: "string", // if condition is false
        value: "hello"
      }, schema)).toBe(true);

      // Hit else schema validation failure
      expect(validateValueAgainstSchema({
        type: "string",
        value: "hi" // fails minLength: 5
      }, schema)).toBe(false);
    });

    test("should hit line 514: no then/else applies, return true", () => {
      const schema: JSONSchema7 = {
        type: "object",
        if: {
          properties: {
            nonExistent: { const: "value" }
          }
        },
        then: {
          properties: {
            shouldNotApply: { type: "string" }
          }
        }
      };

      // Hit line 514: return true (if condition false, no else)
      expect(validateValueAgainstSchema({
        type: "anything"
      }, schema)).toBe(true);
    });
  });

  describe("oneOf validation - Lines 461-474", () => {
    test("should hit lines 462-471: oneOf multiple matches failure", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", minLength: 1 }, // This will match
          { type: "string", maxLength: 10 } // This will also match
        ]
      };

      // Hit lines 462-470: loop through oneOf schemas
      // Hit line 471: if (validCount > 1) return false;
      expect(validateValueAgainstSchema("hello", schema)).toBe(false);
    });

    test("should hit line 474: oneOf no matches failure", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };

      // Hit line 474: if (validCount !== 1) return false;
      expect(validateValueAgainstSchema("short", schema)).toBe(false);
      expect(validateValueAgainstSchema(50, schema)).toBe(false);
    });

    test("should hit oneOf single match success", () => {
      const schema: JSONSchema7 = {
        oneOf: [
          { type: "string", maxLength: 5 },
          { type: "number", minimum: 10 }
        ]
      };

      // Should pass oneOf validation (only first schema matches)
      expect(validateValueAgainstSchema("hi", schema)).toBe(true);
      // Should pass oneOf validation (only second schema matches)
      expect(validateValueAgainstSchema(15, schema)).toBe(true);
    });
  });

  describe("not validation - Lines 477-485", () => {
    test("should hit lines 478-485: not schema matches, return false", () => {
      const schema: JSONSchema7 = {
        not: {
          type: "string",
          minLength: 5
        }
      };

      // Hit lines 478-484: validateValueAgainstSchema for not schema
      // Hit line 485: return false (not schema matched)
      expect(validateValueAgainstSchema("hello", schema)).toBe(false);

      // Should pass (not schema doesn't match)
      expect(validateValueAgainstSchema("hi", schema)).toBe(true);
      expect(validateValueAgainstSchema(123, schema)).toBe(true);
    });

    test("should hit complex not schema validation", () => {
      const schema: JSONSchema7 = {
        not: {
          type: "object",
          properties: {
            forbidden: { type: "string" }
          },
          required: ["forbidden"]
        }
      };

      // Should fail (matches the not schema)
      expect(validateValueAgainstSchema({
        forbidden: "value"
      }, schema)).toBe(false);

      // Should pass (doesn't match the not schema)  
      expect(validateValueAgainstSchema({
        allowed: "value"
      }, schema)).toBe(true);
    });
  });

  describe("object property validation failures - Lines 372, 377", () => {
    test("should hit line 372: minProperties failure", () => {
      const schema: JSONSchema7 = {
        type: "object",
        minProperties: 3
      };

      // Hit line 372: return false;
      expect(validateValueAgainstSchema({}, schema)).toBe(false);
      expect(validateValueAgainstSchema({ a: 1 }, schema)).toBe(false);
      expect(validateValueAgainstSchema({ a: 1, b: 2 }, schema)).toBe(false);
      expect(validateValueAgainstSchema({ a: 1, b: 2, c: 3 }, schema)).toBe(true);
    });

    test("should hit line 377: maxProperties failure", () => {
      const schema: JSONSchema7 = {
        type: "object",
        maxProperties: 2
      };

      // Hit line 377: return false;
      expect(validateValueAgainstSchema({ a: 1, b: 2, c: 3 }, schema)).toBe(false);
      expect(validateValueAgainstSchema({ a: 1, b: 2, c: 3, d: 4 }, schema)).toBe(false);
      expect(validateValueAgainstSchema({ a: 1, b: 2 }, schema)).toBe(true);
    });
  });

  describe("detailed if/then/else error generation - Lines 531-580", () => {
    test("should hit lines 537-553: then schema required field errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          accountType: { type: "string" },
          balance: { type: "number" },
          securityCode: { type: "string" },
          creditLimit: { type: "number" }
        },
        if: {
          properties: {
            accountType: { const: "premium" }
          }
        },
        then: {
          required: ["securityCode", "creditLimit"],
          properties: {
            balance: { minimum: 1000 }
          }
        }
      };

      // Hit lines 531-535: ifResult = validateValueAgainstSchema
      // Hit line 537: if (ifResult && schema.then)
      // Hit lines 542-552: required field checking in then schema
      const errors = getDetailedValidationErrors({
        accountType: "premium", // if condition matches
        balance: 500 // missing securityCode and creditLimit
      }, schema);

      expect(errors.length).toBeGreaterThan(0);
      // Should generate REQUIRED_IF errors
      expect(errors.some(e => e.code === "REQUIRED_IF")).toBe(true);
    });

    test("should hit lines 555-580: else branch error generation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          accountType: { type: "string" },
          value: { type: "string" }
        },
        if: {
          properties: {
            accountType: { const: "premium" }
          }
        },
        then: {
          properties: {
            value: { minLength: 10 }
          }
        },
        else: {
          required: ["value"],
          properties: {
            value: { minLength: 3 }
          }
        }
      };

      // Hit else branch error generation  
      const errors = getDetailedValidationErrors({
        accountType: "basic", // if condition false, goes to else
        value: "x" // too short for else requirements
      }, schema);

      expect(errors.length).toBeGreaterThan(0);
    });

    test("should hit complex nested conditional error paths", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          category: { type: "string" },
          subcategory: { type: "string" },
          metadata: { type: "object" }
        },
        if: {
          properties: {
            category: { const: "electronics" }
          }
        },
        then: {
          if: {
            properties: {
              subcategory: { const: "phone" }
            }
          },
          then: {
            required: ["metadata"],
            properties: {
              metadata: {
                type: "object",
                required: ["warranty", "model"]
              }
            }
          }
        }
      };

      // Hit nested conditional error generation
      const errors = getDetailedValidationErrors({
        category: "electronics", // first if true
        subcategory: "phone", // nested if true
        metadata: {} // missing required warranty and model
      }, schema);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("Type validation edge cases - Lines 185, 193, 198, 202, 208, 212, 218, 222, 226, 230, 234, 238, 242, 246", () => {
    test("should hit specific type checking branches", () => {
      // Test undefined values
      expect(validateValueAgainstSchema(undefined, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(undefined, { type: "number" })).toBe(false);
      expect(validateValueAgainstSchema(undefined, { type: "boolean" })).toBe(false);

      // Test null with various types
      expect(validateValueAgainstSchema(null, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(null, { type: "number" })).toBe(false);
      expect(validateValueAgainstSchema(null, { type: "object" })).toBe(false);
      expect(validateValueAgainstSchema(null, { type: "array" })).toBe(false);
      expect(validateValueAgainstSchema(null, { type: "null" })).toBe(true);

      // Test type mismatches
      expect(validateValueAgainstSchema("string", { type: "number" })).toBe(false);
      expect(validateValueAgainstSchema(123, { type: "string" })).toBe(false);
      expect(validateValueAgainstSchema(true, { type: "number" })).toBe(false);
      expect(validateValueAgainstSchema([], { type: "object" })).toBe(false);
      expect(validateValueAgainstSchema({}, { type: "array" })).toBe(false);
    });

    test("should handle array type specifications", () => {
      const multiTypeSchema: JSONSchema7 = {
        type: ["string", "number"]
      };

      expect(validateValueAgainstSchema("hello", multiTypeSchema)).toBe(true);
      expect(validateValueAgainstSchema(123, multiTypeSchema)).toBe(true);
      expect(validateValueAgainstSchema(true, multiTypeSchema)).toBe(false);
      expect(validateValueAgainstSchema(null, multiTypeSchema)).toBe(false);
    });
  });

  describe("String/Number constraint edge cases - Lines 250-258, 267-268, 272-278", () => {
    test("should handle string length edge cases", () => {
      // Empty string edge cases
      expect(validateValueAgainstSchema("", { type: "string", minLength: 1 })).toBe(false);
      expect(validateValueAgainstSchema("", { type: "string", minLength: 0 })).toBe(true);
      expect(validateValueAgainstSchema("", { type: "string", maxLength: 0 })).toBe(true);

      // Unicode string length
      expect(validateValueAgainstSchema("👍👎", { type: "string", maxLength: 2 })).toBe(true);
      expect(validateValueAgainstSchema("👍👎👏", { type: "string", maxLength: 2 })).toBe(false);
    });

    test("should handle number constraint edge cases", () => {
      // Integer vs number
      expect(validateValueAgainstSchema(3.0, { type: "integer" })).toBe(true);
      expect(validateValueAgainstSchema(3.1, { type: "integer" })).toBe(false);
      
      // Special number values
      expect(validateValueAgainstSchema(Infinity, { type: "number" })).toBe(true);
      expect(validateValueAgainstSchema(-Infinity, { type: "number" })).toBe(true);
      expect(validateValueAgainstSchema(NaN, { type: "number" })).toBe(false);

      // Zero edge cases
      expect(validateValueAgainstSchema(0, { type: "number", minimum: 0 })).toBe(true);
      expect(validateValueAgainstSchema(-0, { type: "number", minimum: 0 })).toBe(true);
      expect(validateValueAgainstSchema(0, { type: "number", exclusiveMinimum: 0 })).toBe(false);
    });
  });

  describe("Complex validation scenarios", () => {
    test("should handle deeply nested if/then/else", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          level1: { type: "string" },
          level2: { type: "string" },
          value: { type: "number" }
        },
        if: {
          properties: { level1: { const: "A" } }
        },
        then: {
          if: {
            properties: { level2: { const: "X" } }
          },
          then: {
            properties: { value: { minimum: 100 } }
          },
          else: {
            properties: { value: { maximum: 50 } }
          }
        },
        else: {
          properties: { value: { multipleOf: 5 } }
        }
      };

      // Test nested then-then path
      expect(validateValueAgainstSchema({
        level1: "A",
        level2: "X", 
        value: 150
      }, schema)).toBe(true);

      expect(validateValueAgainstSchema({
        level1: "A",
        level2: "X",
        value: 50 // fails minimum: 100
      }, schema)).toBe(false);

      // Test nested then-else path  
      expect(validateValueAgainstSchema({
        level1: "A",
        level2: "Y",
        value: 25
      }, schema)).toBe(true);

      expect(validateValueAgainstSchema({
        level1: "A", 
        level2: "Y",
        value: 75 // fails maximum: 50
      }, schema)).toBe(false);

      // Test main else path
      expect(validateValueAgainstSchema({
        level1: "B",
        value: 15
      }, schema)).toBe(true);

      expect(validateValueAgainstSchema({
        level1: "B",
        value: 13 // fails multipleOf: 5
      }, schema)).toBe(false);
    });

    test("should handle mixed validation with all composition types", () => {
      const schema: JSONSchema7 = {
        allOf: [
          {
            oneOf: [
              { type: "string", minLength: 5 },
              { type: "number", minimum: 10 }
            ]
          },
          {
            not: {
              enum: ["forbidden", 99]
            }
          }
        ]
      };

      // Should pass all conditions
      expect(validateValueAgainstSchema("hello", schema)).toBe(true);
      expect(validateValueAgainstSchema(15, schema)).toBe(true);

      // Should fail oneOf (too short string, too small number)
      expect(validateValueAgainstSchema("hi", schema)).toBe(false);
      expect(validateValueAgainstSchema(5, schema)).toBe(false);

      // Should fail not (forbidden values)
      expect(validateValueAgainstSchema("forbidden", schema)).toBe(false);
      expect(validateValueAgainstSchema(99, schema)).toBe(false);

      // Should fail oneOf (matches multiple)
      const multiMatchSchema: JSONSchema7 = {
        oneOf: [
          { type: "string" },
          { type: "string", minLength: 1 }
        ]
      };
      expect(validateValueAgainstSchema("test", multiMatchSchema)).toBe(false);
    });
  });
});