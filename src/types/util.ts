import { Validator } from "./valitator";

export type InferType<T extends Validator<any, any>> =
  T extends Validator<infer U, infer U> ? U : never;
type IsPlainObject<T> = T extends object
  ? T extends Function
    ? false
    : T extends any[]
      ? false
      : T extends Date
        ? false
        : true
  : false;

// Helper type to create a depth counter
type Depth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Helper type for one level of keys without recursion
type DirectKeysOf<T> = T extends object ? Extract<keyof T, string> : never;

// Helper type to exclude Array methods and properties from keys
type ArrayMethodNames = keyof any[] | keyof ReadonlyArray<any>;
type ExcludeArrayMethods<T> = T extends string 
  ? T extends ArrayMethodNames 
    ? never 
    : T 
  : T;

// Helper to extract all union members
type UnionMembers<T> = T extends any ? T : never;

// Helper type to generate paths for array element properties (simplified to avoid duplication)
type ArrayElementPaths<U, Prefix extends string, D extends number> = U extends object
  ? {
      [P in Extract<keyof U, string>]: U[P] extends Array<any>
        ? `${Prefix}.${P}`  // Just the array field itself
        : NonNullable<U[P]> extends Array<any>
          ? `${Prefix}.${P}`  // Just the optional array field itself
          : never;  // Skip non-array fields as they're handled by the main type
    }[Extract<keyof U, string>]
  : never;

// Enhanced NestedKeyOf implementation that handles optional properties and nested arrays
type NestedKeyOfWithDepth<T, D extends number = 5> = D extends 0
  ? never
  : T extends object
    ? {
        [K in Extract<keyof T, string>]: T[K] extends Array<infer U>
          ? U extends Array<infer V>
            ? // 2D array case
              K | `${K}[*]` | `${K}[*][*]` | (V extends object ? `${K}[*][*].${ExcludeArrayMethods<NestedKeyOfWithDepth<V, [-1, 0, 1, 2, 3, 4, 5][D]>>}` : never)
            : // 1D array case
              K | `${K}[*]` | (U extends object ? `${K}[*].${ExcludeArrayMethods<NestedKeyOfWithDepth<U, [-1, 0, 1, 2, 3, 4, 5][D]>>}` : never) | ArrayElementPaths<U, `${K}[*]`, D>
          : NonNullable<T[K]> extends Array<infer U>
            ? U extends Array<infer V>
              ? // Optional 2D array case
                K | `${K}[*]` | `${K}[*][*]` | (V extends object ? `${K}[*][*].${ExcludeArrayMethods<NestedKeyOfWithDepth<V, [-1, 0, 1, 2, 3, 4, 5][D]>>}` : never)
              : // Optional 1D array case
                K | `${K}[*]` | (U extends object ? `${K}[*].${ExcludeArrayMethods<NestedKeyOfWithDepth<U, [-1, 0, 1, 2, 3, 4, 5][D]>>}` : never) | ArrayElementPaths<U, `${K}[*]`, D>
            : NonNullable<T[K]> extends object
              ? IsPlainObject<NonNullable<T[K]>> extends true
                ? K | `${K}.${NestedKeyOfWithDepth<NonNullable<T[K]>, [-1, 0, 1, 2, 3, 4, 5][D]>}`
                : K
              : K;
      }[Extract<keyof T, string>]
    : never;

export type NestedKeyOf<T> = NestedKeyOfWithDepth<T>;

export type TypeOfPath<
  T,
  Path extends string,
> = Path extends `${infer K}[*][*][*]`
  ? K extends keyof T
    ? T[K] extends Array<Array<Array<infer U>>>
      ? U
      : never
    : never
  : Path extends `${infer K}[*][*]`
    ? K extends keyof T
      ? T[K] extends Array<Array<infer U>>
        ? U
        : never
      : never
    : Path extends `${infer K}[*]`
      ? K extends keyof T
        ? T[K] extends Array<infer U>
          ? U
          : never
        : never
      : Path extends `${infer K}.*`
        ? K extends keyof T
          ? T[K] extends Array<infer U>
            ? U
            : never
          : never
        : Path extends `${infer K}[*][*][*].${infer Rest}`
          ? K extends keyof T
            ? T[K] extends Array<Array<Array<infer U>>>
              ? TypeOfPath<U, Rest>
              : never
            : never
          : Path extends `${infer K}[*][*].${infer Rest}`
            ? K extends keyof T
              ? T[K] extends Array<Array<infer U>>
                ? TypeOfPath<U, Rest>
                : never
              : never
            : Path extends `${infer K}[*].${infer Rest}`
              ? K extends keyof T
                ? T[K] extends Array<infer U>
                  ? TypeOfPath<U, Rest>
                  : never
                : never
              : Path extends `${infer K}.*.${infer Rest}`
                ? K extends keyof T
                  ? T[K] extends Array<infer U>
                    ? TypeOfPath<U, Rest>
                    : never
                  : never
                : Path extends `${infer K}.${infer Rest}`
                  ? K extends keyof T
                    ? T[K] extends Array<infer U>
                      ? TypeOfPath<U, Rest> // Implicit array element access
                      : T[K] extends any // Distribute over union types
                        ? TypeOfPath<T[K], Rest>
                        : never
                    : never
                  : Path extends keyof T
                    ? T[Path]
                    : never;
export type ElementType<T> = T extends Array<infer U> ? U : never;
