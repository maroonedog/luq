/**
 * Comprehensive tests for plugin-registry.ts to improve coverage from 65.57% to 90%
 * Focus on uncovered lines: 191, 201-204, 212-266
 */

import { createPluginRegistry } from "../../src/core/registry/plugin-registry";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringEmailPlugin } from "../../src/core/plugin/stringEmail";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { transformPlugin } from "../../src/core/plugin/transform";

describe("Plugin Registry - Comprehensive Coverage", () => {
  describe("FieldRule getters", () => {
    it("should return description from options", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      const emailRule = registry.createFieldRule<string>(
        (b: any) => b.string.required({}).email({}),
        { 
          name: "email",
          description: "Email field validation rule"
        }
      );

      // Test uncovered line 191: description getter
      expect(emailRule.description).toBe("Email field validation rule");
      expect(emailRule.name).toBe("email");
    });

    it("should return undefined for missing description", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      const emailRule = registry.createFieldRule<string>(
        (b: any) => b.string.required({}).email({}),
        { name: "email" } // No description
      );

      // Test uncovered line 191: description getter returning undefined
      expect(emailRule.description).toBeUndefined();
    });

    it("should return undefined for missing options", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      const emailRule = registry.createFieldRule<string>(
        (b: any) => b.string.required({}).email({})
        // No options object
      );

      expect(emailRule.name).toBeUndefined();
      expect(emailRule.description).toBeUndefined();
    });
  });

  describe("FieldRule validate method success path", () => {
    it("should execute successful validation path", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      // Create a simple rule that should always pass
      const alwaysValidRule = registry.createFieldRule<string>(
        (b: any) => b.string, // No validation plugins - should pass
        { name: "simple" }
      );

      // Test uncovered lines 201-204: successful validation path
      const result = alwaysValidRule.validate("test@example.com");
      expect(result.isValid()).toBe(true);
      expect(result.unwrap()).toBe("test@example.com");
    });

    it("should handle successful validation with type conversion", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin);

      const rule = registry.createFieldRule<string>(
        (b: any) => b.string.required({})
      );

      const result = rule.validate("valid string");
      expect(result.isValid()).toBe(true);
      expect(result.unwrap()).toBe("valid string");
    });
  });

  describe("FieldRule parse method", () => {
    it("should execute parse with transforms", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(transformPlugin);

      const transformRule = registry.createFieldRule<string>(
        (b: any) => b.string.required({}).transform((v: string) => v.toUpperCase()),
        { name: "uppercase" }
      );

      // Test uncovered lines 218-242: parse method execution
      const result = transformRule.parse("hello");
      expect(result.isValid()).toBe(true);
      expect(result.unwrap()).toBe("HELLO");
    });

    it("should handle parse with execution plan", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(transformPlugin);

      const rule = registry.createFieldRule<string>(
        (b: any) => b.string.transform((v: string) => v.trim())
      );

      const result = rule.parse("  spaced  ");
      expect(result.isValid()).toBe(true);
      expect(result.unwrap()).toBe("spaced");
    });

    it("should fallback to validation when no execution plan", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin);

      const rule = registry.createFieldRule<string>(
        (b: any) => b.string.required({})
      );

      // Test uncovered lines 244-252: fallback path in parse
      const result = rule.parse("test value");
      expect(result.isValid()).toBe(true);
      expect(result.unwrap()).toBe("test value");
    });

    it("should handle parse errors gracefully", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin);

      // Create a rule that should cause an error
      const errorRule = registry.createFieldRule<string>(
        (b: any) => {
          throw new Error("Rule definition error");
        }
      );

      // Test uncovered lines 253-262: parse error handling
      const result = errorRule.parse("test");
      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors[0].code).toBe("FIELD_RULE_PARSE_ERROR");
      expect(errors[0].message).toContain("Rule definition error");
    });

    it("should handle parse errors with non-Error objects", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin);

      const errorRule = registry.createFieldRule<string>(
        (b: any) => {
          throw "String error";
        }
      );

      const result = errorRule.parse("test");
      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors[0].code).toBe("FIELD_RULE_PARSE_ERROR");
      expect(errors[0].message).toBe("Parse failed");
    });
  });

  describe("FieldRule getPluginRegistry method", () => {
    it("should return the plugin registry", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      const rule = registry.createFieldRule<string>(
        (b: any) => b.string.required({}).email({})
      );

      // Test uncovered lines 265-266: getPluginRegistry method
      const retrievedRegistry = rule.getPluginRegistry();
      expect(retrievedRegistry).toBe(registry);
    });

    it("should allow access to registry plugins through field rule", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin)
        .use(stringMinPlugin);

      const rule = registry.createFieldRule<string>(
        (b: any) => b.string.required({}).email({}).min(5)
      );

      const retrievedRegistry = rule.getPluginRegistry();
      const plugins = retrievedRegistry.getPlugins();
      
      expect(plugins).toHaveProperty("required");
      expect(plugins).toHaveProperty("stringEmail");
      expect(plugins).toHaveProperty("stringMin");
    });
  });

  describe("Error handling in validate method", () => {
    it("should handle validation errors gracefully", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin);

      // Create a rule that should cause an error during validation
      const errorRule = registry.createFieldRule<string>(
        (b: any) => {
          throw new Error("Validation setup error");
        }
      );

      // Test uncovered lines 206-215: validation error handling
      const result = errorRule.validate("test");
      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors[0].code).toBe("FIELD_RULE_ERROR");
      expect(errors[0].message).toBe("Validation setup error");
      expect(errors[0].path).toBe("");
    });

    it("should handle non-Error objects in catch block", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin);

      const errorRule = registry.createFieldRule<string>(
        (b: any) => {
          throw "String error message";
        }
      );

      const result = errorRule.validate("test");
      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors[0].message).toBe("Validation failed");
    });
  });

  describe("Complex validation scenarios", () => {
    it("should handle multiple validation rules successfully", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin)
        .use(stringMinPlugin);

      const complexRule = registry.createFieldRule<string>(
        (b: any) => b.string.required({}).email({}).min(10),
        { 
          name: "complexEmail",
          description: "Complex email with minimum length"
        }
      );

      // Test long valid email (should pass all validations)
      const validResult = complexRule.validate("longemail@example.com");
      expect(validResult.isValid()).toBe(true);

      // Test short email (should fail min length)
      const invalidResult = complexRule.validate("a@b.co");
      expect(invalidResult.isError()).toBe(true);
    });

    it("should handle validation with parse options", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(transformPlugin);

      const rule = registry.createFieldRule<string>(
        (b: any) => b.string.required({}).transform((v: string) => v.toLowerCase()),
        { name: "lowercase" }
      );

      const parseResult = rule.parse("HELLO WORLD", { 
        abortEarly: false
      });
      
      expect(parseResult.isValid()).toBe(true);
      expect(parseResult.unwrap()).toBe("hello world");
    });
  });

  describe("Registry integration scenarios", () => {
    it("should work with toBuilder method", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      const builder = registry.toBuilder();
      expect(builder).toBeDefined();
      expect(typeof builder.for).toBe("function");
    });

    it("should maintain plugin state across field rules", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      const rule1 = registry.createFieldRule<string>(
        (b: any) => b.string.required({})
      );

      const rule2 = registry.createFieldRule<string>(
        (b: any) => b.string.email({})
      );

      // Both rules should share the same registry
      expect(rule1.getPluginRegistry()).toBe(registry);
      expect(rule2.getPluginRegistry()).toBe(registry);
    });
  });
});