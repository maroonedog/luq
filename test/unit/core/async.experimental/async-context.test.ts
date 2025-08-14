/**
 * @jest-environment node
 */

import {
  AsyncContextBuilder,
  createAsyncContext,
  addAsyncSupport,
  getAsyncContext,
  getAsyncContextValue,
  hasAsyncContextKey,
} from "../../../../src/core/async.experimental/async-context";
import { Result } from "../../../../src/types/result";

describe("Async Context", () => {
  describe("AsyncContextBuilder", () => {
    it("should create empty builder", () => {
      const builder = new AsyncContextBuilder();
      expect(builder).toBeInstanceOf(AsyncContextBuilder);
    });

    it("should add single async data", async () => {
      const builder = new AsyncContextBuilder<{ user: string }>();
      const userPromise = Promise.resolve("John");
      
      const typedBuilder = builder.set("user", userPromise);
      const context = await typedBuilder.build();
      
      expect(context.data.user).toBe("John");
      expect(context.isReady).toBe(true);
      expect(context.hasErrors).toBe(false);
      expect(context.errors).toEqual([]);
    });

    it("should add multiple async data", async () => {
      const builder = createAsyncContext<{
        user: string;
        permissions: string[];
      }>();
      
      const context = await builder
        .set("user", Promise.resolve("John"))
        .set("permissions", Promise.resolve(["read", "write"]))
        .build();
      
      expect(context.data.user).toBe("John");
      expect(context.data.permissions).toEqual(["read", "write"]);
      expect(context.isReady).toBe(true);
      expect(context.hasErrors).toBe(false);
    });

    it("should handle promise rejection", async () => {
      const builder = createAsyncContext<{ user: string }>();
      const rejectedPromise = Promise.reject(new Error("User not found"));
      
      const context = await builder
        .set("user", rejectedPromise)
        .build();
      
      expect(context.isReady).toBe(false);
      expect(context.hasErrors).toBe(true);
      expect(context.errors).toHaveLength(1);
      expect(context.errors[0].key).toBe("user");
      expect(context.errors[0].error.message).toBe("User not found");
    });

    it("should handle timeout", async () => {
      const builder = createAsyncContext<{ user: string }>();
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("John"), 1000);
      });
      
      const context = await builder
        .set("user", slowPromise)
        .withOptions({ timeout: 100 })
        .build();
      
      expect(context.hasErrors).toBe(true);
      expect(context.errors[0].key).toBe("user");
      expect(context.errors[0].error.message).toContain("Timeout");
    });

    it("should use default values on error", async () => {
      const builder = createAsyncContext<{ user: string; age: number }>();
      
      const context = await builder
        .set("user", Promise.reject(new Error("Failed")))
        .set("age", Promise.resolve(30))
        .withOptions({
          defaultValues: { user: "DefaultUser" },
          continueOnError: true,
        })
        .build();
      
      expect(context.data.user).toBe("DefaultUser");
      expect(context.data.age).toBe(30);
      expect(context.isReady).toBe(true);
      expect(context.hasErrors).toBe(true);
    });

    it("should stop on error when continueOnError is false", async () => {
      const builder = createAsyncContext<{ user: string }>();
      
      const context = await builder
        .set("user", Promise.reject(new Error("Failed")))
        .withOptions({ continueOnError: false })
        .build();
      
      expect(context.isReady).toBe(false);
      expect(context.hasErrors).toBe(true);
    });

    it("should handle parallel promise execution", async () => {
      const builder = createAsyncContext<{
        data1: string;
        data2: string;
        data3: string;
      }>();
      
      let resolveOrder: number[] = [];
      
      const promise1 = new Promise<string>((resolve) => {
        setTimeout(() => {
          resolveOrder.push(1);
          resolve("data1");
        }, 50);
      });
      
      const promise2 = new Promise<string>((resolve) => {
        setTimeout(() => {
          resolveOrder.push(2);
          resolve("data2");
        }, 20);
      });
      
      const promise3 = new Promise<string>((resolve) => {
        setTimeout(() => {
          resolveOrder.push(3);
          resolve("data3");
        }, 30);
      });
      
      const context = await builder
        .set("data1", promise1)
        .set("data2", promise2)
        .set("data3", promise3)
        .build();
      
      expect(context.data.data1).toBe("data1");
      expect(context.data.data2).toBe("data2");
      expect(context.data.data3).toBe("data3");
      expect(resolveOrder).toEqual([2, 3, 1]); // Should resolve in order of completion
    });

    it("should handle empty promises", async () => {
      const builder = createAsyncContext<{}>();
      const context = await builder.build();
      
      expect(context.data).toEqual({});
      expect(context.isReady).toBe(true);
      expect(context.hasErrors).toBe(false);
      expect(context.errors).toEqual([]);
    });
  });

  describe("createAsyncContext", () => {
    it("should create AsyncContextBuilder instance", () => {
      const builder = createAsyncContext<{ test: string }>();
      expect(builder).toBeInstanceOf(AsyncContextBuilder);
    });

    it("should support method chaining", async () => {
      const context = await createAsyncContext<{
        a: string;
        b: number;
      }>()
        .set("a", Promise.resolve("test"))
        .set("b", Promise.resolve(42))
        .build();
      
      expect(context.data.a).toBe("test");
      expect(context.data.b).toBe(42);
    });
  });

  describe("addAsyncSupport", () => {
    const mockValidator = {
      validate: jest.fn((value: any, options?: any) => 
        Result.ok({ name: value?.name || "default" })
      ),
    };

    beforeEach(() => {
      mockValidator.validate.mockClear();
    });

    it("should add async support to existing validator", () => {
      const asyncValidator = addAsyncSupport(mockValidator);
      
      expect(asyncValidator).toHaveProperty("validate");
      expect(asyncValidator).toHaveProperty("withAsyncContext");
      expect(typeof asyncValidator.withAsyncContext).toBe("function");
    });

    it("should preserve original validate method", () => {
      const asyncValidator = addAsyncSupport(mockValidator);
      const result = asyncValidator.validate({ name: "test" });
      
      expect(mockValidator.validate).toHaveBeenCalledWith({ name: "test" });
      expect(result.isValid()).toBe(true);
      expect(result.unwrap()).toEqual({ name: "test" });
    });

    it("should validate with async context", async () => {
      const asyncValidator = addAsyncSupport(mockValidator);
      const asyncContext = {
        data: { userId: "123" },
        isReady: true,
        hasErrors: false,
        errors: [],
      };
      
      const contextAwareValidator = asyncValidator.withAsyncContext(asyncContext);
      const result = await contextAwareValidator.validate({ name: "John" });
      
      expect(mockValidator.validate).toHaveBeenCalledWith(
        { name: "John" },
        expect.objectContaining({
          context: { userId: "123" },
          asyncContextMeta: {
            hasErrors: false,
            errors: [],
          },
        })
      );
      expect(result.isValid()).toBe(true);
    });

    it("should return error when async context is not ready", async () => {
      const asyncValidator = addAsyncSupport(mockValidator);
      const asyncContext = {
        data: {},
        isReady: false,
        hasErrors: true,
        errors: [{ key: "user", error: new Error("Failed to load user") }],
      };
      
      const contextAwareValidator = asyncValidator.withAsyncContext(asyncContext);
      const result = await contextAwareValidator.validate({ name: "John" });
      
      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe("user");
      expect(errors[0].code).toBe("ASYNC_CONTEXT_ERROR");
      expect(errors[0].message).toContain("Async context error");
    });

    it("should provide type information accessor", () => {
      const asyncValidator = addAsyncSupport(mockValidator);
      const asyncContext = {
        data: { userId: "123" },
        isReady: true,
        hasErrors: false,
        errors: [],
      };
      
      const contextAwareValidator = asyncValidator.withAsyncContext(asyncContext);
      const contextType = contextAwareValidator.getContextType();
      
      // Should not throw and return the type structure (empty object for type checking)
      expect(contextType).toEqual({});
    });

    it("should handle multiple async context errors", async () => {
      const asyncValidator = addAsyncSupport(mockValidator);
      const asyncContext = {
        data: {},
        isReady: false,
        hasErrors: true,
        errors: [
          { key: "user", error: new Error("User load failed") },
          { key: "permissions", error: "Permission denied" },
        ],
      };
      
      const contextAwareValidator = asyncValidator.withAsyncContext(asyncContext);
      const result = await contextAwareValidator.validate({ name: "John" });
      
      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors).toHaveLength(2);
      expect(errors[0].path).toBe("user");
      expect(errors[1].path).toBe("permissions");
    });
  });

  describe("getAsyncContext", () => {
    it("should return async context from options", () => {
      const asyncData = { userId: "123", role: "admin" };
      const options = { context: asyncData };
      
      const result = getAsyncContext(options);
      expect(result).toBe(asyncData);
    });

    it("should return undefined when no async context", () => {
      const options = {};
      const result = getAsyncContext(options);
      expect(result).toBeUndefined();
    });

    it("should return undefined when options is undefined", () => {
      const result = getAsyncContext(undefined);
      expect(result).toBeUndefined();
    });

    it("should handle typed async context", () => {
      interface UserContext {
        userId: string;
        permissions: string[];
      }
      
      const asyncData: UserContext = {
        userId: "123",
        permissions: ["read", "write"],
      };
      const options = { context: asyncData };
      
      const result = getAsyncContext<UserContext>(options);
      expect(result?.userId).toBe("123");
      expect(result?.permissions).toEqual(["read", "write"]);
    });
  });

  describe("getContextValue", () => {
    it("should return specific value from async context", () => {
      const asyncData = { userId: "123", role: "admin" };
      const options = { context: asyncData };
      
      const userId = getAsyncContextValue(options, "userId");
      const role = getAsyncContextValue(options, "role");
      
      expect(userId).toBe("123");
      expect(role).toBe("admin");
    });

    it("should return undefined for missing key", () => {
      const asyncData = { userId: "123" };
      const options = { context: asyncData };
      
      const missing = getAsyncContextValue(options, "missing" as any);
      expect(missing).toBeUndefined();
    });

    it("should return undefined when no async context", () => {
      const options = {};
      const result = getAsyncContextValue(options, "userId");
      expect(result).toBeUndefined();
    });

    it("should handle undefined options", () => {
      const result = getAsyncContextValue(undefined, "userId");
      expect(result).toBeUndefined();
    });
  });

  describe("hasContextKey", () => {
    it("should return true when key exists in async context", () => {
      const asyncData = { userId: "123", role: "admin" };
      const options = { context: asyncData };
      
      expect(hasAsyncContextKey(options, "userId")).toBe(true);
      expect(hasAsyncContextKey(options, "role")).toBe(true);
    });

    it("should return false when key doesn't exist", () => {
      const asyncData = { userId: "123" };
      const options = { context: asyncData };
      
      expect(hasAsyncContextKey(options, "missing" as any)).toBe(false);
    });

    it("should return false when no async context", () => {
      const options = {};
      expect(hasAsyncContextKey(options, "userId")).toBe(false);
    });

    it("should return false when options is undefined", () => {
      expect(hasAsyncContextKey(undefined, "userId")).toBe(false);
    });

    it("should work as type guard", () => {
      const asyncData = { userId: "123" };
      const options = { context: asyncData };
      
      if (hasAsyncContextKey(options, "userId")) {
        // TypeScript should narrow the type here
        expect(options.context.userId).toBe("123");
      }
    });
  });

  describe("edge cases and additional scenarios", () => {
    it("should handle Promise.race behavior with multiple errors", async () => {
      const builder = createAsyncContext<{ data1: string; data2: string }>();
      
      const context = await builder
        .set("data1", Promise.reject(new Error("Error 1")))
        .set("data2", Promise.reject(new Error("Error 2")))
        .withOptions({ continueOnError: true })
        .build();
      
      expect(context.hasErrors).toBe(true);
      expect(context.errors).toHaveLength(2);
      expect(context.isReady).toBe(true);
    });

    it("should handle deeply nested default values", async () => {
      const builder = createAsyncContext<{ 
        nested: { deep: { value: string } } 
      }>();
      
      const context = await builder
        .set("nested", Promise.reject(new Error("Failed")))
        .withOptions({
          defaultValues: { 
            nested: { deep: { value: "default" } } 
          },
          continueOnError: true,
        })
        .build();
      
      expect((context.data as any).nested?.deep?.value).toBe("default");
    });

    it("should handle Promise with undefined resolution", async () => {
      const builder = createAsyncContext<{ data?: string }>();
      
      const context = await builder
        .set("data", Promise.resolve(undefined))
        .build();
      
      expect(context.data.data).toBeUndefined();
      expect(context.isReady).toBe(true);
      expect(context.hasErrors).toBe(false);
    });

    it("should handle Promise with null resolution", async () => {
      const builder = createAsyncContext<{ data: string | null }>();
      
      const context = await builder
        .set("data", Promise.resolve(null))
        .build();
      
      expect(context.data.data).toBeNull();
      expect(context.isReady).toBe(true);
    });

    it("should handle immediate timeout (0ms)", async () => {
      const builder = createAsyncContext<{ data: string }>();
      
      const context = await builder
        .set("data", new Promise(resolve => setTimeout(() => resolve("test"), 10)))
        .withOptions({ timeout: 0 })
        .build();
      
      expect(context.hasErrors).toBe(true);
      expect(context.errors[0].error.message).toContain("Timeout");
    });

    it("should preserve error stack traces", async () => {
      const errorWithStack = new Error("Test error");
      errorWithStack.stack = "Error: Test error\n    at test.js:10:5";
      
      const builder = createAsyncContext<{ data: string }>();
      const context = await builder
        .set("data", Promise.reject(errorWithStack))
        .build();
      
      expect(context.errors[0].error).toBe(errorWithStack);
      expect(context.errors[0].error.stack).toBeDefined();
    });

    it("should handle string rejection reasons", async () => {
      const builder = createAsyncContext<{ data: string }>();
      
      const context = await builder
        .set("data", Promise.reject("String error message"))
        .build();
      
      expect(context.hasErrors).toBe(true);
      expect(context.errors[0].error).toBe("String error message");
    });

    it("should handle numeric rejection reasons", async () => {
      const builder = createAsyncContext<{ data: string }>();
      
      const context = await builder
        .set("data", Promise.reject(404))
        .build();
      
      expect(context.hasErrors).toBe(true);
      expect(context.errors[0].error).toBe(404);
    });

    it("should handle object rejection reasons", async () => {
      const errorObj = { code: "ERR_001", message: "Custom error" };
      const builder = createAsyncContext<{ data: string }>();
      
      const context = await builder
        .set("data", Promise.reject(errorObj))
        .build();
      
      expect(context.hasErrors).toBe(true);
      expect(context.errors[0].error).toEqual(errorObj);
    });

    it("should handle very large number of promises", async () => {
      const builder = createAsyncContext<Record<string, number>>();
      
      // Add 100 promises
      for (let i = 0; i < 100; i++) {
        builder.set(`data${i}`, Promise.resolve(i));
      }
      
      const context = await builder.build();
      
      expect(context.isReady).toBe(true);
      expect(context.hasErrors).toBe(false);
      expect(Object.keys(context.data)).toHaveLength(100);
      expect(context.data.data0).toBe(0);
      expect(context.data.data99).toBe(99);
    });

    it("should handle mixed timeout scenarios", async () => {
      const builder = createAsyncContext<{ fast: string; slow: string }>();
      
      const context = await builder
        .set("fast", Promise.resolve("quick"))
        .set("slow", new Promise(resolve => setTimeout(() => resolve("delayed"), 100)))
        .withOptions({ 
          timeout: 50,
          continueOnError: false 
        })
        .build();
      
      expect(context.data.fast).toBe("quick");
      expect(context.data.slow).toBeUndefined();
      expect(context.hasErrors).toBe(true);
      expect(context.isReady).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete async validation workflow", async () => {
      // Create async context
      const asyncContext = await createAsyncContext<{
        currentUser: { id: string; role: string };
        settings: { feature: boolean };
      }>()
        .set("currentUser", Promise.resolve({ id: "123", role: "admin" }))
        .set("settings", Promise.resolve({ feature: true }))
        .build();
      
      // Create validator with async support
      const validator = addAsyncSupport({
        validate: (value: any, options?: any) => {
          const context = getAsyncContext(options);
          if (context?.currentUser?.role === "admin") {
            return Result.ok(value);
          }
          return Result.error([{
            path: "permission",
            paths: () => ["permission"],
            message: "Access denied",
            code: "ACCESS_DENIED",
          }]);
        },
      });
      
      // Validate with async context
      const result = await validator
        .withAsyncContext(asyncContext)
        .validate({ action: "delete" });
      
      expect(result.isValid()).toBe(true);
      expect(result.unwrap()).toEqual({ action: "delete" });
    });

    it("should handle mixed success and error in async context", async () => {
      const asyncContext = await createAsyncContext<{
        user: string;
        permissions: string[];
      }>()
        .set("user", Promise.resolve("John"))
        .set("permissions", Promise.reject(new Error("Permission service down")))
        .withOptions({
          defaultValues: { permissions: [] },
          continueOnError: true,
        })
        .build();
      
      expect(asyncContext.data.user).toBe("John");
      expect(asyncContext.data.permissions).toEqual([]);
      expect(asyncContext.isReady).toBe(true);
      expect(asyncContext.hasErrors).toBe(true);
      expect(asyncContext.errors).toHaveLength(1);
    });

    it("should handle timeout with partial success", async () => {
      const fastPromise = Promise.resolve("fast");
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("slow"), 200);
      });
      
      const asyncContext = await createAsyncContext<{
        fast: string;
        slow: string;
      }>()
        .set("fast", fastPromise)
        .set("slow", slowPromise)
        .withOptions({
          timeout: 100,
          defaultValues: { slow: "default" },
          continueOnError: true,
        })
        .build();
      
      expect(asyncContext.data.fast).toBe("fast");
      expect(asyncContext.data.slow).toBe("default");
      expect(asyncContext.hasErrors).toBe(true);
    });

    it("should handle AsyncValidationOptions interface", async () => {
      const mockValidator = {
        validate: jest.fn((value: any, options?: any) => {
          // Access asyncContext through the extended interface
          const asyncCtx = options?.asyncContext;
          if (asyncCtx?.validationMode === "strict") {
            return Result.error([{
              path: "validation",
              paths: () => ["validation"],
              message: "Strict mode validation failed",
              code: "STRICT_MODE",
            }]);
          }
          return Result.ok(value);
        }),
      };

      const asyncValidator = addAsyncSupport(mockValidator);
      const asyncContext = {
        data: { validationMode: "strict" },
        isReady: true,
        hasErrors: false,
        errors: [],
      };
      
      const result = await asyncValidator
        .withAsyncContext(asyncContext)
        .validate({ test: "data" });
      
      expect(result.isError()).toBe(true);
      expect(result.errors[0].code).toBe("STRICT_MODE");
    });

    it("should handle getContextType method", () => {
      const validator = addAsyncSupport({
        validate: (value: any) => Result.ok(value),
      });
      
      const asyncContext = {
        data: { userId: "123", role: "admin" },
        isReady: true,
        hasErrors: false,
        errors: [],
      };
      
      const contextAware = validator.withAsyncContext(asyncContext);
      const contextType = contextAware.getContextType();
      
      // Type checking - should return empty object but typed correctly
      expect(contextType).toEqual({});
      expect(typeof contextType).toBe("object");
    });

    it("should handle async context with circular references", async () => {
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;
      
      const builder = createAsyncContext<{ data: any }>();
      const context = await builder
        .set("data", Promise.resolve(circularObj))
        .build();
      
      expect(context.data.data.name).toBe("test");
      expect(context.data.data.self).toBe(context.data.data);
      expect(context.isReady).toBe(true);
    });

    it("should handle async context in extended validation options", async () => {
      const validator = {
        validate: (value: any, options?: any) => {
          // Check asyncContextMeta is properly passed
          if (options?.asyncContextMeta?.hasErrors) {
            return Result.error([{
              path: "meta",
              paths: () => ["meta"],
              message: `Context has ${options.asyncContextMeta.errors.length} errors`,
              code: "CONTEXT_ERRORS",
            }]);
          }
          return Result.ok(value);
        },
      };

      const asyncValidator = addAsyncSupport(validator);
      const asyncContext = {
        data: {},
        isReady: true,
        hasErrors: true,
        errors: [
          { key: "test1", error: "Error 1" },
          { key: "test2", error: "Error 2" },
        ],
      };
      
      const result = await asyncValidator
        .withAsyncContext(asyncContext)
        .validate({ value: "test" });
      
      expect(result.isError()).toBe(true);
      expect(result.errors[0].message).toBe("Context has 2 errors");
    });
  });
});