// ===========================================================================
// L8  src/json-schema/resolve-ref.ts — `$ref` resolution.
//
// A `$ref` is a URI REFERENCE, not a pointer into the current file: `$id`
// moves the base, so the same string can name different places depending on
// where it was written. uri-reference.ts does that arithmetic and
// schema-registry.ts holds the index; ref-scope.ts carries where we are.
//
// Luq still never FETCHES. A reference that leaves the documents the caller
// supplied throws, because a converter that quietly ignored it would build a
// validator that checks less than the schema says.
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
import { RefResolutionError } from "./ref-resolution-error";
import { isDraft07Schema, isSchemaObject } from "./draft07.types";
import { advanceBase } from "./collect-definitions";
import { walkPointer } from "./follow-json-pointer";
import type { RefScope } from "./ref-scope";
import { createLocalScope } from "./ref-scope";
import { resolveUriReference, splitUri } from "./uri-reference";

/** No legitimate document chains this many `$ref`s. See resolveRef. */
const MAX_REF_HOPS = 1000;

function followPointer(
  ref: string,
  fragment: string,
  scope: RefScope
): { schema: Draft07Schema; scope: RefScope } {
  const walked = walkPointer(
    fragment,
    scope.document,
    scope,
    (at, node) =>
      isDraft07Schema(node) && isSchemaObject(node)
        ? advanceBase(at, node)
        : at,
    (token) => {
      throw new RefResolutionError(ref, `no schema at segment "${token}"`);
    }
  );
  if (!isDraft07Schema(walked.node)) {
    throw new RefResolutionError(ref, "the target is not a schema");
  }
  return { schema: walked.node, scope: walked.scope };
}

/** True for `#name`: a plain-name fragment, which names rather than locates. */
function isPlainNameFragment(fragment: string): boolean {
  return fragment !== "" && !fragment.startsWith("/");
}

/** What one hop produced: the node named, and the scope it lives in. */
interface RefStep {
  readonly schema: Draft07Schema;
  readonly scope: RefScope;
}

/**
 * One hop. The returned scope's `document` is the RESOURCE the target was
 * found in, never the target itself — otherwise `a -> b` would resolve `b`
 * against the node `a` names, and a two-link chain of local pointers stops
 * finding anything after the first hop.
 */
function stepRef(ref: string, scope: RefScope): RefStep {
  const absolute = resolveUriReference(scope.baseUri, ref);
  const { resource, fragment } = splitUri(absolute);
  if (isPlainNameFragment(fragment)) {
    const named = scope.registry.findIdentified(absolute);
    if (named === undefined) {
      throw new RefResolutionError(ref, `no schema is named "${absolute}"`);
    }
    return {
      schema: named.schema,
      scope: {
        registry: scope.registry,
        document: named.document,
        baseUri: named.baseUri,
      },
    };
  }
  const target = resolveResource(ref, resource, scope);
  // The RESOURCE's retrieval URI wins over any `$id` the document carries —
  // "retrieved nested refs resolve relative to their URI not $id" in the
  // suite is exactly that. Every `$id` INSIDE it still counts, and
  // followPointer collects them as it walks.
  const landed: RefScope = {
    registry: scope.registry,
    document: target.document,
    baseUri: target.baseUri,
  };
  return followPointer(ref, fragment, landed);
}

/**
 * The DOCUMENT a resource URI names. An empty resource is "the document this
 * reference was written in", which is what makes `#/definitions/x` local.
 */
function resolveResource(
  ref: string,
  resource: string,
  scope: RefScope
): { document: Draft07Schema; baseUri: string } {
  if (resource === "" || resource === scope.baseUri) {
    return { document: scope.document, baseUri: scope.baseUri };
  }
  const identified = scope.registry.findIdentified(resource);
  if (identified === undefined || !isSchemaObject(identified.document)) {
    // The one place an external reference is refused, and it is refused for
    // ONE reason: nobody handed Luq that document. Luq does not go and get it.
    throw new RefResolutionError(
      ref,
      `"${resource}" was not supplied. Luq never fetches a schema; pass it ` +
        "in externalDocuments."
    );
  }
  return { document: identified.document, baseUri: identified.baseUri };
}

/**
 * Resolves `ref` in `scope`, then keeps following `$ref` until it reaches a
 * schema that is not one. `visited` holds the ABSOLUTE URIs already entered on
 * THIS chain, so `a -> b -> a` throws instead of looping forever — absolute,
 * because two different bases can spell the same target differently and a
 * relative comparison would miss the cycle.
 */
export function resolveRefInScope(
  ref: string,
  scope: RefScope
): { schema: Draft07Schema; scope: RefScope } {
  const visited = new Set<string>();
  let current = scope;
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
    const absolute = resolveUriReference(current.baseUri, currentRef);
    if (visited.has(absolute)) {
      throw new RefResolutionError(
        ref,
        `circular reference: ${[...visited, absolute].join(" -> ")}`
      );
    }
    visited.add(absolute);
    const step = stepRef(currentRef, current);
    current = step.scope;
    if (!isSchemaObject(step.schema) || step.schema.$ref === undefined) {
      return { schema: step.schema, scope: current };
    }
    currentRef = step.schema.$ref;
  }
}

/** The local-only door, kept for callers that have nothing but a root. */
export function resolveRef(ref: string, root: Draft07Schema): Draft07Schema {
  return resolveRefInScope(ref, createLocalScope(root)).schema;
}

/**
 * True when `ref` resolves without leaving what the caller supplied and
 * without entering a cycle. It answers the question without making the caller
 * catch to find out.
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
