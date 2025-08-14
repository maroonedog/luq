/**
 * Async Context Design - Separate async layer from validation
 *
 * User proposal: validator.withAsyncContext(ctx).validate()
 * Completely decouple async layer from validation flow to maintain performance
 */

import { ValidationOptions, AsyncContextOptions, AsyncContext, AsyncAwareValidator, ExampleAsyncContext } from "../builder/types/types";
import { Result } from "../../types/result";

/**
 * Extended validation options for async context
 */
interface AsyncValidationOptions extends ValidationOptions {
  asyncContext?: any;
}

/**
 * Async context builder (simplified)
 */
export class AsyncContextBuilder<T = {}> {
  private promises = new Map<string, Promise<any>>();
  private options: AsyncContextOptions = {};

  /**
   * Add async data
   */
  set<K extends string, V>(
    key: K,
    promise: Promise<V>
  ): AsyncContextBuilder<T & { [P in K]: V }> {
    this.promises.set(key, promise);
    return this as any;
  }

  /**
   * Set options
   */
  withOptions(options: AsyncContextOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Build async context (simplified)
   */
  async build(): Promise<AsyncContext<T>> {
    const data = {} as any;
    const errors: Array<{ key: string; error: any }> = [];

    // Timeout handling
    const promises = Array.from(this.promises.entries()).map(
      ([key, promise]) => {
        if (this.options.timeout) {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout: ${key}`)),
              this.options.timeout!
            )
          );
          promise = Promise.race([promise, timeoutPromise]);
        }
        return { key, promise };
      }
    );

    // Parallel execution
    const results = await Promise.allSettled(
      promises.map(({ key, promise }) =>
        promise.then((result) => ({ key, result }))
      )
    );

    // Result processing
    results.forEach((result, index) => {
      const key = promises[index].key;

      if (result.status === "fulfilled") {
        data[key] = result.value.result;
      } else {
        errors.push({ key, error: result.reason });

        // Set default value if available
        if (this.options.defaultValues?.[key] !== undefined) {
          data[key] = this.options.defaultValues[key];
        }
      }
    });

    const hasErrors = errors.length > 0;
    const isReady = !hasErrors || this.options.continueOnError === true;

    return {
      data: data as T,
      isReady,
      hasErrors,
      errors,
    };
  }
}

/**
 * Helper to create async context
 */
export function createAsyncContext<T = {}>(): AsyncContextBuilder<T> {
  return new AsyncContextBuilder<T>();
}


/**
 * Decorator to add async functionality to existing validator (type-safe version)
 */
export function addAsyncSupport<TObject>(validator: {
  validate: (value: any, options?: any) => Result<TObject>;
}): AsyncAwareValidator<TObject> {
  return {
    validate: validator.validate,

    withAsyncContext<TContext extends Record<string, any>>(
      asyncContext: AsyncContext<TContext>
    ) {
      return {
        async validate(
          value: Partial<TObject> | unknown,
          options?: ValidationOptions
        ): Promise<Result<TObject>> {
          // Use async context directly

          // Error handling (optional)
          if (!asyncContext.isReady) {
            return Result.error(
              asyncContext.errors.map(({ key, error }) => ({
                path: key,
                paths: () => key.split('.'),
                message: `Async context error: ${error.message || error}`,
                code: "ASYNC_CONTEXT_ERROR",
              }))
            );
          }

          // Type-safe extended options
          const extendedOptions: ValidationOptions & {
            asyncContext: TContext;
            asyncContextMeta: {
              hasErrors: boolean;
              errors: Array<{ key: string; error: any }>;
            };
          } = {
            ...options,
            asyncContext: asyncContext.data,
            asyncContextMeta: {
              hasErrors: asyncContext.hasErrors,
              errors: asyncContext.errors,
            },
          };

          // Execute sync validation (async context already resolved)
          return validator.validate(value, extendedOptions);
        },

        // Type information accessor (compile-time use only)
        getContextType(): TContext {
          return {} as TContext;
        },
      };
    },
  };
}

/**
 * Helper to access async context in plugins (type-safe version)
 */
export function getAsyncContext<
  T extends Record<string, any> = Record<string, any>,
>(options?: AsyncValidationOptions): T | undefined {
  return options?.asyncContext as T;
}

/**
 * Type-safe async context access (with key)
 */
export function getAsyncContextValue<
  T extends Record<string, any>,
  K extends keyof T,
>(options: ValidationOptions | undefined, key: K): T[K] | undefined {
  const context = getAsyncContext<T>(options);
  return context?.[key];
}

/**
 * Type guard for async context
 */
export function hasAsyncContextKey<
  T extends Record<string, any>,
  K extends keyof T,
>(
  options: ValidationOptions | undefined,
  key: K
): options is ValidationOptions & { asyncContext: T } {
  const context = getAsyncContext<T>(options);
  return context !== undefined && key in context;
}

