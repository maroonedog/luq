import type { TypeName } from "../types";
import type { PluginBag, SlotPlugins } from "./plugin-bag.types";
import type { ChainState } from "./chain-state.types";
import type {
  PluginDefinition,
  PluginSignature,
} from "../plugin-kit/plugin-definition";
import type { TransformOut } from "../plugin-kit/marker.types";
import type { ChainMethod } from "./chain-method.types";
import type { RefineMethods } from "./refine-methods.types";
import type { SlotCatalog } from "./slot-catalog.generated";
import type { CheckAfterTransform } from "./plugin-not-imported.types";

/** The phantom is REQUIRED, not optional. */
export interface ChainMarks<TValue, TState extends ChainState> {
  readonly value: TValue;
  readonly state: TState;
}

/**
 * Every method this slot offers that this builder did not import.
 *
 * An `Omit`, so a method the bag DOES carry keeps its real signature: the key
 * is removed from this half before the intersection, and the two halves can
 * never describe the same method.
 */
type NotImported<B extends PluginBag, S extends TypeName> = Omit<
  SlotCatalog[S],
  keyof SlotPlugins<B, S>
>;

/** Whether a plugin's method replaces the value rather than judging it. */
type IsTransform<P> =
  P extends PluginDefinition<
    string,
    string,
    readonly TypeName[],
    infer Sig extends PluginSignature
  >
    ? [Sig["out"]] extends [TransformOut]
      ? true
      : false
    : false;

/**
 * The method names a chain still offers.
 *
 * Everything, until a transform has been declared; after that, only further
 * transforms. A check written past a transform would run BEFORE it — the
 * runtime order is fixed and is not the written one — so the reading and the
 * behaviour disagree, and the disagreement is invisible. The name is removed
 * rather than deprecated because there is no correct way to call it.
 */
/**
 * Every check the slot offers, resolved to a refusal that says why.
 *
 * Intersected in only when the chain has been transformed, so an ordinary
 * chain carries none of it and the names keep their real signatures.
 */
type ClosedAfterTransform<B extends PluginBag, S extends TypeName> = {
  readonly [
    M in keyof SlotPlugins<B, S> as IsTransform<
      SlotPlugins<B, S>[M]
    > extends true
      ? never
      : M
  ]: CheckAfterTransform<M & string>;
};

export type FieldChain<
  B extends PluginBag,
  S extends TypeName,
  TRoot,
  TValue,
  TState extends ChainState,
> = {
  readonly [
    M in keyof SlotPlugins<B, S> as TState["transformed"] extends true
      ? IsTransform<SlotPlugins<B, S>[M]> extends true
        ? M
        : never
      : M
  ]: ChainMethod<SlotPlugins<B, S>[M], B, S, TRoot, TValue, TState>;
} & (TState["transformed"] extends true
  ? ClosedAfterTransform<B, S>
  : unknown) &
  NotImported<B, S> &
  RefineMethods<B, TRoot, TValue, TState> & {
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
