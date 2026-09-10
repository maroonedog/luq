// ===========================================================================
// L10 src/standard-schema/declaration-recorder.ts — keeps the declared calls.
//
// The record is held per node in a WeakMap, so it lives exactly as long as the
// node does and adds no member to anything.
//
// **It appends; it never rewrites.** The parent's record is only read, and the
// child gets a new array. Two chains branched from one node therefore cannot
// contaminate each other, and reusing an assembled node somewhere else cannot
// move what was already recorded for it.
// ===========================================================================
import type { TypeName } from "../types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { DeclaredCall } from "../chain/declared-call.types";
import {
  installDeclarationRecorder,
  type DeclarationRecorder,
} from "../chain/declaration-recorder.port";

const NONE: readonly DeclaredCall[] = Object.freeze([]);

const callsByNode = new WeakMap<object, readonly DeclaredCall[]>();

const recorder: DeclarationRecorder = {
  record(
    parent: object,
    child: object,
    plugin: AnyPlugin,
    slot: TypeName,
    args: readonly unknown[]
  ): void {
    callsByNode.set(child, [
      ...(callsByNode.get(parent) ?? NONE),
      { pluginName: plugin.name, method: plugin.method, slot, args },
    ]);
  },
  inherit(parent: object, child: object): void {
    const calls = callsByNode.get(parent);
    if (calls !== undefined) callsByNode.set(child, calls);
  },
  read(node: object): readonly DeclaredCall[] | undefined {
    return callsByNode.get(node);
  },
};

/**
 * Idempotent. Call it at module scope, never from inside a function: the
 * recorder has to be in place before any chain runs, and hiding the call
 * behind a function makes that ordering depend on who calls it first.
 */
export function installJsonSchemaDeclarationRecorder(): void {
  installDeclarationRecorder(recorder);
}
