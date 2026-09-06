import type { MessageContextExtra, TypeName } from "../types";
import type { RuleForOut, RuntimeArgs } from "./runtime-args.types";
import type { RuleBuildContext } from "./rule-build-context";

/** TOut defaults to `unknown`, NOT to `Unchanged`. */
export interface PluginSignature<
  TArgs extends readonly unknown[] = readonly unknown[],
  TOut = unknown,
  TContext extends MessageContextExtra = MessageContextExtra,
> {
  readonly args: TArgs;
  readonly out: TOut;
  readonly context: TContext;
}

export type PluginBuild<TSig extends PluginSignature> = (
  ctx: RuleBuildContext<TSig["context"]>,
  ...args: RuntimeArgs<TSig["args"]>
) => RuleForOut<TSig["out"]>;

export interface PluginDefinition<
  TName extends string,
  TMethod extends string,
  TSlots extends readonly TypeName[],
  TSig extends PluginSignature,
> {
  readonly name: TName;
  readonly method: TMethod;
  readonly slots: TSlots;
  // Declared as a METHOD so its parameters stay bivariant.
  build(
    ctx: RuleBuildContext<TSig["context"]>,
    ...args: RuntimeArgs<TSig["args"]>
  ): RuleForOut<TSig["out"]>;
  readonly signature?: TSig;
}

export type AnyPlugin = PluginDefinition<
  string,
  string,
  readonly TypeName[],
  PluginSignature
>;

export interface PluginSpec<
  TName extends string,
  TMethod extends string,
  TSlots extends readonly TypeName[],
  TSig extends PluginSignature,
> {
  readonly name: TName;
  readonly method: TMethod;
  readonly slots: TSlots;
  readonly build: PluginBuild<TSig>;
}

/** Curried: the signature is explicit, the identity literals are inferred. */
export function definePlugin<TSig extends PluginSignature>(): <
  TName extends string,
  TMethod extends string,
  TSlots extends readonly TypeName[],
>(
  spec: PluginSpec<TName, TMethod, TSlots, TSig>
) => PluginDefinition<TName, TMethod, TSlots, TSig> {
  return (spec) => ({
    name: spec.name,
    method: spec.method,
    slots: spec.slots,
    build: spec.build,
  });
}

export type PluginArgs<P> =
  P extends PluginDefinition<string, string, readonly TypeName[], infer Sig>
    ? Sig["args"]
    : never;

export type PluginOut<P> =
  P extends PluginDefinition<string, string, readonly TypeName[], infer Sig>
    ? Sig["out"]
    : never;

export class PluginArgumentError extends Error {
  constructor(pluginName: string, argumentName: string, received: unknown) {
    super(
      `${pluginName}: invalid argument "${argumentName}": ${String(received)}`
    );
    this.name = "PluginArgumentError";
  }
}
