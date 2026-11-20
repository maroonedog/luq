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

interface SlotInputs {
  string: string;
  number: number;
  boolean: boolean;
  date: Date;
  array: readonly unknown[];
  tuple: readonly unknown[];
  object: object;
  union: unknown;
  any: unknown;
}

export type FieldSlots<TRoot, B extends PluginBag, TField> = {
  readonly [S in keyof SlotInputs]: Slot<B, S, TRoot, TField, SlotInputs[S]>;
};

/** A standalone declaration chooses its input by selecting a slot. */
export type FieldRuleSlots<B extends PluginBag> = {
  readonly [S in keyof SlotInputs]: FieldChain<
    B,
    S,
    unknown,
    SlotInputs[S],
    OpenState
  >;
};
