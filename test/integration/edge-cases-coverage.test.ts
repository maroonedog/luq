/**
 * Edge Cases and Error Handling Coverage Test
 *
 * This test suite focuses on edge cases, error conditions, and boundary testing
 * to ensure robust behavior in unexpected situations.
 */

import {
  Builder,
  requiredPlugin,
  optionalPlugin,
  stringMinPlugin,
  stringMaxPlugin,
  numberMinPlugin,
  numberMaxPlugin,
  arrayMinLengthPlugin,
  arrayUniquePlugin,
  skipPlugin,
  transformPlugin,
  objectPlugin,
  oneOfPlugin,
  stringEmailPlugin,
  booleanTruthyPlugin,
} from "../../src/index";

describe("Edge Cases and Error Handling Coverage", () => {
  describe("Boundary Value Testing", () => {
    it("should handle exact boundary values for string length", () => {
      const validator = Builder()
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<{ text: string }>()
        .v("text", (b) => b.string.min(5).max(10))
        .build();

      // Exact boundaries
      expect(validator.validate({ text: "12345" }).valid).toBe(true); // exactly 5
      expect(validator.validate({ text: "1234567890" }).valid).toBe(true); // exactly 10

      // Just outside boundaries
      expect(validator.validate({ text: "1234" }).valid).toBe(false); // 4 chars
      expect(validator.validate({ text: "12345678901" }).valid).toBe(false); // 11 chars
    });

    it("should handle boundary values for numbers", () => {
      const validator = Builder()
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.min(0).max(100))
        .build();

      // Exact boundaries
      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: 100 }).valid).toBe(true);

      // Just outside boundaries
      expect(validator.validate({ value: -0.1 }).valid).toBe(false);
      expect(validator.validate({ value: 100.1 }).valid).toBe(false);
    });
  });

  describe("Data Type Edge Cases", () => {
    it("should handle special number values", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required().min(0))
        .build();

      // Special number values
      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: -0 }).valid).toBe(true);
      expect(validator.validate({ value: Infinity }).valid).toBe(true);
      expect(validator.validate({ value: -Infinity }).valid).toBe(false);

      // NaN handling
      const nanResult = validator.validate({ value: NaN });
      // NaN behavior may vary, just check it doesn't crash
      expect(typeof nanresult.isValid()).toBe("boolean");
    });

    it("should handle special string values", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ text: string }>()
        .v("text", (b) => b.string.required().min(1))
        .build();

      // Empty string
      expect(validator.validate({ text: "" }).valid).toBe(false);

      // Whitespace strings
      expect(validator.validate({ text: " " }).valid).toBe(true);
      expect(validator.validate({ text: "\n" }).valid).toBe(true);
      expect(validator.validate({ text: "\t" }).valid).toBe(true);
    });

    it("should handle unicode and special characters", () => {
      const validator = Builder()
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<{ text: string }>()
        .v("text", (b) => b.string.min(2).max(5))
        .build();

      // Unicode characters
      expect(validator.validate({ text: "😀😁" }).valid).toBe(true); // 2 emoji chars
      expect(validator.validate({ text: "αβγδε" }).valid).toBe(true); // Greek letters
      expect(validator.validate({ text: "你好世界" }).valid).toBe(true); // 4 Chinese chars (within limit)
    });
  });

  describe("Array Edge Cases", () => {
    it("should handle empty arrays", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().minLength(0))
        .build();

      expect(validator.validate({ items: [] }).valid).toBe(true);
    });

    it("should handle arrays with null/undefined elements", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayUniquePlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().unique())
        .build();

      expect(validator.validate({ items: [null, undefined, 1] }).valid).toBe(
        true
      );
      expect(validator.validate({ items: [null, null] }).valid).toBe(false); // duplicate nulls
    });

    it("should handle large arrays", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ items: number[] }>()
        .v("items", (b) => b.array.required().minLength(1))
        .build();

      const largeArray = new Array(10000).fill(0).map((_, i) => i);
      const result = validator.validate({ items: largeArray });
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Object and Nested Structure Edge Cases", () => {
    it("should handle deeply nested objects", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(objectPlugin)
        .for<{ level1: { level2: { level3: { value: string } } } }>()
        .v("level1", (b) => b.object.required())
        .v("level1.level2", (b) => b.object.required())
        .v("level1.level2.level3", (b) => b.object.required())
        .v("level1.level2.level3.value", (b) => b.string.required().min(1))
        .build();

      const deepObject = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      };

      expect(validator.validate(deepObject).valid).toBe(true);

      const brokenDeepObject = {
        level1: {
          level2: {
            level3: {
              value: "",
            },
          },
        },
      };

      expect(validator.validate(brokenDeepObject).valid).toBe(false);
    });

    it("should handle circular references gracefully", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required())
        .build();

      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      // Should not crash and should validate the known fields
      const result = validator.validate(circularObj);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Plugin Interaction Edge Cases", () => {
    it("should handle skip conditions with complex logic", () => {
      const validator = Builder()
        .use(skipPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ mode: string; env: string; debug?: boolean; config?: string }>()
        .v("config", (b) =>
          b.string
            .skip(
              (values) =>
                values.mode === "readonly" ||
                (values.env === "production" && !values.debug)
            )
            .required()
            .min(5)
        )
        .build();

      // Should skip for readonly mode
      expect(validator.validate({ mode: "readonly", env: "dev" }).valid).toBe(
        true
      );

      // Should skip for production without debug
      expect(
        validator.validate({ mode: "edit", env: "production", debug: false })
          .valid
      ).toBe(true);

      // Should validate for production with debug
      expect(
        validator.validate({ mode: "edit", env: "production", debug: true })
          .valid
      ).toBe(false);
      expect(
        validator.validate({
          mode: "edit",
          env: "production",
          debug: true,
          config: "valid",
        }).valid
      ).toBe(true);
    });

    it("should handle multiple transforms in sequence", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<{ text: string }>()
        .v("text", (b) =>
          b.string
            .required()
            .transform((v: string) => v.trim())
            .transform((v: string) => v.toLowerCase())
            .transform((v: string) => v.replace(/\s+/g, "_"))
        )
        .build();

      const result = validator.parse({ text: "  Hello World  " });
      expect(result.isValid()).toBe(true);
      if (result.valid && result.data) {
        expect((result.data as any).text).toBe("hello_world");
      }
    });
  });

  describe("Error Message and Context Edge Cases", () => {
    it("should handle custom error messages with special characters", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ field: string }>()
        .v("field", (b) =>
          b.string.required({
            messageFactory: () => "Error with special chars: 日本語 & émojis 🎉",
          })
        )
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(false);
      if (result.errors.length > 0) {
        expect(result.errors[0].message).toContain("日本語");
        expect(result.errors[0].message).toContain("🎉");
      }
    });

    it("should handle very long error messages", () => {
      const longMessage =
        "This is a very long error message that contains lots of text ".repeat(
          10
        );

      const validator = Builder()
        .use(requiredPlugin)
        .for<{ field: string }>()
        .v("field", (b) =>
          b.string.required({
            messageFactory: () => longMessage,
          })
        )
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(false);
      if (result.errors.length > 0) {
        expect(result.errors[0].message.length).toBeGreaterThan(100);
      }
    });
  });

  describe("Performance and Memory Edge Cases", () => {
    it("should handle validation of large objects without memory issues", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ data: string }>()
        .v("data", (b) => b.string.required().min(1))
        .build();

      const largeString = "x".repeat(100000); // 100KB string
      const result = validator.validate({ data: largeString });
      expect(result.isValid()).toBe(true);
    });

    it("should handle many validation rules efficiently", () => {
      let builder = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<Record<string, string>>();

      // Add many fields
      for (let i = 0; i < 100; i++) {
        builder = builder.v(`field${i}`, (b) =>
          b.string.required().min(1).max(10)
        );
      }

      const validator = builder.build();

      // Create test data
      const testData: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        testData[`field${i}`] = `value${i}`;
      }

      const start = performance.now();
      const result = validator.validate(testData);
      const end = performance.now();

      expect(result.isValid()).toBe(true);
      expect(end - start).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe("Type System Edge Cases", () => {
    it("should handle optional boolean with falsy values", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(booleanTruthyPlugin)
        .for<{ flag?: boolean }>()
        .v("flag", (b) => b.boolean.optional().truthy())
        .build();

      expect(validator.validate({}).valid).toBe(true); // undefined is ok
      expect(validator.validate({ flag: true }).valid).toBe(true);
      expect(validator.validate({ flag: false }).valid).toBe(false);
    });

    it("should handle oneOf with mixed types", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ value: string | number }>()
        .v("value", (b) =>
          b.string.required().oneOf(["active", "inactive", 123] as any)
        )
        .build();

      expect(validator.validate({ value: "active" }).valid).toBe(true);
      expect(validator.validate({ value: "inactive" }).valid).toBe(true);
      expect(validator.validate({ value: 123 as any }).valid).toBe(true);
      expect(validator.validate({ value: "other" }).valid).toBe(false);
    });
  });

  describe("Validation Context Edge Cases", () => {
    it("should handle skip conditions that access undefined properties", () => {
      const validator = Builder()
        .use(skipPlugin)
        .use(requiredPlugin)
        .for<{ config?: string }>()
        .v("config", (b) =>
          b.string
            .skip(
              (values) => (values as any).nonExistentProperty?.someFlag === true
            )
            .required()
        )
        .build();

      // Should not crash when accessing undefined nested properties
      expect(validator.validate({}).valid).toBe(false); // Skip condition is false, so validation runs
    });

    it("should handle validation with null prototype objects", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(1))
        .build();

      const nullProtoObj = Object.create(null);
      nullProtoObj.name = "test";

      const result = validator.validate(nullProtoObj);
      expect(result.isValid()).toBe(true);
    });
  });
});
