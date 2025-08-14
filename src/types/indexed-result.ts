/**
 * True index-based Result implementation
 * Stores only error index and generates error objects on demand
 */

import { ValidationError } from "./index";
import { Result } from "./result";

/**
 * Error context for deferred error generation
 */
export interface ErrorContext {
  path: string;
  value: any;
  validators?: any[];
  errorGenerator?: (index: number, context: ErrorContext) => ValidationError;
}

/**
 * Index-based validation state
 */
export interface IndexedValidState<T> {
  readonly errorIndex: number; // -1 = valid, >=0 = error validator index
  readonly data?: T;
  readonly errorContext?: ErrorContext;
}

/**
 * Create index-based Result implementation
 */
export function createIndexedResult<T>(state: IndexedValidState<T>): Result<T> {
  // Cache for generated errors (lazy generation)
  let cachedErrors: ValidationError[] | undefined;

  const generateErrors = (): ValidationError[] => {
    if (cachedErrors) return cachedErrors;
    
    if (state.errorIndex === -1 || !state.errorContext) {
      cachedErrors = [];
      return cachedErrors;
    }

    // Generate error from index
    if (state.errorContext.errorGenerator) {
      cachedErrors = [state.errorContext.errorGenerator(state.errorIndex, state.errorContext)];
    } else {
      // Fallback error generation
      cachedErrors = [{
        path: state.errorContext.path,
        code: `VALIDATION_ERROR_${state.errorIndex}`,
        message: `Validation failed at validator ${state.errorIndex}`,
        paths: () => [state.errorContext!.path]
      }];
    }
    
    return cachedErrors;
  };

  return {
    isValid(): boolean {
      return state.errorIndex === -1;
    },

    isError(): boolean {
      return state.errorIndex >= 0;
    },

    unwrap(): T {
      if (state.errorIndex === -1 && state.data !== undefined) {
        return state.data;
      }
      const errors = generateErrors();
      throw new Error(`Validation failed with ${errors.length} error(s)`);
    },

    unwrapOr(defaultValue: T): T {
      return state.errorIndex === -1 && state.data !== undefined ? state.data : defaultValue;
    },

    unwrapOrElse(fn: (errors: ValidationError[]) => T): T {
      if (state.errorIndex === -1 && state.data !== undefined) {
        return state.data;
      }
      return fn(generateErrors());
    },

    map<U>(fn: (data: T) => U): Result<U> {
      if (state.errorIndex === -1 && state.data !== undefined) {
        return createIndexedResult<U>({
          errorIndex: -1,
          data: fn(state.data),
        });
      }
      return createIndexedResult<U>({
        errorIndex: state.errorIndex,
        errorContext: state.errorContext,
      });
    },

    flatMap<U>(fn: (data: T) => Result<U>): Result<U> {
      if (state.errorIndex === -1 && state.data !== undefined) {
        return fn(state.data);
      }
      return createIndexedResult<U>({
        errorIndex: state.errorIndex,
        errorContext: state.errorContext,
      });
    },

    tap(fn: (data: T) => void): Result<T> {
      if (state.errorIndex === -1 && state.data !== undefined) {
        fn(state.data);
      }
      return createIndexedResult(state);
    },

    tapError(fn: (errors: ValidationError[]) => void): Result<T> {
      if (state.errorIndex >= 0) {
        fn(generateErrors());
      }
      return createIndexedResult(state);
    },

    // This is where the magic happens - errors are generated only when requested
    get errors(): ValidationError[] {
      return generateErrors();
    },

    get valid(): boolean {
      return state.errorIndex === -1;
    },

    data(): T | undefined {
      return state.errorIndex === -1 ? state.data : undefined;
    },

    toPlainObject(): {
      valid: boolean;
      data?: T;
      errors: ValidationError[];
    } {
      return {
        valid: state.errorIndex === -1,
        data: state.data,
        errors: generateErrors(),
      };
    },
  };
}

/**
 * Index-based Result factory
 */
export const IndexedResult = {
  /**
   * Create a successful result
   */
  ok<T>(data: T): Result<T> {
    return createIndexedResult({ errorIndex: -1, data });
  },

  /**
   * Create a failed result with error index
   */
  errorIndex<T>(
    errorIndex: number,
    errorContext: ErrorContext
  ): Result<T> {
    return createIndexedResult({ errorIndex, errorContext });
  },
  
  /**
   * Create a failed result with pre-generated errors (for compatibility)
   */
  error<T>(errors: ValidationError[]): Result<T> {
    if (errors.length === 0) {
      return IndexedResult.ok(undefined as any);
    }
    
    // For compatibility - store first error
    return createIndexedResult({
      errorIndex: 0,
      errorContext: {
        path: errors[0].path,
        value: undefined,
        errorGenerator: () => errors[0]
      }
    });
  }
};