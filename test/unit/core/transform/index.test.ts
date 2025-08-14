/**
 * @jest-environment node
 */

import * as transformIndex from "../../../../src/core/transform/index";
import * as stringTransforms from "../../../../src/core/transform/string";

describe("Transform Index", () => {
  describe("exports", () => {
    it("should export string transform module", () => {
      expect(transformIndex).toHaveProperty("string");
      expect(transformIndex.string).toBe(stringTransforms);
    });

    it("should export all string transform functions through string namespace", () => {
      // Check that all functions from string module are accessible
      expect(transformIndex.string).toHaveProperty("createDefaultValue");
      expect(transformIndex.string).toHaveProperty("createReplace");
      expect(transformIndex.string).toHaveProperty("createReplaceAll");
      expect(transformIndex.string).toHaveProperty("sanitize");
      
      // Verify they are functions
      expect(typeof transformIndex.string.createDefaultValue).toBe("function");
      expect(typeof transformIndex.string.createReplace).toBe("function");
      expect(typeof transformIndex.string.createReplaceAll).toBe("function");
      expect(typeof transformIndex.string.sanitize).toBe("function");
    });

    it("should re-export string transforms correctly", () => {
      // Verify that the re-exported functions work correctly
      const defaultValueTransform = transformIndex.string.createDefaultValue("default");
      expect(typeof defaultValueTransform).toBe("function");
      
      // sanitize is a direct function, not a factory
      expect(typeof transformIndex.string.sanitize).toBe("function");
    });

    it("should maintain reference equality for re-exported modules", () => {
      // The re-exported module should be the same reference as the original
      expect(transformIndex.string).toBe(stringTransforms);
    });

    it("should not add any additional properties beyond expected exports", () => {
      const exportKeys = Object.keys(transformIndex);
      expect(exportKeys).toEqual(["string"]);
    });

    it("should preserve all properties from string module", () => {
      const stringKeys = Object.keys(stringTransforms);
      const reExportedStringKeys = Object.keys(transformIndex.string);
      
      expect(reExportedStringKeys).toEqual(stringKeys);
    });
  });

  describe("module structure", () => {
    it("should provide access to string transforms via dot notation", () => {
      // Test direct access to functions
      expect(transformIndex.string.createDefaultValue).toBeDefined();
      expect(transformIndex.string.createReplace).toBeDefined();
      expect(transformIndex.string.createReplaceAll).toBeDefined();
      expect(transformIndex.string.sanitize).toBeDefined();
    });

    it("should allow destructuring of string transforms", () => {
      const { createDefaultValue, createReplace, createReplaceAll, sanitize } = transformIndex.string;
      
      expect(typeof createDefaultValue).toBe("function");
      expect(typeof createReplace).toBe("function");
      expect(typeof createReplaceAll).toBe("function");
      expect(typeof sanitize).toBe("function");
    });

    it("should support object spread for string transforms", () => {
      const spreadTransforms = { ...transformIndex.string };
      
      expect(spreadTransforms).toHaveProperty("createDefaultValue");
      expect(spreadTransforms).toHaveProperty("createReplace");
      expect(spreadTransforms).toHaveProperty("createReplaceAll");
      expect(spreadTransforms).toHaveProperty("sanitize");
      expect(typeof spreadTransforms.createDefaultValue).toBe("function");
      expect(typeof spreadTransforms.sanitize).toBe("function");
    });
  });

  describe("type information", () => {
    it("should maintain TypeScript type information for re-exports", () => {
      // This test ensures that TypeScript types are properly preserved
      // The actual type checking happens at compile time, but we can verify
      // that the functions are properly exported and accessible
      
      const stringModule = transformIndex.string;
      
      // These should not throw and should maintain proper typing
      expect(() => {
        const defaultVal = stringModule.createDefaultValue("test");
        const sanitized = stringModule.sanitize("test input");
      }).not.toThrow();
    });
  });

  describe("functional verification", () => {
    it("should properly execute createDefaultValue transform through index", () => {
      const transform = transformIndex.string.createDefaultValue("fallback");
      
      // Test the actual functionality
      expect(transform(undefined)).toBe("fallback");
      expect(transform(null)).toBe("fallback");
      expect(transform("value")).toBe("value");
    });

    it("should properly execute sanitize function through index", () => {
      // sanitize is a direct function that escapes HTML characters
      expect(transformIndex.string.sanitize("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;");
      expect(transformIndex.string.sanitize("normal text")).toBe("normal text");
      expect(transformIndex.string.sanitize("")).toBe("");
    });
  });

  describe("extensibility", () => {
    it("should be extendable for future transform types", () => {
      // The current structure should allow for easy addition of other transform types
      // like number, array, object, etc. in the future
      
      // Verify current structure supports this pattern
      expect(typeof transformIndex).toBe("object");
      expect(transformIndex.string).toBeDefined();
      
      // The structure should be flat and allow for additional exports
      const keys = Object.keys(transformIndex);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.every(key => typeof transformIndex[key as keyof typeof transformIndex] === "object")).toBe(true);
    });
  });
});