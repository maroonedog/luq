// ===========================================================================
// L3  src/chain/collect-field-rules.ts
//
// The ONE place a field's `define` callback is executed. It runs exactly once,
// against one freshly built `b`, and the ordered rule list it produced is
// frozen and handed on to L4. Nothing downstream ever calls it again, so a
// callback with a side effect cannot fire twice.
//
// What was called with what comes from that same single run, for the same
// reason: running the callback twice would fire its side effects twice, so
// this is the only place it can be read. The chain does not keep that record
// itself — see declaration-recorder.port.ts.
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";
import type { PluginBag } from "./plugin-bag.types";
import type { AnyChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";
import type { ChainBuildContext } from "./create-chain-node";
import { readChainNode } from "./chain-node-store";
import { declarationRecorder } from "./declaration-recorder.port";
import type { DeclaredCall } from "./declared-call.types";
import { createFieldSlots } from "./create-field-slots";

/** What the single run produced: rules for the runtime, calls for a writer. */
export interface FieldChainOutcome {
  readonly rules: readonly Rule[];
  /**
   * null means no record was kept, which is not the empty list's "nothing was
   * declared". Collapsing the two lets a writer return a schema with no
   * constraints and no idea that it is missing them.
   */
  readonly calls: readonly DeclaredCall[] | null;
}

export class FieldChainResultError extends Error {
  constructor(readonly fieldPath: string) {
    super(
      `The definition of "${fieldPath}" did not return a chain. End it on a ` +
        `slot method, for example \`(b) => b.string.required()\`.`
    );
    this.name = "FieldChainResultError";
  }
}

export function collectFieldRules<TRoot, B extends PluginBag, TField>(
  bag: B,
  context: ChainBuildContext,
  define: (b: FieldSlots<TRoot, B, TField>) => AnyChain
): FieldChainOutcome {
  const chain = define(createFieldSlots<TRoot, B, TField>(bag, context));
  const rules = readChainNode(chain);
  if (rules === undefined) throw new FieldChainResultError(context.fieldPath);
  const recorder = declarationRecorder;
  return Object.freeze({
    rules: Object.freeze(rules.slice()),
    calls:
      recorder === null
        ? null
        : Object.freeze((recorder.read(chain) ?? []).slice()),
  });
}
