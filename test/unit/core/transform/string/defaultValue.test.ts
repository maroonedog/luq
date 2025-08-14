import { createDefaultValue } from "../../../../../src/core/transform/string/defaultValue";

describe("createDefaultValue", () => {
  describe("basic functionality", () => {
    it("should return default value when input is null", () => {
      const withDefault = createDefaultValue("default");
      expect(withDefault(null)).toBe("default");
    });

    it("should return default value when input is undefined", () => {
      const withDefault = createDefaultValue("default");
      expect(withDefault(undefined)).toBe("default");
    });

    it("should return original value when input is a string", () => {
      const withDefault = createDefaultValue("default");
      expect(withDefault("actual")).toBe("actual");
    });

    it("should return empty string when it's the actual value", () => {
      const withDefault = createDefaultValue("default");
      expect(withDefault("")).toBe("");
    });

    it("should handle whitespace-only strings as valid values", () => {
      const withDefault = createDefaultValue("default");
      expect(withDefault("   ")).toBe("   ");
      expect(withDefault("\t")).toBe("\t");
      expect(withDefault("\n")).toBe("\n");
    });
  });

  describe("different default values", () => {
    it("should handle empty string as default", () => {
      const withDefault = createDefaultValue("");
      expect(withDefault(null)).toBe("");
      expect(withDefault(undefined)).toBe("");
      expect(withDefault("value")).toBe("value");
    });

    it("should handle long strings as default", () => {
      const longDefault = "a".repeat(10000);
      const withDefault = createDefaultValue(longDefault);
      expect(withDefault(null)).toBe(longDefault);
      expect(withDefault(undefined)).toBe(longDefault);
    });

    it("should handle special characters in default", () => {
      const specialDefault = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const withDefault = createDefaultValue(specialDefault);
      expect(withDefault(null)).toBe(specialDefault);
      expect(withDefault(undefined)).toBe(specialDefault);
    });

    it("should handle unicode characters in default", () => {
      const unicodeDefault = "🎉 Hello 世界 مرحبا мир";
      const withDefault = createDefaultValue(unicodeDefault);
      expect(withDefault(null)).toBe(unicodeDefault);
      expect(withDefault(undefined)).toBe(unicodeDefault);
    });

    it("should handle multiline strings as default", () => {
      const multilineDefault = `Line 1
Line 2
Line 3`;
      const withDefault = createDefaultValue(multilineDefault);
      expect(withDefault(null)).toBe(multilineDefault);
    });
  });

  describe("edge cases", () => {
    it("should handle numeric-like strings", () => {
      const withDefault = createDefaultValue("default");
      expect(withDefault("0")).toBe("0");
      expect(withDefault("123")).toBe("123");
      expect(withDefault("-456")).toBe("-456");
      expect(withDefault("3.14")).toBe("3.14");
    });

    it("should handle boolean-like strings", () => {
      const withDefault = createDefaultValue("default");
      expect(withDefault("true")).toBe("true");
      expect(withDefault("false")).toBe("false");
      expect(withDefault("TRUE")).toBe("TRUE");
      expect(withDefault("FALSE")).toBe("FALSE");
    });

    it("should handle JSON strings", () => {
      const withDefault = createDefaultValue("default");
      const jsonString = '{"key": "value"}';
      expect(withDefault(jsonString)).toBe(jsonString);
    });

    it("should handle HTML strings", () => {
      const withDefault = createDefaultValue("default");
      const htmlString = '<div class="test">content</div>';
      expect(withDefault(htmlString)).toBe(htmlString);
    });

    it("should handle strings with null bytes", () => {
      const withDefault = createDefaultValue("default");
      const nullByteString = "test\0string";
      expect(withDefault(nullByteString)).toBe(nullByteString);
    });
  });

  describe("function reusability", () => {
    it("should create reusable functions", () => {
      const withDefault = createDefaultValue("default");
      
      // Test multiple calls
      expect(withDefault(null)).toBe("default");
      expect(withDefault("value1")).toBe("value1");
      expect(withDefault(undefined)).toBe("default");
      expect(withDefault("value2")).toBe("value2");
    });

    it("should create independent functions", () => {
      const withDefault1 = createDefaultValue("default1");
      const withDefault2 = createDefaultValue("default2");
      
      expect(withDefault1(null)).toBe("default1");
      expect(withDefault2(null)).toBe("default2");
      expect(withDefault1(undefined)).toBe("default1");
      expect(withDefault2(undefined)).toBe("default2");
    });

    it("should handle concurrent usage", () => {
      const withDefault = createDefaultValue("default");
      
      const results = [null, "a", undefined, "b", null].map(withDefault);
      expect(results).toEqual(["default", "a", "default", "b", "default"]);
    });
  });

  describe("performance considerations", () => {
    it("should handle rapid repeated calls", () => {
      const withDefault = createDefaultValue("default");
      const iterations = 10000;
      
      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        withDefault(i % 2 === 0 ? null : "value");
      }
      const end = Date.now();
      
      // Should complete in reasonable time (< 100ms)
      expect(end - start).toBeLessThan(100);
    });

    it("should handle very long default values efficiently", () => {
      const longDefault = "x".repeat(1000000); // 1MB string
      const withDefault = createDefaultValue(longDefault);
      
      const start = Date.now();
      const result = withDefault(null);
      const end = Date.now();
      
      expect(result).toBe(longDefault);
      // Should return immediately without copying
      expect(end - start).toBeLessThan(10);
    });
  });
});