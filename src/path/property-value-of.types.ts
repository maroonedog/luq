// L1  src/path/property-value-of.types.ts
// The subject of a PROPERTY-VALUE sub-chain, the sibling of ElementOf.
// ElementOf<T> answers "what is inside this array"; PropertyValueOf<T> answers
// "what is behind any key of this object". objectPatternProperties,
// objectAdditionalProperties (schema form) and any future map-shaped keyword
// need the second question, and NOTHING in L1 could answer it before: the
// marker registry had no way to name that subject, so those plugins had to
// borrow ElementChain, which resolves to `never` for an object and turns every
// slot on the sub-builder into SlotTypeMismatch.
import type { IsOpaqueObject } from "./opaque-object.types";

export type PropertyValueOf<T> = unknown extends T
  ? unknown
  : NonNullable<T> extends infer U
    ? U extends readonly unknown[]
      ? never
      : IsOpaqueObject<U> extends true
        ? never
        : U extends object
          ? U[Extract<keyof U, string>]
          : never
    : never;
