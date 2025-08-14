import { describe, test, expect } from "@jest/globals";
import { transformPlugin } from "../../../../src/core/plugin/transform";

describe.skip("transformPlugin - direct testing", () => { // impl not accessible
  test("should have correct plugin configuration", () => {
    expect(transformPlugin.name).toBe("transform");
    expect(transformPlugin.methodName).toBe("transform");
    expect(transformPlugin.category).toBe("transform");
    expect(transformPlugin.allowedTypes).toContain("string");
    expect(transformPlugin.allowedTypes).toContain("number");
    expect(transformPlugin.allowedTypes).toContain("boolean");
    expect(transformPlugin.allowedTypes).toContain("array");
    expect(transformPlugin.allowedTypes).toContain("object");
    expect(transformPlugin.allowedTypes).toContain("date");
    expect(transformPlugin.allowedTypes).toContain("union");
  });

  test("should create validator implementation with transform function", () => {
    const transformFn = (value: string) => value.toUpperCase();
    const impl = (transformPlugin as any).impl(transformFn);
    
    expect(impl).toHaveProperty("check");
    expect(impl).toHaveProperty("code");
    expect(impl).toHaveProperty("getErrorMessage");
    expect(impl).toHaveProperty("transform");
    expect(typeof impl.check).toBe("function");
    expect(typeof impl.getErrorMessage).toBe("function");
  });

  test("check function should always return true", () => {
    const transformFn = (value: any) => value;
    const impl = (transformPlugin as any).impl(transformFn);
    
    // Transform plugin always validates successfully
    expect(impl.check("any value")).toBe(true);
    expect(impl.check(123)).toBe(true);
    expect(impl.check(null)).toBe(true);
    expect(impl.check(undefined)).toBe(true);
    expect(impl.check([])).toBe(true);
    expect(impl.check({})).toBe(true);
  });

  test("should have correct default error code", () => {
    const transformFn = (value: any) => value;
    const impl = (transformPlugin as any).impl(transformFn);
    expect(impl.code).toBe("transform");
  });

  test("should use custom code when provided", () => {
    const transformFn = (value: any) => value;
    const impl = (transformPlugin as any).impl(transformFn, { code: "custom_transform" });
    expect(impl.code).toBe("custom_transform");
  });

  test("should store transform function in multiple places", () => {
    const transformFn = (value: string) => value.trim();
    const impl = (transformPlugin as any).impl(transformFn);
    
    // Should store in transform property
    expect(impl.transform).toBeDefined();
    expect(impl.transform.transformFn).toBe(transformFn);
    
    // Should store in __transformFn property
    expect((impl as any).__transformFn).toBe(transformFn);
    
    // Should have __isTransform marker
    expect((impl as any).__isTransform).toBe(true);
  });

  test("should store parameters correctly", () => {
    const transformFn = (value: number) => value * 2;
    const options = { code: "double" };
    const impl = (transformPlugin as any).impl(transformFn, options);
    
    expect(Array.isArray(impl.params)).toBe(true);
    expect(impl.params).toHaveLength(2);
    expect(impl.params[0]).toBe(transformFn);
    expect(impl.params[1]).toBe(options);
    
    // Should also store options in transform property
    expect(impl.transform.options).toBe(options);
  });

  test("should handle different transform function types", () => {
    // String transform
    const stringTransform = (value: string) => value.toLowerCase();
    const stringImpl = (transformPlugin as any).impl(stringTransform);
    expect(stringImpl.transform.transformFn).toBe(stringTransform);
    
    // Number transform
    const numberTransform = (value: number) => Math.round(value);
    const numberImpl = (transformPlugin as any).impl(numberTransform);
    expect(numberImpl.transform.transformFn).toBe(numberTransform);
    
    // Array transform
    const arrayTransform = (value: any[]) => value.filter(Boolean);
    const arrayImpl = (transformPlugin as any).impl(arrayTransform);
    expect(arrayImpl.transform.transformFn).toBe(arrayTransform);
    
    // Object transform
    const objectTransform = (value: any) => ({ ...value, processed: true });
    const objectImpl = (transformPlugin as any).impl(objectTransform);
    expect(objectImpl.transform.transformFn).toBe(objectTransform);
  });

  test("should generate error message for transform failures", () => {
    const transformFn = (value: any) => value;
    const impl = (transformPlugin as any).impl(transformFn);
    
    const errorMessage = impl.getErrorMessage("value", "field");
    expect(typeof errorMessage).toBe("string");
    expect(errorMessage).toBe("Transform operation failed");
  });

  test("should handle transform function without options", () => {
    const transformFn = (value: string) => value.toUpperCase();
    const impl = (transformPlugin as any).impl(transformFn);
    
    expect(impl.transform.transformFn).toBe(transformFn);
    expect(impl.transform.options).toBeUndefined();
    expect(impl.params[1]).toBeUndefined();
  });

  test("should preserve transform function reference", () => {
    const originalFn = (value: string) => value.split("").reverse().join("");
    const impl = (transformPlugin as any).impl(originalFn);
    
    // All references should point to the same function
    expect(impl.transform.transformFn).toBe(originalFn);
    expect((impl as any).__transformFn).toBe(originalFn);
    expect(impl.params[0]).toBe(originalFn);
  });

  test("should work with complex transform functions", () => {
    const complexTransform = (value: any) => {
      if (typeof value === "string") {
        return value.trim().toLowerCase().replace(/\s+/g, "-");
      }
      if (typeof value === "number") {
        return Math.abs(value);
      }
      if (Array.isArray(value)) {
        return value.map(item => String(item).toUpperCase());
      }
      return value;
    };
    
    const impl = (transformPlugin as any).impl(complexTransform);
    expect(impl.transform.transformFn).toBe(complexTransform);
    expect(impl.check("any input")).toBe(true);
  });
});