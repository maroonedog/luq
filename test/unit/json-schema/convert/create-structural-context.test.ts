// ===========================================================================
// test/unit/json-schema/convert/create-structural-context.test.ts
//
// THE EXPANSION BUDGET, which is the only thing that bounds the WORK a document
// can ask for. The per-`$ref` unroll cap bounds the DEPTH of one chain and says
// nothing about its width, so a set of mutually recursive definitions that each
// name all the others still fans out exponentially. The budget is shared by
// every context of one conversion and counts `$ref` expansions; when it runs
// out the descent stops, the arm comes back with no rules, and the document is
// checked to the depth that was reached.
//
// A budget is spent one expansion at a time and threaded, already spent, into
// every nested context, so a seed carrying a nearly empty one is the state the
// conversion itself is in at expansion 99,999. Starting there is what makes
// this test a test and not a fifty-second one: reaching the same state through
// a document means performing all one hundred thousand expansions first.
// ===========================================================================
import {
  createExpansionBudget,
  createStructuralContext,
} from "../../../../src/json-schema/create-structural-context";
import type { ConversionSeed } from "../../../../src/json-schema/create-structural-context";
import { createLocalScope } from "../../../../src/json-schema/ref-scope";
import type { Draft07SchemaObject } from "../../../../src/json-schema/draft07.types";
import { DEFAULT_GLOBAL_CONFIG } from "../../../../src/types/global-config";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const document: Draft07SchemaObject = {
  definitions: { small: { maxLength: 2 } },
  properties: { a: { $ref: "#/definitions/small" } },
};

const REFERENCE = { $ref: "#/definitions/small" };

function seedWith(budget: { remaining: number }): ConversionSeed {
  return {
    bag: jsonSchemaBagFixture,
    scope: createLocalScope(document),
    chain: {
      fieldPath: "a",
      declaredSiblingKeys: [],
      config: DEFAULT_GLOBAL_CONFIG,
    },
    budget,
  };
}

const contextWith = (budget: { remaining: number }) =>
  createStructuralContext(seedWith(budget), document, []);

describe("create-structural-context: the expansion budget", () => {
  it("spends one unit per `$ref` and none for an inline sub-schema", () => {
    const budget = createExpansionBudget();
    const context = contextWith(budget);
    const before = budget.remaining;
    context.toBranch("inline", { maxLength: 2 });
    expect(budget.remaining).toBe(before);
    context.toBranch("referenced", REFERENCE);
    expect(budget.remaining).toBe(before - 1);
  });

  it("converts every arm while there is budget left, down to the last unit", () => {
    const budget = { remaining: 2 };
    const context = contextWith(budget);
    expect(context.toBranch("first", REFERENCE).rules.length).toBeGreaterThan(
      0
    );
    expect(budget.remaining).toBe(1);
    // The second arm is converted on the LAST unit, which is what separates
    // "there is budget" from "there is budget to spare": a guard that stopped
    // one expansion early would let this arm through with no rules.
    expect(context.toBranch("second", REFERENCE).rules.length).toBeGreaterThan(
      0
    );
    expect(budget.remaining).toBe(0);
  });

  it("stops converting arms once it is spent, and keeps the label", () => {
    const context = contextWith({ remaining: 1 });
    expect(context.toBranch("first", REFERENCE).rules.length).toBeGreaterThan(
      0
    );
    const exhausted = context.toBranch("second", REFERENCE);
    expect(exhausted.label).toBe("second");
    expect(exhausted.rules).toHaveLength(0);
  });

  it("stops a whole sub-schema, not only a branch of one", () => {
    const context = contextWith({ remaining: 0 });
    expect(context.collectSubSchemaRules(REFERENCE)).toHaveLength(0);
    // Running out is not an error and not a refusal of the document: an inline
    // sub-schema costs nothing and is still converted afterwards.
    expect(
      context.collectSubSchemaRules({ maxLength: 2 }).length
    ).toBeGreaterThan(0);
  });
});
