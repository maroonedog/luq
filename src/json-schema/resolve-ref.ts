// ===========================================================================
// L8  src/json-schema/resolve-ref.ts — local `$ref` resolution.
//
// Local only, and deliberately so: `$id` base-URI resolution and network
// fetching are both out of scope, and a converter that quietly ignored an
// external `$ref` would build a validator that checks less than the schema
// says. An external reference therefore throws.
//
// The part 1.x got wrong is the CHAIN. Its `resolveRef` returned the first
// target it found, so `#/definitions/a -> {$ref:"#/definitions/b"} ->
// {$ref:"#/definitions/a"}` resolved to a schema that was still a `$ref`; the
// recursive `resolveAllRefs` that DID detect cycles was exported and never
// called from either engine. Here the chain is followed inside this function,
// carrying the pointers already entered, so a cycle is an error, never a hang.
//
// A schema that merely mentions itself under a keyword — the usual recursive
// tree node, `#/definitions/node` appearing inside its own `properties` — is
// NOT a cycle: resolving that pointer terminates at once on a schema object.
// ===========================================================================
import type { Draft07Schema } from "./draft07.types";
import { isDraft07Schema, isSchemaObject } from "./draft07.types";
import { isArray, isPlainObject } from "../types";

export class RefResolutionError extends Error {
  readonly ref: string;

  constructor(ref: string, reason: string) {
    super(`Cannot resolve $ref "${ref}": ${reason}`);
    this.name = "RefResolutionError";
    this.ref = ref;
    // Without this, `instanceof` fails when the package is compiled to ES5.
    Object.setPrototypeOf(this, RefResolutionError.prototype);
  }
}

/** No legitimate document chains this many `$ref`s. See resolveRef. */
const MAX_REF_HOPS = 1000;

/** RFC 6901: `~1` is "/" and `~0` is "~", decoded in that order. */
function decodePointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function toPointerTokens(ref: string): readonly string[] {
  const pointer = ref.slice(1);
  if (pointer === "" || pointer === "/") return [];
  return pointer.split("/").slice(1).map(decodePointerToken);
}

/**
 * `definitions` and `$defs` are the same container to a pointer: a Draft-07
 * document spells it one way, a 2019-09 document the other, and a schema that
 * mixes them (they exist) must still resolve. A real `definitions` member
 * always wins, so a property literally named "definitions" is unaffected.
 */
function stepInto(current: unknown, token: string): unknown {
  if (isArray(current)) return current[Number(token)];
  if (!isPlainObject(current)) return undefined;
  if (token === "definitions" || token === "$defs") {
    return current["definitions"] ?? current["$defs"];
  }
  return current[token];
}

function followPointer(ref: string, root: Draft07Schema): Draft07Schema {
  let current: unknown = root;
  for (const token of toPointerTokens(ref)) {
    current = stepInto(current, token);
    if (current === undefined) {
      throw new RefResolutionError(ref, `no schema at segment "${token}"`);
    }
  }
  if (!isDraft07Schema(current)) {
    throw new RefResolutionError(ref, "the target is not a schema");
  }
  return current;
}

/**
 * Resolves `ref` against `root`, then keeps following `$ref` until it reaches
 * a schema that is not one. `visited` holds the pointers already entered on
 * THIS chain, so `a -> b -> a` throws instead of looping forever.
 */
export function resolveRef(ref: string, root: Draft07Schema): Draft07Schema {
  const visited = new Set<string>();
  let currentRef = ref;
  for (let hop = 0; ; hop += 1) {
    // The visited set is the real cycle detector and gives the good message.
    // This bound is the SECOND line: a synchronous infinite loop cannot be
    // interrupted by a test timeout, so a defect in the detector above must
    // still terminate. Measured: removing the visited check without this made
    // the resolver hang the whole test process instead of failing it.
    if (hop > MAX_REF_HOPS) {
      throw new RefResolutionError(ref, `more than ${MAX_REF_HOPS} $ref hops`);
    }
    if (!currentRef.startsWith("#")) {
      throw new RefResolutionError(
        currentRef,
        "external references are not supported"
      );
    }
    if (visited.has(currentRef)) {
      throw new RefResolutionError(
        ref,
        `circular reference: ${[...visited, currentRef].join(" -> ")}`
      );
    }
    visited.add(currentRef);
    const target = followPointer(currentRef, root);
    if (!isSchemaObject(target) || target.$ref === undefined) return target;
    currentRef = target.$ref;
  }
}

/**
 * True when `ref` resolves without leaving the document and without entering a
 * cycle. It answers the question without making the caller catch to find out.
 */
export function isResolvableRef(ref: string, root: Draft07Schema): boolean {
  try {
    resolveRef(ref, root);
    return true;
  } catch (error) {
    if (error instanceof RefResolutionError) return false;
    throw error;
  }
}
