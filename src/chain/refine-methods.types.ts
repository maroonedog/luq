// ===========================================================================
// L3  src/chain/refine-methods.types.ts
// RESIDUAL 4 / item 2 — the refine* family, restored.
//
// WHAT IT IS. Measured in the legacy tree, not guessed:
//   src/core/builder/plugins/plugin-types.ts:722-785 (ChainableFieldBuilderBase)
//   is the LIVE definition; it declares exactly eight methods —
//   refineString / refineNumber / refineBoolean / refineArray /
//   refineObject / refineTuple / refineUnion / refineDate —
//   each `(): ChainableFieldBuilder<TObject, TPlugins, <newSlot>, TCurrentType,
//   TTypeState>`. Note what does and does not move: the SLOT changes, the
//   value type and the type-state do NOT. (plugin-types.ts:192-260's
//   CanRefineToType variant is the dead second system anti-patterns.md names;
//   it is not revived.)
//
// WHY THE VALUE TYPE MUST NOT MOVE. This is the JSON Schema case the critique
// pointed at: `type: ["string","number"]` compiles to ONE linear chain that has
// to carry string keywords and then number keywords. If refine narrowed TValue
// to the refined base, `.refineString()` would leave TValue = string and the
// following `.refineNumber()` would be a slot mismatch — the exact schema this
// mechanism exists for would stop compiling. Verified as a fixture.
//
// WHAT IS NEW. Legacy let you refine anywhere, so `b.string...refineDate()`
// silently produced a Date chain over a string. Here the same SlotAccepts test
// that guards `b.<slot>` guards refine, and a refine the field type cannot
// reach resolves to SlotTypeMismatch — consistent with the .strict() decision
// to return a readable error object rather than `never`.
// ===========================================================================
import type { TypeName } from "../types";
import type { PluginBag } from "./plugin-bag.types";
import type { ChainState } from "./chain-state.types";
import type { FieldChain } from "./field-chain.types";
import type { SlotAccepts, SlotTypeMismatch } from "./slot-value.types";

type Refine<
  B extends PluginBag,
  S extends TypeName,
  TRoot,
  TValue,
  TState extends ChainState,
  TBase,
> =
  SlotAccepts<TValue, TBase> extends true
    ? () => FieldChain<B, S, TRoot, TValue, TState>
    : SlotTypeMismatch<S, TValue>;

/**
 * Present on EVERY chain, exactly as in 1.x. Declared as an interface so the
 * mutual reference with FieldChain stays deferred instead of expanding.
 */
export interface RefineMethods<
  B extends PluginBag,
  TRoot,
  TValue,
  TState extends ChainState,
> {
  readonly refineString: Refine<B, "string", TRoot, TValue, TState, string>;
  readonly refineNumber: Refine<B, "number", TRoot, TValue, TState, number>;
  readonly refineBoolean: Refine<B, "boolean", TRoot, TValue, TState, boolean>;
  readonly refineDate: Refine<B, "date", TRoot, TValue, TState, Date>;
  readonly refineArray: Refine<
    B,
    "array",
    TRoot,
    TValue,
    TState,
    readonly unknown[]
  >;
  readonly refineTuple: Refine<
    B,
    "tuple",
    TRoot,
    TValue,
    TState,
    readonly unknown[]
  >;
  readonly refineObject: Refine<B, "object", TRoot, TValue, TState, object>;
  readonly refineUnion: Refine<B, "union", TRoot, TValue, TState, unknown>;
}

/** The eight names, as a value-level closed set the runtime shares. */
export const REFINE_METHOD_SLOTS = {
  refineString: "string",
  refineNumber: "number",
  refineBoolean: "boolean",
  refineDate: "date",
  refineArray: "array",
  refineTuple: "tuple",
  refineObject: "object",
  refineUnion: "union",
} as const satisfies Readonly<
  Record<keyof RefineMethods<PluginBag, unknown, unknown, ChainState>, TypeName>
>;

export type RefineMethodName = keyof typeof REFINE_METHOD_SLOTS;
