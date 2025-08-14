/**
 * Common type guard utilities
 * Centralizes type checking logic to reduce code duplication and bundle size
 */

/**
 * Checks if a value is a non-null object (excluding arrays)
 */
export const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null && !isArray(value);

/**
 * Checks if a value is a plain object (not Date, RegExp, etc.)
 */
export const isPlainObject = (
  value: unknown
): value is Record<string, unknown> => {
  if (!isObject(value)) return false;

  // Check for built-in object types
  if (value instanceof Date || value instanceof RegExp) return false;

  // Check for plain object
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
};

/**
 * Checks if a value is a string
 */
export const isString = (value: unknown): value is string =>
  typeof value === "string";

/**
 * Checks if a value is a number
 */
export const isNumber = (value: unknown): value is number =>
  typeof value === "number";

/**
 * Checks if a value is a boolean
 */
export const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

/**
 * Checks if a value is a function
 */
export const isFunction = (value: unknown): value is Function =>
  typeof value === "function";

/**
 * Checks if a value is an array
 */
export const isArray = Array.isArray;

/**
 * Checks if a value is null or undefined
 */
export const isNullish = (value: unknown): value is null | undefined =>
  isNull(value) || isUndefined(value);

/**
 * Checks if a value is undefined
 */
export const isUndefined = (value: unknown): value is undefined =>
  typeof value === "undefined";

/**
 * Checks if a value is null
 */
export const isNull = (value: unknown): value is null => value === null;

/**
 * Checks if a value is an Error instance
 */
export const isError = (value: unknown): value is Error =>
  value instanceof Error;

/**
 * Checks if an object has a specific property
 */
export const hasProperty = <T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> => key in obj;

/**
 * Checks if a value is a valid Date
 */
export const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !isNaN(value.getTime());

/**
 * Checks if a value is a finite number
 */
export const isFiniteNumber = (value: unknown): value is number =>
  isNumber(value) && isFinite(value);

/**
 * Checks if a value is an integer
 */
export const isInteger = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value);

/**
 * Type guard for checking multiple types at once
 */
export const isOneOfTypes = <T extends readonly unknown[]>(
  value: unknown,
  guards: Array<(value: unknown) => value is T[number]>
): value is T[number] => guards.some((guard) => guard(value));
