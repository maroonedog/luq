/**
 * @jest-environment node
 */

import {
  enhanceValidatorWithAsync,
  extendFieldBuilderWithAsync,
  createOptimizedAsyncValidator,
  createAsyncValidator,
  AsyncValidationHelpers,
  AsyncDebugUtils,
} from "../../../../src/core/async.experimental/async-validator-integration";
import { Result } from "../../../../src/types/result";
import type { AsyncContext } from "../../../../src/core/builder/types/types";

// Mock the async-context module
jest.mock("../../../../src/core/async.experimental/async-context", () => ({
  createAsyncContext: jest.fn(),
  addAsyncSupport: jest.fn(),
}));

import { createAsyncContext, addAsyncSupport } from "../../../../src/core/async.experimental/async-context";

describe("Async Validator Integration", () => {
  const mockCreateAsyncContext = createAsyncContext as jest.MockedFunction<typeof createAsyncContext>;
  const mockAddAsyncSupport = addAsyncSupport as jest.MockedFunction<typeof addAsyncSupport>;

  beforeEach(() => {
    mockCreateAsyncContext.mockClear();
    mockAddAsyncSupport.mockClear();
  });

  describe("enhanceValidatorWithAsync", () => {
    it("should enhance validator with async functionality", () => {
      const mockValidator = {
        validate: jest.fn(() => Result.ok({ name: "test" })),
        transform: jest.fn(),
        parse: jest.fn(),
        pick: jest.fn(),
      };

      const mockAsyncValidator = {
        validate: mockValidator.validate,
        withAsyncContext: jest.fn(),
      };

      mockAddAsyncSupport.mockReturnValue(mockAsyncValidator);

      const enhanced = enhanceValidatorWithAsync(mockValidator);

      expect(enhanced).toHaveProperty("validate");
      expect(enhanced).toHaveProperty("withAsyncContext");
      expect(enhanced).toHaveProperty("transform");
      expect(mockAddAsyncSupport).toHaveBeenCalledWith(mockValidator);
    });

    it("should preserve original validator functionality", () => {
      const mockValidator = {
        validate: jest.fn(() => Result.ok({ name: "test" })),
        transform: jest.fn(() => "transformed"),
        parse: jest.fn(),
        pick: jest.fn(),
        customMethod: jest.fn(() => "custom"),
      };

      const mockAsyncValidator = {
        validate: mockValidator.validate,
        withAsyncContext: jest.fn(),
      };

      mockAddAsyncSupport.mockReturnValue(mockAsyncValidator);

      const enhanced = enhanceValidatorWithAsync(mockValidator);

      expect(enhanced.validate).toBe(mockValidator.validate);
      expect((enhanced as any).transform).toBe(mockValidator.transform);
      expect((enhanced as any).customMethod).toBe(mockValidator.customMethod);
    });
  });

  describe("extendFieldBuilderWithAsync", () => {
    it("should extend field builder with async support", () => {
      const mockValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const mockAsyncValidator = {
        validate: mockValidator.validate,
        withAsyncContext: jest.fn(),
      };

      const mockFieldBuilder = {
        build: jest.fn(() => mockValidator),
        v: jest.fn(),
        customMethod: jest.fn(),
      };

      mockAddAsyncSupport.mockReturnValue(mockAsyncValidator);

      const extended = extendFieldBuilderWithAsync(mockFieldBuilder);

      expect(extended).toHaveProperty("build");
      expect(extended).toHaveProperty("buildWithAsyncSupport");
      expect((extended as any).v).toBe(mockFieldBuilder.v);
      expect((extended as any).customMethod).toBe(mockFieldBuilder.customMethod);
    });

    it("should build async-aware validator from build method", () => {
      const mockValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const mockAsyncValidator = {
        validate: mockValidator.validate,
        withAsyncContext: jest.fn(),
      };

      const mockFieldBuilder = {
        build: jest.fn(() => mockValidator),
      };

      mockAddAsyncSupport.mockReturnValue(mockAsyncValidator);

      const extended = extendFieldBuilderWithAsync(mockFieldBuilder);
      const result = extended.build();

      expect(mockFieldBuilder.build).toHaveBeenCalled();
      expect(mockAddAsyncSupport).toHaveBeenCalledWith(mockValidator);
      expect(result).toBe(mockAsyncValidator);
    });

    it("should build async-aware validator from buildWithAsyncSupport method", () => {
      const mockValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const mockAsyncValidator = {
        validate: mockValidator.validate,
        withAsyncContext: jest.fn(),
      };

      const mockFieldBuilder = {
        build: jest.fn(() => mockValidator),
      };

      mockAddAsyncSupport.mockReturnValue(mockAsyncValidator);

      const extended = extendFieldBuilderWithAsync(mockFieldBuilder);
      const result = extended.buildWithAsyncSupport();

      expect(mockFieldBuilder.build).toHaveBeenCalled();
      expect(mockAddAsyncSupport).toHaveBeenCalledWith(mockValidator);
      expect(result).toBe(mockAsyncValidator);
    });
  });

  describe("createOptimizedAsyncValidator", () => {
    it("should create async validator with sync validation", () => {
      const mockSyncValidator = {
        validate: jest.fn((value) => Result.ok({ name: value.name })),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);

      expect(asyncValidator).toHaveProperty("validate");
      expect(asyncValidator).toHaveProperty("withAsyncContext");

      const result = asyncValidator.validate({ name: "test" });
      expect(mockSyncValidator.validate).toHaveBeenCalledWith({ name: "test" }, undefined);
      expect(result.isValid()).toBe(true);
    });

    it("should validate with async context", async () => {
      const mockSyncValidator = {
        validate: jest.fn((value, options) => {
          if (options?.asyncContext?.userId) {
            return Result.ok({ name: value.name, userId: options.asyncContext.userId });
          }
          return Result.ok({ name: value.name });
        }),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);
      const context: AsyncContext<{ userId: string }> = {
        data: { userId: "123" },
        isReady: true,
        hasErrors: false,
        errors: [],
      };

      const contextAwareValidator = asyncValidator.withAsyncContext(context);
      const result = await contextAwareValidator.validate({ name: "test" });

      expect(mockSyncValidator.validate).toHaveBeenCalledWith(
        { name: "test" },
        expect.objectContaining({
          asyncContext: { userId: "123" },
        })
      );
      expect(result.isValid()).toBe(true);
      expect(result.unwrap()).toEqual({ name: "test", userId: "123" });
    });

    it("should return error when async context is not ready", async () => {
      const mockSyncValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);
      const context: AsyncContext<{}> = {
        data: {},
        isReady: false,
        hasErrors: true,
        errors: [
          { key: "user", error: new Error("User load failed") },
          { key: "permissions", error: "Permission denied" },
        ],
      };

      const contextAwareValidator = asyncValidator.withAsyncContext(context);
      const result = await contextAwareValidator.validate({ name: "test" });

      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors).toHaveLength(2);
      expect(errors[0].path).toBe("user");
      expect(errors[0].code).toBe("ASYNC_CONTEXT_ERROR");
      expect(errors[0].message).toContain("User load failed");
      expect(errors[1].path).toBe("permissions");
      expect(errors[1].message).toContain("Permission denied");
      expect(mockSyncValidator.validate).not.toHaveBeenCalled();
    });

    it("should provide type information accessor", () => {
      const mockSyncValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);
      const context: AsyncContext<{ userId: string }> = {
        data: { userId: "123" },
        isReady: true,
        hasErrors: false,
        errors: [],
      };

      const contextAwareValidator = asyncValidator.withAsyncContext(context);
      const contextType = contextAwareValidator.getContextType();

      expect(contextType).toEqual({});
    });

    it("should handle async context errors with string messages", async () => {
      const mockSyncValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);
      const context: AsyncContext<{}> = {
        data: {},
        isReady: false,
        hasErrors: true,
        errors: [{ key: "test", error: "Simple string error" }],
      };

      const contextAwareValidator = asyncValidator.withAsyncContext(context);
      const result = await contextAwareValidator.validate({});

      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors[0].message).toContain("Simple string error");
    });
  });

  describe("createAsyncValidator", () => {
    it("should be an alias for createOptimizedAsyncValidator", () => {
      const mockSyncValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const asyncValidator = createAsyncValidator(mockSyncValidator);

      expect(asyncValidator).toHaveProperty("validate");
      expect(asyncValidator).toHaveProperty("withAsyncContext");

      const result = asyncValidator.validate({});
      expect(mockSyncValidator.validate).toHaveBeenCalled();
      expect(result.isValid()).toBe(true);
    });
  });

  describe("AsyncValidationHelpers", () => {
    describe("createSimpleContext", () => {
      it("should create async context from promise object", async () => {
        const mockBuilder = {
          set: jest.fn().mockReturnThis(),
          build: jest.fn().mockResolvedValue({
            data: { user: "John", permissions: ["read"] },
            isReady: true,
            hasErrors: false,
            errors: [],
          }),
        };

        mockCreateAsyncContext.mockReturnValue(mockBuilder as any);

        const asyncData = {
          user: Promise.resolve("John"),
          permissions: Promise.resolve(["read"]),
        };

        const context = await AsyncValidationHelpers.createSimpleContext(asyncData);

        expect(mockCreateAsyncContext).toHaveBeenCalled();
        expect(mockBuilder.set).toHaveBeenCalledWith("user", asyncData.user);
        expect(mockBuilder.set).toHaveBeenCalledWith("permissions", asyncData.permissions);
        expect(mockBuilder.build).toHaveBeenCalled();
        expect(context.data).toEqual({ user: "John", permissions: ["read"] });
      });

      it("should handle empty async data object", async () => {
        const mockBuilder = {
          set: jest.fn().mockReturnThis(),
          build: jest.fn().mockResolvedValue({
            data: {},
            isReady: true,
            hasErrors: false,
            errors: [],
          }),
        };

        mockCreateAsyncContext.mockReturnValue(mockBuilder as any);

        const context = await AsyncValidationHelpers.createSimpleContext({});

        expect(mockBuilder.set).not.toHaveBeenCalled();
        expect(mockBuilder.build).toHaveBeenCalled();
      });
    });

    describe("withTimeout", () => {
      it("should resolve when context resolves within timeout", async () => {
        const contextPromise = Promise.resolve({
          data: { user: "John" },
          isReady: true,
          hasErrors: false,
          errors: [],
        });

        const result = await AsyncValidationHelpers.withTimeout(contextPromise, 1000);

        expect(result.data.user).toBe("John");
      });

      it("should reject when timeout is exceeded", async () => {
        const slowContextPromise = new Promise<AsyncContext<any>>((resolve) => {
          setTimeout(() => resolve({
            data: { user: "John" },
            isReady: true,
            hasErrors: false,
            errors: [],
          }), 200);
        });

        await expect(
          AsyncValidationHelpers.withTimeout(slowContextPromise, 100)
        ).rejects.toThrow("Async context timeout (100ms)");
      });

      it("should reject with original error when context rejects", async () => {
        const errorContextPromise = Promise.reject(new Error("Context failed"));

        await expect(
          AsyncValidationHelpers.withTimeout(errorContextPromise, 1000)
        ).rejects.toThrow("Context failed");
      });
    });

    describe("mergeContexts", () => {
      it("should merge two successful contexts", async () => {
        const context1Promise = Promise.resolve({
          data: { user: "John" },
          isReady: true,
          hasErrors: false,
          errors: [],
        });

        const context2Promise = Promise.resolve({
          data: { permissions: ["read"] },
          isReady: true,
          hasErrors: false,
          errors: [],
        });

        const merged = await AsyncValidationHelpers.mergeContexts(context1Promise, context2Promise);

        expect(merged.data).toEqual({ user: "John", permissions: ["read"] });
        expect(merged.isReady).toBe(true);
        expect(merged.hasErrors).toBe(false);
        expect(merged.errors).toEqual([]);
      });

      it("should handle context with errors", async () => {
        const context1Promise = Promise.resolve({
          data: { user: "John" },
          isReady: true,
          hasErrors: false,
          errors: [],
        });

        const context2Promise = Promise.resolve({
          data: {},
          isReady: false,
          hasErrors: true,
          errors: [{ key: "permissions", error: new Error("Failed") }],
        });

        const merged = await AsyncValidationHelpers.mergeContexts(context1Promise, context2Promise);

        expect(merged.data).toEqual({ user: "John" });
        expect(merged.isReady).toBe(false);
        expect(merged.hasErrors).toBe(true);
        expect(merged.errors).toHaveLength(1);
        expect(merged.errors[0].key).toBe("permissions");
      });

      it("should merge errors from both contexts", async () => {
        const context1Promise = Promise.resolve({
          data: {},
          isReady: false,
          hasErrors: true,
          errors: [{ key: "user", error: new Error("User failed") }],
        });

        const context2Promise = Promise.resolve({
          data: {},
          isReady: false,
          hasErrors: true,
          errors: [{ key: "permissions", error: new Error("Permissions failed") }],
        });

        const merged = await AsyncValidationHelpers.mergeContexts(context1Promise, context2Promise);

        expect(merged.isReady).toBe(false);
        expect(merged.hasErrors).toBe(true);
        expect(merged.errors).toHaveLength(2);
        expect(merged.errors[0].key).toBe("user");
        expect(merged.errors[1].key).toBe("permissions");
      });

      it("should handle overlapping data keys", async () => {
        const context1Promise = Promise.resolve({
          data: { shared: "value1", unique1: "data1" },
          isReady: true,
          hasErrors: false,
          errors: [],
        });

        const context2Promise = Promise.resolve({
          data: { shared: "value2", unique2: "data2" },
          isReady: true,
          hasErrors: false,
          errors: [],
        });

        const merged = await AsyncValidationHelpers.mergeContexts(context1Promise, context2Promise);

        expect(merged.data).toEqual({
          shared: "value2", // Second context wins
          unique1: "data1",
          unique2: "data2",
        });
      });
    });
  });

  describe("AsyncDebugUtils", () => {
    // Mock performance.now for consistent testing
    const originalPerformanceNow = performance.now;
    let mockTime = 0;

    beforeEach(() => {
      const mockTime = 0;
      performance.now = jest.fn(() => mockTime);
    });

    afterEach(() => {
      performance.now = originalPerformanceNow;
    });

    describe("measureAsyncContextBuild", () => {
      it("should measure context build time", async () => {
        const mockContext = {
          data: { user: "John" },
          isReady: true,
          hasErrors: false,
          errors: [],
        };

        const contextBuilder = jest.fn(async () => {
          mockTime = 100; // Simulate 100ms build time
          return mockContext;
        });

        const result = await AsyncDebugUtils.measureAsyncContextBuild(contextBuilder);

        expect(result.context).toBe(mockContext);
        expect(result.buildTimeMs).toBe(100);
        expect(contextBuilder).toHaveBeenCalled();
      });

      it("should handle context builder errors", async () => {
        const contextBuilder = jest.fn(async () => {
          throw new Error("Build failed");
        });

        await expect(
          AsyncDebugUtils.measureAsyncContextBuild(contextBuilder)
        ).rejects.toThrow("Build failed");
      });
    });

    describe("compareValidationPerformance", () => {
      it("should measure sync and async validation performance", async () => {
        const mockValidator = {
          validate: jest.fn(() => Result.ok({})),
          withAsyncContext: jest.fn(() => ({
            validate: jest.fn(async () => Result.ok({})),
            getContextType: jest.fn(() => ({})),
          })),
        };

        const mockContextPromise = Promise.resolve({
          data: { user: "John" },
          isReady: true,
          hasErrors: false,
          errors: [],
        });

        // Simulate timing: sync=50ms, context build=30ms, async validation=20ms
        const mockTime = 0;
        performance.now = jest.fn()
          .mockReturnValueOnce(0)    // sync start
          .mockReturnValueOnce(50)   // sync end
          .mockReturnValueOnce(50)   // context start
          .mockReturnValueOnce(80)   // context end
          .mockReturnValueOnce(80)   // async start
          .mockReturnValueOnce(100); // async end

        const result = await AsyncDebugUtils.compareValidationPerformance(
          mockValidator as any,
          { name: "test" },
          mockContextPromise
        );

        expect(result.syncTimeMs).toBe(50);
        expect(result.contextBuildTimeMs).toBe(30);
        expect(result.asyncTimeMs).toBe(20);
        expect(mockValidator.validate).toHaveBeenCalledWith({ name: "test" });
      });

      it("should handle case without async context", async () => {
        const mockValidator = {
          validate: jest.fn(() => Result.ok({})),
          withAsyncContext: jest.fn(),
        };

        const mockTime = 0;
        performance.now = jest.fn()
          .mockReturnValueOnce(0)   // sync start
          .mockReturnValueOnce(75); // sync end

        const result = await AsyncDebugUtils.compareValidationPerformance(
          mockValidator,
          { name: "test" }
        );

        expect(result.syncTimeMs).toBe(75);
        expect(result.contextBuildTimeMs).toBe(0);
        expect(result.asyncTimeMs).toBe(0);
        expect(mockValidator.validate).toHaveBeenCalledWith({ name: "test" });
        expect(mockValidator.withAsyncContext).not.toHaveBeenCalled();
      });

      it("should measure performance with async context validator", async () => {
        const mockAsyncContextValidator = {
          validate: jest.fn(async () => Result.ok({})),
        };

        const mockValidator = {
          validate: jest.fn(() => Result.ok({})),
          withAsyncContext: jest.fn(() => mockAsyncContextValidator),
        };

        const mockContext = {
          data: { user: "John" },
          isReady: true,
          hasErrors: false,
          errors: [],
        };

        const mockContextPromise = Promise.resolve(mockContext);

        const mockTime = 0;
        performance.now = jest.fn()
          .mockReturnValueOnce(0)   // sync start
          .mockReturnValueOnce(30)  // sync end
          .mockReturnValueOnce(30)  // context start
          .mockReturnValueOnce(60)  // context end
          .mockReturnValueOnce(60)  // async start
          .mockReturnValueOnce(90); // async end

        const result = await AsyncDebugUtils.compareValidationPerformance(
          mockValidator as any,
          { name: "test" },
          mockContextPromise
        );

        expect(result.syncTimeMs).toBe(30);
        expect(result.contextBuildTimeMs).toBe(30);
        expect(result.asyncTimeMs).toBe(30);
        expect(mockValidator.withAsyncContext).toHaveBeenCalledWith(mockContext);
        expect(mockAsyncContextValidator.validate).toHaveBeenCalledWith({ name: "test" });
      });
    });
  });

  describe("edge cases and additional scenarios", () => {
    it("should handle validator with all optional methods", () => {
      const minimalValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const enhanced = enhanceValidatorWithAsync(minimalValidator as any);
      expect(enhanced.validate).toBe(minimalValidator.validate);
      expect(enhanced.withAsyncContext).toBeDefined();
      expect((enhanced as any).transform).toBeUndefined();
      expect((enhanced as any).parse).toBeUndefined();
    });

    it("should handle field builder with minimal interface", () => {
      const minimalFieldBuilder = {
        build: jest.fn(() => ({ validate: jest.fn(() => Result.ok({})) })),
      };

      mockAddAsyncSupport.mockReturnValue({
        validate: jest.fn(),
        withAsyncContext: jest.fn(),
      });

      const extended = extendFieldBuilderWithAsync(minimalFieldBuilder);
      expect(extended.build).toBeDefined();
      expect(extended.buildWithAsyncSupport).toBeDefined();
      expect((extended as any).v).toBeUndefined();
    });

    it("should handle async context with complex error objects", async () => {
      const mockSyncValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);
      const complexError = {
        code: "COMPLEX_ERROR",
        message: "Complex error occurred",
        details: { field: "test", reason: "validation" },
        stack: "Error: Complex error\n    at test.js:10:5",
      };

      const context: AsyncContext<{}> = {
        data: {},
        isReady: false,
        hasErrors: true,
        errors: [{ key: "complex", error: complexError }],
      };

      const contextAwareValidator = asyncValidator.withAsyncContext(context);
      const result = await contextAwareValidator.validate({});

      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors[0].message).toContain("Complex error occurred");
    });

    it("should handle async context with numeric error codes", async () => {
      const mockSyncValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);
      const context: AsyncContext<{}> = {
        data: {},
        isReady: false,
        hasErrors: true,
        errors: [{ key: "status", error: 404 }],
      };

      const contextAwareValidator = asyncValidator.withAsyncContext(context);
      const result = await contextAwareValidator.validate({});

      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors[0].message).toContain("404");
    });

    it("should handle async context with undefined error", async () => {
      const mockSyncValidator = {
        validate: jest.fn(() => Result.ok({})),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);
      const context: AsyncContext<{}> = {
        data: {},
        isReady: false,
        hasErrors: true,
        errors: [{ key: "undefined", error: undefined }],
      };

      const contextAwareValidator = asyncValidator.withAsyncContext(context);
      const result = await contextAwareValidator.validate({});

      expect(result.isError()).toBe(true);
      const errors = result.errors;
      expect(errors[0].message).toContain("Async context error");
    });

    it("should handle mergeContexts with deeply nested data", async () => {
      const context1Promise = Promise.resolve({
        data: { 
          user: { 
            profile: { 
              name: "John",
              settings: { theme: "dark" }
            } 
          } 
        },
        isReady: true,
        hasErrors: false,
        errors: [],
      });

      const context2Promise = Promise.resolve({
        data: { 
          user: { 
            profile: { 
              age: 30,
              settings: { language: "en" }
            },
            permissions: ["read"]
          } 
        },
        isReady: true,
        hasErrors: false,
        errors: [],
      });

      const merged = await AsyncValidationHelpers.mergeContexts(context1Promise, context2Promise);

      expect(merged.data.user.profile.name).toBeUndefined(); // Overwritten by context2
      expect(merged.data.user.profile.age).toBe(30);
      expect(merged.data.user.profile.settings.language).toBe("en");
      expect(merged.data.user.permissions).toEqual(["read"]);
    });

    it("should handle createSimpleContext with Promise.reject", async () => {
      const mockBuilder = {
        set: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue({
          data: { success: "value" },
          isReady: false,
          hasErrors: true,
          errors: [{ key: "failed", error: "Promise rejected" }],
        }),
      };

      mockCreateAsyncContext.mockReturnValue(mockBuilder as any);

      const asyncData = {
        success: Promise.resolve("value"),
        failed: Promise.reject("Promise rejected"),
      };

      const context = await AsyncValidationHelpers.createSimpleContext(asyncData);

      expect(context.hasErrors).toBe(true);
      expect(context.errors).toHaveLength(1);
    });

    it("should handle withTimeout with zero timeout", async () => {
      const contextPromise = new Promise<AsyncContext<any>>((resolve) => {
        setTimeout(() => resolve({
          data: {},
          isReady: true,
          hasErrors: false,
          errors: [],
        }), 10);
      });

      await expect(
        AsyncValidationHelpers.withTimeout(contextPromise, 0)
      ).rejects.toThrow("Async context timeout (0ms)");
    });

    it("should handle measureAsyncContextBuild with sync context builder", async () => {
      const mockContext = {
        data: { instant: true },
        isReady: true,
        hasErrors: false,
        errors: [],
      };

      const contextBuilder = jest.fn(() => Promise.resolve(mockContext));
      const mockTime = 0;
      performance.now = jest.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0); // Instant resolution

      const result = await AsyncDebugUtils.measureAsyncContextBuild(contextBuilder);

      expect(result.context).toBe(mockContext);
      expect(result.buildTimeMs).toBe(0);
    });

    it("should handle compareValidationPerformance with validation errors", async () => {
      const mockValidator = {
        validate: jest.fn(() => Result.error([{
          path: "field",
          paths: () => ["field"],
          message: "Validation failed",
          code: "VALIDATION_ERROR",
        }])),
        withAsyncContext: jest.fn(() => ({
          validate: jest.fn(async () => Result.error([{
            path: "async_field",
            paths: () => ["async_field"],
            message: "Async validation failed",
            code: "ASYNC_VALIDATION_ERROR",
          }])),
          getContextType: jest.fn(() => ({})),
        })),
      };

      const mockContextPromise = Promise.resolve({
        data: { user: "John" },
        isReady: true,
        hasErrors: false,
        errors: [],
      });

      const mockTime = 0;
      performance.now = jest.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(20)
        .mockReturnValueOnce(20)
        .mockReturnValueOnce(30);

      const result = await AsyncDebugUtils.compareValidationPerformance(
        mockValidator as any,
        { name: "test" },
        mockContextPromise
      );

      expect(result.syncTimeMs).toBe(10);
      expect(result.contextBuildTimeMs).toBe(10);
      expect(result.asyncTimeMs).toBe(10);
    });

    it("should handle circular references in async context", () => {
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      const mockSyncValidator = {
        validate: jest.fn((value, options) => {
          // Should be able to access circular reference
          if (options?.asyncContext?.self?.name === "test") {
            return Result.ok({ validated: true });
          }
          return Result.ok({ validated: false });
        }),
      };

      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);
      const context: AsyncContext<any> = {
        data: circularObj,
        isReady: true,
        hasErrors: false,
        errors: [],
      };

      const contextAwareValidator = asyncValidator.withAsyncContext(context);
      // Note: This is synchronous despite returning Promise in the interface
      const resultPromise = contextAwareValidator.validate({});
      
      // Resolve the promise
      return resultPromise.then(result => {
        expect(result.isValid()).toBe(true);
        expect(result.unwrap()).toEqual({ validated: true });
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete async validation workflow", async () => {
      const mockSyncValidator = {
        validate: jest.fn((value, options) => {
          if (options?.asyncContext?.userId) {
            return Result.ok({ ...value, validated: true, userId: options.asyncContext.userId });
          }
          return Result.ok({ ...value, validated: false });
        }),
      };

      // Create async context
      const context: AsyncContext<{ userId: string; role: string }> = {
        data: { userId: "123", role: "admin" },
        isReady: true,
        hasErrors: false,
        errors: [],
      };

      // Create optimized async validator
      const asyncValidator = createOptimizedAsyncValidator(mockSyncValidator);

      // Test sync validation
      const syncResult = asyncValidator.validate({ name: "John" });
      expect(syncResult.unwrap()).toEqual({ name: "John", validated: false });

      // Test async validation
      const asyncResult = await asyncValidator
        .withAsyncContext(context)
        .validate({ name: "John" });

      expect(asyncResult.unwrap()).toEqual({
        name: "John",
        validated: true,
        userId: "123",
      });
    });

    it("should handle field builder async workflow", () => {
      const mockValidator = {
        validate: jest.fn(() => Result.ok({ field: "value" })),
        transform: jest.fn((fn) => ({ 
          validate: (v: any) => Result.ok(fn(v)) 
        })),
      };

      const mockFieldBuilder = {
        build: jest.fn(() => mockValidator),
        v: jest.fn().mockReturnThis(),
        for: jest.fn().mockReturnThis(),
      };

      mockAddAsyncSupport.mockImplementation((validator) => ({
        ...validator,
        withAsyncContext: jest.fn(() => ({
          validate: jest.fn(async () => Result.ok({ async: true })),
          getContextType: jest.fn(() => ({} as any)),
        })),
      }) as any);

      const extended = extendFieldBuilderWithAsync(mockFieldBuilder);
      
      // Test that methods are preserved
      (extended as any).v("field", jest.fn());
      expect(mockFieldBuilder.v).toHaveBeenCalled();
      
      // Test async build
      const asyncValidator = extended.buildWithAsyncSupport();
      expect(mockFieldBuilder.build).toHaveBeenCalled();
      expect(asyncValidator.withAsyncContext).toBeDefined();
    });

    it("should handle performance comparison with no async support", async () => {
      const mockValidator = {
        validate: jest.fn(() => Result.ok({})),
        // No withAsyncContext method
      };

      const mockTime = 0;
      performance.now = jest.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(25);

      const result = await AsyncDebugUtils.compareValidationPerformance(
        mockValidator as any,
        { test: "data" }
      );

      expect(result.syncTimeMs).toBe(25);
      expect(result.contextBuildTimeMs).toBe(0);
      expect(result.asyncTimeMs).toBe(0);
    });

    it("should handle async helpers with complex promise chains", async () => {
      const mockBuilder = {
        set: jest.fn().mockReturnThis(),
        build: jest.fn().mockImplementation(() => 
          new Promise(resolve => {
            setTimeout(() => resolve({
              data: { delayed: "result" },
              isReady: true,
              hasErrors: false,
              errors: [],
            }), 50);
          })
        ),
      };

      mockCreateAsyncContext.mockReturnValue(mockBuilder as any);

      const asyncData = {
        immediate: Promise.resolve("now"),
        delayed: new Promise(resolve => setTimeout(() => resolve("later"), 25)),
      };

      const contextPromise = AsyncValidationHelpers.createSimpleContext(asyncData);
      const context = await AsyncValidationHelpers.withTimeout(contextPromise, 100);

      expect((context.data as any).delayed).toBe("result");
      expect(context.isReady).toBe(true);
    });
  });
});