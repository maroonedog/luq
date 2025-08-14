/**
 * Async integration for existing validator factory
 *
 * Extends existing validator-factory.ts to add async context functionality
 * Integration design to minimize performance impact
 */

import {
  createAsyncContext,
  addAsyncSupport,
} from "./async-context";
import type {
  AsyncContext,
  AsyncAwareValidator,
  AsyncEnhancedBuilder,
  TransformAwareValidator,
  ValidationOptions,
} from "../builder/types/types";
import { Result } from "../../types/result";

/**
 * Extended validation options for async context
 */
interface AsyncValidationOptions extends ValidationOptions {
  asyncContext?: any;
}

/**
 * Decorator to add async functionality to validator factory
 */
export function enhanceValidatorWithAsync<TObject extends object, TMap = {}>(
  validator: TransformAwareValidator<TObject, TMap>
): AsyncAwareValidator<TObject> & TransformAwareValidator<TObject, TMap> {
  const asyncAware = addAsyncSupport(validator);

  return {
    ...validator, // Preserve existing functionality
    ...asyncAware, // Add async functionality
  };
}


/**
 * Field builder extension with async support
 */
export function extendFieldBuilderWithAsync<
  TObject extends object,
  TMap,
  TPlugins,
  TDeclaredFields,
>(fieldBuilder: any): AsyncEnhancedBuilder<TObject> {
  const originalBuild = fieldBuilder.build.bind(fieldBuilder);

  return {
    ...fieldBuilder,

    // Extend existing build method with async support
    build(): AsyncAwareValidator<TObject> &
      TransformAwareValidator<TObject, any> {
      const originalValidator = originalBuild();
      return enhanceValidatorWithAsync(originalValidator);
    },

    // Explicit async-aware build
    buildWithAsyncSupport(): AsyncAwareValidator<TObject> &
      TransformAwareValidator<TObject, any> {
      const originalValidator = originalBuild();
      return enhanceValidatorWithAsync(originalValidator);
    },
  };
}

/**
 * Performance-optimized async validation execution (functional implementation)
 */
export const createOptimizedAsyncValidator = <TObject>(
  syncValidator: {
    validate: (value: any, options?: any) => Result<TObject>;
  }
): AsyncAwareValidator<TObject> => {
  const validate = (
    value: Partial<TObject> | unknown,
    options?: ValidationOptions
  ): Result<TObject> => {
    // Execute sync validation as-is (no performance impact)
    return syncValidator.validate(value, options);
  };

  const withAsyncContext = <TContext extends Record<string, any>>(
    asyncContext: AsyncContext<TContext>
  ) => {
    return {
      async validate(
        value: Partial<TObject> | unknown,
        options?: ValidationOptions
      ): Promise<Result<TObject>> {
        // Use async context directly

        // Error check (early return)
        if (!asyncContext.isReady) {
          return Result.error(
            asyncContext.errors.map(({ key, error }) => ({
              path: key,
              paths: () => key.split('.'),
              message: `Async context error in "${key}": ${error?.message || error || 'Unknown error'}`,
              code: "ASYNC_CONTEXT_ERROR",
            }))
          );
        }

        // Inject async data into sync validation options
        const enhancedOptions: AsyncValidationOptions = {
          ...options,
          asyncContext: asyncContext.data,
        };

        // Execute sync validation (maintain existing performance optimization)
        return syncValidator.validate(value, enhancedOptions);
      },
      
      // Type information accessor (compile-time use only)
      getContextType(): TContext {
        return {} as TContext;
      },
    };
  };

  return {
    validate,
    withAsyncContext,
  };
};

/**
 * Factory function: Create async-aware validator
 */
export function createAsyncValidator<TObject>(syncValidator: {
  validate: (value: any, options?: any) => Result<TObject>;
}): AsyncAwareValidator<TObject> {
  return createOptimizedAsyncValidator(syncValidator);
}

/**
 * Convenient helper functions
 */
export const AsyncValidationHelpers = {
  /**
   * Create simple async context
   */
  createSimpleContext<T>(
    asyncData: Record<string, Promise<any>>
  ): Promise<AsyncContext<T>> {
    const builder = createAsyncContext<T>();

    for (const [key, promise] of Object.entries(asyncData)) {
      builder.set(key, promise);
    }

    return builder.build();
  },

  /**
   * Set timeout for async validation
   */
  withTimeout<T>(
    asyncContextPromise: Promise<AsyncContext<T>>,
    timeoutMs: number
  ): Promise<AsyncContext<T>> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Async context timeout (${timeoutMs}ms)`)),
        timeoutMs
      );
    });

    return Promise.race([asyncContextPromise, timeoutPromise]);
  },

  /**
   * Merge multiple async contexts
   */
  async mergeContexts<T1, T2>(
    context1: Promise<AsyncContext<T1>>,
    context2: Promise<AsyncContext<T2>>
  ): Promise<AsyncContext<T1 & T2>> {
    const [ctx1, ctx2] = await Promise.all([context1, context2]);

    return {
      data: { ...ctx1.data, ...ctx2.data } as T1 & T2,
      isReady: ctx1.isReady && ctx2.isReady,
      hasErrors: ctx1.hasErrors || ctx2.hasErrors,
      errors: [...ctx1.errors, ...ctx2.errors],
    };
  },
};

/**
 * Utilities for debugging and performance measurement
 */
export const AsyncDebugUtils = {
  /**
   * Measure async context build time
   */
  async measureAsyncContextBuild<T>(
    contextBuilder: () => Promise<AsyncContext<T>>
  ): Promise<{ context: AsyncContext<T>; buildTimeMs: number }> {
    const start = performance.now();
    const context = await contextBuilder();
    const buildTimeMs = performance.now() - start;

    return { context, buildTimeMs };
  },

  /**
   * Compare validation execution time
   */
  async compareValidationPerformance<TObject>(
    validator: AsyncAwareValidator<TObject>,
    value: any,
    asyncContext?: Promise<AsyncContext<any>>
  ): Promise<{
    syncTimeMs: number;
    asyncTimeMs: number;
    contextBuildTimeMs: number;
  }> {
    // Measure sync validation time
    const syncStart = performance.now();
    await validator.validate(value);
    const syncTimeMs = performance.now() - syncStart;

    if (!asyncContext) {
      return { syncTimeMs, asyncTimeMs: 0, contextBuildTimeMs: 0 };
    }

    // Async context build time
    const contextStart = performance.now();
    const resolvedContext = await asyncContext;
    const contextBuildTimeMs = performance.now() - contextStart;

    // Async validation time (excluding context build)
    const asyncStart = performance.now();
    await validator
      .withAsyncContext(resolvedContext)
      .validate(value);
    const asyncTimeMs = performance.now() - asyncStart;

    return { syncTimeMs, asyncTimeMs, contextBuildTimeMs };
  },
};
