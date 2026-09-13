import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { FieldPath } from "../path/field-path.types";
import type { ValueAtPath } from "../path/value-at-path.types";
import type {
  ApplyParsedOverrides,
  ParsedOverride,
  RecordParsedOverride,
} from "../path/write-at-path.types";
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
import { createBuilder } from "./create-builder";
import type { FieldOptions } from "./field-options.types";
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
  /**
   * The fields whose chain leaves a different type behind than it was given.
   *
   * Empty for a builder that declares no transform, which is nearly all of
   * them, and `build()` then returns `Validator<T>` exactly as before. What it
   * fixes when it is NOT empty: `parse()` applies the transforms and hands
   * back the transformed value, and its type used to say otherwise.
   */
  TParsed extends readonly ParsedOverride[] = readonly [],
> {
  /**
   * `options` is a FIELD CONFIGURATION and never a Rule; it is where a default
   * is declared. See ./field-options.types.ts.
   */
  v<K extends FieldPath<T> & string, C extends AnyChain>(
    path: K,
    define: (b: FieldSlots<T, B, ValueAtPath<T, K>>) => C,
    options?: FieldOptions<ValueAtPath<T, K>>
  ): [UncoveredOf<C>] extends [never]
    ? FieldBuilder<
        T,
        B,
        TDeclared | K,
        RecordParsedOverride<TParsed, K, ValueAtPath<T, K>, ChainOutput<C>>
      >
    : UnionGuardCoverageError<K, UncoveredOf<C>>;

  strict(): [MissingLeafPaths<T, TDeclared>] extends [never]
    ? FieldBuilder<T, B, TDeclared, TParsed>
    : MissingFieldsError<MissingLeafPaths<T, TDeclared>>;

  build(): Validator<T, ApplyParsedOverrides<T, TParsed>>;
}

export interface Builder<B extends PluginBag = Record<never, never>> {
  // NB: the intersection is written INLINE.
  use<P extends AnyPlugin>(plugin: P): Builder<B & BagEntry<P>>;
  /**
   * A whole SET of plugins at once — a preset, or any object of them.
   *
   * A bag is a name -> plugin map, so a preset is that value and nothing more;
   * there is no registry and no preset type to learn. `use()` one at a time
   * still works and still costs only what it names, which is the point of the
   * subpaths — this is for the case where writing fifteen `use()` lines is the
   * thing standing between you and the validator.
   *
   * Duplicates follow the same rule as `use()`: FIRST WINS, so a preset cannot
   * quietly replace a plugin you already registered.
   */
  useAll<Bag extends PluginBag>(plugins: Bag): Builder<B & Bag>;
  /**
   * The per-builder override of the process-wide GlobalConfig. Merged over
   * getGlobalConfig() once, at build(), and handed to every plugin as
   * RuleBuildContext.config.
   */
  withConfig(config: GlobalConfig): Builder<B>;
  for<T extends object>(): FieldBuilder<T, B, never>;
}

/**
 * THE SINGLE PUBLIC ENTRY POINT. It is declared here, beside the interface it
 * merges with, so `Builder` names both the value and the type; the
 * implementation lives in ./create-builder.ts and is reached by a value import,
 * while that module reaches back for a TYPE only — one runtime edge, no cycle.
 */
export const Builder: () => Builder = createBuilder;
