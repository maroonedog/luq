import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringMin Plugin", () => {
  describe("Basic behavior", () => {
    test("Accepts string that meets minimum length", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(3))
        .build();

      const result = validator.validate({ name: "abc" });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("Rejects string that does not meet minimum length", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(5))
        .build();

      const result = validator.validate({ name: "abc" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "name",
        code: "stringMin",
      });
    });

    test("Boundary value verification", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(5))
        .build();

      // Exactly 5 characters
      expect(validator.validate({ name: "abcde" }).valid).toBe(true);
      // 4 characters (boundary value - 1)
      expect(validator.validate({ name: "abcd" }).valid).toBe(false);
      // 6 characters (boundary value + 1)
      expect(validator.validate({ name: "abcdef" }).valid).toBe(true);
    });
  });

  describe("Edge cases", () => {
    test("Empty string processing", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(1))
        .build();

      const result = validator.validate({ name: "" });
      expect(result.isValid()).toBe(false);
    });

    test("Multi-byte character processing", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(3))
        .build();

      // 3 Japanese characters
      expect(validator.validate({ name: "あいう" }).valid).toBe(true);
      // 2 Japanese characters
      expect(validator.validate({ name: "あい" }).valid).toBe(false);
    });

    test("Emoji processing", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(2))
        .build();

      // 2 emojis (4 UTF-16 code units)
      expect(validator.validate({ name: "😀😁" }).valid).toBe(true);
      // 1 emoji (2 UTF-16 code units) - passes min(2) due to surrogate pairs
      expect(validator.validate({ name: "😀" }).valid).toBe(true);
      // 1 regular character - fails min(2)
      expect(validator.validate({ name: "a" }).valid).toBe(false);
    });
  });

  describe("Combination with optional fields", () => {
    test("Skip validation for undefined", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<{ name?: string }>()
        .v("name", (b) => b.string.optional().min(3))
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(true);
    });

    test("Validate normally when value exists", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .for<{ name?: string }>()
        .v("name", (b) => b.string.optional().min(3))
        .build();

      expect(validator.validate({ name: "abc" }).valid).toBe(true);
      expect(validator.validate({ name: "ab" }).valid).toBe(false);
    });
  });

  describe("Custom error messages", () => {
    test("Can set custom error message", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string.required().min(3, {
            messageFactory: () => "Name must be at least 3 characters",
          })
        )
        .build();

      const result = validator.validate({ name: "ab" });
      expect(result.errors[0].message).toBe(
        "Name must be at least 3 characters"
      );
    });
  });

  describe("Special case with minimum length 0", () => {
    test("Minimum length 0 allows empty string", () => {
      const validator = Builder()
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.min(0))
        .build();

      expect(validator.validate({ name: "" }).valid).toBe(true);
      expect(validator.validate({ name: "a" }).valid).toBe(true);
    });
  });

  describe("Performance tests", () => {
    test("Works fast even with large strings", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ content: string }>()
        .v("content", (b) => b.string.required().min(1000))
        .build();

      const longString = "a".repeat(10000);
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        validator.validate({ content: longString });
      }

      const end = performance.now();
      const timePerValidation = (end - start) / 1000;

      // Ensure each validation takes less than 1ms
      expect(timePerValidation).toBeLessThan(1);
    });
  });
});
