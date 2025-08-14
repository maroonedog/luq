import { describe, test, expect } from "@jest/globals";
import { skipPlugin } from "../../../../src/core/plugin/skip";

describe("skipPlugin - direct testing", () => {
  test("should have correct plugin configuration", () => {
    expect(skipPlugin.name).toBe("skip");
    expect(skipPlugin.methodName).toBe("skip");
    expect(skipPlugin.category).toBe("conditional");
    expect(skipPlugin.allowedTypes).toContain("string");
    expect(skipPlugin.allowedTypes).toContain("number");
    expect(skipPlugin.allowedTypes).toContain("boolean");
    expect(skipPlugin.allowedTypes).toContain("array");
    expect(skipPlugin.allowedTypes).toContain("object");
  });

  test("should create validator implementation with condition", () => {
    const condition = (values: any) => values.skip === true;
    const impl = (skipPlugin as any).impl(condition);
    
    expect(impl).toHaveProperty("check");
    expect(impl).toHaveProperty("shouldSkipAllValidation");
    expect(impl).toHaveProperty("code");
    expect(impl).toHaveProperty("getErrorMessage");
    expect(typeof impl.check).toBe("function");
    expect(typeof impl.shouldSkipAllValidation).toBe("function");
  });

  test("check function should always return true", () => {
    const condition = (values: any) => false;
    const impl = (skipPlugin as any).impl(condition);
    
    // Skip plugin always returns true when check is called
    expect(impl.check("any value")).toBe(true);
    expect(impl.check(null)).toBe(true);
    expect(impl.check(undefined)).toBe(true);
    expect(impl.check(123)).toBe(true);
  });

  test("shouldSkipAllValidation should respect condition", () => {
    const condition = (values: any) => values.skipField === true;
    const impl = (skipPlugin as any).impl(condition);
    
    // Should skip when condition is true
    expect(impl.shouldSkipAllValidation("value", { skipField: true })).toBe(true);
    
    // Should not skip when condition is false
    expect(impl.shouldSkipAllValidation("value", { skipField: false })).toBe(false);
  });

  test("shouldSkipAllValidation should return false when no allValues provided", () => {
    const condition = (values: any) => true;
    const impl = (skipPlugin as any).impl(condition);
    
    // Should not skip when no context provided
    expect(impl.shouldSkipAllValidation("value")).toBe(false);
    expect(impl.shouldSkipAllValidation("value", undefined)).toBe(false);
  });

  test("should handle complex conditions", () => {
    const condition = (values: any) => values.mode === 'production' && !values.debug;
    const impl = (skipPlugin as any).impl(condition);
    
    // Should skip in production without debug
    expect(impl.shouldSkipAllValidation("value", { mode: 'production', debug: false })).toBe(true);
    
    // Should not skip in development
    expect(impl.shouldSkipAllValidation("value", { mode: 'development', debug: false })).toBe(false);
    
    // Should not skip in production with debug
    expect(impl.shouldSkipAllValidation("value", { mode: 'production', debug: true })).toBe(false);
  });

  test("should have correct error code", () => {
    const condition = (values: any) => false;
    const impl = (skipPlugin as any).impl(condition);
    expect(impl.code).toBe("skip");
  });

  test("should store condition and options in params", () => {
    const condition = (values: any) => values.test;
    const options = { abortEarly: true };
    const impl = (skipPlugin as any).impl(condition, options);
    
    expect(Array.isArray(impl.params)).toBe(true);
    expect(impl.params).toHaveLength(2);
    expect(impl.params[0]).toBe(condition);
    expect(impl.params[1]).toBe(options);
  });

  test("should have metadata with correct properties", () => {
    const condition = (values: any) => values.test;
    const impl = (skipPlugin as any).impl(condition);
    
    expect(impl.metadata).toBeDefined();
    expect(impl.metadata.type).toBe("conditional");
    expect(impl.metadata.category).toBe("skip");
    expect(impl.metadata.skipCondition).toBe(condition);
    expect(impl.metadata.async).toBe(false);
  });

  test("should generate error message", () => {
    const condition = (values: any) => false;
    const impl = (skipPlugin as any).impl(condition);
    
    const errorMessage = impl.getErrorMessage();
    expect(typeof errorMessage).toBe("string");
    expect(errorMessage.length).toBeGreaterThan(0);
  });
});