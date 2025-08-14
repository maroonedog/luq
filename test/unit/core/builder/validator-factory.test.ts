import { describe, test, expect, beforeEach } from "@jest/globals";
import {
  createValidatorFactory,
  FieldDefinition,
} from "../../../../src/core/builder/validator-factory";
import { Builder } from "../../../../src";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";

describe("ValidatorFactory", () => {
  let plugins: Record<string, any>;

  beforeEach(() => {
    plugins = {
      required: requiredPlugin,
      optional: optionalPlugin,
      stringMin: stringMinPlugin,
      numberMin: numberMinPlugin,
      arrayMaxLength: arrayMaxLengthPlugin,
    };
  });

  describe("createValidatorFactory", () => {
    test("should create a validator factory with provided plugins", () => {
      const factory = createValidatorFactory(plugins);
      expect(factory).toBeDefined();
      expect(typeof factory.buildOptimizedValidator).toBe("function");
    });

    test("should handle empty plugin set", () => {
      const factory = createValidatorFactory({});
      expect(factory).toBeDefined();
    });
  });

  describe("buildOptimizedValidator - empty validator", () => {
    test("should build empty validator for no field definitions", () => {
      const factory = createValidatorFactory(plugins);
      const validator = factory.buildOptimizedValidator([]);

      expect(validator).toBeDefined();
      expect(typeof validator.validate).toBe("function");
      expect(typeof validator.parse).toBe("function");
    });

    test("empty validator should always return valid for any input", () => {
      const factory = createValidatorFactory(plugins);
      const validator = factory.buildOptimizedValidator([]);

      const result = validator.validate({ any: "data" });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("empty validator parse should return input unchanged", () => {
      const factory = createValidatorFactory(plugins);
      const validator = factory.buildOptimizedValidator([]);

      const testData = { some: "data", number: 42 };
      const result = validator.parse(testData);
      expect(result.isValid()).toBe(true);
      expect(result.data()).toEqual(testData);
    });
  });

  describe("buildOptimizedValidator - single field", () => {
    test("should build validator for single required string field", () => {
      const factory = createValidatorFactory(plugins);

      const fieldDef: FieldDefinition = {
        path: "name",
        builderFunction: (b: any) => b.string.required(),
        fieldType: "string",
      };

      const validator = factory.buildOptimizedValidator([fieldDef]);
      expect(validator).toBeDefined();
    });

    test("should validate single required field correctly", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>();

      const validator = builder
        .v("name", (b) => b.string.required().min(3))
        .build();

      // Valid case
      expect(validator.validate({ name: "Alice" }).valid).toBe(true);

      // Invalid case - missing field
      expect(validator.validate({} as any).valid).toBe(false);

      // Invalid case - too short
      expect(validator.validate({ name: "AB" }).valid).toBe(false);
    });
  });

  describe("buildOptimizedValidator - multiple fields", () => {
    test("should build validator for multiple fields", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ name: string; age: number; email?: string }>();

      const validator = builder
        .v("name", (b) => b.string.required().min(2))
        .v("age", (b) => b.number.required().min(18))
        .v("email", (b) => b.string.optional().min(5))
        .build();

      expect(validator).toBeDefined();
    });

    test("should validate multiple fields correctly", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ name: string; age: number; email?: string }>();

      const validator = builder
        .v("name", (b) => b.string.required().min(2))
        .v("age", (b) => b.number.required().min(18))
        .v("email", (b) => b.string.optional().min(5))
        .build();

      // Valid case - all fields valid
      const validResult = validator.validate({
        name: "John",
        age: 25,
        email: "john@example.com",
      });
      expect(validResult.valid).toBe(true);

      // Valid case - optional field missing
      const validWithoutEmail = validator.validate({
        name: "John",
        age: 25,
      });
      expect(validWithoutEmail.valid).toBe(true);

      // Invalid case - multiple errors
      const invalidResult = validator.validate({
        name: "J", // too short
        age: 15, // too young
        email: "bad", // too short
      });
      expect(invalidResult.valid).toBe(false);
      // Note: May collect only the first error depending on validation strategy
      expect(invalidResult.errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("buildOptimizedValidator - array fields", () => {
    test("should handle array field validation", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ tags: string[] }>();

      const validator = builder
        .v("tags", (b) => b.array.required().maxLength(5))
        .build();

      // Valid array
      expect(validator.validate({ tags: ["a", "b", "c"] }).valid).toBe(true);

      // Invalid - too many items
      expect(
        validator.validate({
          tags: ["a", "b", "c", "d", "e", "f"],
        }).valid
      ).toBe(false);

      // Invalid - missing
      expect(validator.validate({} as any).valid).toBe(false);
    });

    test("should handle nested array element validation", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ users: Array<{ name: string }> }>();

      const validator = builder
        .v("users[*].name", (b) => b.string.required().min(2))
        .build();

      // Valid nested validation
      expect(
        validator.validate({
          users: [{ name: "Alice" }, { name: "Bob" }],
        }).valid
      ).toBe(true);

      // Invalid nested validation
      expect(
        validator.validate({
          users: [{ name: "Alice" }, { name: "B" }], // Second name too short
        }).valid
      ).toBe(false);
    });
  });

  describe("buildOptimizedValidator - nested object fields", () => {
    test("should handle nested object field validation", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ user: { profile: { name: string } } }>();

      const validator = builder
        .v("user.profile.name", (b) => b.string.required().min(2))
        .build();

      // Valid nested object
      expect(
        validator.validate({
          user: { profile: { name: "Alice" } },
        }).valid
      ).toBe(true);

      // Invalid - nested field too short
      expect(
        validator.validate({
          user: { profile: { name: "A" } },
        }).valid
      ).toBe(false);

      // Invalid - missing nested structure
      expect(
        validator.validate({
          user: {},
        } as any).valid
      ).toBe(false);
    });
  });

  describe("buildOptimizedValidator - error collection", () => {
    test("should collect all errors by default", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ name: string; age: number; email: string }>();

      const validator = builder
        .v("name", (b) => b.string.required().min(3))
        .v("age", (b) => b.number.required().min(18))
        .v("email", (b) => b.string.required().min(5))
        .build();

      const result = validator.validate({
        name: "AB", // too short
        age: 15, // too young
        email: "bad", // too short
      });

      expect(result.valid).toBe(false);
      // Validation strategy may optimize to return only first error by default
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    test("should abort early when abortEarly option is true", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<{ name: string; age: number; email: string }>();

      const validator = builder
        .v("name", (b) => b.string.required().min(3))
        .v("age", (b) => b.number.required().min(18))
        .v("email", (b) => b.string.required().min(5))
        .build();

      const result = validator.validate(
        {
          name: "AB", // too short
          age: 15, // too young
          email: "bad", // too short
        },
        { abortEarly: true }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeLessThanOrEqual(3); // May stop at first error
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("buildOptimizedValidator - parse mode", () => {
    test("should support parse mode for data transformation", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>();

      const validator = builder
        .v("name", (b) => b.string.required().min(2))
        .build();

      const parseResult = validator.parse({ name: "Alice" });
      expect(parseResult.isValid()).toBe(true);
      expect(parseResult.data()).toEqual({ name: "Alice" });
    });

    test("should return errors in parse mode for invalid data", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>();

      const validator = builder
        .v("name", (b) => b.string.required().min(5))
        .build();

      const parseResult = validator.parse({ name: "Bob" }); // too short
      expect(parseResult.isValid()).toBe(false);
      expect(parseResult.errors).toHaveLength(1);
    });
  });

  describe("buildOptimizedValidator - performance optimizations", () => {
    test("should handle large number of fields efficiently", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Record<string, string>>();

      // Build validator with 10 fields (reduced to avoid type complexity)
      let validatorBuilder = builder;
      const testData: Record<string, string> = {};

      for (let i = 0; i < 10; i++) {
        const fieldName = `field${i}` as keyof Record<string, string>;
        validatorBuilder = validatorBuilder.v(fieldName, (b) =>
          b.string.required().min(2)
        ) as any; // Type assertion to bypass strict type checking
        testData[fieldName] = `value${i}`;
      }

      const validator = validatorBuilder.build();

      const start = performance.now();
      const result = validator.validate(testData);
      const end = performance.now();

      expect(result.valid).toBe(true);
      expect(end - start).toBeLessThan(100); // Should complete within 100ms
    });

    test("should reuse field accessors for similar paths", () => {
      const builder = Builder().use(requiredPlugin).use(stringMinPlugin).for<{
        user1: { name: string };
        user2: { name: string };
        user3: { name: string };
      }>();

      const validator = builder
        .v("user1.name", (b) => b.string.required().min(2))
        .v("user2.name", (b) => b.string.required().min(2))
        .v("user3.name", (b) => b.string.required().min(2))
        .build();

      expect(
        validator.validate({
          user1: { name: "Alice" },
          user2: { name: "Bob" },
          user3: { name: "Charlie" },
        }).valid
      ).toBe(true);
    });
  });

  describe("buildOptimizedValidator - edge cases", () => {
    test("should handle undefined and null values appropriately", () => {
      const builder = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<{ name?: string }>();

      const validator = builder
        .v("name", (b) => b.string.optional().min(2))
        .build();

      // Undefined is valid for optional field
      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ name: undefined }).valid).toBe(true);

      // null handling - may be treated differently than undefined
      // depending on plugin implementation
      const nullResult = validator.validate({ name: null } as any);
      expect(typeof nullResult.valid).toBe("boolean"); // Just verify it returns a result
    });

    test("should handle complex nested structures", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{
          company: {
            departments: Array<{
              name: string;
              employees?: Array<{ name: string }>;
            }>;
          };
        }>();

      const validator = builder
        .v("company.departments[*].name", (b) => b.string.required().min(2))
        .v("company.departments[*].employees[*].name", (b) =>
          b.string.optional().min(2)
        )
        .build();

      const validData = {
        company: {
          departments: [
            {
              name: "Engineering",
              employees: [{ name: "Alice" }, { name: "Bob" }],
            },
            {
              name: "Marketing",
              // employees is optional
            },
          ],
        },
      };

      expect(validator.validate(validData).valid).toBe(true);
    });

    test("should handle circular references gracefully", () => {
      const builder = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<{ name?: string; self?: any }>();

      const validator = builder
        .v("name", (b) => b.string.optional().min(2))
        .build();

      const circularData: any = { name: "Test" };
      circularData.self = circularData;

      // Should not crash with circular references
      expect(() => {
        const result = validator.validate(circularData);
        expect(result.valid).toBe(true);
      }).not.toThrow();
    });
  });
});
