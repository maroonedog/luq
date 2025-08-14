import { describe, test, expect } from "@jest/globals";
import { 
  convertJsonSchemaToFieldDefinition,
  getBaseChain,
  applyConstraints
} from "../../../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("jsonSchema internal functions - 100% coverage", () => {
  
  describe("getBaseChain", () => {
    const mockBuilder = {
      string: { type: 'string', chain: true },
      number: { type: 'number', chain: true },
      boolean: { type: 'boolean', chain: true },
      array: { type: 'array', chain: true },
      object: { type: 'object', chain: true }
    };

    test("should return string chain for string type", () => {
      const schema: JSONSchema7 = { type: 'string' };
      const result = getBaseChain(mockBuilder, schema);
      expect(result.type).toBe('string');
    });

    test("should return number chain for number type", () => {
      const schema: JSONSchema7 = { type: 'number' };
      const result = getBaseChain(mockBuilder, schema);
      expect(result.type).toBe('number');
    });

    test("should return number chain for integer type", () => {
      const schema: JSONSchema7 = { type: 'integer' };
      const result = getBaseChain(mockBuilder, schema);
      expect(result.type).toBe('number');
    });

    test("should return boolean chain for boolean type", () => {
      const schema: JSONSchema7 = { type: 'boolean' };
      const result = getBaseChain(mockBuilder, schema);
      expect(result.type).toBe('boolean');
    });

    test("should return array chain for array type", () => {
      const schema: JSONSchema7 = { type: 'array' };
      const result = getBaseChain(mockBuilder, schema);
      expect(result.type).toBe('array');
    });

    test("should return object chain for object type", () => {
      const schema: JSONSchema7 = { type: 'object' };
      const result = getBaseChain(mockBuilder, schema);
      expect(result.type).toBe('object');
    });

    test("should return string chain as default for unknown type", () => {
      const schema: JSONSchema7 = { type: 'unknown' as any };
      const result = getBaseChain(mockBuilder, schema);
      expect(result.type).toBe('string');
    });

    test("should return string chain when type is undefined", () => {
      const schema: JSONSchema7 = {} as any;
      const result = getBaseChain(mockBuilder, schema);
      expect(result.type).toBe('string');
    });
  });

  describe("applyConstraints", () => {
    describe("String constraints", () => {
      test("should apply minLength constraint", () => {
        const chain = { 
          min: jest.fn().mockReturnThis() 
        };
        const schema: JSONSchema7 = { type: 'string', minLength: 5 };
        
        const result = applyConstraints(chain, schema);
        expect(chain.min).toHaveBeenCalledWith(5);
      });

      test("should apply maxLength constraint", () => {
        const chain = { 
          max: jest.fn().mockReturnThis() 
        };
        const schema: JSONSchema7 = { type: 'string', maxLength: 10 };
        
        const result = applyConstraints(chain, schema);
        expect(chain.max).toHaveBeenCalledWith(10);
      });

      test("should apply pattern constraint", () => {
        const chain = { 
          pattern: jest.fn().mockReturnThis() 
        };
        const schema: JSONSchema7 = { type: 'string', pattern: '^test' };
        
        const result = applyConstraints(chain, schema);
        expect(chain.pattern).toHaveBeenCalledWith(/^test/);
      });

      test("should not apply constraints when chain methods don't exist", () => {
        const chain = {}; // No methods
        const schema: JSONSchema7 = { 
          type: 'string', 
          minLength: 5,
          maxLength: 10,
          pattern: '^test'
        };
        
        // Should not throw
        const result = applyConstraints(chain, schema);
        expect(result).toBe(chain);
      });

      describe("Format handling", () => {
        test("should apply email format", () => {
          const chain = { email: jest.fn().mockReturnThis() };
          const schema: JSONSchema7 = { type: 'string', format: 'email' };
          
          applyConstraints(chain, schema);
          expect(chain.email).toHaveBeenCalled();
        });

        test("should apply uri format", () => {
          const chain = { url: jest.fn().mockReturnThis() };
          const schema: JSONSchema7 = { type: 'string', format: 'uri' };
          
          applyConstraints(chain, schema);
          expect(chain.url).toHaveBeenCalled();
        });

        test("should apply url format", () => {
          const chain = { url: jest.fn().mockReturnThis() };
          const schema: JSONSchema7 = { type: 'string', format: 'url' };
          
          applyConstraints(chain, schema);
          expect(chain.url).toHaveBeenCalled();
        });

        test("should apply uuid format", () => {
          const chain = { uuid: jest.fn().mockReturnThis() };
          const schema: JSONSchema7 = { type: 'string', format: 'uuid' };
          
          applyConstraints(chain, schema);
          expect(chain.uuid).toHaveBeenCalled();
        });

        test("should apply date format", () => {
          const chain = { date: jest.fn().mockReturnThis() };
          const schema: JSONSchema7 = { type: 'string', format: 'date' };
          
          applyConstraints(chain, schema);
          expect(chain.date).toHaveBeenCalled();
        });

        test("should apply date-time format", () => {
          const chain = { date: jest.fn().mockReturnThis() };
          const schema: JSONSchema7 = { type: 'string', format: 'date-time' };
          
          applyConstraints(chain, schema);
          expect(chain.date).toHaveBeenCalled();
        });

        test("should apply custom format when chain.custom exists", () => {
          const customValidator = (v: string) => v === 'valid';
          const chain = { custom: jest.fn().mockReturnThis() };
          const schema: JSONSchema7 = { type: 'string', format: 'phone' };
          const customFormats = { phone: customValidator };
          
          applyConstraints(chain, schema, customFormats);
          expect(chain.custom).toHaveBeenCalledWith(customValidator);
        });

        test("should ignore custom format when chain.custom doesn't exist", () => {
          const customValidator = (v: string) => v === 'valid';
          const chain = {}; // No custom method
          const schema: JSONSchema7 = { type: 'string', format: 'phone' };
          const customFormats = { phone: customValidator };
          
          // Should not throw
          const result = applyConstraints(chain, schema, customFormats);
          expect(result).toBe(chain);
        });

        test("should ignore unknown format without custom handler", () => {
          const chain = {};
          const schema: JSONSchema7 = { type: 'string', format: 'unknown' };
          
          // Should not throw
          const result = applyConstraints(chain, schema);
          expect(result).toBe(chain);
        });

        test("should ignore format when chain method doesn't exist", () => {
          const chain = {}; // No email method
          const schema: JSONSchema7 = { type: 'string', format: 'email' };
          
          // Should not throw
          const result = applyConstraints(chain, schema);
          expect(result).toBe(chain);
        });
      });
    });

    describe("Number constraints", () => {
      test("should apply minimum constraint", () => {
        const chain = { min: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'number', minimum: 10 };
        
        applyConstraints(chain, schema);
        expect(chain.min).toHaveBeenCalledWith(10);
      });

      test("should apply maximum constraint", () => {
        const chain = { max: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'number', maximum: 100 };
        
        applyConstraints(chain, schema);
        expect(chain.max).toHaveBeenCalledWith(100);
      });

      test("should apply multipleOf constraint", () => {
        const chain = { multipleOf: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'number', multipleOf: 5 };
        
        applyConstraints(chain, schema);
        expect(chain.multipleOf).toHaveBeenCalledWith(5);
      });

      test("should apply integer constraint for integer type", () => {
        const chain = { integer: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'integer' };
        
        applyConstraints(chain, schema);
        expect(chain.integer).toHaveBeenCalled();
      });

      test("should handle minimum of 0", () => {
        const chain = { min: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'number', minimum: 0 };
        
        applyConstraints(chain, schema);
        expect(chain.min).toHaveBeenCalledWith(0);
      });

      test("should handle maximum of 0", () => {
        const chain = { max: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'number', maximum: 0 };
        
        applyConstraints(chain, schema);
        expect(chain.max).toHaveBeenCalledWith(0);
      });

      test("should not apply constraints when chain methods don't exist", () => {
        const chain = {};
        const schema: JSONSchema7 = { 
          type: 'number', 
          minimum: 10,
          maximum: 100,
          multipleOf: 5
        };
        
        // Should not throw
        const result = applyConstraints(chain, schema);
        expect(result).toBe(chain);
      });

      test("should not apply integer when chain.integer doesn't exist", () => {
        const chain = {};
        const schema: JSONSchema7 = { type: 'integer' };
        
        // Should not throw
        const result = applyConstraints(chain, schema);
        expect(result).toBe(chain);
      });
    });

    describe("Array constraints", () => {
      test("should apply minItems constraint", () => {
        const chain = { minLength: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'array', minItems: 2 };
        
        applyConstraints(chain, schema);
        expect(chain.minLength).toHaveBeenCalledWith(2);
      });

      test("should apply maxItems constraint", () => {
        const chain = { maxLength: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'array', maxItems: 10 };
        
        applyConstraints(chain, schema);
        expect(chain.maxLength).toHaveBeenCalledWith(10);
      });

      test("should apply uniqueItems constraint", () => {
        const chain = { unique: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'array', uniqueItems: true };
        
        applyConstraints(chain, schema);
        expect(chain.unique).toHaveBeenCalled();
      });

      test("should not apply uniqueItems when false", () => {
        const chain = { unique: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { type: 'array', uniqueItems: false };
        
        applyConstraints(chain, schema);
        expect(chain.unique).not.toHaveBeenCalled();
      });

      test("should not apply constraints when chain methods don't exist", () => {
        const chain = {};
        const schema: JSONSchema7 = { 
          type: 'array', 
          minItems: 1,
          maxItems: 10,
          uniqueItems: true
        };
        
        // Should not throw
        const result = applyConstraints(chain, schema);
        expect(result).toBe(chain);
      });
    });

    describe("Enum and const constraints", () => {
      test("should apply enum constraint", () => {
        const chain = { oneOf: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { enum: ['a', 'b', 'c'] };
        
        applyConstraints(chain, schema);
        expect(chain.oneOf).toHaveBeenCalledWith(['a', 'b', 'c']);
      });

      test("should apply const constraint", () => {
        const chain = { literal: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { const: 'exactValue' };
        
        applyConstraints(chain, schema);
        expect(chain.literal).toHaveBeenCalledWith('exactValue');
      });

      test("should handle const with null value", () => {
        const chain = { literal: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { const: null };
        
        applyConstraints(chain, schema);
        expect(chain.literal).toHaveBeenCalledWith(null);
      });

      test("should handle const with 0 value", () => {
        const chain = { literal: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { const: 0 };
        
        applyConstraints(chain, schema);
        expect(chain.literal).toHaveBeenCalledWith(0);
      });

      test("should handle const with false value", () => {
        const chain = { literal: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { const: false };
        
        applyConstraints(chain, schema);
        expect(chain.literal).toHaveBeenCalledWith(false);
      });

      test("should not apply enum when chain.oneOf doesn't exist", () => {
        const chain = {};
        const schema: JSONSchema7 = { enum: ['a', 'b'] };
        
        // Should not throw
        const result = applyConstraints(chain, schema);
        expect(result).toBe(chain);
      });

      test("should not apply const when chain.literal doesn't exist", () => {
        const chain = {};
        const schema: JSONSchema7 = { const: 'value' };
        
        // Should not throw
        const result = applyConstraints(chain, schema);
        expect(result).toBe(chain);
      });
    });

    describe("Mixed types", () => {
      test("should not apply string constraints to non-string types", () => {
        const chain = { min: jest.fn().mockReturnThis() };
        const schema: JSONSchema7 = { 
          type: 'number', 
          minLength: 5 // String constraint on number type
        } as any;
        
        applyConstraints(chain, schema);
        // min should be called for minimum, not minLength
        expect(chain.min).not.toHaveBeenCalled();
      });

      test("should handle schema without type", () => {
        const chain = {};
        const schema: JSONSchema7 = { minLength: 5 } as any;
        
        // Should not throw
        const result = applyConstraints(chain, schema);
        expect(result).toBe(chain);
      });

      test("should return the modified chain", () => {
        const chain = { 
          min: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis()
        };
        const schema: JSONSchema7 = { 
          type: 'number', 
          minimum: 1,
          maximum: 10
        };
        
        const result = applyConstraints(chain, schema);
        expect(result).toBe(chain);
      });
    });
  });

  describe("convertJsonSchemaToFieldDefinition", () => {
    test("should create a function that builds a validation chain", () => {
      const schema: JSONSchema7 = { type: 'string', minLength: 5 };
      const converter = convertJsonSchemaToFieldDefinition(schema, false);
      
      expect(typeof converter).toBe('function');
    });

    test("should apply required when isRequired is true", () => {
      const schema: JSONSchema7 = { type: 'string' };
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis(),
          min: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertJsonSchemaToFieldDefinition(schema, true);
      const result = converter(mockBuilder);
      
      expect(mockBuilder.string.required).toHaveBeenCalled();
    });

    test("should not apply required when isRequired is false", () => {
      const schema: JSONSchema7 = { type: 'string' };
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertJsonSchemaToFieldDefinition(schema, false);
      const result = converter(mockBuilder);
      
      expect(mockBuilder.string.required).not.toHaveBeenCalled();
    });

    test("should not apply required when chain.required doesn't exist", () => {
      const schema: JSONSchema7 = { type: 'string' };
      const mockBuilder = {
        string: {} // No required method
      };
      
      const converter = convertJsonSchemaToFieldDefinition(schema, true);
      
      // Should not throw
      const result = converter(mockBuilder);
      expect(result).toBeDefined();
    });

    test("should pass customFormats to applyConstraints", () => {
      const schema: JSONSchema7 = { type: 'string', format: 'phone' };
      const customFormats = {
        phone: (v: string) => /^\d+$/.test(v)
      };
      const mockBuilder = {
        string: {
          custom: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertJsonSchemaToFieldDefinition(schema, false, customFormats);
      const result = converter(mockBuilder);
      
      expect(mockBuilder.string.custom).toHaveBeenCalledWith(customFormats.phone);
    });

    test("should handle all types through getBaseChain", () => {
      const types = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
      
      types.forEach(type => {
        const schema: JSONSchema7 = { type: type as any };
        const mockBuilder = {
          string: { type: 'string' },
          number: { type: 'number' },
          boolean: { type: 'boolean' },
          array: { type: 'array' },
          object: { type: 'object' }
        };
        
        const converter = convertJsonSchemaToFieldDefinition(schema, false);
        const result = converter(mockBuilder);
        
        expect(result).toBeDefined();
      });
    });

    test("should handle complex schema with multiple constraints", () => {
      const schema: JSONSchema7 = {
        type: 'string',
        minLength: 5,
        maxLength: 50,
        pattern: '^[A-Z]',
        format: 'email',
        enum: ['ADMIN@example.com', 'USER@example.com'],
        const: 'ADMIN@example.com'
      };
      
      const mockBuilder = {
        string: {
          required: jest.fn().mockReturnThis(),
          min: jest.fn().mockReturnThis(),
          max: jest.fn().mockReturnThis(),
          pattern: jest.fn().mockReturnThis(),
          email: jest.fn().mockReturnThis(),
          oneOf: jest.fn().mockReturnThis(),
          literal: jest.fn().mockReturnThis()
        }
      };
      
      const converter = convertJsonSchemaToFieldDefinition(schema, true);
      const result = converter(mockBuilder);
      
      expect(mockBuilder.string.required).toHaveBeenCalled();
      expect(mockBuilder.string.min).toHaveBeenCalledWith(5);
      expect(mockBuilder.string.max).toHaveBeenCalledWith(50);
      expect(mockBuilder.string.pattern).toHaveBeenCalledWith(/^[A-Z]/);
      expect(mockBuilder.string.email).toHaveBeenCalled();
      expect(mockBuilder.string.oneOf).toHaveBeenCalledWith(['ADMIN@example.com', 'USER@example.com']);
      expect(mockBuilder.string.literal).toHaveBeenCalledWith('ADMIN@example.com');
    });
  });
});