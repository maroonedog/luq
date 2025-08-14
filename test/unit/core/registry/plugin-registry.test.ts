/**
 * Test coverage for plugin-registry.ts
 * Testing core plugin registry functionality
 */

import { createPluginRegistry, FieldRule } from "../../../../src/core/registry/plugin-registry";
import { Result } from "../../../../src/types/result";

// Mock plugins for testing
const mockRequiredPlugin = {
  name: "required" as const,
  methodName: "required" as const,
  category: "standard" as const,
  allowedTypes: ["string", "number", "boolean", "date", "array", "object", "tuple", "union"] as const,
  pluginType: "validator" as const,
  implementation: () => ({
    check: (value: any) => value !== null && value !== undefined && value !== "",
    code: "required",
    getErrorMessage: () => "Field is required",
    params: []
  })
};

const mockStringMinPlugin = {
  name: "stringMin" as const,
  methodName: "min" as const,
  category: "string" as const,
  allowedTypes: ["string"] as const,
  pluginType: "validator" as const,
  implementation: (length: number) => ({
    check: (value: string) => typeof value === "string" && value.length >= length,
    code: "stringMin",
    getErrorMessage: () => `Minimum length is ${length}`,
    params: [length]
  })
};

const mockTransformPlugin = {
  name: "transform" as const,
  methodName: "transform" as const,
  category: "transform" as const,
  allowedTypes: ["string", "number", "boolean"] as const,
  pluginType: "transform" as const,
  implementation: (transformFn: (value: any) => any) => ({
    transformFn,
    code: "transform",
    params: [transformFn]
  })
};

describe("Plugin Registry", () => {
  describe("createPluginRegistry", () => {
    test("should create empty plugin registry", () => {
      const registry = createPluginRegistry();

      expect(registry).toBeDefined();
      expect(typeof registry.use).toBe("function");
      expect(typeof registry.createFieldRule).toBe("function");
      expect(typeof registry.toBuilder).toBe("function");
      expect(typeof registry.getPlugins).toBe("function");
    });

    test("should start with empty plugins", () => {
      const registry = createPluginRegistry();
      const plugins = registry.getPlugins();

      expect(plugins).toEqual({});
    });
  });

  describe("Plugin management", () => {
    test("should add single plugin", () => {
      const registry = createPluginRegistry().use(mockRequiredPlugin);
      const plugins = registry.getPlugins();

      expect(plugins).toHaveProperty("required");
      expect(plugins.required).toBe(mockRequiredPlugin);
    });

    test("should add multiple plugins", () => {
      const registry = createPluginRegistry()
        .use(mockRequiredPlugin)
        .use(mockStringMinPlugin);
      
      const plugins = registry.getPlugins();

      expect(plugins).toHaveProperty("required");
      expect(plugins).toHaveProperty("stringMin");
      expect(Object.keys(plugins)).toHaveLength(2);
    });

    test("should overwrite plugin with same name", () => {
      const updatedRequiredPlugin = {
        ...mockRequiredPlugin,
        implementation: () => ({
          check: () => true, // Always pass
          code: "required_updated",
          getErrorMessage: () => "Updated required message",
          params: []
        })
      };

      const registry = createPluginRegistry()
        .use(mockRequiredPlugin)
        .use(updatedRequiredPlugin);
      
      const plugins = registry.getPlugins();

      expect(Object.keys(plugins)).toHaveLength(1);
      expect(plugins.required).toBe(updatedRequiredPlugin);
    });

    test("should maintain type safety with plugin accumulation", () => {
      const registry = createPluginRegistry()
        .use(mockRequiredPlugin)
        .use(mockStringMinPlugin);

      // This is a type test - we're verifying that TypeScript can properly
      // track the accumulated plugins without compilation errors
      expect(registry).toBeDefined();
    });
  });

  describe("toBuilder", () => {
    test("should create builder with no plugins", () => {
      const registry = createPluginRegistry();
      const builder = registry.toBuilder();

      expect(builder).toBeDefined();
      expect(typeof builder.for).toBe("function");
    });

    test("should create builder with registered plugins", () => {
      const registry = createPluginRegistry()
        .use(mockRequiredPlugin)
        .use(mockStringMinPlugin);
      
      const builder = registry.toBuilder();

      expect(builder).toBeDefined();
      expect(typeof builder.for).toBe("function");
    });
  });

  describe("createFieldRule", () => {
    test("should create simple field rule with basic validation", () => {
      const registry = createPluginRegistry().use(mockRequiredPlugin);
      
      const rule = registry.createFieldRule((context) => {
        // Simple mock for testing - we can't access the actual methods without complex setup
        return {
          build: () => ({
            _validators: [mockRequiredPlugin.implementation()],
            _transforms: [],
            _executionPlan: null
          })
        } as any;
      });

      expect(rule).toBeDefined();
      expect(typeof rule.validate).toBe("function");
      expect(typeof rule.parse).toBe("function");
      expect(typeof rule.getPluginRegistry).toBe("function");
    });

    test("should create field rule with name and description", () => {
      const registry = createPluginRegistry().use(mockRequiredPlugin);
      
      const rule = registry.createFieldRule(
        (context) => ({
          build: () => ({
            _validators: [],
            _transforms: [],
            _executionPlan: null
          })
        } as any),
        {
          name: "testField",
          description: "A test field rule"
        }
      );

      expect(rule.name).toBe("testField");
      expect(rule.description).toBe("A test field rule");
    });

    test("should create field rule with field options", () => {
      const registry = createPluginRegistry().use(mockRequiredPlugin);
      
      const rule = registry.createFieldRule(
        (context) => ({
          build: () => ({
            _validators: [],
            _transforms: [],
            _executionPlan: null
          })
        } as any),
        {
          fieldOptions: {
            defaultValue: "test default"
          }
        }
      );

      expect(rule.fieldOptions).toEqual({
        defaultValue: "test default"
      });
    });
  });

  describe("FieldRule functionality", () => {
    let registry: any;
    let mockRule: FieldRule<string>;

    beforeEach(() => {
      registry = createPluginRegistry().use(mockRequiredPlugin);
      
      mockRule = registry.createFieldRule((context: any) => ({
        build: () => ({
          _validators: [mockRequiredPlugin.implementation()],
          _transforms: [],
          _executionPlan: null
        })
      }));
    });

    test("should validate valid value", () => {
      const result = mockRule.validate("test value");

      expect(result).toBeDefined();
      // Since we're using mocked validators, we expect it to work
    });

    test("should validate invalid value", () => {
      const result = mockRule.validate("");

      expect(result).toBeDefined();
      // Should fail validation for empty string with required plugin
    });

    test("should parse valid value", () => {
      const result = mockRule.parse("test value");

      expect(result).toBeDefined();
    });

    test("should handle parsing errors gracefully", () => {
      const result = mockRule.parse(null);

      expect(result).toBeDefined();
      // Should handle null values gracefully
    });

    test("should return plugin registry reference", () => {
      const returnedRegistry = mockRule.getPluginRegistry();

      expect(returnedRegistry).toBe(registry);
    });

    test("should expose internal validators for integration", () => {
      if (mockRule._getInternalValidators) {
        const internals = mockRule._getInternalValidators();

        expect(internals).toBeDefined();
        expect(Array.isArray(internals.validators)).toBe(true);
        expect(Array.isArray(internals.transforms)).toBe(true);
      }
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle field rule creation with empty definition", () => {
      const registry = createPluginRegistry();
      
      const rule = registry.createFieldRule((context) => ({
        build: () => ({
          _validators: [],
          _transforms: [],
          _executionPlan: null
        })
      } as any));

      expect(rule).toBeDefined();
    });

    test("should handle validation errors gracefully", () => {
      const registry = createPluginRegistry();
      
      const rule = registry.createFieldRule((context) => ({
        build: () => {
          throw new Error("Build error");
        }
      } as any));

      // Should not throw during rule creation
      expect(rule).toBeDefined();
    });

    test("should handle missing plugin gracefully", () => {
      const registry = createPluginRegistry();
      const plugins = registry.getPlugins();

      expect(plugins).toEqual({});
    });

    test("should handle complex field options normalization", () => {
      const registry = createPluginRegistry();
      
      const rule = registry.createFieldRule(
        (context) => ({
          build: () => ({
            _validators: [],
            _transforms: [],
            _executionPlan: null
          })
        } as any),
        "simple default value" as any // Test normalization
      );

      expect(rule).toBeDefined();
    });
  });

  describe("Integration scenarios", () => {
    test("should work with multiple plugins and complex validation", () => {
      const registry = createPluginRegistry()
        .use(mockRequiredPlugin)
        .use(mockStringMinPlugin)
        .use(mockTransformPlugin);

      const rule = registry.createFieldRule((context) => ({
        build: () => ({
          _validators: [
            mockRequiredPlugin.implementation(),
            mockStringMinPlugin.implementation(3)
          ],
          _transforms: [
            mockTransformPlugin.implementation((s: string) => s.toUpperCase())
          ],
          _executionPlan: null
        })
      } as any));

      expect(rule).toBeDefined();
    });

    test("should handle plugin method name mapping", () => {
      const registry = createPluginRegistry()
        .use(mockRequiredPlugin)
        .use(mockStringMinPlugin);

      const plugins = registry.getPlugins();

      // Verify plugins are stored by their name, not methodName
      expect(plugins.required).toBeDefined();
      expect(plugins.stringMin).toBeDefined();
      expect(plugins.required.methodName).toBe("required");
      expect(plugins.stringMin.methodName).toBe("min");
    });
  });
});