import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  getSpecificValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  resolveRef
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Final 140 Lines Coverage", () => {
  describe("resolveRef - Lines 94, 109, 126-127", () => {
    test("should throw for external references", () => {
      expect(() => {
        resolveRef("http://external.com/schema", {});
      }).toThrow("External $ref not supported");
    });

    test("should handle $ref resolution in validation", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          stringType: { type: "string", minLength: 3 }
        }
      };
      
      const schema: JSONSchema7 = { $ref: "#/definitions/stringType" };
      
      // This should hit lines 126-127: schema = resolveRef(schema.$ref, rootSchema);
      expect(validateValueAgainstSchema("hello", schema, undefined, rootSchema)).toBe(true);
      expect(validateValueAgainstSchema("hi", schema, undefined, rootSchema)).toBe(false);
    });
  });

  describe("exclusiveMinimum/Maximum boolean - Lines 302, 312, 320, 330, 334", () => {
    test("should handle draft-04 exclusiveMinimum boolean", () => {
      const schema: any = {
        type: "number",
        minimum: 10,
        exclusiveMinimum: true
      };
      
      // Hit line 302: if (value <= schema.minimum) return false;
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
      expect(validateValueAgainstSchema(11, schema)).toBe(true);
    });

    test("should handle draft-07 exclusiveMinimum number", () => {
      const schema: JSONSchema7 = {
        type: "number", 
        exclusiveMinimum: 10
      };
      
      // Hit line 312: if (value <= schema.exclusiveMinimum) return false;
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
      expect(validateValueAgainstSchema(11, schema)).toBe(true);
    });

    test("should handle draft-04 exclusiveMaximum boolean", () => {
      const schema: any = {
        type: "number",
        maximum: 100,
        exclusiveMaximum: true  
      };
      
      // Hit line 320: if (value >= schema.maximum) return false;
      expect(validateValueAgainstSchema(100, schema)).toBe(false);
      expect(validateValueAgainstSchema(99, schema)).toBe(true);
    });

    test("should handle draft-07 exclusiveMaximum number", () => {
      const schema: JSONSchema7 = {
        type: "number",
        exclusiveMaximum: 100
      };
      
      // Hit line 330: if (value >= schema.exclusiveMaximum) return false;
      expect(validateValueAgainstSchema(100, schema)).toBe(false);
      expect(validateValueAgainstSchema(99, schema)).toBe(true);
    });

    test("should handle multipleOf validation", () => {
      const schema: JSONSchema7 = {
        type: "number",
        multipleOf: 3
      };
      
      // Hit line 334: if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) return false;
      expect(validateValueAgainstSchema(9, schema)).toBe(true);
      expect(validateValueAgainstSchema(10, schema)).toBe(false);
    });
  });

  describe("Object validation - Lines 372, 377, 397, 404-406", () => {
    test("should handle minProperties validation failure", () => {
      const schema: JSONSchema7 = {
        type: "object",
        minProperties: 2
      };
      
      // Hit line 372: return false;
      expect(validateValueAgainstSchema({}, schema)).toBe(false);
      expect(validateValueAgainstSchema({a: 1}, schema)).toBe(false);
      expect(validateValueAgainstSchema({a: 1, b: 2}, schema)).toBe(true);
    });

    test("should handle maxProperties validation failure", () => {
      const schema: JSONSchema7 = {
        type: "object", 
        maxProperties: 2
      };
      
      // Hit line 377: return false;
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
      
      // Hit line 397: return false;
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
      
      // Hit lines 404-406: if (!allowedKeys.includes(key)) return false;
      expect(validateValueAgainstSchema({name: "John", extra: "value"}, schema)).toBe(false);
      expect(validateValueAgainstSchema({name: "John"}, schema)).toBe(true);
    });
  });

  describe("Schema composition failures - Lines 430-438, 444-457, 461-474, 478-485, 491-514", () => {
    test("should handle allOf validation failure", () => {
      const schema: JSONSchema7 = {
        allOf: [
          { type: "string", minLength: 10 },
          { type: "string", maxLength: 5 }  // impossible constraint
        ]
      };
      
      // Hit line 438: return false;
      expect(validateValueAgainstSchema("test", schema)).toBe(false);
    });

    test("should handle anyOf validation failure", () => {
      const schema: JSONSchema7 = {
        anyOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      // Hit line 457: if (!anyValid) return false;
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
      
      // Hit line 471: if (validCount > 1) return false;
      expect(validateValueAgainstSchema("hello", schema)).toBe(false); // matches both
    });

    test("should handle oneOf no matches", () => {
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

    test("should handle not validation failure", () => {
      const schema: JSONSchema7 = {
        not: { type: "string" }
      };
      
      // Hit line 485: return false;
      expect(validateValueAgainstSchema("string value", schema)).toBe(false);
      expect(validateValueAgainstSchema(123, schema)).toBe(true);
    });
  });

  describe("Array validation - Lines 344-353, 461-474, 478-485, 491-514", () => {
    test("should handle uniqueItems validation failure", () => {
      const schema: JSONSchema7 = {
        type: "array",
        uniqueItems: true
      };
      
      // Hit lines 352-353: if (seen.has(key)) return false;
      expect(validateValueAgainstSchema([1, 2, 1], schema)).toBe(false);
      expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(true);
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
      
      // Hit lines 461-474
      expect(validateValueAgainstSchema(["test", 42], schema)).toBe(true);
      expect(validateValueAgainstSchema(["test", 42, "extra"], schema)).toBe(false);
    });

    test("should handle additionalItems schema validation", () => {
      const schema: JSONSchema7 = {
        type: "array", 
        items: [{ type: "string" }],
        additionalItems: { type: "number" }
      };
      
      // Hit lines 478-485
      expect(validateValueAgainstSchema(["test", 42, 84], schema)).toBe(true);
      expect(validateValueAgainstSchema(["test", "not-number"], schema)).toBe(false);
    });

    test("should handle contains validation", () => {
      const schema: JSONSchema7 = {
        type: "array",
        contains: {
          type: "number",
          minimum: 10
        }
      };
      
      // Hit lines 491-514
      expect(validateValueAgainstSchema([5, 15, 8], schema)).toBe(true); // 15 matches
      expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(false); // none match
      expect(validateValueAgainstSchema([], schema)).toBe(false); // empty array
    });
  });

  describe("getDetailedValidationErrors - Lines 527-645", () => {
    test("should handle if/then/else validation errors", () => {
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
          required: ["extra"],
          properties: {
            value: { type: "string", minLength: 10 }
          }
        },
        else: {
          properties: {
            value: { type: "string", minLength: 5 }
          }
        }
      };

      // Test if condition matches, then validation fails
      const errors1 = getDetailedValidationErrors(
        { type: "special", value: "short" }, // missing extra, value too short
        schema
      );
      expect(errors1.length).toBeGreaterThan(0);

      // Test if condition doesn't match, else validation fails  
      const errors2 = getDetailedValidationErrors(
        { type: "other", value: "hi" }, // else branch, value too short
        schema
      );
      expect(errors2.length).toBeGreaterThan(0);
    });

    test("should handle complex nested validation errors", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          nested: {
            type: "object", 
            properties: {
              field: { type: "string", minLength: 5 }
            },
            required: ["field"]
          }
        }
      };

      const errors = getDetailedValidationErrors(
        { nested: { field: "hi" } }, // field too short
        schema
      );
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("getSpecificValidationErrors - Lines 654-744", () => {
    test("should validate specific paths", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          deeply: {
            type: "object",
            properties: {
              nested: {
                type: "object", 
                properties: {
                  field: { type: "string", minLength: 5 }
                },
                required: ["field"]
              }
            }
          }
        }
      };

      const errors = getSpecificValidationErrors(
        { deeply: { nested: { field: "hi" } } },
        schema,
        "/deeply/nested"
      );
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("DSL conversion - Lines 756-759, 774-777, 837-838, 882-886, 920, 931", () => {
    test("should handle root schema additionalProperties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: { type: "number" }
      };

      // Hit lines 756-759
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.length).toBeGreaterThan(0);
    });

    test("should handle propertyNames constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          pattern: "^[a-z]+$"
        }
      };

      // Hit lines 774-777  
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl.length).toBeGreaterThan(0);
    });

    test("should handle multipleTypes with null", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            type: ["string", "null"]
          }
        }
      };

      // Hit lines 837-838
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.nullable).toBe(true);
    });

    test("should handle multipleTypes primary type selection", () => {
      const schema: JSONSchema7 = {
        type: "object", 
        properties: {
          field: {
            type: ["null", "string"]
          }
        }
      };

      // Hit lines 882-886
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.type).toBe("string");
      expect(fieldDsl?.nullable).toBe(true);
    });

    test("should handle exclusiveMinimum boolean in DSL", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            type: "number",
            minimum: 10,
            exclusiveMinimum: true as any
          }
        }
      };

      // Hit line 920
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.constraints?.exclusiveMin).toBe(true);
    });

    test("should handle exclusiveMaximum boolean in DSL", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            type: "number", 
            maximum: 100,
            exclusiveMaximum: true as any
          }
        }
      };

      // Hit line 931
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const fieldDsl = dsl.find(d => d.path === "field");
      expect(fieldDsl?.constraints?.exclusiveMax).toBe(true);
    });
  });

  describe("Direct line coverage - Specific validation paths", () => {
    test("should hit integer type validation", () => {
      const schema: JSONSchema7 = { type: "integer" };
      
      expect(validateValueAgainstSchema(42, schema)).toBe(true);
      expect(validateValueAgainstSchema(3.14, schema)).toBe(false);
    });

    test("should hit NaN validation", () => {
      const schema: JSONSchema7 = { type: "number" };
      
      expect(validateValueAgainstSchema(NaN, schema)).toBe(false);
      expect(validateValueAgainstSchema(42, schema)).toBe(true);
    });

    test("should hit format validation", () => {
      const formats = [
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

    test("should hit patternProperties validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        patternProperties: {
          "^str_": { type: "string" },
          "^num_": { type: "number" }
        }
      };

      expect(validateValueAgainstSchema({
        str_name: "value",
        num_count: 42
      }, schema)).toBe(true);

      expect(validateValueAgainstSchema({
        str_name: 123 // wrong type for pattern
      }, schema)).toBe(false);
    });

    test("should hit propertyNames validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          pattern: "^[a-z]+$"
        }
      };

      expect(validateValueAgainstSchema({ name: "value" }, schema)).toBe(true);
      expect(validateValueAgainstSchema({ "123invalid": "value" }, schema)).toBe(false);
    });

    test("should hit dependencies array validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          creditCard: { type: "string" },
          cvv: { type: "string" }
        },
        dependencies: {
          creditCard: ["cvv"]
        }
      };

      expect(validateValueAgainstSchema({
        creditCard: "1234",
        cvv: "123"
      }, schema)).toBe(true);

      expect(validateValueAgainstSchema({
        creditCard: "1234"
        // missing cvv dependency  
      }, schema)).toBe(false);
    });

    test("should hit dependencies schema validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
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

      expect(validateValueAgainstSchema({
        name: "John",
        age: 25
      }, schema)).toBe(true);

      expect(validateValueAgainstSchema({
        name: "John",
        age: 10 // too young
      }, schema)).toBe(false);

      expect(validateValueAgainstSchema({
        name: "John"
        // missing age
      }, schema)).toBe(false);
    });
  });

  describe("Complex edge cases", () => {
    test("should handle $defs references", () => {
      const rootSchema: JSONSchema7 = {
        $defs: {
          user: { type: "string" }
        }
      };

      const resolved = resolveRef("#/$defs/user", rootSchema);
      expect(resolved).toEqual({ type: "string" });
    });

    test("should handle circular schema references", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          parent: { $ref: "#" }
        }
      };

      expect(validateValueAgainstSchema({
        name: "Item"
      }, schema)).toBe(true);

      expect(validateValueAgainstSchema({
        name: "Parent",
        parent: {
          name: "GrandParent"
        }
      }, schema)).toBe(true);
    });
  });
});