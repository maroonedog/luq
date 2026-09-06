// ===========================================================================
// L8  src/json-schema/keyword-binding.types.ts  (critique C2)
//
// THE DEFECT THIS FILE EXISTS TO KILL: the legacy converter wrote
// `if (constraints.minItems !== undefined && chain.minItems) chain.minItems(n)`.
// `minItems` is not a chain method, so the constraint silently evaporated. A
// runtime assert against a manifest does not catch that at build time, so the
// method identifier is a STRING LITERAL TYPE here, constrained by
// `keyof SlotPlugins<JsonSchemaBag, S>`. Binding a keyword to a method that
// does not exist is a compile error, not a silent no-op.
//
// FIX (the reason this file was rewritten): `KeywordBinding` no longer derives
// `pluginName` or the argument tuple from the registry. Inside a generic
// function neither S nor M is concrete, so tsc could not connect
// `NameOf<BoundPlugin<S, M>>` to the plugin in hand and reported TS2322 twice.
// The identifiers are TYPE PARAMETERS now; the registry lookups moved to the
// consumer-side aliases `BindingForMethod` / `AnyKeywordBinding`, where S and M
// are concrete and resolve.
//
// LAYERING: L8. The plugin-isolation checker must not treat src/json-schema/**
// (outside src/json-schema/extensions/**) as a plugin directory (A-14).
// ===========================================================================
import type { TypeName } from "../types";
import type {
  ArgsOf,
  BindableMethod,
  BoundMethod,
  BoundPlugin,
  NameOf,
} from "./json-schema-bag.types";

/**
 * One JSON Schema keyword bound to one chain method.
 *
 * Nothing here is looked up in the plugin registry: every identifier arrives as
 * a type argument, inferred by `bindKeyword` from the plugin object itself.
 * `M extends BoundMethod<S>` is the ONLY registry contact, and it is a
 * constraint (a gate), not a derivation (a computation) — which is what lets
 * the type be written by hand and still be checked.
 */
export interface KeywordBinding<
  S extends TypeName,
  M extends BoundMethod<S>,
  TName extends string,
  TArgs extends readonly unknown[],
  V,
> {
  readonly handling: "bind";
  readonly slot: S;
  readonly method: M;
  readonly pluginName: TName;
  toArguments(keywordValue: V): TArgs;
}

/** Consumer-side alias: S and M are concrete here, so the registry resolves. */
export type BindingForMethod<
  S extends TypeName,
  M extends BoundMethod<S>,
  V,
> = KeywordBinding<
  S,
  M,
  NameOf<BoundPlugin<S, M>>,
  ArgsOf<BoundPlugin<S, M>>,
  V
>;

/** Any binding a Draft-07 keyword may legally hold: reachable and marker-free. */
export type AnyKeywordBinding<V = never> = {
  [S in TypeName]: {
    [M in BindableMethod<S> & BoundMethod<S>]: BindingForMethod<S, M, V>;
  }[BindableMethod<S> & BoundMethod<S>];
}[TypeName];

/** The keyword shapes the CONVERTER handles itself (recursion, slot choice). */
export interface StructuralKeyword {
  readonly handling: "structural";
  readonly note: string;
}

/** Declared out of scope, in writing. The legacy code just ignored these. */
export interface UnsupportedKeyword {
  readonly handling: "unsupported";
  readonly reason: string;
}

export type KeywordHandlingFor<V> =
  | AnyKeywordBinding<V>
  | StructuralKeyword
  | UnsupportedKeyword;
