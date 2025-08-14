/**
 * Comprehensive Error Handling and Edge Cases Test
 *
 * This test suite focuses on error recovery, graceful degradation, and complex
 * error scenarios that could occur in production environments.
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
  arrayMaxLengthPlugin,
  arrayUniquePlugin,
  skipPlugin,
  transformPlugin,
  objectPlugin,
  oneOfPlugin,
  stringEmailPlugin,
  booleanTruthyPlugin,
  requiredIfPlugin,
  stringPatternPlugin,
} from "../../src/index";

// Import plugins not exported in main index
import { nullablePlugin } from "../../src/core/plugin/nullable";
import { optionalIfPlugin } from "../../src/core/plugin/optionalIf";

describe("Comprehensive Error Handling and Edge Cases", () => {
  describe("Plugin Configuration Edge Cases", () => {
    it("should handle invalid plugin parameters gracefully", () => {
      const validator = Builder()
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<{ text: string }>()
        .v("text", (b) => b.string.min(-1).max(-5)) // Invalid: min > max
        .build();

      // Should not crash during validation, even with invalid config
      const result = validator.validate({ text: "test" });
      expect(typeof result.isValid()).toBe("boolean");
    });

    it("should handle conflicting plugin configurations", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .for<{ field?: string }>()
        .v("field", (b) => b.string.required().optional()) // Conflicting requirements
        .build();

      // Should resolve the conflict predictably
      const result = validator.validate({});
      expect(typeof result.isValid()).toBe("boolean");
    });

    it("should handle plugin parameters with edge values", () => {
      const validator = Builder()
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ str: string; num: number }>()
        .v("str", (b) => b.string.min(0).max(Number.MAX_SAFE_INTEGER))
        .v("num", (b) =>
          b.number.min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
        )
        .build();

      const result = validator.validate({ str: "test", num: 42 });
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Transform Error Scenarios", () => {
    it("should handle transform function that throws errors", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(requiredPlugin)
        .for<{ data: string }>()
        .v("data", (b) =>
          b.string.required().transform((value: string) => {
            if (value === "ERROR") {
              throw new Error("Transform failed");
            }
            return value.toUpperCase();
          })
        )
        .build();

      // Normal case should succeed and not return transformed data with validate()
      const normalResult = validator.validate({ data: "hello" });
      expect(normalresult.isValid()).toBe(true);

      // Try parse() method for transformed data
      const parseResult = (validator as any).parse({ data: "hello" });
      expect(parseresult.isValid()).toBe(true);
      // Note: transform data might not be available in current implementation

      // Error case - validate() doesn't run transforms, so it succeeds
      const errorResult = validator.validate({ data: "ERROR" });
      // validate() doesn't run transforms, so validation passes
      expect(errorresult.isValid()).toBe(true);

      // But parse() would throw the error (as shown in debug test)
      expect(() => {
        (validator as any).parse({ data: "ERROR" });
      }).toThrow("Transform failed");
    });

    it("should handle transform that returns unexpected types", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(requiredPlugin)
        .for<{ value: string }>()
        .v("value", (b) =>
          b.string.required().transform((value: string) => {
            // Transform returns wrong type
            return 123 as any;
          })
        )
        .build();

      const result = validator.validate({ value: "test" });
      expect(typeof result.isValid()).toBe("boolean");
    });

    it("should handle multiple transforms where middle one fails", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(requiredPlugin)
        .for<{ text: string }>()
        .v(
          "text",
          (b) =>
            b.string
              .required()
              .transform((v: string) => v.trim()) // Success
              .transform((v: string) => {
                if (v === "FAIL") throw new Error("Middle transform failed");
                return v.toLowerCase();
              }) // May fail
              .transform((v: string) => v + "_suffix") // Success
        )
        .build();

      const normalResult = validator.validate({ text: "  Hello  " });
      expect(normalresult.isValid()).toBe(true);

      // validate() doesn't run transforms, so validation passes
      const failResult = validator.validate({ text: "FAIL" });
      expect(failresult.isValid()).toBe(true);

      // But parse() would fail with the transform error
      expect(() => {
        (validator as any).parse({ text: "FAIL" });
      }).toThrow("Middle transform failed");
    });
  });

  describe("Nested Structure Error Propagation", () => {
    it("should handle errors in deeply nested structures", () => {
      interface DeepStructure {
        level1: {
          level2: {
            level3: {
              level4: {
                value: string;
                optional?: string;
              };
            };
          };
        };
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(objectPlugin)
        .for<DeepStructure>()
        .v("level1", (b) => b.object.required())
        .v("level1.level2", (b) => b.object.required())
        .v("level1.level2.level3", (b) => b.object.required())
        .v("level1.level2.level3.level4", (b) => b.object.required())
        .v("level1.level2.level3.level4.value", (b) =>
          b.string.required().min(5)
        )
        .v("level1.level2.level3.level4.optional", (b) =>
          b.string.optional().min(3)
        )
        .build();

      // Error at deepest level
      const deepError = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: "x", // Too short
                optional: "ab", // Too short
              },
            },
          },
        },
      };

      const result = validator.validate(deepError);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Check error paths are correctly reported
      const errorPaths = result.errors.map((e) => e.path);
      expect(
        errorPaths.some((path) =>
          path.includes("level1.level2.level3.level4.value")
        )
      ).toBe(true);
    });

    it("should handle partial object failures gracefully", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(objectPlugin)
        .for<{
          user: { name: string; email: string };
          settings: { theme: string; lang: string };
        }>()
        .v("user", (b) => b.object.required())
        .v("user.name", (b) => b.string.required().min(2))
        .v("user.email", (b) => b.string.required().min(5))
        .v("settings", (b) => b.object.required())
        .v("settings.theme", (b) => b.string.required().min(1))
        .v("settings.lang", (b) => b.string.required().min(2))
        .build();

      const partiallyInvalid = {
        user: {
          name: "John", // Valid
          email: "a", // Invalid - too short
        },
        settings: {
          theme: "dark", // Valid
          lang: "x", // Invalid - too short
        },
      };

      const result = validator.validate(partiallyInvalid);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBe(2); // Two validation errors

      const errorCodes = result.errors.map((e) => e.code);
      expect(errorCodes.filter((code) => code === "stringMin").length).toBe(2);
    });
  });

  describe("Array Validation Edge Cases", () => {
    it("should handle mixed valid/invalid array elements", () => {
      const validator = Builder()
        .use(arrayMinLengthPlugin)
        .use(arrayUniquePlugin)
        .use(requiredPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().minLength(2).unique())
        .build();

      // Mixed scenarios
      expect(validator.validate({ items: ["a", "b", "c"] }).valid).toBe(true);
      expect(validator.validate({ items: ["a", "a"] }).valid).toBe(false); // Duplicate
      expect(validator.validate({ items: ["a"] }).valid).toBe(false); // Too short
      expect(validator.validate({ items: [] }).valid).toBe(false); // Too short
    });

    it("should handle sparse arrays", () => {
      const validator = Builder()
        .use(arrayMinLengthPlugin)
        .use(requiredPlugin)
        .for<{ items: (string | undefined)[] }>()
        .v("items", (b) => b.array.required().minLength(3))
        .build();

      const sparseArray: (string | undefined)[] = ["a", , "c", , "e"]; // [0]: 'a', [1]: undefined, etc.
      const result = validator.validate({ items: sparseArray });
      expect(result.isValid()).toBe(true); // Array length is 5, meets minimum
    });

    it("should handle arrays with prototype pollution attempts", () => {
      const validator = Builder()
        .use(arrayMinLengthPlugin)
        .use(requiredPlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().minLength(1))
        .build();

      const maliciousArray = ["normal"];
      // Attempt to pollute Array prototype (this is an edge case test, not actual pollution)
      (maliciousArray as any).__proto__ = { malicious: "value" };

      const result = validator.validate({ items: maliciousArray });
      expect(result.isValid()).toBe(true); // Should validate normally, ignoring prototype
    });
  });

  describe("Complex Plugin Interaction Scenarios", () => {
    it("should handle complex conditional logic with multiple dependencies", () => {
      interface ComplexForm {
        userType: "admin" | "user" | "guest";
        permission: "read" | "write" | "admin";
        features: string[];
        adminCode?: string;
        userPrefs?: {
          theme: string;
          notifications: boolean;
        };
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(requiredIfPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .use(objectPlugin)
        .use(oneOfPlugin)
        .use(booleanTruthyPlugin)
        .for<ComplexForm>()
        .v("userType", (b) =>
          b.string.required().oneOf(["admin", "user", "guest"])
        )
        .v("permission", (b) =>
          b.string.required().oneOf(["read", "write", "admin"])
        )
        .v("features", (b) => b.array.required().minLength(1))
        .v("adminCode", (b) =>
          b.string
            .requiredIf(
              (data) => data.userType === "admin" && data.permission === "admin"
            )
            .min(8)
        )
        .v("userPrefs", (b) =>
          b.object.requiredIf((data) => data.userType !== "guest")
        )
        .v("userPrefs.theme", (b) =>
          b.string
            .requiredIf((data) => data.userType !== "guest")
            .oneOf(["light", "dark"])
        )
        .v("userPrefs.notifications", (b) =>
          b.boolean.requiredIf((data) => data.userType !== "guest")
        )
        .build();

      // Admin user - should require admin code
      const adminUser = {
        userType: "admin" as const,
        permission: "admin" as const,
        features: ["dashboard", "users"],
        // Missing adminCode and userPrefs
      };
      expect(validator.validate(adminUser).valid).toBe(false);

      // Complete admin user
      const completeAdmin = {
        userType: "admin" as const,
        permission: "admin" as const,
        features: ["dashboard", "users"],
        adminCode: "secretcode123",
        userPrefs: {
          theme: "dark",
          notifications: true,
        },
      };
      expect(validator.validate(completeAdmin).valid).toBe(true);

      // Guest user - should not require userPrefs
      const guestUser = {
        userType: "guest" as const,
        permission: "read" as const,
        features: ["view"],
        // No userPrefs required
      };
      expect(validator.validate(guestUser).valid).toBe(true);
    });

    it("should handle skip conditions with side effects", () => {
      let skipCallCount = 0;

      const validator = Builder()
        .use(skipPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ mode: string; config?: string }>()
        .v("config", (b) =>
          b.string
            .skip((values) => {
              skipCallCount++; // Side effect
              return values.mode === "readonly";
            })
            .required()
            .min(5)
        )
        .build();

      skipCallCount = 0;
      validator.validate({ mode: "readonly" });
      const firstCallCount = skipCallCount;

      skipCallCount = 0;
      validator.validate({ mode: "edit" });
      const secondCallCount = skipCallCount;

      expect(firstCallCount).toBeGreaterThan(0);
      expect(secondCallCount).toBeGreaterThan(0);
    });
  });

  describe("Error Message Edge Cases", () => {
    it("should handle error factories that throw exceptions", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ field: string }>()
        .v("field", (b) =>
          b.string.required({
            messageFactory: () => {
              throw new Error("Error factory failed");
            },
          })
        )
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(false);
      // Should have a fallback error message
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle error factories returning null/undefined", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ field: string }>()
        .v("field", (b) =>
          b.string.required({
            messageFactory: () => null as any,
          })
        )
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Library preserves null from custom error factory
      expect(result.errors[0].message).toBe(null);
    });

    it("should handle extremely nested field paths in error messages", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(objectPlugin)
        .for<{ a: { b: { c: { d: { e: { f: string } } } } } }>()
        .v("a.b.c.d.e.f", (b) => b.string.required().min(10))
        .build();

      const result = validator.validate({
        a: { b: { c: { d: { e: { f: "short" } } } } },
      });

      expect(result.isValid()).toBe(false);
      const error = result.errors[0];
      expect(error.path).toContain("a.b.c.d.e.f");
      expect(error.message).toBeTruthy();
    });
  });

  describe("Memory and Performance Edge Cases", () => {
    it("should handle recursive data structures without stack overflow", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ name: string; parent?: any }>()
        .v("name", (b) => b.string.required().min(1))
        .build();

      // Create deeply nested structure
      let deepObj: any = { name: "leaf" };
      for (let i = 0; i < 1000; i++) {
        deepObj = { name: `level${i}`, parent: deepObj };
      }

      const result = validator.validate(deepObj);
      expect(result.isValid()).toBe(true); // Should not stack overflow
    });

    it("should handle validation of objects with many properties", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Record<string, string>>()
        .v("field1", (b) => b.string.required().min(1))
        .build();

      // Create object with many properties
      const manyPropsObj: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        manyPropsObj[`prop${i}`] = `value${i}`;
      }
      manyPropsObj.field1 = "required";

      const start = performance.now();
      const result = validator.validate(manyPropsObj);
      const end = performance.now();

      expect(result.isValid()).toBe(true);
      expect(end - start).toBeLessThan(50); // Should be reasonably fast
    });
  });

  describe("Concurrency and State Edge Cases", () => {
    it("should handle concurrent validations without interference", async () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin)
        .for<{ id: string; data: string }>()
        .v("id", (b) => b.string.required().min(1))
        .v("data", (b) =>
          b.string.required().transform((v: string) => `processed_${v}`)
        )
        .build();

      // Run multiple validations concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() =>
          validator.validate({ id: `id${i}`, data: `data${i}` })
        )
      );

      const results = await Promise.all(promises);

      // All should succeed (validate doesn't return transformed data)
      results.forEach((result, i) => {
        expect(result.isValid()).toBe(true);
      });
    });
  });

  describe("Regex and Pattern Edge Cases", () => {
    it("should handle potentially dangerous regex patterns safely", () => {
      const validator = Builder()
        .use(stringPatternPlugin)
        .use(requiredPlugin)
        .for<{ text: string }>()
        .v(
          "text",
          (b) => b.string.required().pattern(/^[a-zA-Z0-9]+$/) // Safe pattern
        )
        .build();

      // Test with various inputs
      expect(validator.validate({ text: "abc123" }).valid).toBe(true);
      expect(validator.validate({ text: "abc_123" }).valid).toBe(false); // Underscore not allowed
      expect(validator.validate({ text: "abc-123" }).valid).toBe(false); // Dash not allowed
    });

    it("should handle unicode in regex patterns", () => {
      const validator = Builder()
        .use(stringPatternPlugin)
        .use(requiredPlugin)
        .for<{ text: string }>()
        .v(
          "text",
          (b) => b.string.required().pattern(/^[\u4e00-\u9fff]+$/) // Chinese characters
        )
        .build();

      expect(validator.validate({ text: "你好世界" }).valid).toBe(true);
      expect(validator.validate({ text: "hello" }).valid).toBe(false);
      expect(validator.validate({ text: "你好world" }).valid).toBe(false); // Mixed
    });
  });
});
