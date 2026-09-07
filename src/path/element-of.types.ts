export type ElementOf<T> = unknown extends T
  ? unknown
  : NonNullable<T> extends infer U
    ? U extends readonly (infer E)[]
      ? E
      : never
    : never;
