/**
 * @jest-environment node
 */

import {
  isObject,
  isPlainObject,
  isString,
  isNumber,
  isBoolean,
  isFunction,
  isArray,
  isNullish,
  isUndefined,
  isNull,
  isError,
  hasProperty,
  isValidDate,
  isFiniteNumber,
  isInteger,
  isOneOfTypes,
} from "../../../../src/core/utils/type-guards";

describe("Type Guards", () => {
  describe("isObject", () => {
    it("should return true for plain objects", () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
      expect(isObject(new Date())).toBe(true);
      expect(isObject(new RegExp("test"))).toBe(true);
    });

    it("should return false for null", () => {
      expect(isObject(null)).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isObject("string")).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });

    it("should return false for functions", () => {
      expect(isObject(() => {})).toBe(false);
      expect(isObject(function () {})).toBe(false);
    });
  });

  describe("isPlainObject", () => {
    it("should return true for plain objects", () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
      expect(isPlainObject(Object.create(null))).toBe(true);
    });

    it("should return false for Date objects", () => {
      expect(isPlainObject(new Date())).toBe(false);
    });

    it("should return false for RegExp objects", () => {
      expect(isPlainObject(new RegExp("test"))).toBe(false);
      expect(isPlainObject(/test/)).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject([1, 2, 3])).toBe(false);
    });

    it("should return false for null and undefined", () => {
      expect(isPlainObject(null)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isPlainObject("string")).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject(true)).toBe(false);
    });

    it("should return false for custom class instances", () => {
      class Custom {}
      expect(isPlainObject(new Custom())).toBe(false);
    });

    it("should return false for functions", () => {
      expect(isPlainObject(() => {})).toBe(false);
      expect(isPlainObject(function () {})).toBe(false);
    });
  });

  describe("isString", () => {
    it("should return true for strings", () => {
      expect(isString("")).toBe(true);
      expect(isString("hello")).toBe(true);
      expect(isString(String("hello"))).toBe(true);
    });

    it("should return false for non-strings", () => {
      expect(isString(123)).toBe(false);
      expect(isString(true)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString(new String("hello"))).toBe(false); // String object
    });
  });

  describe("isNumber", () => {
    it("should return true for numbers", () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-123)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber(Infinity)).toBe(true);
      expect(isNumber(-Infinity)).toBe(true);
      expect(isNumber(NaN)).toBe(true);
    });

    it("should return false for non-numbers", () => {
      expect(isNumber("123")).toBe(false);
      expect(isNumber(true)).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isNumber({})).toBe(false);
      expect(isNumber([])).toBe(false);
      expect(isNumber(new Number(123))).toBe(false); // Number object
    });
  });

  describe("isBoolean", () => {
    it("should return true for booleans", () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
      expect(isBoolean(Boolean(1))).toBe(true);
    });

    it("should return false for non-booleans", () => {
      expect(isBoolean(1)).toBe(false);
      expect(isBoolean(0)).toBe(false);
      expect(isBoolean("true")).toBe(false);
      expect(isBoolean("false")).toBe(false);
      expect(isBoolean(null)).toBe(false);
      expect(isBoolean(undefined)).toBe(false);
      expect(isBoolean({})).toBe(false);
      expect(isBoolean([])).toBe(false);
      expect(isBoolean(new Boolean(true))).toBe(false); // Boolean object
    });
  });

  describe("isFunction", () => {
    it("should return true for functions", () => {
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(function () {})).toBe(true);
      expect(isFunction(async function () {})).toBe(true);
      expect(isFunction(function* () {})).toBe(true);
      expect(isFunction(class {})).toBe(true);
      expect(isFunction(Date)).toBe(true);
    });

    it("should return false for non-functions", () => {
      expect(isFunction("function")).toBe(false);
      expect(isFunction(123)).toBe(false);
      expect(isFunction(true)).toBe(false);
      expect(isFunction(null)).toBe(false);
      expect(isFunction(undefined)).toBe(false);
      expect(isFunction({})).toBe(false);
      expect(isFunction([])).toBe(false);
    });
  });

  describe("isArray", () => {
    it("should return true for arrays", () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(new Array(5))).toBe(true);
      expect(isArray(Array.from({ length: 3 }))).toBe(true);
    });

    it("should return false for non-arrays", () => {
      expect(isArray("array")).toBe(false);
      expect(isArray(123)).toBe(false);
      expect(isArray(true)).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isArray({})).toBe(false);
      expect(isArray({ length: 3 })).toBe(false); // Array-like object
    });
  });

  describe("isNullish", () => {
    it("should return true for null and undefined", () => {
      expect(isNullish(null)).toBe(true);
      expect(isNullish(undefined)).toBe(true);
    });

    it("should return false for defined values", () => {
      expect(isNullish(0)).toBe(false);
      expect(isNullish("")).toBe(false);
      expect(isNullish(false)).toBe(false);
      expect(isNullish({})).toBe(false);
      expect(isNullish([])).toBe(false);
      expect(isNullish(NaN)).toBe(false);
    });
  });

  describe("isUndefined", () => {
    it("should return true for undefined", () => {
      expect(isUndefined(undefined)).toBe(true);
      expect(isUndefined(void 0)).toBe(true);
    });

    it("should return false for defined values", () => {
      expect(isUndefined(null)).toBe(false);
      expect(isUndefined(0)).toBe(false);
      expect(isUndefined("")).toBe(false);
      expect(isUndefined(false)).toBe(false);
      expect(isUndefined({})).toBe(false);
      expect(isUndefined([])).toBe(false);
      expect(isUndefined(NaN)).toBe(false);
    });
  });

  describe("isNull", () => {
    it("should return true for null", () => {
      expect(isNull(null)).toBe(true);
    });

    it("should return false for non-null values", () => {
      expect(isNull(undefined)).toBe(false);
      expect(isNull(0)).toBe(false);
      expect(isNull("")).toBe(false);
      expect(isNull(false)).toBe(false);
      expect(isNull({})).toBe(false);
      expect(isNull([])).toBe(false);
      expect(isNull(NaN)).toBe(false);
    });
  });

  describe("isError", () => {
    it("should return true for Error instances", () => {
      expect(isError(new Error("test"))).toBe(true);
      expect(isError(new TypeError("test"))).toBe(true);
      expect(isError(new RangeError("test"))).toBe(true);
      expect(isError(new SyntaxError("test"))).toBe(true);
    });

    it("should return false for non-Error objects", () => {
      expect(isError({ message: "error" })).toBe(false);
      expect(isError("Error")).toBe(false);
      expect(isError(123)).toBe(false);
      expect(isError(true)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError({})).toBe(false);
      expect(isError([])).toBe(false);
    });

    it("should return true for custom Error subclasses", () => {
      class CustomError extends Error {}
      expect(isError(new CustomError("test"))).toBe(true);
    });
  });

  describe("hasProperty", () => {
    it("should return true when object has property", () => {
      const obj = { a: 1, b: "test" };
      expect(hasProperty(obj, "a")).toBe(true);
      expect(hasProperty(obj, "b")).toBe(true);
    });

    it("should return false when object doesn't have property", () => {
      const obj = { a: 1 };
      expect(hasProperty(obj, "b")).toBe(false);
      expect(hasProperty(obj, "nonExistent")).toBe(false);
    });

    it("should work with symbol keys", () => {
      const sym = Symbol("test");
      const obj = { [sym]: "value" };
      expect(hasProperty(obj, sym)).toBe(true);
    });

    it("should work with number keys", () => {
      const obj = { 0: "zero", 1: "one" };
      expect(hasProperty(obj, 0)).toBe(true);
      expect(hasProperty(obj, 1)).toBe(true);
      expect(hasProperty(obj, 2)).toBe(false);
    });

    it("should work with arrays", () => {
      const arr = ["a", "b", "c"];
      expect(hasProperty(arr, 0)).toBe(true);
      expect(hasProperty(arr, "length")).toBe(true);
      expect(hasProperty(arr, 5)).toBe(false);
    });

    it("should return true for inherited properties", () => {
      const obj = { a: 1 };
      expect(hasProperty(obj, "toString")).toBe(true); // inherited property
      expect(hasProperty(obj, "hasOwnProperty")).toBe(true); // inherited property
    });
  });

  describe("isValidDate", () => {
    it("should return true for valid dates", () => {
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate(new Date("2023-01-01"))).toBe(true);
      expect(isValidDate(new Date(2023, 0, 1))).toBe(true);
      expect(isValidDate(new Date(0))).toBe(true); // Unix epoch
    });

    it("should return false for invalid dates", () => {
      expect(isValidDate(new Date("invalid"))).toBe(false);
      expect(isValidDate(new Date(NaN))).toBe(false);
    });

    it("should return false for non-Date objects", () => {
      expect(isValidDate("2023-01-01")).toBe(false);
      expect(isValidDate(123456789)).toBe(false);
      expect(isValidDate({})).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
    });
  });

  describe("isFiniteNumber", () => {
    it("should return true for finite numbers", () => {
      expect(isFiniteNumber(0)).toBe(true);
      expect(isFiniteNumber(123)).toBe(true);
      expect(isFiniteNumber(-123)).toBe(true);
      expect(isFiniteNumber(3.14)).toBe(true);
      expect(isFiniteNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(isFiniteNumber(Number.MIN_SAFE_INTEGER)).toBe(true);
    });

    it("should return false for infinite numbers", () => {
      expect(isFiniteNumber(Infinity)).toBe(false);
      expect(isFiniteNumber(-Infinity)).toBe(false);
    });

    it("should return false for NaN", () => {
      expect(isFiniteNumber(NaN)).toBe(false);
    });

    it("should return false for non-numbers", () => {
      expect(isFiniteNumber("123")).toBe(false);
      expect(isFiniteNumber(true)).toBe(false);
      expect(isFiniteNumber(null)).toBe(false);
      expect(isFiniteNumber(undefined)).toBe(false);
      expect(isFiniteNumber({})).toBe(false);
      expect(isFiniteNumber([])).toBe(false);
    });
  });

  describe("isInteger", () => {
    it("should return true for integers", () => {
      expect(isInteger(0)).toBe(true);
      expect(isInteger(123)).toBe(true);
      expect(isInteger(-123)).toBe(true);
      expect(isInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(isInteger(Number.MIN_SAFE_INTEGER)).toBe(true);
    });

    it("should return false for floating point numbers", () => {
      expect(isInteger(3.14)).toBe(false);
      expect(isInteger(0.1)).toBe(false);
      expect(isInteger(-0.5)).toBe(false);
    });

    it("should return false for infinite numbers", () => {
      expect(isInteger(Infinity)).toBe(false);
      expect(isInteger(-Infinity)).toBe(false);
    });

    it("should return false for NaN", () => {
      expect(isInteger(NaN)).toBe(false);
    });

    it("should return false for non-numbers", () => {
      expect(isInteger("123")).toBe(false);
      expect(isInteger(true)).toBe(false);
      expect(isInteger(null)).toBe(false);
      expect(isInteger(undefined)).toBe(false);
      expect(isInteger({})).toBe(false);
      expect(isInteger([])).toBe(false);
    });
  });

  describe("isOneOfTypes", () => {
    it("should return true when value matches one of the guards", () => {
      const guards = [isString, isNumber, isBoolean];
      expect(isOneOfTypes("hello", guards)).toBe(true);
      expect(isOneOfTypes(123, guards)).toBe(true);
      expect(isOneOfTypes(true, guards)).toBe(true);
    });

    it("should return false when value doesn't match any guard", () => {
      const guards = [isString, isNumber];
      expect(isOneOfTypes(true, guards)).toBe(false);
      expect(isOneOfTypes(null, guards)).toBe(false);
      expect(isOneOfTypes({}, guards)).toBe(false);
      expect(isOneOfTypes([], guards)).toBe(false);
    });

    it("should work with empty guards array", () => {
      expect(isOneOfTypes("hello", [])).toBe(false);
      expect(isOneOfTypes(123, [])).toBe(false);
    });

    it("should work with single guard", () => {
      expect(isOneOfTypes("hello", [isString])).toBe(true);
      expect(isOneOfTypes(123, [isString])).toBe(false);
    });

    it("should work with custom guards", () => {
      const isEven = (value: unknown): value is number => 
        isNumber(value) && value % 2 === 0;
      const isOdd = (value: unknown): value is number => 
        isNumber(value) && value % 2 === 1;
      
      expect(isOneOfTypes(4, [isEven, isOdd])).toBe(true);
      expect(isOneOfTypes(3, [isEven, isOdd])).toBe(true);
      expect(isOneOfTypes(3.5, [isEven, isOdd])).toBe(false);
      expect(isOneOfTypes("4", [isEven, isOdd])).toBe(false);
    });
  });
});