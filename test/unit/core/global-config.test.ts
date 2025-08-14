import { describe, test, expect, beforeEach } from "@jest/globals";
import { 
  globalConfig, 
  setGlobalConfig, 
  getGlobalConfig, 
  resetGlobalConfig,
  GlobalConfig 
} from "../../../src/core/global-config";

describe("GlobalConfig", () => {
  beforeEach(() => {
    // Reset to default state before each test
    resetGlobalConfig();
  });

  describe("globalConfig object", () => {
    test("should have default configuration", () => {
      expect(globalConfig.messageKeyPrefix).toBe("");
      expect(globalConfig.toBooleanTruthyValues).toEqual(["true", "1", "yes", "on"]);
      expect(globalConfig.numberFormat).toEqual({
        decimalSeparator: ".",
        thousandSeparator: ","
      });
      expect(globalConfig.dateFormat).toBe("YYYY-MM-DD");
      expect(globalConfig.trimStrings).toBe(false);
      expect(globalConfig.caseSensitive).toBe(true);
      expect(globalConfig.customTransforms).toEqual({});
    });

    test("should allow setting partial config", () => {
      globalConfig.setConfig({ messageKeyPrefix: "test." });
      
      expect(globalConfig.messageKeyPrefix).toBe("test.");
      // Other values should remain default
      expect(globalConfig.dateFormat).toBe("YYYY-MM-DD");
      expect(globalConfig.trimStrings).toBe(false);
    });

    test("should allow setting number format", () => {
      globalConfig.setConfig({ 
        numberFormat: {
          decimalSeparator: ",",
          thousandSeparator: "."
        }
      });
      
      expect(globalConfig.numberFormat).toEqual({
        decimalSeparator: ",",
        thousandSeparator: "."
      });
    });

    test("should merge number format instead of replacing", () => {
      globalConfig.setConfig({ 
        numberFormat: {
          decimalSeparator: ";"
          // thousandSeparator not specified
        }
      });
      
      expect(globalConfig.numberFormat).toEqual({
        decimalSeparator: ";",
        thousandSeparator: "," // Should keep default
      });
    });

    test("should allow setting toBooleanTruthyValues", () => {
      const newValues = ["yes", "y", "1", "true"];
      globalConfig.setConfig({ toBooleanTruthyValues: newValues });
      
      expect(globalConfig.toBooleanTruthyValues).toEqual(newValues);
    });

    test("should allow setting custom transforms", () => {
      const transforms = {
        uppercase: (value: string) => value.toUpperCase(),
        addPrefix: (value: string) => `prefix_${value}`
      };
      
      globalConfig.setConfig({ customTransforms: transforms });
      
      expect(globalConfig.customTransforms).toEqual(transforms);
    });

    test("should return copy of config via getConfig", () => {
      const config = globalConfig.getConfig();
      
      expect(config).toEqual({
        messageKeyPrefix: "",
        toBooleanTruthyValues: ["true", "1", "yes", "on"],
        numberFormat: {
          decimalSeparator: ".",
          thousandSeparator: ","
        },
        dateFormat: "YYYY-MM-DD",
        trimStrings: false,
        caseSensitive: true,
        customTransforms: {}
      });
      
      // Should be a copy, not reference
      config.messageKeyPrefix = "modified";
      expect(globalConfig.messageKeyPrefix).toBe(""); // Should not change
    });

    test("should reset to default configuration", () => {
      // Change configuration
      globalConfig.setConfig({
        messageKeyPrefix: "test.",
        trimStrings: true,
        caseSensitive: false,
        dateFormat: "DD-MM-YYYY"
      });
      
      // Verify changes
      expect(globalConfig.messageKeyPrefix).toBe("test.");
      expect(globalConfig.trimStrings).toBe(true);
      
      // Reset
      globalConfig.reset();
      
      // Verify reset to defaults
      expect(globalConfig.messageKeyPrefix).toBe("");
      expect(globalConfig.trimStrings).toBe(false);
      expect(globalConfig.caseSensitive).toBe(true);
      expect(globalConfig.dateFormat).toBe("YYYY-MM-DD");
    });
  });

  describe("getter properties", () => {
    test("messageKeyPrefix should handle falsy values", () => {
      globalConfig.setConfig({ messageKeyPrefix: undefined });
      expect(globalConfig.messageKeyPrefix).toBe("");
      
      globalConfig.setConfig({ messageKeyPrefix: null as any });
      expect(globalConfig.messageKeyPrefix).toBe("");
    });

    test("toBooleanTruthyValues should return array copy", () => {
      const values = globalConfig.toBooleanTruthyValues;
      values.push("extra");
      
      // Original should not be modified
      expect(globalConfig.toBooleanTruthyValues).toEqual(["true", "1", "yes", "on"]);
    });

    test("toBooleanTruthyValues should handle undefined", () => {
      globalConfig.setConfig({ toBooleanTruthyValues: undefined as any });
      expect(globalConfig.toBooleanTruthyValues).toEqual([]);
    });

    test("numberFormat should return copy", () => {
      const format = globalConfig.numberFormat;
      format.decimalSeparator = "modified";
      
      // Original should not be modified
      expect(globalConfig.numberFormat.decimalSeparator).toBe(".");
    });

    test("dateFormat should handle falsy values", () => {
      globalConfig.setConfig({ dateFormat: undefined });
      expect(globalConfig.dateFormat).toBe("YYYY-MM-DD");
      
      globalConfig.setConfig({ dateFormat: null as any });
      expect(globalConfig.dateFormat).toBe("YYYY-MM-DD");
    });

    test("trimStrings should handle falsy values", () => {
      globalConfig.setConfig({ trimStrings: undefined });
      expect(globalConfig.trimStrings).toBe(false);
      
      globalConfig.setConfig({ trimStrings: null as any });
      expect(globalConfig.trimStrings).toBe(false);
    });

    test("caseSensitive should default to true", () => {
      globalConfig.setConfig({ caseSensitive: undefined });
      expect(globalConfig.caseSensitive).toBe(true);
      
      globalConfig.setConfig({ caseSensitive: null as any });
      expect(globalConfig.caseSensitive).toBe(true);
      
      globalConfig.setConfig({ caseSensitive: false });
      expect(globalConfig.caseSensitive).toBe(false);
    });

    test("customTransforms should return copy", () => {
      const transforms = { test: (v: any) => v };
      globalConfig.setConfig({ customTransforms: transforms });
      
      const retrieved = globalConfig.customTransforms;
      retrieved.extra = (v: any) => v;
      
      // Original should not be modified
      expect(Object.keys(globalConfig.customTransforms)).toEqual(["test"]);
    });
  });

  describe("helper functions", () => {
    test("setGlobalConfig should work", () => {
      setGlobalConfig({ messageKeyPrefix: "helper." });
      expect(globalConfig.messageKeyPrefix).toBe("helper.");
    });

    test("getGlobalConfig should return current config", () => {
      setGlobalConfig({ trimStrings: true, dateFormat: "MM-DD-YYYY" });
      
      const config = getGlobalConfig();
      expect(config.trimStrings).toBe(true);
      expect(config.dateFormat).toBe("MM-DD-YYYY");
    });

    test("resetGlobalConfig should reset to defaults", () => {
      setGlobalConfig({ 
        messageKeyPrefix: "test.",
        trimStrings: true,
        caseSensitive: false
      });
      
      expect(globalConfig.messageKeyPrefix).toBe("test.");
      
      resetGlobalConfig();
      
      expect(globalConfig.messageKeyPrefix).toBe("");
      expect(globalConfig.trimStrings).toBe(false);
      expect(globalConfig.caseSensitive).toBe(true);
    });
  });

  describe("complex configuration scenarios", () => {
    test("should handle multiple successive configurations", () => {
      globalConfig.setConfig({ messageKeyPrefix: "step1." });
      expect(globalConfig.messageKeyPrefix).toBe("step1.");
      
      globalConfig.setConfig({ trimStrings: true });
      expect(globalConfig.messageKeyPrefix).toBe("step1."); // Should persist
      expect(globalConfig.trimStrings).toBe(true);
      
      globalConfig.setConfig({ messageKeyPrefix: "step2." });
      expect(globalConfig.messageKeyPrefix).toBe("step2.");
      expect(globalConfig.trimStrings).toBe(true); // Should persist
    });

    test("should handle complex nested config updates", () => {
      globalConfig.setConfig({
        numberFormat: { decimalSeparator: "," },
        customTransforms: { 
          trim: (v: string) => v.trim(),
          upper: (v: string) => v.toUpperCase()
        }
      });
      
      // Update just one part of numberFormat
      globalConfig.setConfig({
        numberFormat: { thousandSeparator: " " }
      });
      
      expect(globalConfig.numberFormat).toEqual({
        decimalSeparator: ",", // Should persist
        thousandSeparator: " " // Should be updated
      });
      
      // customTransforms should be completely replaced
      globalConfig.setConfig({
        customTransforms: { lower: (v: string) => v.toLowerCase() }
      });
      
      expect(globalConfig.customTransforms).toEqual({
        lower: expect.any(Function)
      });
    });
  });

  describe("edge cases", () => {
    test("should handle empty config object", () => {
      globalConfig.setConfig({});
      
      // Should maintain defaults
      expect(globalConfig.messageKeyPrefix).toBe("");
      expect(globalConfig.dateFormat).toBe("YYYY-MM-DD");
    });

    test("should handle invalid config values gracefully", () => {
      expect(() => {
        globalConfig.setConfig({
          toBooleanTruthyValues: null as any,
          numberFormat: null as any,
          customTransforms: null as any
        });
      }).not.toThrow();
      
      // Should handle gracefully
      expect(Array.isArray(globalConfig.toBooleanTruthyValues)).toBe(true);
      expect(typeof globalConfig.numberFormat).toBe("object");
      expect(typeof globalConfig.customTransforms).toBe("object");
    });

    test("should preserve object isolation after reset", () => {
      const customTransforms = { test: (v: any) => v };
      globalConfig.setConfig({ customTransforms });
      
      const beforeReset = globalConfig.customTransforms;
      resetGlobalConfig();
      const afterReset = globalConfig.customTransforms;
      
      // Should be different object instances
      expect(beforeReset).not.toBe(afterReset);
      expect(afterReset).toEqual({});
    });
  });

  describe("type safety", () => {
    test("should work with proper TypeScript types", () => {
      const config: GlobalConfig = {
        messageKeyPrefix: "typed.",
        toBooleanTruthyValues: ["1", "true"],
        numberFormat: {
          decimalSeparator: ",",
          thousandSeparator: " "
        },
        dateFormat: "DD/MM/YYYY",
        trimStrings: true,
        caseSensitive: false,
        customTransforms: {
          normalize: (value: string) => value.toLowerCase().trim()
        }
      };
      
      globalConfig.setConfig(config);
      
      expect(globalConfig.messageKeyPrefix).toBe("typed.");
      expect(globalConfig.trimStrings).toBe(true);
      expect(globalConfig.caseSensitive).toBe(false);
    });
  });
});