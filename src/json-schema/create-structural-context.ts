// ===========================================================================
// L8  src/json-schema/create-structural-context.ts — what an expansion may
// reach, and the knot that lets the conversion recurse without a cycle.
//
// ONE CONTEXT PER SCHEMA NODE, not one per field. `declaredSiblingKeys` is that
// node's own `properties` keys, because objectAdditionalProperties reads its
// allowed set from there: a sub-schema inside a branch must not inherit the
// outer field's declared children, or `additionalProperties: false` would judge
// the wrong key set.
//
// `collectSubSchemaRules` and `toBranch` are handed in rather than imported by
// the expansions, so compose-keyword can convert its own arms while
// schema-to-declarations can dispatch to compose-keyword: the two would import
// each other otherwise. This module is the single supplier of both.
//
// `visitedRefs` is the recursion guard. A `$ref` that comes round a second time
// on the same branch is a RECURSIVE definition; its expansion does not
// terminate, so the sub-schema converter stops there and the node keeps only
// the rules it already has. objectRecursively is the plugin for that shape and
// it is not in the JSON Schema bag.
// ===========================================================================
import type { ChainBuildContext } from "../chain/create-chain-node";
import type { Rule } from "../plugin-kit/compiled-rule";
import type { RuleBuildContext } from "../plugin-kit/rule-build-context";
import type { MessageContextExtra } from "../types";
import {
  readRefPointer,
  resolveSchemaNodeInScope,
} from "./collect-definitions";
import type { RefScope } from "./ref-scope";
import {
  collectSubSchemaRules,
  toSchemaBranch,
} from "./collect-sub-schema-rules";
import type { Draft07Schema, Draft07SchemaObject } from "./draft07.types";
import type { JsonSchemaBag } from "./json-schema-bag.types";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);

/**
 * How many times one `$ref` may be entered on a single branch of the
 * conversion, and how much expansion the whole conversion may do.
 *
 * A recursive definition has infinitely many declared paths and Luq declares
 * finite ones, so SOMETHING has to stop. It used to stop at the FIRST repeat,
 * which is why a mutually recursive schema (tree -> node -> tree) checked only
 * two levels and silently accepted anything deeper.
 *
 * Unrolling further is exponential in the number of mutually recursive
 * definitions, and the measurement says so plainly. A three-way cycle
 * (a -> b -> c -> a, each also naming the others) builds in:
 *
 *     1 unroll    17 ms      2 unrolls    55 ms
 *     3 unrolls  538 ms      4 unrolls  9257 ms
 *
 * Three is what the corpus needs (the mutually recursive tree in ref.json
 * puts its invalid value three levels down) and is where the cost is still
 * a fraction of a second. It is a BUILD-time cost, paid once per document.
 *
 * The per-ref cap bounds the depth and leaves the WIDTH to the document, so
 * it is not a bound on the work by itself. EXPANSION_BUDGET is: it caps the
 * total number of `$ref` expansions one conversion may do, whatever shape
 * the document has. It is deliberately far above what a real schema reaches
 * — the whole official corpus stays under it — so it changes nothing for
 * ordinary documents and only stops a pathological one from running away.
 *
 * Running out is not an error. The conversion stops adding rules, exactly as
 * it did at the first repeat before, and the document is checked to the depth
 * that was reached — the same silence as before, moved further out.
 */
const MAX_REF_UNROLL = 3;
const EXPANSION_BUDGET = 100000;

/** Shared by every context of ONE conversion, so the budget is the whole. */
interface ExpansionBudget {
  remaining: number;
}

function countOf(pointers: readonly string[], pointer: string): number {
  let count = 0;
  for (const one of pointers) if (one === pointer) count += 1;
  return count;
}

/** A resolved node together with the context that reads it. */
interface Descent {
  readonly node: Draft07SchemaObject;
  readonly context: StructuralContext;
}

export interface ConversionSeed {
  readonly bag: JsonSchemaBag;
  readonly scope: RefScope;
  readonly chain: ChainBuildContext;
  /** Created by the entry point; every nested context shares this one. */
  readonly budget?: ExpansionBudget;
}

/** The budget a conversion starts with. One per document, not one per node. */
export function createExpansionBudget(): ExpansionBudget {
  return { remaining: EXPANSION_BUDGET };
}

function propertyKeysOf(schema: Draft07SchemaObject): readonly string[] {
  return Object.freeze(Object.keys(schema.properties ?? {}));
}

export function createStructuralContext(
  seed: ConversionSeed,
  node: Draft07SchemaObject,
  visitedRefs: readonly string[],
  scope: RefScope = seed.scope
): StructuralContext {
  const budget = seed.budget ?? createExpansionBudget();
  const build: ChainBuildContext = {
    fieldPath: seed.chain.fieldPath,
    declaredSiblingKeys: propertyKeysOf(node),
    config: seed.chain.config,
  };
  /**
   * One descent: the node this schema really is, and the context inside it.
   *
   * The RESOLVED node is handed back, and callers must use it rather than the
   * schema they passed in. Resolving the same `$ref` a second time — which
   * is what happens if the original is passed on — moves the base twice, so
   * a relative reference under a relative `$id` doubles its own folder.
   */
  const descend = (schema: Draft07Schema): Descent | undefined => {
    const pointer = readRefPointer(schema);
    if (
      pointer !== undefined &&
      countOf(visitedRefs, pointer) >= MAX_REF_UNROLL
    ) {
      return undefined;
    }
    if (pointer !== undefined) {
      if (budget.remaining <= 0) return undefined;
      budget.remaining -= 1;
    }
    const seen =
      pointer === undefined ? visitedRefs : [...visitedRefs, pointer];
    // The scope moves with the node: following a `$ref` into another
    // document makes THAT document's base the one its own refs resolve in.
    const resolved = resolveSchemaNodeInScope(schema, scope);
    return {
      node: resolved.node,
      context: createStructuralContext(
        { ...seed, budget },
        resolved.node,
        seen,
        resolved.scope
      ),
    };
  };
  const ruleContextFor = <C extends MessageContextExtra>(
    pluginName: string,
    code: string
  ): RuleBuildContext<C> => ({
    pluginName,
    code,
    severity: build.config.defaultSeverity,
    config: build.config,
    fieldPath: build.fieldPath,
    declaredSiblingKeys: build.declaredSiblingKeys,
  });
  return {
    bag: seed.bag,
    build,
    scope,
    visitedRefs,
    collectSubSchemaRules: (schema) => {
      const child = descend(schema);
      return child === undefined
        ? NO_RULES
        : collectSubSchemaRules(child.node, child.context);
    },
    toBranch: (label, schema) => {
      const child = descend(schema);
      return child === undefined
        ? { label, rules: NO_RULES, fields: [] }
        : toSchemaBranch(label, child.node, child.context);
    },
    ruleContextFor,
  };
}
