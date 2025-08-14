/**
 * @jest-environment node
 */

import { AsyncPluginUtils } from "../../../../src/core/async.experimental/async-plugin-extensions";
import type { ValidationContext } from "../../../../src/core/builder/types/types";

// Mock the async-context module
jest.mock("../../../../src/core/async.experimental/async-context", () => ({
  getAsyncContext: jest.fn(),
}));

import { getAsyncContext } from "../../../../src/core/async.experimental/async-context";

describe("AsyncPluginUtils", () => {
  const mockGetAsyncContext = getAsyncContext as jest.MockedFunction<
    typeof getAsyncContext
  >;

  beforeEach(() => {
    mockGetAsyncContext.mockClear();
  });

  describe("hasAsyncContext", () => {
    it("should return true when async context exists", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue({ userId: "123" });

      const result = AsyncPluginUtils.hasAsyncContext(mockContext);

      expect(result).toBe(true);
      expect(mockGetAsyncContext).toHaveBeenCalledWith(mockContext);
    });

    it("should return false when async context is undefined", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue(undefined);

      const result = AsyncPluginUtils.hasAsyncContext(mockContext);

      expect(result).toBe(false);
      expect(mockGetAsyncContext).toHaveBeenCalledWith(mockContext);
    });

    it("should return false when async context is null", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue(null as any);

      const result = AsyncPluginUtils.hasAsyncContext(mockContext);

      expect(result).toBe(false);
      expect(mockGetAsyncContext).toHaveBeenCalledWith(mockContext);
    });
  });

  describe("has", () => {
    it("should return true when key exists in async context", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = { userId: "123", role: "admin" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const result = AsyncPluginUtils.has(mockContext, "userId");

      expect(result).toBe(true);
      expect(mockGetAsyncContext).toHaveBeenCalledWith(mockContext);
    });

    it("should return true when key exists even with falsy value", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = { isActive: false, count: 0, name: "" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      expect(AsyncPluginUtils.has(mockContext, "isActive")).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, "count")).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, "name")).toBe(true);
    });

    it("should return false when key doesn't exist in async context", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = { userId: "123" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const result = AsyncPluginUtils.has(mockContext, "role");

      expect(result).toBe(false);
    });

    it("should return false when async context is undefined", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue(undefined);

      const result = AsyncPluginUtils.has(mockContext, "userId");

      expect(result).toBe(false);
    });

    it("should return false when async context is null", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue(null as any);

      const result = AsyncPluginUtils.has(mockContext, "userId");

      expect(result).toBe(false);
    });

    it("should handle symbol keys", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const symbolKey = Symbol("test");
      const asyncData = { [symbolKey]: "value" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const result = AsyncPluginUtils.has(mockContext, symbolKey as any);

      expect(result).toBe(true);
    });

    it("should handle number keys", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = { 0: "first", 1: "second" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      expect(AsyncPluginUtils.has(mockContext, 0 as any)).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, 1 as any)).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, 2 as any)).toBe(false);
    });
  });

  describe("tryGet", () => {
    it("should return value when key exists in async context", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = { userId: "123", role: "admin" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const userId = AsyncPluginUtils.tryGet(mockContext, "userId");
      const role = AsyncPluginUtils.tryGet(mockContext, "role");

      expect(userId).toBe("123");
      expect(role).toBe("admin");
      expect(mockGetAsyncContext).toHaveBeenCalledWith(mockContext);
    });

    it("should return undefined when key doesn't exist", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = { userId: "123" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const result = AsyncPluginUtils.tryGet(mockContext, "missing" as any);

      expect(result).toBeUndefined();
    });

    it("should return undefined when async context is undefined", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue(undefined);

      const result = AsyncPluginUtils.tryGet(mockContext, "userId");

      expect(result).toBeUndefined();
    });

    it("should return falsy values correctly", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = {
        isActive: false,
        count: 0,
        name: "",
        value: null,
        undefinedValue: undefined,
      };
      mockGetAsyncContext.mockReturnValue(asyncData);

      expect(AsyncPluginUtils.tryGet(mockContext, "isActive")).toBe(false);
      expect(AsyncPluginUtils.tryGet(mockContext, "count")).toBe(0);
      expect(AsyncPluginUtils.tryGet(mockContext, "name")).toBe("");
      expect(AsyncPluginUtils.tryGet(mockContext, "value")).toBeNull();
      expect(
        AsyncPluginUtils.tryGet(mockContext, "undefinedValue")
      ).toBeUndefined();
    });

    it("should handle nested object access", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = {
        user: {
          profile: {
            name: "John",
            settings: { theme: "dark" },
          },
        },
      };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const user = AsyncPluginUtils.tryGet(mockContext, "user");
      expect(user).toBe(asyncData.user);
    });

    it("should work with typed interface", () => {
      interface UserContext {
        userId: string;
        permissions: string[];
        settings: { theme: string };
      }

      const mockContext = {} as ValidationContext<any, any>;
      const asyncData: UserContext = {
        userId: "123",
        permissions: ["read", "write"],
        settings: { theme: "dark" },
      };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const userId = AsyncPluginUtils.tryGet<UserContext>(
        mockContext,
        "userId"
      );
      const permissions = AsyncPluginUtils.tryGet<UserContext>(
        mockContext,
        "permissions"
      );
      const settings = AsyncPluginUtils.tryGet<UserContext>(
        mockContext,
        "settings"
      );

      expect(userId).toBe("123");
      expect(permissions).toEqual(["read", "write"]);
      expect(settings).toEqual({ theme: "dark" });
    });
  });

  describe("requireAsyncContext", () => {
    it("should return valid result when async context exists", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = { userId: "123", role: "admin" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const result = AsyncPluginUtils.requireAsyncContext(mockContext);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toBe(asyncData);
      }
      expect(mockGetAsyncContext).toHaveBeenCalledWith(mockContext);
    });

    it("should return invalid result when async context is undefined", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue(undefined);

      const result = AsyncPluginUtils.requireAsyncContext(mockContext);

      expect(result.valid).toBe(false);
      expect("message" in result ? result.message : "").toBe(
        "This validation requires async context"
      );
    });

    it("should return invalid result when async context is null", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue(null as any);

      const result = AsyncPluginUtils.requireAsyncContext(mockContext);

      expect(result.valid).toBe(false);
      expect("message" in result ? result.message : "").toBe(
        "This validation requires async context"
      );
    });

    it("should work with typed async context", () => {
      interface UserContext {
        userId: string;
        role: string;
      }

      const mockContext = {} as ValidationContext<any, any>;
      const asyncData: UserContext = { userId: "123", role: "admin" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const result =
        AsyncPluginUtils.requireAsyncContext<UserContext>(mockContext);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.userId).toBe("123");
        expect(result.data.role).toBe("admin");
      }
    });

    it("should handle empty object as valid async context", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = {};
      mockGetAsyncContext.mockReturnValue(asyncData);

      const result = AsyncPluginUtils.requireAsyncContext(mockContext);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({});
      }
    });

    it("should handle falsy values in valid async context", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = { isActive: false, count: 0, name: "" };
      mockGetAsyncContext.mockReturnValue(asyncData);

      const result = AsyncPluginUtils.requireAsyncContext(mockContext);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({ isActive: false, count: 0, name: "" });
      }
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete async plugin workflow", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const asyncData = {
        currentUser: { id: "123", role: "admin" },
        permissions: ["read", "write", "delete"],
        settings: { strictMode: true },
      };
      mockGetAsyncContext.mockReturnValue(asyncData);

      // Check if async context exists
      expect(AsyncPluginUtils.hasAsyncContext(mockContext)).toBe(true);

      // Check for specific keys
      expect(AsyncPluginUtils.has(mockContext, "currentUser")).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, "permissions")).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, "missing")).toBe(false);

      // Get specific values
      const user = AsyncPluginUtils.tryGet(mockContext, "currentUser");
      const permissions = AsyncPluginUtils.tryGet(mockContext, "permissions");
      expect(user).toEqual({ id: "123", role: "admin" });
      expect(permissions).toEqual(["read", "write", "delete"]);

      // Require async context
      const required = AsyncPluginUtils.requireAsyncContext(mockContext);
      expect(required.valid).toBe(true);
      if (required.valid) {
        expect(required.data).toBe(asyncData);
      }
    });

    it("should handle missing async context gracefully", () => {
      const mockContext = {} as ValidationContext<any, any>;
      mockGetAsyncContext.mockReturnValue(undefined);

      // All operations should handle missing context gracefully
      expect(AsyncPluginUtils.hasAsyncContext(mockContext)).toBe(false);
      expect(AsyncPluginUtils.has(mockContext, "anything")).toBe(false);
      expect(AsyncPluginUtils.tryGet(mockContext, "anything")).toBeUndefined();

      const required = AsyncPluginUtils.requireAsyncContext(mockContext);
      expect(required.valid).toBe(false);
      expect(typeof ("message" in required ? required.message : "")).toBe(
        "string"
      );
    });

    it("should work with different async context structures", () => {
      const mockContext = {} as ValidationContext<any, any>;

      // Test with array-like structure
      const arrayLikeData = { 0: "first", 1: "second", length: 2 };
      mockGetAsyncContext.mockReturnValue(arrayLikeData);

      expect(AsyncPluginUtils.has(mockContext, "0")).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, "length")).toBe(true);
      expect(AsyncPluginUtils.tryGet(mockContext, "0")).toBe("first");
      expect(AsyncPluginUtils.tryGet(mockContext, "length")).toBe(2);

      // Test with nested structure
      const nestedData = {
        level1: {
          level2: {
            value: "deep",
          },
        },
      };
      mockGetAsyncContext.mockReturnValue(nestedData);

      expect(AsyncPluginUtils.has(mockContext, "level1")).toBe(true);
      const level1 = AsyncPluginUtils.tryGet(mockContext, "level1");
      expect(level1).toEqual(nestedData.level1);
    });

    it("should handle prototype properties correctly", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const objWithProto = Object.create({ inheritedProp: "inherited" });
      objWithProto.ownProp = "own";
      mockGetAsyncContext.mockReturnValue(objWithProto);

      expect(AsyncPluginUtils.has(mockContext, "ownProp")).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, "inheritedProp")).toBe(true);
      expect(AsyncPluginUtils.tryGet(mockContext, "ownProp")).toBe("own");
      expect(AsyncPluginUtils.tryGet(mockContext, "inheritedProp")).toBe("inherited");
    });

    it("should handle special object types", () => {
      const mockContext = {} as ValidationContext<any, any>;
      
      // Test with Date object
      const dateData = { date: new Date("2024-01-01") };
      mockGetAsyncContext.mockReturnValue(dateData);
      expect(AsyncPluginUtils.has(mockContext, "date")).toBe(true);
      const dateValue = AsyncPluginUtils.tryGet(mockContext, "date");
      expect(dateValue).toBeInstanceOf(Date);

      // Test with RegExp object
      const regexpData = { pattern: /test/gi };
      mockGetAsyncContext.mockReturnValue(regexpData);
      expect(AsyncPluginUtils.has(mockContext, "pattern")).toBe(true);
      const regexpValue = AsyncPluginUtils.tryGet(mockContext, "pattern");
      expect(regexpValue).toBeInstanceOf(RegExp);

      // Test with Array
      const arrayData = { items: [1, 2, 3] };
      mockGetAsyncContext.mockReturnValue(arrayData);
      expect(AsyncPluginUtils.has(mockContext, "items")).toBe(true);
      const arrayValue = AsyncPluginUtils.tryGet(mockContext, "items");
      expect(Array.isArray(arrayValue)).toBe(true);
      expect(arrayValue).toEqual([1, 2, 3]);
    });

    it("should handle edge case with Object.create(null)", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const nullProtoObj = Object.create(null);
      nullProtoObj.prop = "value";
      mockGetAsyncContext.mockReturnValue(nullProtoObj);

      expect(AsyncPluginUtils.has(mockContext, "prop")).toBe(true);
      expect(AsyncPluginUtils.tryGet(mockContext, "prop")).toBe("value");
      expect(AsyncPluginUtils.has(mockContext, "toString" as any)).toBe(false);
    });

    it("should handle context with methods", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const contextWithMethods = {
        value: "test",
        getValue: function() { return this.value; },
        arrow: () => "arrow",
      };
      mockGetAsyncContext.mockReturnValue(contextWithMethods);

      expect(AsyncPluginUtils.has(mockContext, "getValue")).toBe(true);
      expect(AsyncPluginUtils.has(mockContext, "arrow")).toBe(true);
      const getValueFn = AsyncPluginUtils.tryGet(mockContext, "getValue");
      const arrowFn = AsyncPluginUtils.tryGet(mockContext, "arrow");
      expect(typeof getValueFn).toBe("function");
      expect(typeof arrowFn).toBe("function");
    });

    it("should handle getters and setters", () => {
      const mockContext = {} as ValidationContext<any, any>;
      const objWithAccessors = {
        _value: "internal",
        get value() { return this._value; },
        set value(v) { this._value = v; },
      };
      mockGetAsyncContext.mockReturnValue(objWithAccessors);

      expect(AsyncPluginUtils.has(mockContext, "value")).toBe(true);
      expect(AsyncPluginUtils.tryGet(mockContext, "value")).toBe("internal");
    });

    it("should handle frozen and sealed objects", () => {
      const mockContext = {} as ValidationContext<any, any>;
      
      // Test with frozen object
      const frozenData = Object.freeze({ prop: "frozen" });
      mockGetAsyncContext.mockReturnValue(frozenData);
      expect(AsyncPluginUtils.has(mockContext, "prop")).toBe(true);
      expect(AsyncPluginUtils.tryGet(mockContext, "prop")).toBe("frozen");

      // Test with sealed object
      const sealedData = Object.seal({ prop: "sealed" });
      mockGetAsyncContext.mockReturnValue(sealedData);
      expect(AsyncPluginUtils.has(mockContext, "prop")).toBe(true);
      expect(AsyncPluginUtils.tryGet(mockContext, "prop")).toBe("sealed");
    });

    it("should correctly type check when using generics", () => {
      interface StrictContext {
        id: number;
        name: string;
        optional?: boolean;
      }

      const mockContext = {} as ValidationContext<any, any>;
      const strictData: StrictContext = {
        id: 123,
        name: "test",
      };
      mockGetAsyncContext.mockReturnValue(strictData);

      // Type-safe access
      const id = AsyncPluginUtils.tryGet<StrictContext>(mockContext, "id");
      const name = AsyncPluginUtils.tryGet<StrictContext>(mockContext, "name");
      const optional = AsyncPluginUtils.tryGet<StrictContext>(mockContext, "optional");

      expect(id).toBe(123);
      expect(name).toBe("test");
      expect(optional).toBeUndefined();

      // Check required context
      const required = AsyncPluginUtils.requireAsyncContext<StrictContext>(mockContext);
      if (required.valid) {
        expect(required.data.id).toBe(123);
        expect(required.data.name).toBe("test");
      }
    });
  });
});
