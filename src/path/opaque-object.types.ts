/** Built-in and callable object types whose members are implementation, not
 *  data. FieldPath (generator) and ValueAtPath (resolver) both read this, so
 *  the two directions cannot disagree about where a path stops. */
export type OpaqueObject =
  | Date
  | RegExp
  | Error
  | Promise<unknown>
  | ReadonlyMap<unknown, unknown>
  | ReadonlySet<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>
  | ArrayBuffer
  | SharedArrayBuffer
  | ArrayBufferView
  | ((...args: never[]) => unknown)
  | (abstract new (...args: never[]) => unknown);

export type IsOpaqueObject<T> = [T] extends [never]
  ? false
  : [NonNullable<T>] extends [OpaqueObject]
    ? true
    : false;
