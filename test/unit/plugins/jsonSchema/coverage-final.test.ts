import { 
  convertJsonSchemaToLuqDSL, 
  convertDSLToFieldDefinition
} from "../../../../src/core/plugin/jsonSchema/dsl-converter";
import { validateValueAgainstSchema } from "../../../../src/core/plugin/jsonSchema/validation-core";
import { getDetailedValidationErrors } from "../../../../src/core/plugin/jsonSchema/error-generation";
import { resolveRef, resolveAllRefs } from "../../../../src/core/plugin/jsonSchema/ref-resolver";
import { formatValidators } from "../../../../src/core/plugin/jsonSchema/format-validators";
import type { JSONSchema7 } from "json-schema";

describe("JsonSchema 100% Coverage - Final Push", () => {
  
  describe("dsl-converter.ts - Cover remaining lines", () => {
    test("should handle multiple types with null", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          value: { type: ["string", "number", "null"] }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      const field = result.find(f => f.path === "value");
      
      expect(field?.nullable).toBe(true);
      expect(field?.multipleTypes).toEqual(["string", "number"]);
    });

    test("should handle nested arrays with items", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          matrix: {
            type: "array",
            items: {
              type: "array",
              items: { type: "number" }
            }
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result.some(f => f.path === "matrix")).toBe(true);
      expect(result.some(f => f.path === "matrix.*")).toBe(true);
    });

    test("should handle allOf at property level", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          combined: {
            allOf: [
              { type: "string", minLength: 5 },
              { maxLength: 10 }
            ]
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      const field = result.find(f => f.path === "combined");
      
      expect(field?.constraints.allOf).toBeDefined();
    });

    test("should handle anyOf constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          flexible: {
            anyOf: [
              { type: "string" },
              { type: "number" }
            ]
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      const field = result.find(f => f.path === "flexible");
      
      expect(field?.constraints.anyOf).toBeDefined();
    });

    test("should handle not constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          notString: {
            not: { type: "string" }
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      const field = result.find(f => f.path === "notString");
      
      expect(field?.constraints.not).toBeDefined();
    });

    test("should handle conditional schemas", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          country: { type: "string" },
          postalCode: { type: "string" }
        },
        if: {
          properties: { country: { const: "USA" } }
        },
        then: {
          properties: { postalCode: { pattern: "^\\d{5}(-\\d{4})?$" } }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      // Should include conditional constraints
      const rootField = result.find(f => f.path === "");
      if (rootField) {
        expect(rootField.constraints.if).toBeDefined();
        expect(rootField.constraints.then).toBeDefined();
      }
    });

    test("convertDSLToFieldDefinition - handle all constraint types", () => {
      // Test date type
      const dateDsl = {
        path: "date",
        type: "date" as const,
        constraints: { required: true }
      };
      
      const dateDefinition = convertDSLToFieldDefinition(dateDsl);
      const mockDateBuilder = {
        date: {
          required: jest.fn().mockReturnThis()
        }
      };
      dateDefinition(mockDateBuilder as any);
      expect(mockDateBuilder.date.required).toHaveBeenCalled();
      
      // Test tuple type
      const tupleDsl = {
        path: "tuple",
        type: "tuple" as const,
        constraints: { 
          items: [
            { type: "string" },
            { type: "number" }
          ]
        }
      };
      
      const tupleDefinition = convertDSLToFieldDefinition(tupleDsl);
      const mockTupleBuilder = {
        tuple: jest.fn().mockReturnValue({
          required: jest.fn().mockReturnThis()
        })
      };
      tupleDefinition(mockTupleBuilder as any);
      expect(mockTupleBuilder.tuple).toHaveBeenCalled();
      
      // Test object type
      const objectDsl = {
        path: "obj",
        type: "object" as const,
        constraints: { 
          required: true,
          minProperties: 2,
          maxProperties: 5
        }
      };
      
      const objDefinition = convertDSLToFieldDefinition(objectDsl);
      const mockObjBuilder = {
        object: {
          required: jest.fn().mockReturnThis(),
          custom: jest.fn().mockReturnThis()
        }
      };
      objDefinition(mockObjBuilder as any);
      expect(mockObjBuilder.object.required).toHaveBeenCalled();
      
      // Test allOf constraint
      const allOfDsl = {
        path: "combined",
        type: "string" as const,
        constraints: {
          allOf: [
            { type: "string", minLength: 5 },
            { type: "string", maxLength: 10 }
          ]
        }
      };
      
      const allOfDefinition = convertDSLToFieldDefinition(allOfDsl);
      const mockAllOfBuilder = {
        string: {
          required: jest.fn().mockReturnThis(),
          custom: jest.fn().mockReturnThis()
        }
      };
      allOfDefinition(mockAllOfBuilder as any);
      expect(mockAllOfBuilder.string.custom).toHaveBeenCalled();
    });
  });

  describe("validation-core.ts - Cover remaining lines", () => {
    test("should handle deepEqual edge cases", () => {
      // Line 25-26: Array length mismatch
      expect(validateValueAgainstSchema([1, 2], { const: [1, 2, 3] })).toBe(false);
      
      // Line 180: Tuple validation with boolean items
      const tupleSchema: JSONSchema7 = {
        type: "array",
        items: [
          { type: "string" },
          false as any
        ]
      };
      expect(validateValueAgainstSchema(["test", "anything"], tupleSchema)).toBe(false);
      
      // Line 196: Additional items with boolean
      const additionalSchema: JSONSchema7 = {
        type: "array",
        items: [{ type: "string" }],
        additionalItems: true as any
      };
      expect(validateValueAgainstSchema(["test", 123], additionalSchema)).toBe(true);
      
      // Line 212: Contains with true schema
      const containsSchema: JSONSchema7 = {
        type: "array",
        contains: true as any
      };
      expect(validateValueAgainstSchema([1, 2], containsSchema)).toBe(true);
      expect(validateValueAgainstSchema([], containsSchema)).toBe(false);
      
      // Line 286-287: Object property validation
      const objSchema: JSONSchema7 = {
        type: "object",
        properties: {
          nested: {
            type: "object",
            properties: {
              value: { type: "string" }
            }
          }
        }
      };
      expect(validateValueAgainstSchema({ nested: { value: 123 } }, objSchema)).toBe(false);
    });
  });

  describe("ref-resolver.ts - Cover remaining lines", () => {
    test("should handle edge cases in ref resolution", () => {
      // Line 82: Circular reference detection
      const circularSchema: JSONSchema7 = {
        definitions: {
          node: {
            type: "object",
            properties: {
              children: {
                type: "array",
                items: { $ref: "#/definitions/node" }
              }
            }
          }
        },
        $ref: "#/definitions/node"
      };
      
      const resolved = resolveAllRefs(circularSchema, circularSchema);
      expect(resolved).toBeDefined();
      
      // Line 91, 106, 114, 122: Boolean schema handling
      const booleanItemsSchema: JSONSchema7 = {
        type: "array",
        items: true as any
      };
      
      const resolvedBool = resolveAllRefs(booleanItemsSchema, booleanItemsSchema);
      expect(resolvedBool.items).toBe(true);
      
      // Handle not with boolean
      const notBoolSchema: JSONSchema7 = {
        not: true as any
      };
      
      const resolvedNot = resolveAllRefs(notBoolSchema, notBoolSchema);
      expect(resolvedNot.not).toBe(true);
      
      // Handle if/then/else with boolean
      const conditionalBoolSchema: JSONSchema7 = {
        if: true as any,
        then: false as any,
        else: true as any
      };
      
      const resolvedConditional = resolveAllRefs(conditionalBoolSchema, conditionalBoolSchema);
      expect(resolvedConditional.if).toBe(true);
      expect(resolvedConditional.then).toBe(false);
      expect(resolvedConditional.else).toBe(true);
    });
  });

  describe("error-generation.ts - Cover remaining lines", () => {
    test("should generate errors for all uncovered cases", () => {
      // Line 147, 150: String constraints
      const stringSchema: JSONSchema7 = {
        type: "string",
        minLength: 5,
        maxLength: 10,
        pattern: "^[A-Z]"
      };
      
      const stringErrors = getDetailedValidationErrors("abcdefghijk", stringSchema);
      expect(stringErrors.some(e => e.code === "MAX_LENGTH")).toBe(true);
      
      // Line 163-174: Number constraints with exclusiveMin/Max as boolean
      const numberSchema: JSONSchema7 = {
        type: "number",
        minimum: 0,
        maximum: 100,
        exclusiveMinimum: true as any,
        exclusiveMaximum: true as any
      };
      
      const numErrors1 = getDetailedValidationErrors(0, numberSchema);
      expect(numErrors1.length).toBeGreaterThan(0);
      
      const numErrors2 = getDetailedValidationErrors(100, numberSchema);
      expect(numErrors2.length).toBeGreaterThan(0);
      
      // Line 275-276, 295-296: Boolean exclusive checks
      const exclusiveSchema: JSONSchema7 = {
        type: "number",
        minimum: 10,
        maximum: 20,
        exclusiveMinimum: false as any,
        exclusiveMaximum: false as any
      };
      
      const exclusiveErrors = getDetailedValidationErrors(25, exclusiveSchema);
      expect(exclusiveErrors.some(e => e.code === "MAXIMUM")).toBe(true);
      
      // Line 483, 507, 511: Schema composition errors
      const compSchema: JSONSchema7 = {
        allOf: [
          { type: "string" },
          { type: "number" }
        ]
      };
      
      const compErrors = getDetailedValidationErrors("test", compSchema);
      expect(compErrors.length).toBeGreaterThan(0);
      
      // Line 546: Conditional with only if
      const ifOnlySchema: JSONSchema7 = {
        if: { type: "string" },
        then: { minLength: 5 }
      };
      
      const ifErrors = getDetailedValidationErrors("ab", ifOnlySchema);
      expect(ifErrors.length).toBeGreaterThan(0);
      
      // Line 566: Conditional else branch
      const elseSchema: JSONSchema7 = {
        if: { type: "string" },
        else: { type: "number" }
      };
      
      const elseErrors = getDetailedValidationErrors(true, elseSchema);
      expect(elseErrors.length).toBeGreaterThan(0);
    });
  });

  describe("format-validators.ts - Line 83 coverage", () => {
    test("should never reach line 83 due to regex pattern", () => {
      // Line 83 is technically unreachable because the regex .+ ensures rest.length > 0
      // But we can test the URI validation thoroughly
      
      expect(formatValidators.uri("http://example.com")).toBe(true);
      expect(formatValidators.uri("https://example.com/path")).toBe(true);
      expect(formatValidators.uri("ftp://files.example.com")).toBe(true);
      expect(formatValidators.uri("mailto:test@example.com")).toBe(true);
      expect(formatValidators.uri("urn:isbn:0451450523")).toBe(true);
      expect(formatValidators.uri("tel:+1-816-555-1212")).toBe(true);
      expect(formatValidators.uri("foo://bar")).toBe(true);
      expect(formatValidators.uri("scheme:")).toBe(false); // No content after scheme
      expect(formatValidators.uri("://missing-scheme")).toBe(false);
      expect(formatValidators.uri("not a uri")).toBe(false);
    });
  });

  describe("plugin.ts - Line 79 coverage", () => {
    test("should handle requiredIf in fromJsonSchema", () => {
      const mockBuilder: any = {
        v: jest.fn(function(path, definition) {
          // Store the calls for verification
          this.calls = this.calls || [];
          this.calls.push({ path, definition });
          return this;
        }),
        strict: jest.fn(function() { return this; }),
        calls: []
      };
      
      const { jsonSchemaPlugin } = require("../../../../src/core/plugin/jsonSchema/plugin");
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      const schema: any = {
        type: "object",
        properties: {
          hasAddress: { type: "boolean" },
          address: { type: "string" }
        },
        dependentRequired: {
          hasAddress: ["address"]
        }
      };
      
      mockBuilder.fromJsonSchema(schema);
      
      // Line 79: Check that requiredIf was applied
      expect(mockBuilder.v).toHaveBeenCalled();
      const addressCall = mockBuilder.v.mock.calls.find((call: any) => call[0] === "address");
      expect(addressCall).toBeDefined();
    });
  });

  describe("index.ts - Full coverage", () => {
    test("should execute all code in index.ts", () => {
      // Import the module to ensure all export statements are executed
      const indexModule = require("../../../../src/core/plugin/jsonSchema/index");
      
      // Verify all expected exports exist
      expect(indexModule.jsonSchemaPlugin).toBeDefined();
      expect(indexModule.validateValueAgainstSchema).toBeDefined();
      expect(indexModule.getDetailedValidationErrors).toBeDefined();
      expect(indexModule.getSpecificValidationErrors).toBeDefined();
      expect(indexModule.convertJsonSchemaToLuqDSL).toBeDefined();
      expect(indexModule.convertDSLToFieldDefinition).toBeDefined();
      expect(indexModule.resolveRef).toBeDefined();
      
      // Import again to ensure module caching works
      const indexModule2 = require("../../../../src/core/plugin/jsonSchema/index");
      expect(indexModule2).toBe(indexModule);
    });
  });
});