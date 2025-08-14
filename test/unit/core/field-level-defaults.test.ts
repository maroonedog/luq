import { describe, it, expect } from "@jest/globals";
import { Builder } from "../../../src/core/builder/core/builder";
import { requiredPlugin } from "../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../src/core/plugin/numberMin";
import { optionalPlugin } from "../../../src/core/plugin/optional";
import { nullablePlugin } from "../../../src/core/plugin/nullable";

describe("Field-level Default Values", () => {
  describe("Basic default value functionality", () => {
    it("should apply default value when field is undefined", () => {
      type User = {
        name: string;
        age: number;
        city?: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(optionalPlugin)
        .for<User>()
        .v("name", (b) => b.string.required(), "Anonymous") // default value as third param
        .v("age", (b) => b.number.required().min(0), 18) // default value
        .v("city", (b) => b.string.optional(), "Unknown") // default for optional field
        .build();

      const result = validator.parse({});

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        const data = result.data();
        expect(data.name).toBe("Anonymous");
        expect(data.age).toBe(18);
        expect(data.city).toBe("Unknown");
      }
    });

    it("should not apply default when field has value", () => {
      type User = {
        name: string;
        age: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<User>()
        .v("name", (b) => b.string.required(), "Anonymous")
        .v("age", (b) => b.number.required().min(0), 18)
        .build();

      const result = validator.parse({
        name: "John",
        age: 25,
      });

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        const data = result.data();
        expect(data.name).toBe("John");
        expect(data.age).toBe(25);
      }
    });

    it("should support function as default value", () => {
      type Order = {
        id: string;
        timestamp: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .for<Order>()
        .v(
          "id",
          (b) => b.string.required(),
          () => `order-${Date.now()}`
        )
        .v(
          "timestamp",
          (b) => b.number.required(),
          () => Date.now()
        )
        .build();

      const result = validator.parse({});

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        const data = result.data();
        expect(data.id).toMatch(/^order-\d+$/);
        expect(data.timestamp).toBeGreaterThan(0);
      }
    });

    it("should handle null values with applyDefaultToNull option", () => {
      type User = {
        name: string;
        nickname: string | null;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(nullablePlugin)
        .for<User>()
        .v("name", (b) => b.string.nullable(), {
          default: "Anonymous",
          applyDefaultToNull: false, // Don't apply default to null
        })
        .v("nickname", (b) => b.string.required(), {
          default: "Guest",
          applyDefaultToNull: true, // Apply default to null
        })
        .build();

      const result = validator.parse({
        name: null,
        nickname: null,
      });

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        const data = result.data();
        expect(data.name).toBe(null); // null is preserved
        expect(data.nickname).toBe("Guest"); // null is replaced with default
      }
    });

    it("should support full field options", () => {
      type Product = {
        name: string;
        description: string;
        stock: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<Product>()
        .v("name", (b) => b.string.required(), {
          default: "Unnamed Product",
          description: "Product display name",
        })
        .v("description", (b) => b.string.required(), {
          default: "No description available",
          deprecated: "Use 'details' field instead",
        })
        .v("stock", (b) => b.number.required().min(0), {
          default: 0,
          metadata: { unit: "pieces" },
        })
        .build();

      const result = validator.parse({});

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        const data = result.data();
        expect(data.name).toBe("Unnamed Product");
        expect(data.description).toBe("No description available");
        expect(data.stock).toBe(0);
      }
    });

    it("should work with nested fields", () => {
      type User = {
        profile: {
          name: string;
          bio?: string;
        };
        settings: {
          theme: string;
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .for<User>()
        .v("profile.name", (b) => b.string.required(), "Anonymous")
        .v("profile.bio", (b) => b.string.optional(), "No bio provided")
        .v("settings.theme", (b) => b.string.required(), "light")
        .build();

      const result = validator.parse({
        profile: {},
        settings: {},
      });

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        const data = result.data();
        expect(data.profile.name).toBe("Anonymous");
        expect(data.profile.bio).toBe("No bio provided");
        expect(data.settings.theme).toBe("light");
      }
    });
  });

  describe("Default values with validation", () => {
    it("should validate default values", () => {
      type User = {
        name: string;
        age: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<User>()
        .v("name", (b) => b.string.required().min(5), "Jo") // Default is too short
        .v("age", (b) => b.number.required().min(18), 16) // Default is too young
        .build();

      const result = validator.parse({});

      expect(result.isValid()).toBe(false);
      if (!result.isValid()) {
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].path).toBe("name");
        expect(result.errors[1].path).toBe("age");
      }
    });

    it("should apply defaults before validation", () => {
      type Form = {
        acceptTerms: boolean;
        newsletter: boolean;
      };

      // Ensure we're not in ultra-fast mode for this test
      const originalEnv = process.env.LUQ_ULTRA_FAST;
      const originalGlobal = (global as any).__LUQ_ULTRA_FAST__;
      process.env.LUQ_ULTRA_FAST = "false";
      (global as any).__LUQ_ULTRA_FAST__ = false;

      const validator = Builder()
        .use(requiredPlugin)
        .for<Form>()
        .v("acceptTerms", (b) => b.boolean.required(), false)
        .v("newsletter", (b) => b.boolean.required(), true)
        .build();

      const result = validator.parse({});

      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.LUQ_ULTRA_FAST = originalEnv;
      } else {
        delete process.env.LUQ_ULTRA_FAST;
      }
      (global as any).__LUQ_ULTRA_FAST__ = originalGlobal;

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        const data = result.data();
        expect(data.acceptTerms).toBe(false);
        expect(data.newsletter).toBe(true);
      }
    });
  });

  describe("Backwards compatibility", () => {
    it("should work without default values (existing behavior)", () => {
      type User = {
        name: string;
        age: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .for<User>()
        .v("name", (b) => b.string.required())
        .v("age", (b) => b.number.required())
        .build();

      const result = validator.parse({});

      expect(result.isValid()).toBe(false);
      if (!result.isValid()) {
        expect(result.errors).toHaveLength(2);
      }
    });
  });
});
