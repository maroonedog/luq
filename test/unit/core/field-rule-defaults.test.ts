import { describe, it, expect } from "@jest/globals";
import { createPluginRegistry } from "../../../src/core/registry/plugin-registry";
import { requiredPlugin } from "../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../src/core/plugin/numberMin";

describe("FieldRule Default Values", () => {
  const registry = createPluginRegistry()
    .use(requiredPlugin)
    .use(stringMinPlugin) 
    .use(numberMinPlugin);

  describe("createFieldRule with simple default values", () => {
    it("should support simple default value", () => {
      const nameRule = registry.createFieldRule<string>(
        (context) => context.string.required().min(3),
        "Anonymous" // Simple default value
      );

      // Test parse with undefined value
      const result1 = nameRule.parse(undefined);
      expect(result1.valid).toBe(true);
      if (result1.valid) {
        expect(result1.data()).toBe("Anonymous");
      }

      // Test parse with existing value
      const result2 = nameRule.parse("John");
      expect(result2.valid).toBe(true);
      if (result2.valid) {
        expect(result2.data()).toBe("John");
      }

      // Test validate with undefined (should apply default and validate)
      const result3 = nameRule.validate(undefined);
      expect(result3.valid).toBe(true);
      if (result3.valid) {
        expect(result3.data()).toBe("Anonymous");
      }
    });

    it("should support falsy default values", () => {
      // Use number 0 instead of boolean false for now since boolean plugin is not included
      const scoreRule = registry.createFieldRule<number>(
        (context) => context.number.required(),
        0 // Falsy default value
      );

      const result = scoreRule.parse(undefined);
      
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data()).toBe(0);
      }
    });

    it("should support number default values", () => {
      const scoreRule = registry.createFieldRule<number>(
        (context) => context.number.required().min(0),
        0 // Number default value
      );

      const result = scoreRule.parse(undefined);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data()).toBe(0);
      }
    });
  });

  describe("createFieldRule with full options", () => {
    it("should support field options object", () => {
      const nameRule = registry.createFieldRule<string>(
        (context) => context.string.required().min(3),
        {
          name: "nameField",
          description: "User name field",
          fieldOptions: {
            default: "Anonymous",
            applyDefaultToNull: false,
            description: "The user's display name"
          }
        }
      );

      expect(nameRule.name).toBe("nameField");
      expect(nameRule.description).toBe("User name field");
      expect(nameRule.fieldOptions?.default).toBe("Anonymous");
      expect(nameRule.fieldOptions?.applyDefaultToNull).toBe(false);

      // Test with undefined - should apply default
      const result1 = nameRule.parse(undefined);
      expect(result1.valid).toBe(true);
      if (result1.valid) {
        expect(result1.data()).toBe("Anonymous");
      }

      // Test with null - should NOT apply default due to applyDefaultToNull: false
      const result2 = nameRule.parse(null);
      expect(result2.valid).toBe(false); // Should fail validation because null doesn't meet required
    });

    it("should support function as default value", () => {
      const timestampRule = registry.createFieldRule<number>(
        (context) => context.number.required().min(0),
        {
          fieldOptions: {
            default: () => Date.now(),
            description: "Current timestamp"
          }
        }
      );

      const before = Date.now();
      const result = timestampRule.parse(undefined);
      const after = Date.now();

      expect(result.valid).toBe(true);
      if (result.valid) {
        const timestamp = result.data();
        expect(timestamp).toBeGreaterThanOrEqual(before);
        expect(timestamp).toBeLessThanOrEqual(after);
      }
    });
  });

  describe("createFieldRule with nested field options", () => {
    it("should support full FieldOptions object", () => {
      const productRule = registry.createFieldRule<string>(
        (context) => context.string.required().min(3),
        {
          fieldOptions: {
            default: "Default Product",
            description: "Product name",
            deprecated: "Use 'title' instead",
            metadata: { category: "product" }
          }
        }
      );

      expect(productRule.fieldOptions?.default).toBe("Default Product");
      expect(productRule.fieldOptions?.description).toBe("Product name");
      expect(productRule.fieldOptions?.deprecated).toBe("Use 'title' instead");
      expect(productRule.fieldOptions?.metadata?.category).toBe("product");

      const result = productRule.parse(undefined);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data()).toBe("Default Product");
      }
    });
  });

  describe("validation with default values", () => {
    it("should validate default values according to rules", () => {
      // Default value that fails validation
      const invalidDefaultRule = registry.createFieldRule<string>(
        (context) => context.string.required().min(5),
        "Hi" // Default is too short (less than 5 characters)
      );

      const result = invalidDefaultRule.validate(undefined);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe("stringMin");
      }
    });

    it("should pass validation when default meets requirements", () => {
      // Default value that passes validation
      const validDefaultRule = registry.createFieldRule<string>(
        (context) => context.string.required().min(5),
        "Hello World" // Default meets min length requirement
      );

      const result = validDefaultRule.validate(undefined);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data()).toBe("Hello World");
      }
    });
  });
});