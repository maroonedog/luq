import {
  createUltraFastSingleFieldValidator,
  createUltraFastMultiFieldValidator,
  UltraFastValidator,
} from "../../../../src/core/builder/ultra-fast-validator";
import { UnifiedValidator } from "../../../../src/core/optimization/unified-validator";

// Mock UnifiedValidator
class MockUnifiedValidator implements UnifiedValidator {
  constructor(
    private validFn: (value: any, context: any) => boolean = () => true,
    private transformFn?: (value: any) => any
  ) {}

  validate(value: any, context: any) {
    if (this.validFn(value, context)) {
      return { valid: true, data: value, errors: [] };
    }
    return {
      valid: false,
      data: undefined,
      errors: [{ message: "Validation failed", path: "field", code: "MOCK_ERROR" }],
    };
  }

  parse(value: any, context: any) {
    if (!this.validFn(value, context)) {
      return {
        valid: false,
        data: undefined,
        errors: [{ message: "Validation failed", path: "field", code: "MOCK_ERROR" }],
      };
    }
    
    if (this.transformFn) {
      const transformed = this.transformFn(value);
      return { valid: true, data: transformed, errors: [] };
    }
    
    return { valid: true, data: value, errors: [] };
  }
}

describe("ultra-fast-validator", () => {
  describe("createUltraFastSingleFieldValidator", () => {
    describe("validate method", () => {
      it("should validate simple field", () => {
        const validator = new MockUnifiedValidator((v) => v === "valid");
        const ultraFast = createUltraFastSingleFieldValidator<{ name: string }>(
          "name",
          validator
        );

        const result1 = ultraFast.validate({ name: "valid" });
        expect(result1.valid).toBe(true);
        expect(result1.value).toEqual({ name: "valid" });

        const result2 = ultraFast.validate({ name: "invalid" });
        expect(result2.valid).toBe(false);
        expect(result2.error).toBeDefined();
      });

      it("should handle null value", () => {
        const validator = new MockUnifiedValidator();
        const ultraFast = createUltraFastSingleFieldValidator<{ name: string }>(
          "name",
          validator
        );

        const result = ultraFast.validate(null as any);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Value is required");
      });

      it("should handle undefined value", () => {
        const validator = new MockUnifiedValidator();
        const ultraFast = createUltraFastSingleFieldValidator<{ name: string }>(
          "name",
          validator
        );

        const result = ultraFast.validate(undefined as any);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Value is required");
      });

      it("should validate nested field", () => {
        const validator = new MockUnifiedValidator((v) => v === "nested");
        const ultraFast = createUltraFastSingleFieldValidator<{
          user: { name: string };
        }>("user.name", validator);

        const result1 = ultraFast.validate({ user: { name: "nested" } });
        expect(result1.valid).toBe(true);
        expect(result1.value).toEqual({ user: { name: "nested" } });

        const result2 = ultraFast.validate({ user: { name: "invalid" } });
        expect(result2.valid).toBe(false);
      });

      it("should validate deeply nested field", () => {
        const validator = new MockUnifiedValidator((v) => v === "deep");
        const ultraFast = createUltraFastSingleFieldValidator<{
          a: { b: { c: { d: string } } };
        }>("a.b.c.d", validator);

        const result = ultraFast.validate({
          a: { b: { c: { d: "deep" } } },
        });
        expect(result.valid).toBe(true);
      });

      it("should handle missing nested field", () => {
        const validator = new MockUnifiedValidator();
        const ultraFast = createUltraFastSingleFieldValidator<any>(
          "user.name",
          validator
        );

        const result = ultraFast.validate({ user: {} });
        expect(result.valid).toBe(true); // undefined is passed to validator
      });

      it("should reuse result objects for performance", () => {
        const validator = new MockUnifiedValidator();
        const ultraFast = createUltraFastSingleFieldValidator<{ name: string }>(
          "name",
          validator
        );

        const result1 = ultraFast.validate({ name: "test1" });
        const result2 = ultraFast.validate({ name: "test2" });
        
        // Same result object reference (for performance)
        expect(result1).toBe(result2);
      });
    });

    describe("parse method", () => {
      it("should parse and transform simple field", () => {
        const validator = new MockUnifiedValidator(
          () => true,
          (v) => v.toUpperCase()
        );
        const ultraFast = createUltraFastSingleFieldValidator<{ name: string }>(
          "name",
          validator
        );

        const result = ultraFast.parse({ name: "lower" });
        expect(result.valid).toBe(true);
        expect(result.value).toEqual({ name: "LOWER" });
      });

      it("should handle no transformation", () => {
        const validator = new MockUnifiedValidator();
        const ultraFast = createUltraFastSingleFieldValidator<{ name: string }>(
          "name",
          validator
        );

        const input = { name: "test" };
        const result = ultraFast.parse(input);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(input); // Same reference when no transform
      });

      it("should parse and transform nested field", () => {
        const validator = new MockUnifiedValidator(
          () => true,
          (v) => v * 2
        );
        const ultraFast = createUltraFastSingleFieldValidator<{
          data: { value: number };
        }>("data.value", validator);

        const result = ultraFast.parse({ data: { value: 5 } });
        expect(result.valid).toBe(true);
        expect(result.value).toEqual({ data: { value: 10 } });
      });

      it("should handle parse validation failure", () => {
        const validator = new MockUnifiedValidator((v) => false);
        const ultraFast = createUltraFastSingleFieldValidator<{ name: string }>(
          "name",
          validator
        );

        const result = ultraFast.parse({ name: "test" });
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("should handle null value in parse", () => {
        const validator = new MockUnifiedValidator();
        const ultraFast = createUltraFastSingleFieldValidator<{ name: string }>(
          "name",
          validator
        );

        const result = ultraFast.parse(null as any);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Value is required");
      });
    });
  });

  describe("createUltraFastMultiFieldValidator", () => {
    describe("two fields optimization", () => {
      it("should validate two fields", () => {
        const validator1 = new MockUnifiedValidator((v) => v === "valid1");
        const validator2 = new MockUnifiedValidator((v) => v === "valid2");
        
        const ultraFast = createUltraFastMultiFieldValidator<{
          field1: string;
          field2: string;
        }>([
          { path: "field1", validator: validator1 },
          { path: "field2", validator: validator2 },
        ]);

        const result1 = ultraFast.validate({
          field1: "valid1",
          field2: "valid2",
        });
        expect(result1.valid).toBe(true);

        const result2 = ultraFast.validate({
          field1: "valid1",
          field2: "invalid",
        });
        expect(result2.valid).toBe(false);

        const result3 = ultraFast.validate({
          field1: "invalid",
          field2: "valid2",
        });
        expect(result3.valid).toBe(false);
      });

      it("should parse and transform two fields", () => {
        const validator1 = new MockUnifiedValidator(
          () => true,
          (v) => v.toUpperCase()
        );
        const validator2 = new MockUnifiedValidator(
          () => true,
          (v) => v * 2
        );
        
        const ultraFast = createUltraFastMultiFieldValidator<{
          name: string;
          value: number;
        }>([
          { path: "name", validator: validator1 },
          { path: "value", validator: validator2 },
        ]);

        const result = ultraFast.parse({
          name: "test",
          value: 5,
        });
        expect(result.valid).toBe(true);
        expect(result.value).toEqual({
          name: "TEST",
          value: 10,
        });
      });

      it("should handle partial transformation for two fields", () => {
        const validator1 = new MockUnifiedValidator(); // No transform
        const validator2 = new MockUnifiedValidator(
          () => true,
          (v) => v * 2
        );
        
        const ultraFast = createUltraFastMultiFieldValidator<{
          name: string;
          value: number;
        }>([
          { path: "name", validator: validator1 },
          { path: "value", validator: validator2 },
        ]);

        const result = ultraFast.parse({
          name: "test",
          value: 5,
        });
        expect(result.valid).toBe(true);
        expect(result.value).toEqual({
          name: "test",
          value: 10,
        });
      });
    });

    describe("multiple fields (general case)", () => {
      it("should validate three fields", () => {
        const validators = [
          new MockUnifiedValidator((v) => v === "a"),
          new MockUnifiedValidator((v) => v === "b"),
          new MockUnifiedValidator((v) => v === "c"),
        ];
        
        const ultraFast = createUltraFastMultiFieldValidator<{
          f1: string;
          f2: string;
          f3: string;
        }>([
          { path: "f1", validator: validators[0] },
          { path: "f2", validator: validators[1] },
          { path: "f3", validator: validators[2] },
        ]);

        const result1 = ultraFast.validate({ f1: "a", f2: "b", f3: "c" });
        expect(result1.valid).toBe(true);

        const result2 = ultraFast.validate({ f1: "a", f2: "b", f3: "wrong" });
        expect(result2.valid).toBe(false);
      });

      it("should validate many fields", () => {
        const validators = Array.from({ length: 10 }, (_, i) =>
          new MockUnifiedValidator((v) => v === i)
        );
        
        const fields = validators.map((validator, i) => ({
          path: `field${i}`,
          validator,
        }));
        
        const ultraFast = createUltraFastMultiFieldValidator<any>(fields);

        const validData = Object.fromEntries(
          fields.map((_, i) => [`field${i}`, i])
        );
        const result1 = ultraFast.validate(validData);
        expect(result1.valid).toBe(true);

        const invalidData = { ...validData, field5: 999 };
        const result2 = ultraFast.validate(invalidData);
        expect(result2.valid).toBe(false);
      });

      it("should parse and transform multiple fields", () => {
        const validators = [
          new MockUnifiedValidator(() => true, (v) => v.toUpperCase()),
          new MockUnifiedValidator(() => true, (v) => v * 2),
          new MockUnifiedValidator(() => true, (v) => !v),
        ];
        
        const ultraFast = createUltraFastMultiFieldValidator<{
          str: string;
          num: number;
          bool: boolean;
        }>([
          { path: "str", validator: validators[0] },
          { path: "num", validator: validators[1] },
          { path: "bool", validator: validators[2] },
        ]);

        const result = ultraFast.parse({
          str: "lower",
          num: 5,
          bool: true,
        });
        expect(result.valid).toBe(true);
        expect(result.value).toEqual({
          str: "LOWER",
          num: 10,
          bool: false,
        });
      });
    });

    describe("nested fields", () => {
      it("should validate nested fields", () => {
        const validator1 = new MockUnifiedValidator((v) => v === "nested1");
        const validator2 = new MockUnifiedValidator((v) => v === "nested2");
        
        const ultraFast = createUltraFastMultiFieldValidator<{
          user: { name: string; email: string };
        }>([
          { path: "user.name", validator: validator1 },
          { path: "user.email", validator: validator2 },
        ]);

        const result = ultraFast.validate({
          user: { name: "nested1", email: "nested2" },
        });
        expect(result.valid).toBe(true);
      });

      it("should parse and transform nested fields", () => {
        const validator1 = new MockUnifiedValidator(
          () => true,
          (v) => v.toUpperCase()
        );
        const validator2 = new MockUnifiedValidator(
          () => true,
          (v) => v.toLowerCase()
        );
        
        const ultraFast = createUltraFastMultiFieldValidator<{
          data: { upper: string; lower: string };
        }>([
          { path: "data.upper", validator: validator1 },
          { path: "data.lower", validator: validator2 },
        ]);

        const result = ultraFast.parse({
          data: { upper: "test", lower: "TEST" },
        });
        expect(result.valid).toBe(true);
        expect(result.value).toEqual({
          data: { upper: "TEST", lower: "test" },
        });
      });
    });

    describe("edge cases", () => {
      it("should handle empty fields array", () => {
        const ultraFast = createUltraFastMultiFieldValidator<{}>([]); 

        const result = ultraFast.validate({});
        expect(result.valid).toBe(true);
      });

      it("should handle single field", () => {
        const validator = new MockUnifiedValidator((v) => v === "single");
        const ultraFast = createUltraFastMultiFieldValidator<{
          field: string;
        }>([{ path: "field", validator }]);

        const result = ultraFast.validate({ field: "single" });
        expect(result.valid).toBe(true);
      });

      it("should handle null value", () => {
        const validator = new MockUnifiedValidator();
        const ultraFast = createUltraFastMultiFieldValidator<{
          field: string;
        }>([{ path: "field", validator }]);

        const result = ultraFast.validate(null as any);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Value is required");
      });

      it("should handle validation error in middle field", () => {
        const validators = [
          new MockUnifiedValidator(),
          new MockUnifiedValidator((v) => false), // Always fails
          new MockUnifiedValidator(),
        ];
        
        const ultraFast = createUltraFastMultiFieldValidator<any>([
          { path: "f1", validator: validators[0] },
          { path: "f2", validator: validators[1] },
          { path: "f3", validator: validators[2] },
        ]);

        const result = ultraFast.validate({ f1: 1, f2: 2, f3: 3 });
        expect(result.valid).toBe(false);
        // Should stop at first error
      });

      it("should maintain transform order", () => {
        let callOrder: string[] = [];
        
        const validator1 = new MockUnifiedValidator(
          () => true,
          (v) => {
            callOrder.push("first");
            return v + "1";
          }
        );
        const validator2 = new MockUnifiedValidator(
          () => true,
          (v) => {
            callOrder.push("second");
            return v + "2";
          }
        );
        
        const ultraFast = createUltraFastMultiFieldValidator<{
          f1: string;
          f2: string;
        }>([
          { path: "f1", validator: validator1 },
          { path: "f2", validator: validator2 },
        ]);

        ultraFast.parse({ f1: "a", f2: "b" });
        expect(callOrder).toEqual(["first", "second"]);
      });
    });

    describe("performance characteristics", () => {
      it("should reuse result objects", () => {
        const validator = new MockUnifiedValidator();
        const ultraFast = createUltraFastMultiFieldValidator<{
          field: string;
        }>([{ path: "field", validator }]);

        const result1 = ultraFast.validate({ field: "test1" });
        const result2 = ultraFast.validate({ field: "test2" });
        
        // Same result object reference
        expect(result1).toBe(result2);
      });

      it("should handle large number of fields efficiently", () => {
        const fields = Array.from({ length: 100 }, (_, i) => ({
          path: `field${i}`,
          validator: new MockUnifiedValidator(),
        }));
        
        const ultraFast = createUltraFastMultiFieldValidator<any>(fields);
        
        const data = Object.fromEntries(
          fields.map((_, i) => [`field${i}`, `value${i}`])
        );

        const start = Date.now();
        for (let i = 0; i < 1000; i++) {
          ultraFast.validate(data);
        }
        const end = Date.now();
        
        // Should complete quickly
        expect(end - start).toBeLessThan(100);
      });
    });
  });
});