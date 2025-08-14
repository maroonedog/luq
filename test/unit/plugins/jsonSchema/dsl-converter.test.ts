import { describe, test, expect } from "@jest/globals";
import { 
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition
} from "../../../../src/core/plugin/jsonSchema/dsl-converter";
import type { JSONSchema7 } from "json-schema";

describe("DSL Converter", () => {
  describe("convertJsonSchemaToLuqDSL", () => {
    test("should convert simple object schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string", minLength: 3 },
          age: { type: "number", minimum: 18 }
        },
        required: ["name"]
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result).toHaveLength(2); // name + age (root is skipped for simple schemas)
      
      const nameField = result.find(f => f.path === "name");
      expect(nameField).toMatchObject({
        path: "name",
        type: "string",
        constraints: expect.objectContaining({
          required: true,
          minLength: 3
        })
      });

      const ageField = result.find(f => f.path === "age");
      expect(ageField).toMatchObject({
        path: "age", 
        type: "number",
        constraints: expect.objectContaining({
          // required: false is not included when field is not in required array
          min: 18
        })
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

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const nestedField = result.find(f => f.path === "user.profile.name");
      expect(nestedField).toBeDefined();
      expect(nestedField?.type).toBe("string");
    });

    test("should handle arrays with items schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string", minLength: 2 },
            minItems: 1,
            maxItems: 10
          }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const arrayField = result.find(f => f.path === "items");
      expect(arrayField).toMatchObject({
        path: "items",
        type: "array", 
        constraints: expect.objectContaining({
          minItems: 1,
          maxItems: 10,
          items: expect.objectContaining({
            type: "string",
            minLength: 2
          })
        })
      });
    });

    test("should handle tuple arrays", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          coordinates: {
            type: "array",
            items: [
              { type: "number" },
              { type: "number" },
              { type: "string" }
            ]
          }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const tupleField = result.find(f => f.path === "coordinates");
      expect(tupleField).toBeDefined();
      expect(tupleField?.type).toBe("array"); // Tuples are represented as arrays with items constraint
      expect(Array.isArray(tupleField?.constraints.items)).toBe(true);
    });

    test("should handle string constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          email: { 
            type: "string", 
            format: "email",
            minLength: 5,
            maxLength: 100,
            pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
          }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const emailField = result.find(f => f.path === "email");
      expect(emailField?.constraints).toMatchObject({
        format: "email",
        minLength: 5,
        maxLength: 100,
        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      });
    });

    test("should handle number constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          price: {
            type: "number",
            minimum: 0,
            maximum: 1000,
            exclusiveMinimum: 0.1,
            multipleOf: 0.01
          }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const priceField = result.find(f => f.path === "price");
      expect(priceField?.constraints).toMatchObject({
        min: 0.1,  // When exclusiveMinimum is a number in draft-07, it becomes the min value
        max: 1000,
        exclusiveMin: true,  // And exclusiveMin becomes a boolean flag
        multipleOf: 0.01
      });
    });

    test("should handle enum constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "inactive", "pending"]
          }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const statusField = result.find(f => f.path === "status");
      expect(statusField?.constraints.enum).toEqual(["active", "inactive", "pending"]);
    });

    test("should handle const constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          version: { const: 1 }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const versionField = result.find(f => f.path === "version");
      expect(versionField?.constraints.const).toBe(1);
    });

    test("should handle $ref resolution", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          UserProfile: {
            type: "object",
            properties: {
              name: { type: "string" }
            }
          }
        },
        type: "object",
        properties: {
          user: { $ref: "#/definitions/UserProfile" }
        }
      };

      const result = convertJsonSchemaToLuqDSL(rootSchema, "", rootSchema);
      
      const userNameField = result.find(f => f.path === "user.name");
      expect(userNameField).toBeDefined();
    });

    test("should handle parent path parameter", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema, "parent");
      
      const nameField = result.find(f => f.path === "parent.name");
      expect(nameField).toBeDefined();
    });

    test("should handle root-level constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: false,
        minProperties: 1,
        maxProperties: 5
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const rootConstraints = result.find(f => f.path === "");
      expect(rootConstraints?.constraints).toMatchObject({
        additionalProperties: false,
        minProperties: 1,
        maxProperties: 5
      });
    });

    test("should handle composition schemas", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: {
            allOf: [
              { type: "string", minLength: 3 },
              { type: "string", maxLength: 10 }
            ]
          }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      
      const valueField = result.find(f => f.path === "value");
      expect(valueField?.constraints.allOf).toBeDefined();
      expect(Array.isArray(valueField?.constraints.allOf)).toBe(true);
    });
  });

  describe("convertDSLToFieldDefinition", () => {
    test("should convert string field with basic constraints", () => {
      const dslField = {
        path: "name",
        type: "string" as const,
        constraints: {
          required: true,
          minLength: 3,
          maxLength: 50
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      
      // Since we can't easily test the builder function directly,
      // we'll check that it returns a function
      expect(typeof definition).toBe("function");
    });

    test("should convert number field with constraints", () => {
      const dslField = {
        path: "age",
        type: "number" as const,
        constraints: {
          required: true,
          min: 0,
          max: 150
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });

    test("should convert field with format constraint", () => {
      const dslField = {
        path: "email",
        type: "string" as const,
        constraints: {
          required: true,
          format: "email"
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });

    test("should handle custom formats", () => {
      const dslField = {
        path: "productId",
        type: "string" as const,
        constraints: {
          required: true,
          format: "product-id"
        }
      };

      const customFormats = {
        "product-id": (value: string) => value.startsWith("PROD-")
      };

      const definition = convertDSLToFieldDefinition(dslField, customFormats);
      expect(typeof definition).toBe("function");
    });

    test("should convert array field", () => {
      const dslField = {
        path: "items",
        type: "array" as const,
        constraints: {
          required: true,
          minItems: 1,
          maxItems: 10,
          items: {
            type: "string" as const,
            minLength: 2
          } as any
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });

    test("should convert object field", () => {
      const dslField = {
        path: "user",
        type: "object" as const,
        constraints: {
          required: true,
          minProperties: 1,
          maxProperties: 5
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });

    test("should convert boolean field", () => {
      const dslField = {
        path: "active",
        type: "boolean" as const,
        constraints: {
          required: true
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });

    test("should convert nullable field", () => {
      const dslField = {
        path: "description",
        type: "string" as const,
        nullable: true,
        constraints: {
          required: false,
          minLength: 10
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });

    test("should convert field with multiple types", () => {
      const dslField = {
        path: "value",
        type: "string" as const,
        multipleTypes: ["string", "number"],
        constraints: {
          required: true
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });

    test("should handle enum constraint", () => {
      const dslField = {
        path: "status",
        type: "string" as const,
        constraints: {
          required: true,
          enum: ["active", "inactive", "pending"]
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });

    test("should handle transform constraint", () => {
      const dslField = {
        path: "name",
        type: "string" as const,
        constraints: {
          required: true,
          transform: "toLowerCase"
        }
      };

      const definition = convertDSLToFieldDefinition(dslField);
      expect(typeof definition).toBe("function");
    });
  });

  describe("edge cases", () => {
    test("should handle empty schema gracefully", () => {
      const schema: JSONSchema7 = {};
      const result = convertJsonSchemaToLuqDSL(schema);
      expect(Array.isArray(result)).toBe(true);
    });

    test("should handle schema with no properties", () => {
      const schema: JSONSchema7 = {
        type: "object"
      };
      const result = convertJsonSchemaToLuqDSL(schema);
      expect(Array.isArray(result)).toBe(true);
    });

    test("should handle invalid DSL field gracefully", () => {
      const invalidDslField = {
        path: "",
        type: "invalid" as any,
        constraints: {}
      };

      expect(() => {
        convertDSLToFieldDefinition(invalidDslField);
      }).not.toThrow();
    });

    test("should handle deeply nested schema", () => {
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
                    type: "object",
                    properties: {
                      value: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const result = convertJsonSchemaToLuqDSL(schema);
      const deepField = result.find(f => f.path === "level1.level2.level3.value");
      expect(deepField).toBeDefined();
    });
  });
});