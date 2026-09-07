import type { TypeName } from "../types";
import type { PluginBag } from "./plugin-bag.types";
import type { OpenState } from "./chain-state.types";
import type { FieldChain } from "./field-chain.types";
import type {
  SlotAccepts,
  SlotTypeMismatch,
  SlotValue,
} from "./slot-value.types";

type Slot<B extends PluginBag, S extends TypeName, TRoot, TField, TBase> =
  SlotAccepts<TField, TBase> extends true
    ? FieldChain<B, S, TRoot, SlotValue<TField, TBase>, OpenState>
    : SlotTypeMismatch<S, TField>;

export interface FieldSlots<TRoot, B extends PluginBag, TField> {
  readonly string: Slot<B, "string", TRoot, TField, string>;
  readonly number: Slot<B, "number", TRoot, TField, number>;
  readonly boolean: Slot<B, "boolean", TRoot, TField, boolean>;
  readonly date: Slot<B, "date", TRoot, TField, Date>;
  readonly array: Slot<B, "array", TRoot, TField, readonly unknown[]>;
  readonly tuple: Slot<B, "tuple", TRoot, TField, readonly unknown[]>;
  readonly object: Slot<B, "object", TRoot, TField, object>;
  readonly union: Slot<B, "union", TRoot, TField, unknown>;
  readonly any: Slot<B, "any", TRoot, TField, unknown>;
}
