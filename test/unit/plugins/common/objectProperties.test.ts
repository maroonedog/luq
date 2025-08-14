import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { objectMinPropertiesPlugin } from "../../../../src/core/plugin/objectMinProperties";
import { objectMaxPropertiesPlugin } from "../../../../src/core/plugin/objectMaxProperties";
import { requiredPlugin } from "../../../../src/core/plugin/required";

describe("Object Properties Validation", () => {
  describe("objectMinPropertiesPlugin", () => {
    test("should validate minimum properties", () => {
      const builder = Builder()
        .use(objectMinPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ config: object }>()
        .v("config", (b) => b.object.minProperties(2))
        .build();

      // Valid: has 2 properties
      expect(builder.validate({ config: { a: 1, b: 2 } }).valid).toBe(true);

      // Valid: has more than 2 properties
      expect(builder.validate({ config: { a: 1, b: 2, c: 3 } }).valid).toBe(true);

      // Invalid: has only 1 property
      expect(builder.validate({ config: { a: 1 } }).valid).toBe(false);

      // Invalid: empty object
      expect(builder.validate({ config: {} }).valid).toBe(false);
    });

    test("should handle edge cases", () => {
      const builder = Builder()
        .use(objectMinPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.minProperties(0))
        .build();

      // Valid: empty object when min is 0
      expect(builder.validate({ data: {} }).valid).toBe(true);

      // Valid: null is ignored by object validator
      expect(builder.validate({ data: null }).valid).toBe(true);
    });

    test("should throw error for invalid minValue", () => {
      expect(() => {
        Builder()
          .use(objectMinPropertiesPlugin)
          .for<{ config: object }>()
          .v("config", (b) => (b.object as any).minProperties(-1));
      }).toThrow("Invalid minValue: -1");

      expect(() => {
        Builder()
          .use(objectMinPropertiesPlugin)
          .for<{ config: object }>()
          .v("config", (b) => (b.object as any).minProperties(NaN));
      }).toThrow("Invalid minValue: NaN");
    });
  });

  describe("objectMaxPropertiesPlugin", () => {
    test("should validate maximum properties", () => {
      const builder = Builder()
        .use(objectMaxPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ config: object }>()
        .v("config", (b) => b.object.maxProperties(2))
        .build();

      // Valid: has 2 properties
      expect(builder.validate({ config: { a: 1, b: 2 } }).valid).toBe(true);

      // Valid: has fewer than 2 properties
      expect(builder.validate({ config: { a: 1 } }).valid).toBe(true);

      // Valid: empty object
      expect(builder.validate({ config: {} }).valid).toBe(true);

      // Invalid: has more than 2 properties
      expect(builder.validate({ config: { a: 1, b: 2, c: 3 } }).valid).toBe(false);
    });

    test("should handle edge cases", () => {
      const builder = Builder()
        .use(objectMaxPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.maxProperties(0))
        .build();

      // Valid: empty object when max is 0
      expect(builder.validate({ data: {} }).valid).toBe(true);

      // Invalid: any properties when max is 0
      expect(builder.validate({ data: { a: 1 } }).valid).toBe(false);

      // Valid: null is ignored by object validator
      expect(builder.validate({ data: null }).valid).toBe(true);
    });

    test("should throw error for invalid maxValue", () => {
      expect(() => {
        Builder()
          .use(objectMaxPropertiesPlugin)
          .for<{ config: object }>()
          .v("config", (b) => (b.object as any).maxProperties(-1));
      }).toThrow("Invalid maxValue: -1");

      expect(() => {
        Builder()
          .use(objectMaxPropertiesPlugin)
          .for<{ config: object }>()
          .v("config", (b) => (b.object as any).maxProperties(NaN));
      }).toThrow("Invalid maxValue: NaN");
    });
  });

  describe("Combined min/max properties", () => {
    test("should validate range of properties", () => {
      const builder = Builder()
        .use(objectMinPropertiesPlugin)
        .use(objectMaxPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ config: object }>()
        .v("config", (b) => b.object.minProperties(2).maxProperties(4))
        .build();

      // Valid: within range
      expect(builder.validate({ config: { a: 1, b: 2 } }).valid).toBe(true);
      expect(builder.validate({ config: { a: 1, b: 2, c: 3 } }).valid).toBe(true);
      expect(builder.validate({ config: { a: 1, b: 2, c: 3, d: 4 } }).valid).toBe(true);

      // Invalid: below minimum
      expect(builder.validate({ config: { a: 1 } }).valid).toBe(false);
      expect(builder.validate({ config: {} }).valid).toBe(false);

      // Invalid: above maximum
      expect(builder.validate({ config: { a: 1, b: 2, c: 3, d: 4, e: 5 } }).valid).toBe(false);
    });
  });

  describe("Custom error messages", () => {
    test("should use custom error messages", () => {
      const builder = Builder()
        .use(objectMinPropertiesPlugin)
        .use(objectMaxPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ config: object }>()
        .v("config", (b) => 
          b.object
            .minProperties(2, {
              messageFactory: ({ path, min, actual }) => 
                `${path} needs at least ${min} properties, got ${actual}`
            })
            .maxProperties(3, {
              messageFactory: ({ path, max, actual }) => 
                `${path} can have at most ${max} properties, got ${actual}`
            })
        )
        .build();

      const result1 = builder.validate({ config: { a: 1 } });
      expect(result1.valid).toBe(false);
      if (!result1.valid) {
        expect(result1.errors[0].message).toBe("config needs at least 2 properties, got 1");
      }

      const result2 = builder.validate({ config: { a: 1, b: 2, c: 3, d: 4 } });
      expect(result2.valid).toBe(false);
      if (!result2.valid) {
        expect(result2.errors[0].message).toBe("config can have at most 3 properties, got 4");
      }
    });
  });
});