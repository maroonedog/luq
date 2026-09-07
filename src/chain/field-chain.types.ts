import type { TypeName } from "../types";
import type { PluginBag, SlotPlugins } from "./plugin-bag.types";
import type { ChainState } from "./chain-state.types";
import type { ChainMethod } from "./chain-method.types";
import type { RefineMethods } from "./refine-methods.types";

/** The phantom is REQUIRED, not optional. */
export interface ChainMarks<TValue, TState extends ChainState> {
  readonly value: TValue;
  readonly state: TState;
}

export type FieldChain<
  B extends PluginBag,
  S extends TypeName,
  TRoot,
  TValue,
  TState extends ChainState,
> = {
  readonly [M in keyof SlotPlugins<B, S>]: ChainMethod<
    SlotPlugins<B, S>[M],
    B,
    S,
    TRoot,
    TValue,
    TState
  >;
} & RefineMethods<B, TRoot, TValue, TState> & {
    readonly __chain: ChainMarks<TValue, TState>;
  };

/** `ChainMarks<unknown, ChainState>`, never `ChainMarks<never, ...>`. */
export interface AnyChain {
  readonly __chain: ChainMarks<unknown, ChainState>;
}

export type ChainOutput<C> = C extends {
  readonly __chain: ChainMarks<infer V, ChainState>;
}
  ? V
  : never;
export type ChainStateOf<C> = C extends {
  readonly __chain: ChainMarks<unknown, infer St>;
}
  ? St
  : never;
