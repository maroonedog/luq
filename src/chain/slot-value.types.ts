import type { TypeName } from "../types";

type IsUnknown<T> = unknown extends T ? true : false;

/** True when TField can legally be addressed through a slot based on TBase. */
export type SlotAccepts<TField, TBase> =
  IsUnknown<TField> extends true
    ? true
    : [Extract<NonNullable<TField>, TBase>] extends [never]
      ? false
      : true;

/** The TValue a slot hands its chain. */
export type SlotValue<TField, TBase> =
  IsUnknown<TField> extends true
    ? TBase | undefined
    : Extract<TField, TBase | null | undefined>;

/** What a slot resolves to when the field type cannot flow through it. */
export interface SlotTypeMismatch<S extends TypeName, TField> {
  readonly luqError: "slotTypeMismatch";
  readonly message: "This field's declared type cannot be validated through this slot.";
  readonly slot: S;
  readonly fieldType: TField;
}
