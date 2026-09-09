import type {
  AnyPlugin,
  PluginDefinition,
  PluginSignature,
} from "../plugin-kit/plugin-definition";
import type { TypeName } from "../types";

// NOTE: there is deliberately NO `AddToBag<B, P> = B & BagEntry<P>` alias.
export type PluginBag = Readonly<Record<string, AnyPlugin>>;

export type BagEntry<P> =
  P extends PluginDefinition<
    infer TName,
    string,
    readonly TypeName[],
    PluginSignature
  >
    ? { readonly [K in TName]: P }
    : never;

export type SlotPlugins<B extends PluginBag, S extends TypeName> = {
  [
    K in keyof B as S extends B[K]["slots"][number] ? B[K]["method"] : never
  ]: B[K];
};
