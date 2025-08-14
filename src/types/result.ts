/**
 * Result pattern implementation for Luq validation
 * Provides a type-safe, functional approach to handling validation results
 */

import { ValidationError } from "./index";

/**
 * Lightweight validation exception interface
 */
export interface LuqValidationException {
  readonly name: string;
  readonly message: string;
  readonly errors: ValidationError[];
  toString(): string;
}

/**
 * Create a validation exception (does not extend Error for performance)
 */
export function createLuqValidationException(
  message: string,
  errors: ValidationError[]
): LuqValidationException {
  return {
    name: "LuqValidationException",
    message,
    errors,
    toString() {
      return `${this.name}: ${this.message}`;
    },
  };
}

// For backward compatibility
export const LuqValidationException = createLuqValidationException as any as {
  new (message: string, errors: ValidationError[]): LuqValidationException;
};

/**
 * Represents a successful validation result
 */
export interface ValidResult<T> {
  readonly isValid: true;
  readonly data: T;
  readonly errors: never;
}

/**
 * Represents a failed validation result
 */
export interface InvalidResult {
  readonly isValid: false;
  readonly data: never;
  readonly errors: ValidationError[];
}

/**
 * Union type for validation results
 */
export type ValidationState<T> = ValidResult<T> | InvalidResult;

/**
 * Result interface providing functional validation result handling
 * Pattern 3: Function-based interface approach
 *
 * @example
 * ```typescript
 * const result = validator.validate(data);
 *
 * // Check if valid
 * if (result.isValid()) {
 *   // unwrap data safely
 *   const data = result.unwrap();
 * }
 *
 * // Functional approach
 * const processed = result
 *   .map(data => ({ ...data, processed: true }))
 *   .unwrapOr(defaultValue);
 *
 * // Exception approach
 * const data = result.unwrap(); // throws if invalid
 * ```
 */
export interface Result<T> {
  /**
   * Check if result is valid
   */
  isValid(): boolean;

  /**
   * Backward compatibility: Check if result is valid (property access)
   */
  readonly valid: boolean;

  /**
   * Check if result is invalid
   */
  isError(): boolean;

  /**
   * Get the data if valid, otherwise throw ValidationException
   *
   * @throws {LuqValidationException} If the result is invalid
   */
  unwrap(): T;

  /**
   * Get the data if valid, otherwise return the default value
   */
  unwrapOr(defaultValue: T): T;

  /**
   * Get the data if valid, otherwise compute default using lazy function
   */
  unwrapOrElse(fn: (errors: ValidationError[]) => T): T;

  /**
   * Transform the data if valid, leave errors unchanged
   */
  map<U>(fn: (data: T) => U): Result<U>;

  /**
   * Transform the data if valid, allowing for fallible transformation
   */
  flatMap<U>(fn: (data: T) => Result<U>): Result<U>;

  /**
   * Execute a side effect if the result is valid
   */
  tap(fn: (data: T) => void): Result<T>;

  /**
   * Execute a side effect if the result is invalid
   */
  tapError(fn: (errors: ValidationError[]) => void): Result<T>;

  /**
   * Get the data if valid, undefined otherwise
   * Use with caution - prefer unwrapOr() or check isValid() first
   */
  data(): T | undefined;

  /**
   * Get the errors if invalid, empty array otherwise
   */
  readonly errors: ValidationError[];

  /**
   * Convert to plain object (for serialization/compatibility)
   */
  toPlainObject(): {
    valid: boolean;
    data?: T;
    errors: ValidationError[];
  };
}

/**
 * Optimized success result prototype
 */
const successProto = {
  isValid(): boolean {
    return true;
  },

  isError(): boolean {
    return false;
  },

  data(): any {
    return (this as any)._data;
  },

  unwrap(): any {
    return (this as any)._data;
  },

  unwrapOr(defaultValue: any): any {
    return (this as any)._data;
  },

  unwrapOrElse(fn: (errors: ValidationError[]) => any): any {
    return (this as any)._data;
  },

  map(fn: (data: any) => any): Result<any> {
    return Result.ok(fn((this as any)._data));
  },

  flatMap(fn: (data: any) => Result<any>): Result<any> {
    return fn((this as any)._data);
  },

  tap(fn: (data: any) => void): Result<any> {
    fn((this as any)._data);
    return this;
  },

  tapError(fn: (errors: ValidationError[]) => void): Result<any> {
    return this;
  },

  onSuccessPostProcess(fn: (data: any) => void): Result<any> {
    fn((this as any)._data);
    return this;
  },

  errors(): ValidationError[] {
    return [];
  },

  toPlainObject(): any {
    return {
      valid: true,
      data: (this as any)._data,
      errors: [],
    };
  },

  get valid(): boolean {
    return true;
  },

  get value(): any {
    return (this as any)._data;
  },
};

/**
 * Result implementation factory
 */
export const Result = {
  /**
   * Create a successful result - optimized for performance
   */
  ok<T>(data: T): Result<T> {
    // Use prototype-based approach for better performance
    const result = Object.create(successProto);
    result._data = data;
    return result;
  },

  /**
   * Create a failed result
   */
  error<T>(errors: ValidationError[]): Result<T> {
    return createResult({
      isValid: false,
      data: undefined as never,
      errors,
    } as InvalidResult);
  },
};

/**
 * Internal function to create Result implementation
 */
function createResult<T>(state: ValidationState<T>): Result<T> {
  const result: Result<T> = {
    isValid(): boolean {
      return state.isValid;
    },

    isError(): boolean {
      return !state.isValid;
    },

    unwrap(): T {
      if (state.isValid) {
        return state.data;
      }
      throw createLuqValidationException(
        `Validation failed with ${state.errors.length} error(s)`,
        state.errors
      );
    },

    unwrapOr(defaultValue: T): T {
      return state.isValid ? state.data : defaultValue;
    },

    unwrapOrElse(fn: (errors: ValidationError[]) => T): T {
      return state.isValid ? state.data : fn(state.errors);
    },

    map<U>(fn: (data: T) => U): Result<U> {
      if (state.isValid) {
        return Result.ok(fn(state.data));
      }
      return Result.error(state.errors);
    },

    flatMap<U>(fn: (data: T) => Result<U>): Result<U> {
      if (state.isValid) {
        return fn(state.data);
      }
      return Result.error(state.errors);
    },

    tap(fn: (data: T) => void): Result<T> {
      if (state.isValid) {
        fn(state.data);
      }
      return createResult(state);
    },

    tapError(fn: (errors: ValidationError[]) => void): Result<T> {
      if (!state.isValid) {
        fn(state.errors);
      }
      return createResult(state);
    },

    data(): T | undefined {
      return state.isValid ? state.data : undefined;
    },

    toPlainObject(): {
      valid: boolean;
      data?: T;
      errors: ValidationError[];
    } {
      return {
        valid: state.isValid,
        data: state.isValid ? state.data : undefined,
        errors: state.isValid ? [] : state.errors,
      };
    },

    // Backward compatibility properties
    get valid(): boolean {
      return state.isValid;
    },

    get errors(): ValidationError[] {
      return state.isValid ? [] : state.errors;
    },
  };
  return result;
}

/**
 * Utility functions for working with Results
 */
export namespace ResultUtils {
  /**
   * Combine multiple results into a single result containing an array
   * If any result is invalid, returns the first error
   */
  export function all<T>(results: Result<T>[]): Result<T[]> {
    const data: T[] = [];
    const resultsLength = results.length;
    for (let i = 0; i < resultsLength; i++) {
      const result = results[i];
      if (result.isError()) {
        return Result.error(result.errors);
      }
      data.push(result.unwrap());
    }
    return Result.ok(data);
  }

  /**
   * Return the first valid result, or all errors if none are valid
   */
  export function any<T>(results: Result<T>[]): Result<T> {
    const allErrors: ValidationError[] = [];
    const resultsLength = results.length;
    for (let i = 0; i < resultsLength; i++) {
      const result = results[i];
      if (result.isValid()) {
        return result;
      }
      allErrors.push(...result.errors);
    }
    return Result.error(allErrors);
  }

  /**
   * Partition results into valid and invalid arrays
   */
  export function partition<T>(results: Result<T>[]): {
    valid: T[];
    invalid: ValidationError[][];
  } {
    const valid: T[] = [];
    const invalid: ValidationError[][] = [];
    const resultsLength = results.length;

    for (let i = 0; i < resultsLength; i++) {
      const result = results[i];
      if (result.isValid()) {
        valid.push(result.unwrap());
      } else {
        invalid.push(result.errors);
      }
    }

    return { valid, invalid };
  }
}
