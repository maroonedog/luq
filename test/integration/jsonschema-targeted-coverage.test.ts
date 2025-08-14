import { describe, test, expect } from "@jest/globals";
import { 
  validateValueAgainstSchema,
  getDetailedValidationErrors,
  getSpecificValidationErrors,
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  getBaseChain,
  applyConstraints,
  resolveRef
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Targeted Coverage", () => {
  describe("validateValueAgainstSchema - Uncovered Paths", () => {
    test("should handle draft-04 boolean exclusiveMinimum/Maximum", () => {
      // Line 302: if (value <= schema.minimum) return false;
      const schemaMin: any = {
        type: "number",
        minimum: 10,
        exclusiveMinimum: true
      };
      expect(validateValueAgainstSchema(10, schemaMin)).toBe(false);
      expect(validateValueAgainstSchema(11, schemaMin)).toBe(true);
      
      // Line 320: if (value >= schema.maximum) return false;
      const schemaMax: any = {
        type: "number",
        maximum: 100,
        exclusiveMaximum: true
      };
      expect(validateValueAgainstSchema(100, schemaMax)).toBe(false);
      expect(validateValueAgainstSchema(99, schemaMax)).toBe(true);
    });

    test("should handle additionalItems with boolean false", () => {
      // Line 461-474: additionalItems false branch
      const schema: JSONSchema7 = {
        type: "array",
        items: [
          { type: "string" },
          { type: "number" }
        ],
        additionalItems: false
      };
      
      expect(validateValueAgainstSchema(["test", 42], schema)).toBe(true);
      expect(validateValueAgainstSchema(["test", 42, "extra"], schema)).toBe(false);
    });

    test("should handle additionalItems with schema", () => {
      // Line 478-485: additionalItems schema validation
      const schema: JSONSchema7 = {
        type: "array",
        items: [
          { type: "string" }
        ],
        additionalItems: { type: "number" }
      };
      
      expect(validateValueAgainstSchema(["test", 42, 84], schema)).toBe(true);
      expect(validateValueAgainstSchema(["test", "not-number"], schema)).toBe(false);
    });

    test("should handle contains validation", () => {
      // Line 491-514: contains logic
      const schema: JSONSchema7 = {
        type: "array",
        contains: {
          type: "number",
          minimum: 10
        }
      };
      
      expect(validateValueAgainstSchema([5, 15, 8], schema)).toBe(true); // 15 matches
      expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(false); // none match
      expect(validateValueAgainstSchema([], schema)).toBe(false); // empty array
    });

    test("should handle object patternProperties validation", () => {
      // Lines around 430-438
      const schema: JSONSchema7 = {
        type: "object",
        patternProperties: {
          "^str_": { type: "string" },
          "^num_": { type: "number" }
        }
      };
      
      expect(validateValueAgainstSchema({
        str_name: "value",
        num_count: 42,
        other: "anything"
      }, schema)).toBe(true);
      
      expect(validateValueAgainstSchema({
        str_name: 123 // wrong type for pattern
      }, schema)).toBe(false);
    });

    test("should handle propertyNames validation", () => {
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          pattern: "^[a-z]+$"
        }
      };
      
      expect(validateValueAgainstSchema({ name: "value", age: 30 }, schema)).toBe(true);
      expect(validateValueAgainstSchema({ "123invalid": "value" }, schema)).toBe(false);
    });

    test("should handle dependencies array validation", () => {
      // Lines 444-457
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          creditCard: { type: "string" },
          cvv: { type: "string" },
          billing: { type: "string" }
        },
        dependencies: {
          creditCard: ["cvv", "billing"]
        }
      };
      
      expect(validateValueAgainstSchema({
        creditCard: "1234",
        cvv: "123",
        billing: "address"
      }, schema)).toBe(true);
      
      expect(validateValueAgainstSchema({
        creditCard: "1234"
        // missing dependencies
      }, schema)).toBe(false);
    });

    test("should handle dependencies schema validation", () => {
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
    });
  });

  describe("getDetailedValidationErrors - Uncovered paths", () => {
    test("should handle if/then/else validation errors", () => {
      // Lines 527-645: if/then/else validation logic
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: {},
          required_field: { type: "string" }
        },
        if: {
          properties: {
            type: { const: "special" }
          }
        },
        then: {
          required: ["required_field"],
          properties: {
            value: { type: "number", minimum: 10 }
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
        { type: "special", value: 5 }, // value too small
        schema
      );
      expect(errors1.length).toBeGreaterThan(0);
      
      // Test if condition doesn't match, else validation fails
      const errors2 = getDetailedValidationErrors(
        { type: "other", value: "hi" }, // value too short
        schema
      );
      expect(errors2.length).toBeGreaterThan(0);
      
      // Test missing required field in then
      const errors3 = getDetailedValidationErrors(
        { type: "special", value: 15 }, // missing required_field
        schema
      );
      expect(errors3.some(e => e.path.includes("required_field"))).toBe(true);
    });
  });

  describe("getSpecificValidationErrors - Uncovered paths", () => {
    test("should get errors for nested path validation", () => {
      // Lines 654-744: specific path validation
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
      expect(errors.some(e => e.path.includes("field"))).toBe(true);
    });

    test("should handle array validation at specific path", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: { type: "number", minimum: 10 }
              },
              required: ["value"]
            }
          }
        }
      };
      
      const errors = getSpecificValidationErrors(
        { items: [{ value: 5 }, { value: 15 }] },
        schema,
        "/items"
      );
      
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("convertJsonSchemaToLuqDSL - Uncovered paths", () => {
    test("should handle tuple arrays with additionalItems", () => {
      // Lines 837-838, 920, 931
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          coords: {
            type: "array",
            items: [
              { type: "number" },
              { type: "number" }
            ],
            additionalItems: { type: "string" }
          }
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const coordsDsl = dsl.find(d => d.path === "coords");
      expect(coordsDsl?.constraints?.items).toBeInstanceOf(Array);
      expect((coordsDsl?.constraints as any)?.additionalItems).toBeDefined();
    });

    test("should handle root schema additionalProperties", () => {
      // Lines 756-759
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: { type: "number" }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      // Check if root constraints are captured
      const hasAdditionalProperties = dsl.some(d => 
        d.path === "" && d.constraints?.additionalProperties
      );
      expect(hasAdditionalProperties).toBe(true);
    });

    test("should handle propertyNames constraints", () => {
      // Lines 774-777
      const schema: JSONSchema7 = {
        type: "object",
        propertyNames: {
          pattern: "^[a-z]+$"
        }
      };
      
      const dsl = convertJsonSchemaToLuqDSL(schema);
      const rootConstraints = dsl.find(d => d.path === "");
      expect(rootConstraints?.constraints?.propertyNames).toBeDefined();
    });
  });

  describe("convertDSLToFieldDefinition - Uncovered paths", () => {
    test("should handle multipleTypes with oneOf", () => {
      // Lines 1011-1012
      const dsl = {
        path: "field",
        type: "string" as const,
        multipleTypes: ["string", "number", "boolean"],
        constraints: {}
      };
      
      const mockBuilder = {
        oneOf: jest.fn().mockReturnThis()
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });

    test("should handle const constraint with literal", () => {
      // Lines 1036, 1073, 1079
      const dsl = {
        path: "field",
        type: "string" as const,
        constraints: {
          const: "exact-value"
        }
      };
      
      const mockBuilder = {
        literal: jest.fn().mockReturnThis()
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.literal).toHaveBeenCalledWith("exact-value");
    });

    test("should handle custom format with refine", () => {
      // Lines 1120-1125, 1131-1145
      const dsl = {
        path: "ssn",
        type: "string" as const,
        constraints: {
          format: "ssn"
        }
      };
      
      const customFormats = {
        ssn: jest.fn((v: string) => /^\d{3}-\d{2}-\d{4}$/.test(v))
      };
      
      const mockBuilder = {
        string: {
          refine: jest.fn().mockReturnThis()
        }
      };
      
      const definition = convertDSLToFieldDefinition(dsl, customFormats);
      definition(mockBuilder);
      
      expect(mockBuilder.string.refine).toHaveBeenCalledWith(customFormats.ssn);
    });

    test("should handle tuple builder", () => {
      // Line 1186
      const dsl: any = {
        path: "tuple",
        type: "array",
        constraints: {
          items: [
            { type: "string" },
            { type: "number" }
          ]
        }
      };
      
      const mockBuilder = {
        tupleBuilder: jest.fn().mockReturnValue({
          tuple: jest.fn().mockReturnThis()
        })
      };
      
      const definition = convertDSLToFieldDefinition(dsl);
      definition(mockBuilder);
      
      expect(mockBuilder.tupleBuilder).toHaveBeenCalled();
    });
  });

  describe("applyConstraints - Uncovered paths", () => {
    test("should handle object constraints", () => {
      // Lines 1274-1280, 1294-1300
      const constraints: any = {
        minProperties: 2,
        maxProperties: 10,
        additionalProperties: { type: "string" }
      };
      
      const mockChain = {
        minProperties: jest.fn().mockReturnThis(),
        maxProperties: jest.fn().mockReturnThis(),
        additionalProperties: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      
      expect(mockChain.minProperties).toHaveBeenCalledWith(2);
      expect(mockChain.maxProperties).toHaveBeenCalledWith(10);
      expect(mockChain.additionalProperties).toHaveBeenCalled();
    });

    test("should handle propertyNames constraint", () => {
      // Lines 1370-1374
      const constraints: any = {
        propertyNames: {
          enum: ["name", "age", "email"]
        }
      };
      
      const mockChain = {
        propertyNames: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      
      expect(mockChain.propertyNames).toHaveBeenCalledWith(
        expect.objectContaining({
          validator: expect.any(Function)
        })
      );
    });

    test("should handle allOf validation", () => {
      // Lines 1407, 1421-1429, 1449
      const constraints: any = {
        allOf: [
          { type: "string", minLength: 5 },
          { type: "string", maxLength: 10 }
        ]
      };
      
      const mockChain = {
        custom: jest.fn((validator) => {
          // Test the validator function directly
          expect(validator("hello")).toBe(true);
          expect(validator("hi")).toBe(false); // too short
          expect(validator("verylongstring")).toBe(false); // too long
          return mockChain;
        })
      };
      
      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should handle anyOf validation", () => {
      const constraints: any = {
        anyOf: [
          { type: "string", minLength: 10 },
          { type: "number", minimum: 100 }
        ]
      };
      
      const mockChain = {
        custom: jest.fn((validator) => {
          expect(validator("long string here")).toBe(true);
          expect(validator(150)).toBe(true);
          expect(validator("short")).toBe(false);
          expect(validator(50)).toBe(false);
          return mockChain;
        })
      };
      
      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should handle oneOf validation", () => {
      const constraints: any = {
        oneOf: [
          { type: "string", maxLength: 5 },
          { type: "string", minLength: 10 }
        ]
      };
      
      const mockChain = {
        custom: jest.fn((validator) => {
          expect(validator("hi")).toBe(true); // matches first only
          expect(validator("verylongstring")).toBe(true); // matches second only
          expect(validator("medium")).toBe(false); // matches both or none
          return mockChain;
        })
      };
      
      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should handle conditional validation", () => {
      // Lines 1519-1535
      const constraints: any = {
        if: { properties: { type: { const: "A" } } },
        then: { properties: { value: { type: "number" } } },
        else: { properties: { value: { type: "string" } } }
      };
      
      const mockChain = {
        custom: jest.fn((validator) => {
          expect(validator({ type: "A", value: 42 })).toBe(true);
          expect(validator({ type: "A", value: "string" })).toBe(false);
          expect(validator({ type: "B", value: "string" })).toBe(true);
          expect(validator({ type: "B", value: 42 })).toBe(false);
          return mockChain;
        })
      };
      
      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });

    test("should handle requiredIf conditional", () => {
      // Lines 1484-1490, 1506
      const constraints: any = {
        if: { properties: { hasAccount: { const: true } } },
        then: { required: ["username", "password"] }
      };
      
      const mockChain = {
        custom: jest.fn().mockReturnThis(),
        requiredIf: jest.fn().mockReturnThis()
      };
      
      applyConstraints(mockChain, constraints);
      expect(mockChain.custom).toHaveBeenCalled();
    });
  });

  describe("getBaseChain - Uncovered paths", () => {
    test("should handle multiple types with oneOf", () => {
      // Lines 1589-1604
      const schema: JSONSchema7 = {
        type: ["string", "number", "boolean"]
      };
      
      const mockBuilder = {
        oneOf: jest.fn(() => ({ type: "oneOf" }))
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.oneOf).toHaveBeenCalled();
    });

    test("should handle null type only", () => {
      // Line 1579
      const schema: JSONSchema7 = {
        type: "null"
      };
      
      const mockBuilder = {
        literal: jest.fn((val) => ({ type: "literal", value: val }))
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(mockBuilder.literal).toHaveBeenCalledWith(null);
    });

    test("should handle date builder when available", () => {
      // Lines 1631-1634
      const schema: any = {
        type: "string",
        format: "date"
      };
      
      const mockBuilder = {
        date: { type: "date" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("date");
    });

    test("should default to string for unknown type", () => {
      // Line 1647
      const schema: any = {
        type: "unknown"
      };
      
      const mockBuilder = {
        string: { type: "string" }
      };
      
      const chain = getBaseChain(mockBuilder, schema);
      expect(chain.type).toBe("string");
    });
  });

  describe("resolveRef - Error cases", () => {
    test("should throw for external references", () => {
      expect(() => {
        resolveRef("http://example.com/schema", {});
      }).toThrow("External $ref not supported");
    });

    test("should throw for unresolvable references", () => {
      expect(() => {
        resolveRef("#/definitions/nonexistent", {});
      }).toThrow("Cannot resolve $ref");
    });

    test("should handle $defs references", () => {
      const rootSchema: JSONSchema7 = {
        $defs: {
          user: {
            type: "string"
          }
        }
      };
      
      const resolved = resolveRef("#/$defs/user", rootSchema);
      expect(resolved).toEqual({ type: "string" });
    });
  });
});
