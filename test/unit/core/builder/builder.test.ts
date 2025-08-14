import { describe, test, expect } from "@jest/globals";
import {
  Builder
} from "../../../../src/core/builder/core/builder";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("Builder", () => {
  describe("constructor", () => {
    test("should create a new builder instance", () => {
      const builder = Builder();
      expect(builder).toBeDefined();
      expect(builder.use).toBeDefined();
      expect(builder.for).toBeDefined();
    });
  });

  describe("use method", () => {
    test("should handle single plugin", () => {
      const builder = Builder();
      const result = builder.use(requiredPlugin);

      expect(result).toBe(builder); // Should return self for chaining
    });

    test("should handle multiple plugins", () => {
      const builder = Builder();
      const result = builder.use(
        requiredPlugin,
        stringMinPlugin,
        numberMinPlugin
      );

      expect(result).toBe(builder); // Should return self for chaining
    });

    test("should handle empty plugin list", () => {
      const builder = Builder();
      const result = builder.use();

      expect(result).toBe(builder);
    });

    test("should skip null/undefined plugins", () => {
      const builder = Builder();
      const result = builder.use(
        requiredPlugin,
        null,
        undefined,
        stringMinPlugin
      );

      expect(result).toBe(builder);
    });

    test("should throw error for invalid plugins", () => {
      const builder = Builder();

      expect(() => builder.use("invalid" as any)).toThrow(
        "Invalid plugin at index 0"
      );
      expect(() => builder.use({} as any)).toThrow("Invalid plugin at index 0");
      expect(() => builder.use({ notName: "test" } as any)).toThrow(
        "Invalid plugin at index 0"
      );
    });

    test("should skip duplicate plugins", () => {
      const builder = Builder();

      // Add same plugin twice
      builder.use(requiredPlugin);
      builder.use(requiredPlugin);

      // Should not throw and should handle gracefully
      expect(() => builder.use(requiredPlugin)).not.toThrow();
    });

    test("should handle builder extension plugins", () => {
      const mockExtension = jest.fn();
      const extensionPlugin = {
        name: "testExtension",
        category: "builder-extension" as const,
        extendBuilder: mockExtension,
      };

      const builder = Builder();
      builder.use(extensionPlugin);

      expect(mockExtension).toHaveBeenCalledWith(builder);
    });
  });

  describe("for method", () => {
    test("should return a field builder for the specified type", () => {
      const builder = Builder();
      const fieldBuilder = builder.for<{ name: string; age: number }>();

      expect(fieldBuilder).toBeDefined();
      expect(fieldBuilder.v).toBeDefined();
      expect(fieldBuilder.field).toBeDefined();
      expect(fieldBuilder.build).toBeDefined();
    });

    test("should preserve plugins when creating field builder", () => {
      const builder = Builder();
      builder.use(requiredPlugin, stringMinPlugin);

      const fieldBuilder = builder.for<{ name: string }>();

      // Should be able to use the plugins - just check that v method exists
      expect(fieldBuilder.v).toBeDefined();
      expect(typeof fieldBuilder.v).toBe("function");
    });
  });

  describe("chaining", () => {
    test("should support method chaining", () => {
      const builder = Builder();

      const result = builder
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin);

      expect(result).toBe(builder);
    });

    test("should support chaining with for method", () => {
      const builder = Builder();

      const validator = (
        builder.use(requiredPlugin).use(stringMinPlugin) as any
      )
        .for()
        .v("name", (b) => b.string.required().min(3) as any)
        .build();

      expect(validator).toBeDefined();
      expect(validator.validate).toBeDefined();
    });
  });

  describe("error handling", () => {
    test("should log error for invalid plugin", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const builder = Builder();

      try {
        builder.use("invalid" as any);
      } catch (e) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith("Invalid plugin:", "invalid");
      consoleSpy.mockRestore();
    });

    test("should provide helpful error messages", () => {
      const builder = Builder();

      expect(() => builder.use(123 as any)).toThrow(
        "Invalid plugin at index 0: plugin must be an object with a 'name' property"
      );

      expect(() => builder.use(requiredPlugin, "invalid" as any)).toThrow(
        "Invalid plugin at index 1: plugin must be an object with a 'name' property"
      );
    });
  });
});

describe("Builder function", () => {
  test("should create a new builder instance", () => {
    const builder = Builder();

    expect(builder).toBeDefined();
    expect(builder.use).toBeDefined();
    expect(builder.for).toBeDefined();
  });

  test("should create builder with correct type inference", () => {
    const builder = Builder<{ name: string; age: number }>();

    expect(builder).toBeDefined();

    // Should be able to use the builder
    const validator = (
      builder
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin) as any
    )
      .for()
      .v("name", (b) => b.string.required().min(3) as any)
      .v("age", (b) => b.number.required().min(0) as any)
      .build();

    expect(validator).toBeDefined();
  });

  test("should handle complex scenarios", () => {
    interface User {
      name: string;
      email?: string;
      age: number;
      profile: {
        bio?: string;
        website?: string;
      };
    }

    const builder = Builder<User>();

    const validator = (
      builder
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin) as any
    )
      .for()
      .v("name", (b) => b.string.required().min(2) as any)
      .v("email", (b) => b.string.optional() as any)
      .v("age", (b) => b.number.required().min(18) as any)
      .v("profile.bio", (b) => b.string.optional().min(10) as any)
      .v("profile.website", (b) => b.string.optional() as any)
      .build();

    // Test valid data
    const validResult = validator.validate({
      name: "John Doe",
      age: 25,
      profile: {
        bio: "Software developer",
      },
    });

    expect(validResult.isValid()).toBe(true);

    // Test invalid data
    const invalidResult = validator.validate({
      name: "J", // Too short
      age: 17, // Too young
      profile: {},
    }, { abortEarly: false });

    expect(invalidResult.isValid()).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThanOrEqual(1);
    // Check that we have errors for both name and age
    const errorPaths = invalidResult.errors.map(e => e.path);
    expect(errorPaths).toContain("name");
    expect(errorPaths).toContain("age");
  });
});

describe("Edge cases and error scenarios", () => {
  test("should handle plugins with same name gracefully", () => {
    const plugin1 = {
      name: "custom1",
      methodName: "custom1",
      category: "standard" as const,
      create: () => () => ({ valid: true })
    };
    const plugin2 = {
      name: "custom1", // Same name as plugin1
      methodName: "custom1",
      category: "standard" as const,
      create: () => () => ({ valid: true })
    };

    const builder = Builder();

    // Should not throw (second plugin is skipped)
    expect(() => {
      builder.use(plugin1).use(plugin2);
    }).not.toThrow();
  });

  test("should handle mixed valid and invalid plugins", () => {
    const builder = Builder();

    expect(() => {
      builder.use(requiredPlugin, null, "invalid" as any, stringMinPlugin);
    }).toThrow("Invalid plugin at index 2");
  });

  test("should handle builder extensions that throw errors", () => {
    const errorPlugin = {
      name: "errorExtension",
      category: "builder-extension" as const,
      extendBuilder: () => {
        throw new Error("Extension error");
      },
    };

    const builder = Builder();

    expect(() => builder.use(errorPlugin)).toThrow("Extension error");
  });

  test("should handle deeply nested plugin structures", () => {
    const nestedPlugin = {
      name: "nested",
      methodName: "nested",
      category: "standard" as const,
      create: () => () => ({ valid: true }),
      config: {
        deep: {
          nested: {
            value: true,
          },
        },
      },
    };

    const builder = Builder();

    // Should handle complex plugin objects
    expect(() => builder.use(nestedPlugin)).not.toThrow();
  });
});
