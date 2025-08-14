import { describe, test, expect } from "@jest/globals";
import { 
  getDetailedValidationErrors,
  getSpecificValidationErrors
} from "../../../../src/core/plugin/jsonSchema/error-generation";
import type { JSONSchema7 } from "json-schema";

describe("Error Generation", () => {
  describe("getDetailedValidationErrors", () => {
    test("should return empty array for valid values", () => {
      const schema: JSONSchema7 = { type: "string", minLength: 3 };
      const errors = getDetailedValidationErrors("hello", schema);
      expect(errors).toEqual([]);
    });

    test("should generate errors for invalid type", () => {
      const schema: JSONSchema7 = { type: "string" };
      const errors = getDetailedValidationErrors(123, schema);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatchObject({
        path: "",
        code: expect.any(String),
        message: expect.any(String)
      });
    });

    test("should handle $ref resolution", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          StringType: { type: "string", minLength: 5 }
        }
      };
      
      const schema: JSONSchema7 = { $ref: "#/definitions/StringType" };
      const errors = getDetailedValidationErrors("hi", schema, undefined, rootSchema);
      
      expect(errors.length).toBeGreaterThan(0);
    });

    test("should handle nested object validation errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 },
          age: { type: "number", minimum: 18 }
        },
        required: ["name", "age"]
      };
      
      const errors = getDetailedValidationErrors(
        { name: "Jo", age: 15 },
        schema
      );
      
      expect(errors.length).toBeGreaterThan(0);
      const paths = errors.map(e => e.path);
      expect(paths).toContain("name");
      expect(paths).toContain("age");
    });

    test("should handle array validation errors", () => {
      const schema: JSONSchema7 = {
        type: "array",
        items: { type: "string", minLength: 2 },
        minItems: 2
      };
      
      const errors = getDetailedValidationErrors(["a"], schema);
      
      expect(errors.length).toBeGreaterThan(0);
      const codes = errors.map(e => e.code);
      expect(codes).toContain("MIN_ITEMS");
      expect(codes).toContain("MIN_LENGTH");
    });

    test("should handle custom formats", () => {
      const schema: JSONSchema7 = {
        type: "string",
        format: "product-id"
      };
      
      const customFormats = {
        "product-id": (value: string) => value.startsWith("PROD-") && value.length === 10
      };
      
      const errors = getDetailedValidationErrors(
        "invalid-id",
        schema,
        customFormats
      );
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("FORMAT");
    });

    test("should handle path parameter correctly", () => {
      const schema: JSONSchema7 = { type: "string", minLength: 5 };
      const errors = getDetailedValidationErrors(
        "hi",
        schema,
        undefined,
        undefined,
        "user.name"
      );
      
      expect(errors[0].path).toBe("user.name");
    });

    test("should handle composition schemas (allOf)", () => {
      const schema: JSONSchema7 = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 3 } // Impossible constraint
        ]
      };
      
      const errors = getDetailedValidationErrors("hello", schema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("should handle enum validation errors", () => {
      const schema: JSONSchema7 = {
        type: "string",
        enum: ["red", "green", "blue"]
      };
      
      const errors = getDetailedValidationErrors("yellow", schema);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("ENUM");
    });
  });

  describe("getSpecificValidationErrors", () => {
    test("should return errors for specific field path", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 },
          age: { type: "number", minimum: 18 }
        }
      };
      
      const value = { name: "Jo", age: 25 };
      const errors = getSpecificValidationErrors(value, schema, "name");
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].path).toBe("name");
    });

    test("should return empty array when field is valid", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 }
        }
      };
      
      const value = { name: "John" };
      const errors = getSpecificValidationErrors(value, schema, "name");
      
      expect(errors).toEqual([]);
    });

    test("should handle nested field paths", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              profile: {
                type: "object", 
                properties: {
                  name: { type: "string", minLength: 3 }
                }
              }
            }
          }
        }
      };
      
      const value = { 
        user: { 
          profile: { 
            name: "Jo" 
          } 
        } 
      };
      
      const errors = getSpecificValidationErrors(value, schema, "user.profile.name");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].path).toBe("user.profile.name");
    });

    test("should handle array field paths", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string", minLength: 2 }
          }
        }
      };
      
      const value = { items: ["a", "bb", "c"] };
      const errors = getSpecificValidationErrors(value, schema, "items[0]");
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].path).toBe("items[0]");
    });

    test("should handle non-existent field paths", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        }
      };
      
      const value = { name: "John" };
      const errors = getSpecificValidationErrors(value, schema, "nonexistent");
      
      expect(errors).toEqual([]);
    });

    test("should work with custom formats", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: { type: "string", format: "product-id" }
        }
      };
      
      const customFormats = {
        "product-id": (value: string) => value.startsWith("PROD-")
      };
      
      const value = { id: "invalid-id" };
      const errors = getSpecificValidationErrors(
        value,
        schema,
        "id",
        customFormats
      );
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].path).toBe("id");
      expect(errors[0].code).toBe("FORMAT");
    });
  });

  describe("edge cases", () => {
    test("should handle null and undefined values gracefully", () => {
      const schema: JSONSchema7 = { type: "string" };
      
      expect(getDetailedValidationErrors(null, schema)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "TYPE_MISMATCH" })
        ])
      );
      
      expect(getDetailedValidationErrors(undefined, schema)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "TYPE_MISMATCH" })
        ])
      );
    });

    test("should handle circular references in schema resolution", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          Node: {
            type: "object",
            properties: {
              value: { type: "string" },
              next: { $ref: "#/definitions/Node" }
            }
          }
        }
      };
      
      const schema: JSONSchema7 = { $ref: "#/definitions/Node" };
      
      // Should not throw - circular reference detection should prevent infinite loops
      expect(() => {
        getDetailedValidationErrors({ value: "test" }, schema, undefined, rootSchema);
      }).not.toThrow();
    });

    test("should handle malformed schema gracefully", () => {
      const schema = { type: "invalid-type" } as any;
      
      expect(() => {
        getDetailedValidationErrors("test", schema);
      }).not.toThrow();
    });
  });
});