import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { FieldPath } from "../path/field-path.types";
import type { ValueAtPath } from "../path/value-at-path.types";
import type { MissingLeafPaths } from "../path/leaf-path.types";
import type { BagEntry, PluginBag } from "../chain/plugin-bag.types";
import type {
  AnyChain,
  ChainOutput,
  ChainStateOf,
} from "../chain/field-chain.types";
import type { FieldSlots } from "../chain/field-slots.types";
import type {
  UncoveredMembers,
  UnionGuardCoverageError,
} from "../chain/chain-state.types";
import type { GlobalConfig } from "../types/global-config";
import type { Validator } from "./validator.types";

export type UncoveredOf<C> = UncoveredMembers<ChainOutput<C>, ChainStateOf<C>>;

export interface MissingFieldsError<TMissing> {
  readonly luqError: "missingFieldDeclarations";
  readonly message: "Declare every leaf path, or drop .strict().";
  readonly missing: TMissing;
}

export interface FieldBuilder<
  T extends object,
  B extends PluginBag,
  TDeclared extends string,
> {
  v<K extends FieldPath<T> & string, C extends AnyChain>(
    path: K,
    define: (b: FieldSlots<T, B, ValueAtPath<T, K>>) => C
  ): [UncoveredOf<C>] extends [never]
    ? FieldBuilder<T, B, TDeclared | K>
    : UnionGuardCoverageError<K, UncoveredOf<C>>;

  strict(): [MissingLeafPaths<T, TDeclared>] extends [never]
    ? FieldBuilder<T, B, TDeclared>
    : MissingFieldsError<MissingLeafPaths<T, TDeclared>>;

  build(): Validator<T>;
}

export interface Builder<B extends PluginBag = Record<never, never>> {
  // NB: the intersection is written INLINE.
  use<P extends AnyPlugin>(plugin: P): Builder<B & BagEntry<P>>;
  /**
   * The per-builder override of the process-wide GlobalConfig. Merged over
   * getGlobalConfig() once, at build(), and handed to every plugin as
   * RuleBuildContext.config.
   */
  withConfig(config: GlobalConfig): Builder<B>;
  for<T extends object>(): FieldBuilder<T, B, never>;
}

declare function createBuilder(): Builder;
export const Builder: () => Builder = createBuilder;
