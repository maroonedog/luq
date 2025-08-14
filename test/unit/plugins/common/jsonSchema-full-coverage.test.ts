import { describe, test, expect } from "@jest/globals";
import { 
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
  jsonSchemaPlugin
} from "../../../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";
import { Builder } from "../../../../src/core/builder/core/builder";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { stringEmailPlugin } from "../../../../src/core/plugin/stringEmail";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
import { arrayUniquePlugin } from "../../../../src/core/plugin/arrayUnique";
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
import { literalPlugin } from "../../../../src/core/plugin/literal";

describe("jsonSchema Full Coverage - 100%", () => {
  
  describe("convertJsonSchemaToLuqDSL", () => {
    test("should convert simple object properties", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };
      
      const result = convertJsonSchemaToLuqDSL(schema, '', ['name']);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        path: 'name',
        type: 'string',
        constraints: { required: true }
      });
      expect(result[1]).toMatchObject({
        path: 'age',
        type: 'number',
        constraints: { required: false }
      });
    });

    test("should handle nested objects recursively", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  name: { type: 'string' }
                },
                required: ['name']
              }
            }
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'user.profile.name',
        type: 'string',
        constraints: { required: true }
      });
    });

    test("should handle integer type as number", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          count: { type: 'integer' }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result[0]).toMatchObject({
        path: 'count',
        type: 'number'
      });
    });

    test("should handle missing type (defaults to string)", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          field: { minLength: 5 } as any
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result[0]).toMatchObject({
        path: 'field',
        type: 'string'
      });
    });

    test("should capture all string constraints", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            minLength: 5,
            maxLength: 50,
            pattern: '^[A-Z]',
            format: 'email'
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result[0].constraints).toMatchObject({
        minLength: 5,
        maxLength: 50,
        pattern: '^[A-Z]',
        format: 'email'
      });
    });

    test("should capture all number constraints", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          value: {
            type: 'number',
            minimum: 0,
            maximum: 100
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result[0].constraints).toMatchObject({
        min: 0,
        max: 100
      });
    });

    test("should capture array constraints", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 10,
            uniqueItems: true
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result[0].constraints).toMatchObject({
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10,
        uniqueItems: true
      });
    });

    test("should capture enum constraint", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive']
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result[0].constraints.enum).toEqual(['active', 'inactive']);
    });

    test("should handle parentPath correctly", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          field: { type: 'string' }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema, 'parent');
      
      expect(result[0].path).toBe('parent.field');
    });

    test("should handle empty schema", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {}
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result).toEqual([]);
    });

    test("should handle non-object schema", () => {
      const schema: JSONSchema7 = {
        type: 'string'
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result).toEqual([]);
    });

    test("should handle schema without properties", () => {
      const schema: JSONSchema7 = {
        type: 'object'
      };
      
      const result = convertJsonSchemaToLuqDSL(schema);
      
      expect(result).toEqual([]);
    });

    test("should handle deeply nested with parent path", () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: { type: 'string' }
            }
          }
        }
      };
      
      const result = convertJsonSchemaToLuqDSL(schema, 'root');
      
      expect(result[0].path).toBe('root.level1.level2');
    });
  });

  describe("convertDSLToFieldDefinition", () => {
    test("should create field definition for string type", () => {
      const dsl = {
        path: 'name',
        type: 'string' as const,
        constraints: {
          required: true,
          minLength: 3,
          maxLength: 50
        }
      };
      
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis(),
          min: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      expect(mockBuilder.string.required).toHaveBeenCalled();
      expect(mockBuilder.string.min).toHaveBeenCalledWith(3);
      expect(mockBuilder.string.max).toHaveBeenCalledWith(50);
    });

    test("should handle pattern constraint", () => {
      const dsl = {
        path: 'field',
        type: 'string' as const,
        constraints: {
          pattern: '^test'
        }
      };
      
      const mockBuilder = {
        string: {
          pattern: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      expect(mockBuilder.string.pattern).toHaveBeenCalledWith(/^test/);
    });

    test("should handle format constraint", () => {
      const dsl = {
        path: 'email',
        type: 'string' as const,
        constraints: {
          format: 'email'
        }
      };
      
      const mockBuilder = {
        string: {
          email: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      expect(mockBuilder.string.email).toHaveBeenCalled();
    });

    test("should handle format when chain method exists (email)", () => {
      const dsl = {
        path: 'emailField',
        type: 'string' as const,
        constraints: {
          format: 'email'
        }
      };
      
      // Chain with email method that exists
      const mockChain = {
        email: jest.fn().mockReturnThis()
      };
      
      const mockBuilder = {
        string: mockChain
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      const result = converter(mockBuilder);
      
      expect(mockChain.email).toHaveBeenCalled();
      expect(result).toBe(mockChain);
    });

    test("should use refine when format method doesn't exist but customFormats provided", () => {
      const dsl = {
        path: 'customField',
        type: 'string' as const,
        constraints: {
          format: 'customValidator'
        }
      };
      
      const customFormats = {
        customValidator: (v: string) => v.startsWith('valid')
      };
      
      // Chain without the specific format method, but with refine
      const mockChain = {
        refine: jest.fn().mockReturnThis()
        // No 'customValidator' method
      };
      
      const mockBuilder = {
        string: mockChain
      };
      
      const converter = convertDSLToFieldDefinition(dsl, customFormats);
      const result = converter(mockBuilder);
      
      // Should call refine since chain.customValidator doesn't exist
      expect(mockChain.refine).toHaveBeenCalledWith(customFormats.customValidator);
      expect(result).toBe(mockChain);
    });

    test("should handle custom format with refine", () => {
      const dsl = {
        path: 'phone',
        type: 'string' as const,
        constraints: {
          format: 'phone'
        }
      };
      
      const customFormats = {
        phone: (v: string) => /^\d+$/.test(v)
      };
      
      const mockBuilder = {
        string: {
          refine: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl, customFormats);
      converter(mockBuilder);
      
      expect(mockBuilder.string.refine).toHaveBeenCalledWith(customFormats.phone);
    });

    test("should handle custom format with refine - coverage line 137", () => {
      const dsl = {
        path: 'customField',
        type: 'string' as const,
        constraints: {
          format: 'customFormat'
        }
      };
      
      const customFormats = {
        customFormat: (v: string) => v.length > 5
      };
      
      // Create a chain that has the refine method and will be modified
      let chainCalled = false;
      const mockChain = {
        refine: jest.fn((fn) => {
          chainCalled = true;
          return mockChain; // Return self for chaining
        })
      };
      
      const mockBuilder = {
        string: mockChain
      };
      
      const converter = convertDSLToFieldDefinition(dsl, customFormats);
      const result = converter(mockBuilder);
      
      // Verify that refine was called with the custom format function
      expect(mockChain.refine).toHaveBeenCalledWith(customFormats.customFormat);
      expect(chainCalled).toBe(true);
      expect(result).toBe(mockChain); // Should return the modified chain
    });

    test("should handle number constraints", () => {
      const dsl = {
        path: 'age',
        type: 'number' as const,
        constraints: {
          min: 0,
          max: 120
        }
      };
      
      const mockBuilder = {
        number: {
          min: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      expect(mockBuilder.number.min).toHaveBeenCalledWith(0);
      expect(mockBuilder.number.max).toHaveBeenCalledWith(120);
    });

    test("should handle array constraints", () => {
      const dsl = {
        path: 'items',
        type: 'array' as const,
        constraints: {
          minItems: 1,
          maxItems: 10,
          uniqueItems: true
        }
      };
      
      const mockBuilder = {
        array: {
          minLength: jest.fn().mockReturnThis(),
          maxLength: jest.fn().mockReturnThis(),
          unique: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      expect(mockBuilder.array.minLength).toHaveBeenCalledWith(1);
      expect(mockBuilder.array.maxLength).toHaveBeenCalledWith(10);
      expect(mockBuilder.array.unique).toHaveBeenCalled();
    });

    test("should handle enum constraint", () => {
      const dsl = {
        path: 'status',
        type: 'string' as const,
        constraints: {
          enum: ['active', 'inactive']
        }
      };
      
      const mockBuilder = {
        string: {
          oneOf: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      expect(mockBuilder.string.oneOf).toHaveBeenCalledWith(['active', 'inactive']);
    });

    test("should use default chain when type not found", () => {
      const dsl = {
        path: 'field',
        type: 'unknown' as any,
        constraints: {}
      };
      
      const mockBuilder = {
        string: { type: 'string' }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      const result = converter(mockBuilder);
      
      expect(result.type).toBe('string');
    });

    test("should not apply constraints when methods don't exist", () => {
      const dsl = {
        path: 'field',
        type: 'string' as const,
        constraints: {
          required: true,
          minLength: 5,
          pattern: '^test',
          format: 'email',
          enum: ['a', 'b']
        }
      };
      
      const mockBuilder = {
        string: {} // No methods
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      
      // Should not throw
      const result = converter(mockBuilder);
      expect(result).toBeDefined();
    });

    test("should handle all constraints being undefined", () => {
      const dsl = {
        path: 'field',
        type: 'string' as const,
        constraints: {
          required: undefined,
          minLength: undefined,
          maxLength: undefined,
          min: undefined,
          max: undefined,
          minItems: undefined,
          maxItems: undefined,
          uniqueItems: undefined,
          enum: undefined
        }
      };
      
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis(),
          min: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      // None of the methods should be called
      expect(mockBuilder.string.required).not.toHaveBeenCalled();
      expect(mockBuilder.string.min).not.toHaveBeenCalled();
    });

    test("should not apply required when false", () => {
      const dsl = {
        path: 'field',
        type: 'string' as const,
        constraints: {
          required: false
        }
      };
      
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      expect(mockBuilder.string.required).not.toHaveBeenCalled();
    });

    test("should not apply uniqueItems when false", () => {
      const dsl = {
        path: 'items',
        type: 'array' as const,
        constraints: {
          uniqueItems: false
        }
      };
      
      const mockBuilder = {
        array: {
          unique: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertDSLToFieldDefinition(dsl);
      converter(mockBuilder);
      
      expect(mockBuilder.array.unique).not.toHaveBeenCalled();
    });
  });

  describe("jsonSchemaPlugin.extendBuilder", () => {
    test("should add fromJsonSchema method to builder", () => {
      const mockBuilder: any = {};
      
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      expect(typeof mockBuilder.fromJsonSchema).toBe('function');
    });

    test("should throw error for non-object root schema", () => {
      const mockBuilder: any = {};
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      const schema: JSONSchema7 = { type: 'string' };
      
      expect(() => {
        mockBuilder.fromJsonSchema(schema);
      }).toThrow('Root schema must be an object with properties');
    });

    test("should throw error for schema without properties", () => {
      const mockBuilder: any = {};
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      const schema: JSONSchema7 = { type: 'object' };
      
      expect(() => {
        mockBuilder.fromJsonSchema(schema);
      }).toThrow('Root schema must be an object with properties');
    });

    test("should process valid schema", () => {
      const fieldBuilder = {
        field: jest.fn().mockReturnThis()
      };
      
      const mockBuilder: any = {
        for: jest.fn().mockReturnValue(fieldBuilder)
      };
      
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };
      
      const result = mockBuilder.fromJsonSchema(schema);
      
      expect(mockBuilder.for).toHaveBeenCalled();
      expect(fieldBuilder.field).toHaveBeenCalled();
      expect(result).toBe(fieldBuilder);
    });

    test("should handle strictRequired option", () => {
      const fieldBuilder = {
        field: jest.fn().mockReturnThis()
      };
      
      const mockBuilder: any = {
        for: jest.fn().mockReturnValue(fieldBuilder)
      };
      
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false
      };
      
      const result = mockBuilder.fromJsonSchema(schema, {
        strictRequired: true
      });
      
      // The option is accepted but may not change behavior
      expect(result).toBe(fieldBuilder);
    });

    test("should pass customFormats to field definitions", () => {
      const fieldBuilder = {
        field: jest.fn().mockReturnThis()
      };
      
      const mockBuilder: any = {
        for: jest.fn().mockReturnValue(fieldBuilder)
      };
      
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          phone: { type: 'string', format: 'phone' }
        }
      };
      
      const customFormats = {
        phone: (v: string) => /^\d+$/.test(v)
      };
      
      mockBuilder.fromJsonSchema(schema, { customFormats });
      
      expect(fieldBuilder.field).toHaveBeenCalled();
      
      // Get the function passed to field()
      const [path, definitionFn] = fieldBuilder.field.mock.calls[0];
      expect(path).toBe('phone');
      expect(typeof definitionFn).toBe('function');
    });

    test("should handle nested objects in schema", () => {
      const fieldBuilder = {
        field: jest.fn().mockReturnThis()
      };
      
      const mockBuilder: any = {
        for: jest.fn().mockReturnValue(fieldBuilder)
      };
      
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' }
            }
          }
        }
      };
      
      mockBuilder.fromJsonSchema(schema);
      
      // Should be called twice for nested fields
      expect(fieldBuilder.field).toHaveBeenCalledTimes(2);
      
      const calls = fieldBuilder.field.mock.calls;
      expect(calls[0][0]).toBe('user.name');
      expect(calls[1][0]).toBe('user.age');
    });

    test("should handle required fields correctly", () => {
      const fieldBuilder = {
        field: jest.fn().mockReturnThis()
      };
      
      const mockBuilder: any = {
        for: jest.fn().mockReturnValue(fieldBuilder)
      };
      
      jsonSchemaPlugin.extendBuilder(mockBuilder);
      
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          required1: { type: 'string' },
          optional1: { type: 'string' }
        },
        required: ['required1']
      };
      
      mockBuilder.fromJsonSchema(schema);
      
      expect(fieldBuilder.field).toHaveBeenCalledTimes(2);
    });
  });

  describe("Integration test with real Builder", () => {
    test("should work with actual Builder instance", () => {
      const builder = Builder()
        .use(jsonSchemaPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(stringPatternPlugin)
        .use(stringEmailPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayMaxLengthPlugin)
        .use(arrayUniquePlugin)
        .use(oneOfPlugin)
        .use(literalPlugin);
      
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 3,
            maxLength: 50
          },
          age: {
            type: 'number',
            minimum: 0,
            maximum: 120
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            uniqueItems: true
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive']
          }
        },
        required: ['name', 'age']
      };
      
      const validator = (builder as any).fromJsonSchema(schema).build();
      
      // Valid data
      expect(validator.validate({
        name: 'John',
        age: 30,
        tags: ['tag1', 'tag2'],
        status: 'active'
      }).valid).toBe(true);
      
      // Invalid: name too short
      expect(validator.validate({
        name: 'Jo',
        age: 30,
        tags: ['tag1'],
        status: 'active'
      }).valid).toBe(false);
      
      // Invalid: missing required field
      expect(validator.validate({
        name: 'John',
        tags: ['tag1'],
        status: 'active'
      }).valid).toBe(false);
    });
  });
});