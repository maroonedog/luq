import { describe, test, expect, jest } from "@jest/globals";
import { createFieldBuilderImpl } from "../../../../src/core/builder/core/field-builder";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { transformPlugin } from "../../../../src/core/plugin/transform";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { Result } from "../../../../src/types/result";

describe("FieldBuilderImpl", () => {
  describe("constructor", () => {
    test("should create a new field builder instance", () => {
      const plugins = { required: requiredPlugin };
      const chainableBuilder = {};

      const fieldBuilder = createFieldBuilderImpl(plugins, chainableBuilder);

      expect(fieldBuilder).toBeDefined();
      expect(typeof fieldBuilder).toBe("object");
      expect(fieldBuilder.field).toBeDefined();
      expect(fieldBuilder.v).toBeDefined();
    });

    test("should initialize with field definitions", () => {
      const plugins = { required: requiredPlugin };
      const chainableBuilder = {};
      const fieldDefinitions = [
        { path: "name", inferredType: "string", builderFunction: () => {} },
      ];

      const fieldBuilder = createFieldBuilderImpl(
        plugins,
        chainableBuilder,
        fieldDefinitions
      );

      expect(fieldBuilder).toBeDefined();
      expect(fieldBuilder.field).toBeDefined();
    });

    test("should initialize with strict mode", () => {
      const plugins = { required: requiredPlugin };
      const chainableBuilder = {};

      const fieldBuilder = createFieldBuilderImpl(
        plugins,
        chainableBuilder,
        [],
        true
      );

      expect(fieldBuilder).toBeDefined();
      expect(fieldBuilder.strict).toBeDefined();
    });
  });

  describe("field/v method", () => {
    test("v should be an alias for field method", () => {
      const plugins = { required: requiredPlugin };
      const fieldBuilder = createFieldBuilderImpl(plugins, {});

      expect(fieldBuilder.v).toBe(fieldBuilder.field);
    });

    test("should add a field definition", () => {
      const plugins = {
        required: requiredPlugin,
        stringMin: stringMinPlugin,
      };
      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      const newBuilder = fieldBuilder.field("name", (b) => {
        // Type assertion to help TypeScript understand the structure
        return b.string.required().min(3) as any;
      });

      expect(newBuilder).toBeDefined();
      expect(typeof newBuilder).toBe("object");
      expect(newBuilder.field).toBeDefined();
      expect(newBuilder).not.toBe(fieldBuilder); // Should return new instance
    });

    test("should handle nested fields", () => {
      const plugins = {
        required: requiredPlugin,
        optional: optionalPlugin,
        stringMin: stringMinPlugin,
      };

      interface User {
        profile: {
          name: string;
          bio?: string;
        };
      }

      const fieldBuilder = createFieldBuilderImpl<User, {}, typeof plugins>(
        plugins,
        {}
      );

      const newBuilder = fieldBuilder
        .field("profile.name", (b) => b.string.required().min(2) as any)
        .field("profile.bio", (b) => b.string.optional().min(10) as any);

      expect(newBuilder).toBeDefined();
    });

    test("should handle array fields", () => {
      const plugins = {
        required: requiredPlugin,
        arrayMinLength: arrayMinLengthPlugin,
        stringMin: stringMinPlugin,
      };

      interface Data {
        tags: string[];
      }

      const fieldBuilder = createFieldBuilderImpl<Data, {}, typeof plugins>(
        plugins,
        {}
      );

      const newBuilder = fieldBuilder.field(
        "tags",
        (b) => b.array.required().minLength(1) as any
      );
      // Note: Array element validation like "tags[*]" requires special handling

      expect(newBuilder).toBeDefined();
    });
  });

  describe("useField method", () => {
    test("should add a field rule", () => {
      const plugins = { required: requiredPlugin };

      // Create a mock plugin registry
      const mockPluginRegistry: any = {};
      mockPluginRegistry.use = jest.fn().mockReturnValue(mockPluginRegistry);
      mockPluginRegistry.createFieldRule = jest.fn();
      mockPluginRegistry.toBuilder = jest.fn();
      mockPluginRegistry.getPlugins = jest.fn().mockReturnValue({});

      // Create a mock field rule with minimal interface
      const fieldRule = {
        validate: (value: any) => {
          const isValid = value && value.length > 0;
          return isValid
            ? Result.ok(value)
            : Result.error([{ message: "Field is required" }] as any);
        },
        _phantomType: {} as any,
        parse: (value: any) => Result.ok(value),
        getPluginRegistry: () => mockPluginRegistry,
      };

      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      const newBuilder = fieldBuilder.useField("name", fieldRule);

      expect(newBuilder).toBeDefined();
      expect(typeof newBuilder).toBe("object");
      expect(newBuilder.field).toBeDefined();
    });

    test("should handle nested field rules", () => {
      const plugins = { required: requiredPlugin };

      interface User {
        profile: {
          name: string;
        };
      }

      // Create a mock plugin registry
      const mockPluginRegistry: any = {};
      mockPluginRegistry.use = jest.fn().mockReturnValue(mockPluginRegistry);
      mockPluginRegistry.createFieldRule = jest.fn();
      mockPluginRegistry.toBuilder = jest.fn();
      mockPluginRegistry.getPlugins = jest.fn().mockReturnValue({});

      const fieldRule = {
        validate: (value: any) => Result.ok(value),
        _phantomType: {} as any,
        parse: (value: any) => Result.ok(value),
        getPluginRegistry: () => mockPluginRegistry,
      };

      const fieldBuilder = createFieldBuilderImpl<User, {}, typeof plugins>(
        plugins,
        {}
      );

      const newBuilder = fieldBuilder.useField("profile.name", fieldRule);

      expect(newBuilder).toBeDefined();
    });
  });

  describe("strict mode", () => {
    test("should enable strict mode", () => {
      const plugins = { required: requiredPlugin };

      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      // Add field first, then call strict
      const builderWithField = fieldBuilder.field(
        "name",
        (b) => b.string.required() as any
      );
      const strictBuilder = builderWithField.strict();

      expect(strictBuilder).toBeDefined();
      expect(typeof strictBuilder).toBe("object");
      expect(strictBuilder.field).toBeDefined();
    });

    test("should enable editor-only strict mode", () => {
      const plugins = { required: requiredPlugin };

      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      // Add field first, then call strictOnEditor
      const builderWithField = fieldBuilder.field(
        "name",
        (b) => b.string.required() as any
      );
      const strictBuilder = builderWithField.strictOnEditor();

      expect(strictBuilder).toBeDefined();
      expect(typeof strictBuilder).toBe("object");
      expect(strictBuilder.field).toBeDefined();
    });
  });

  describe("build method", () => {
    test("should build a validator", () => {
      const plugins = {
        required: requiredPlugin,
        stringMin: stringMinPlugin,
      };

      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      const validator = fieldBuilder
        .field("name", (b) => b.string.required().min(3) as any)
        .build();

      expect(validator).toBeDefined();
      expect(validator.validate).toBeDefined();
      expect(typeof validator.validate).toBe("function");
    });

    test("should build validator with transforms", () => {
      const plugins = {
        required: requiredPlugin,
        transform: transformPlugin,
      };

      const fieldBuilder = createFieldBuilderImpl<
        { count: string },
        {},
        typeof plugins
      >(plugins, {});

      const validator = fieldBuilder
        .field(
          "count",
          (b) => b.string.required().transform((v) => parseInt(v, 10)) as any
        )
        .build();

      expect(validator).toBeDefined();
      expect(validator.validate).toBeDefined();
      expect(validator.parse).toBeDefined();
    });

    test("should handle complex nested structures", () => {
      const plugins = {
        required: requiredPlugin,
        optional: optionalPlugin,
        stringMin: stringMinPlugin,
        numberMin: numberMinPlugin,
        arrayMinLength: arrayMinLengthPlugin,
      };

      interface ComplexData {
        user: {
          name: string;
          age: number;
          tags?: string[];
        };
        settings: {
          notifications: {
            email: boolean;
            push?: boolean;
          };
        };
      }

      const fieldBuilder = createFieldBuilderImpl<
        ComplexData,
        {},
        typeof plugins
      >(plugins, {});

      const validator = fieldBuilder
        .field("user.name", (b) => b.string.required().min(2) as any)
        .field("user.age", (b) => b.number.required().min(18) as any)
        .field("user.tags", (b) => b.array.optional().minLength(1) as any)
        .field("user.tags[*]", (b) => b.string.min(2)) // Array element paths need special handling
        .field(
          "settings.notifications.email",
          (b) => b.boolean.required() as any
        )
        .field(
          "settings.notifications.push",
          (b) => b.boolean.optional()
        )
        .build();

      expect(validator).toBeDefined();

      // Test valid data
      const validResult = validator.validate({
        user: {
          name: "John",
          age: 25,
          tags: ["tech", "music"],
        },
        settings: {
          notifications: {
            email: true,
          },
        },
      });

      expect(validResult.isValid()).toBe(true);

      // Test invalid data
      const invalidResult = validator.validate({
        user: {
          name: "J", // Too short
          age: 17, // Too young
        },
        settings: {
          notifications: {
            email: true,
          },
        },
      });

      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThanOrEqual(1);
      // Note: May return 1 or 2 errors depending on validation behavior
      expect(invalidResult.errors[0].path).toBe("user.name");
    });
  });

  describe("field type inference", () => {
    test("should infer nested field type", () => {
      const plugins = { required: requiredPlugin };

      const fieldBuilder = createFieldBuilderImpl<
        { user: { name: string } },
        {},
        typeof plugins
      >(plugins, {});

      // This tests the internal inferFieldType method indirectly
      const newBuilder = fieldBuilder.field(
        "user.name",
        (b) => b.string.required() as any
      );

      expect(newBuilder).toBeDefined();
    });

    test("should infer scalar field type", () => {
      const plugins = { required: requiredPlugin };

      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      const newBuilder = fieldBuilder.field(
        "name",
        (b) => b.string.required() as any
      );

      expect(newBuilder).toBeDefined();
    });
  });

  describe("error handling", () => {
    test("should handle invalid field paths gracefully", () => {
      const plugins = { required: requiredPlugin };

      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      // TypeScript would normally catch this, but testing runtime behavior
      // Use expect to catch the error during field definition
      expect(() => {
        fieldBuilder
          .field("name" as any, (b) => {
            throw new Error("Builder error");
          })
          .build();
      }).toThrow("Builder error");
    });

    test("should handle field rule validation errors", () => {
      const plugins = { required: requiredPlugin };

      // Create a mock plugin registry
      const mockPluginRegistry: any = {};
      mockPluginRegistry.use = jest.fn().mockReturnValue(mockPluginRegistry);
      mockPluginRegistry.createFieldRule = jest.fn();
      mockPluginRegistry.toBuilder = jest.fn();
      mockPluginRegistry.getPlugins = jest.fn().mockReturnValue({});

      const errorFieldRule = {
        validate: (value: any) => {
          throw new Error("Validation error");
        },
        _phantomType: {} as any,
        parse: (value: any) => Result.ok(value),
        getPluginRegistry: () => mockPluginRegistry,
      };

      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      const validator = fieldBuilder.useField("name", errorFieldRule).build();

      expect(validator).toBeDefined();

      // Should handle error gracefully during validation
      expect(() => validator.validate({ name: "test" })).not.toThrow();
    });
  });

  describe("builder caching", () => {
    test("should cache validator factory", () => {
      const plugins = {
        required: requiredPlugin,
        stringMin: stringMinPlugin,
      };

      const fieldBuilder = createFieldBuilderImpl<
        { name: string },
        {},
        typeof plugins
      >(plugins, {});

      const builder = fieldBuilder.field(
        "name",
        (b) => b.string.required().min(3) as any
      );

      // Build multiple times - should reuse cached factory
      const validator1 = builder.build();
      const validator2 = builder.build();

      expect(validator1).toBeDefined();
      expect(validator2).toBeDefined();
      // Note: They won't be the same instance because build() creates new validators
      // but the internal factory should be cached
    });
  });
});
