// ===========================================================================
// L3  src/chain/declaration-recorder.port.ts — the port for keeping a record.
//
// The chain keeps no record of what was called with what. A compiled rule holds
// the closure and not the argument, so `.min(3)`'s 3 is gone by the time the
// rule exists — and whoever needs that 3 back has to ask for it BEFORE the
// chain runs. Asking is installing a recorder here.
//
// With none installed the chain builds no record object and copies no record
// array; every chain step costs one null check instead. That is the whole point
// of inverting this: keeping the record is not something the chain needs, so
// the chain does not decide to do it.
//
// Installing has to happen before the chain runs, because the record is made as
// the chain is walked and cannot be reconstructed afterwards. Nothing here can
// enforce that ordering; what it can do is make the absence unmistakable, so a
// missing recorder yields no record rather than an empty one.
// ===========================================================================
import type { TypeName } from "../types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { DeclaredCall } from "./declared-call.types";

/**
 * Only the parent-to-child relation between nodes crosses this line; how the
 * record is held is the implementation's business. Nothing passed here is
 * built for the occasion — the plugin, the slot and the arguments are all
 * already in hand for building the rule.
 */
export interface DeclarationRecorder {
  /**
   * `child`'s record is `parent`'s with one call appended. Called once, by
   * whoever made the node, immediately after freezing it.
   */
  record(
    parent: object,
    child: object,
    plugin: AnyPlugin,
    slot: TypeName,
    args: readonly unknown[]
  ): void;
  /** A refine step adds no call. It carries the record across unchanged. */
  inherit(parent: object, child: object): void;
  /** The calls declared up to that node, or undefined when there are none. */
  read(node: object): readonly DeclaredCall[] | undefined;
}

/**
 * Null until someone installs. Exposed as the binding rather than behind a
 * getter because that measured smaller: with no installer reachable, what
 * survives minification is one `let` and an optional chain.
 */
export let declarationRecorder: DeclarationRecorder | null = null;

/**
 * Called once, when the implementation is loaded. A second call overwrites,
 * which is harmless while there is one implementation.
 */
export function installDeclarationRecorder(
  recorder: DeclarationRecorder | null
): void {
  declarationRecorder = recorder;
}
