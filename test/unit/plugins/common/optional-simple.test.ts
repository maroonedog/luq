import { describe, test, expect } from "@jest/globals";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("optionalPlugin - direct testing", () => {
  test("should have correct plugin configuration", () => {
    expect(optionalPlugin.name).toBe("optional");
    expect(optionalPlugin.methodName).toBe("optional");
    expect(optionalPlugin.category).toBe("standard");
    expect(optionalPlugin.allowedTypes).toContain("string");
    expect(optionalPlugin.allowedTypes).toContain("number");
    expect(optionalPlugin.allowedTypes).toContain("boolean");
  });

  test("should create validator implementation", () => {
    const impl = (optionalPlugin as any).impl();
    
    expect(impl).toHaveProperty("check");
    expect(impl).toHaveProperty("code");
    expect(impl).toHaveProperty("getErrorMessage");
    expect(typeof impl.check).toBe("function");
    expect(typeof impl.getErrorMessage).toBe("function");
  });

  test("check function should accept undefined values", () => {
    const impl = (optionalPlugin as any).impl();
    
    expect(impl.check(undefined)).toBe(true);
  });

  test("check function should reject null values", () => {
    const impl = (optionalPlugin as any).impl();
    
    expect(impl.check(null)).toBe(false);
  });

  test("check function should accept valid values", () => {
    const impl = (optionalPlugin as any).impl();
    
    expect(impl.check("hello")).toBe(true);
    expect(impl.check(42)).toBe(true);
    expect(impl.check(true)).toBe(true);
    expect(impl.check(false)).toBe(true);
    expect(impl.check([])).toBe(true);
    expect(impl.check({})).toBe(true);
    expect(impl.check("")).toBe(true); // empty string is valid
    expect(impl.check(0)).toBe(true); // zero is valid
  });

  test("should have correct error code", () => {
    const impl = (optionalPlugin as any).impl();
    expect(impl.code).toBe("optional");
  });

  test("should generate appropriate error messages", () => {
    const impl = (optionalPlugin as any).impl();
    
    const nullErrorMessage = impl.getErrorMessage(null, "testField");
    expect(nullErrorMessage).toContain("testField");
    expect(nullErrorMessage).toContain("cannot be null");
    expect(nullErrorMessage).toContain("use undefined");
  });

  test("should have optional flags set", () => {
    const impl = (optionalPlugin as any).impl();
    
    expect(impl.isOptional).toBe(true);
    expect(impl.skipForUndefined).toBe(true);
  });

  test("should have empty params array", () => {
    const impl = (optionalPlugin as any).impl();
    expect(Array.isArray(impl.params)).toBe(true);
    expect(impl.params).toHaveLength(0);
  });
});