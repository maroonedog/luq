import { describe, test, expect } from "@jest/globals";
import { literalPlugin } from "../../../../src/core/plugin/literal";

describe("literalPlugin - direct testing", () => {
  test("should have correct plugin configuration", () => {
    expect(literalPlugin.name).toBe("literal");
    expect(literalPlugin.methodName).toBe("literal");
    expect(literalPlugin.category).toBe("standard");
    expect(literalPlugin.allowedTypes).toContain("string");
    expect(literalPlugin.allowedTypes).toContain("number");
    expect(literalPlugin.allowedTypes).toContain("boolean");
    expect(literalPlugin.allowedTypes).toContain("null");
  });

  test("should create validator implementation with expected value", () => {
    const impl = (literalPlugin as any).impl("test");
    
    expect(impl).toHaveProperty("check");
    expect(impl).toHaveProperty("code");
    expect(impl).toHaveProperty("getErrorMessage");
    expect(typeof impl.check).toBe("function");
    expect(typeof impl.getErrorMessage).toBe("function");
  });

  test("should validate string literals correctly", () => {
    const impl = (literalPlugin as any).impl("hello");
    
    expect(impl.check("hello")).toBe(true);
    expect(impl.check("Hello")).toBe(false);
    expect(impl.check("world")).toBe(false);
    expect(impl.check("")).toBe(false);
    expect(impl.check(null)).toBe(false);
    expect(impl.check(undefined)).toBe(false);
  });

  test("should validate number literals correctly", () => {
    const impl = (literalPlugin as any).impl(42);
    
    expect(impl.check(42)).toBe(true);
    expect(impl.check(43)).toBe(false);
    expect(impl.check("42")).toBe(false);
    expect(impl.check(0)).toBe(false);
    expect(impl.check(null)).toBe(false);
  });

  test("should validate boolean literals correctly", () => {
    const trueImpl = (literalPlugin as any).impl(true);
    const falseImpl = (literalPlugin as any).impl(false);
    
    expect(trueImpl.check(true)).toBe(true);
    expect(trueImpl.check(false)).toBe(false);
    expect(trueImpl.check(1)).toBe(false);
    expect(trueImpl.check("true")).toBe(false);
    
    expect(falseImpl.check(false)).toBe(true);
    expect(falseImpl.check(true)).toBe(false);
    expect(falseImpl.check(0)).toBe(false);
    expect(falseImpl.check("false")).toBe(false);
  });

  test("should validate null literal correctly", () => {
    const impl = (literalPlugin as any).impl(null);
    
    expect(impl.check(null)).toBe(true);
    expect(impl.check(undefined)).toBe(false);
    expect(impl.check("")).toBe(false);
    expect(impl.check(0)).toBe(false);
    expect(impl.check(false)).toBe(false);
  });

  test("should handle NaN literal specially", () => {
    const impl = (literalPlugin as any).impl(NaN);
    
    expect(impl.check(NaN)).toBe(true);
    expect(impl.check(0)).toBe(false);
    expect(impl.check("NaN")).toBe(false);
    expect(impl.check(undefined)).toBe(false);
    expect(impl.check(Number.NaN)).toBe(true);
  });

  test("should have correct error code", () => {
    const impl = (literalPlugin as any).impl("test");
    expect(impl.code).toBe("literal");
  });

  test("should use custom code when provided", () => {
    const impl = (literalPlugin as any).impl("test", { code: "custom_literal" });
    expect(impl.code).toBe("custom_literal");
  });

  test("should generate appropriate error messages", () => {
    const stringImpl = (literalPlugin as any).impl("expected");
    const numberImpl = (literalPlugin as any).impl(123);
    const booleanImpl = (literalPlugin as any).impl(true);
    
    const stringError = stringImpl.getErrorMessage("actual", "field");
    expect(stringError).toContain("expected");
    expect(stringError).toContain('"expected"'); // quotes for string
    
    const numberError = numberImpl.getErrorMessage(456, "field");
    expect(numberError).toContain("123");
    expect(numberError).not.toContain('"123"'); // no quotes for number
    
    const booleanError = booleanImpl.getErrorMessage(false, "field");
    expect(booleanError).toContain("true");
  });

  test("should use custom messageFactory when provided", () => {
    const customIssueFactory = jest.fn().mockReturnValue("Custom error message");
    const impl = (literalPlugin as any).impl("test", { messageFactory: customIssueFactory });
    
    const errorMessage = impl.getErrorMessage("wrong", "testField");
    
    expect(customIssueFactory).toHaveBeenCalledWith({
      path: "testField",
      value: "wrong",
      code: "literal",
      expected: "test"
    });
    expect(errorMessage).toBe("Custom error message");
  });

  test("should store parameters correctly", () => {
    const options = { code: "custom" };
    const impl = (literalPlugin as any).impl("value", options);
    
    expect(Array.isArray(impl.params)).toBe(true);
    expect(impl.params).toHaveLength(2);
    expect(impl.params[0]).toBe("value");
    expect(impl.params[1]).toBe(options);
  });

  test("should handle edge cases", () => {
    // Empty string literal
    const emptyImpl = (literalPlugin as any).impl("");
    expect(emptyImpl.check("")).toBe(true);
    expect(emptyImpl.check(" ")).toBe(false);
    
    // Zero literal
    const zeroImpl = (literalPlugin as any).impl(0);
    expect(zeroImpl.check(0)).toBe(true);
    expect(zeroImpl.check(-0)).toBe(true); // -0 === 0 in JavaScript
    expect(zeroImpl.check(false)).toBe(false);
    
    // Infinity literal
    const infImpl = (literalPlugin as any).impl(Infinity);
    expect(infImpl.check(Infinity)).toBe(true);
    expect(infImpl.check(-Infinity)).toBe(false);
    expect(infImpl.check(Number.POSITIVE_INFINITY)).toBe(true);
  });
});