// ===========================================================================
// test/unit/json-schema/convert/compose-conditional.test.ts
//
// ONE IMPLEMENTATION, TWO FRONT DOORS — asserted, not claimed.
//
// The same if/then/else is expressed twice: once as a hand-written chain
// (`.conditionalSchema(...)`) and once as a JSON document, and the two are
// asked the same questions. They must agree on every one, and the rule the
// converter produced must be the composite the PLUGIN produced — same kind,
// same code, same branch labels — because the converter calls the plugin's own
// build() with the resolved sub-chain rules rather than re-implementing the
// routing. 1.x had a second implementation (a private recursive evaluator) and
// the two disagreed.
// ===========================================================================
import { Builder } from "../../../../src/index";
import { conditionalSchemaPlugin } from "../../../../src/plugins/conditional-schema";
import { stringMinPlugin } from "../../../../src/plugins/string-min";
import { stringMaxPlugin } from "../../../../src/plugins/string-max";
import { requiredPlugin } from "../../../../src/plugins/required";
import {
  buildFieldEntries,
  fromJsonSchema,
} from "../../../../src/json-schema/build-from-schema";
import { DEFAULT_GLOBAL_CONFIG } from "../../../../src/types/global-config";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

interface Holder {
  readonly a?: string;
}

const SCHEMA = {
  properties: {
    // `type` is declared because the hand-written twin says `b.string`, which
    // is itself a claim about the type. Without it the document would accept a
    // number here — correctly, since `minLength` says nothing about one — and
    // the two doors would be answering different questions.
    a: {
      type: "string",
      if: { minLength: 2 },
      then: { minLength: 4 },
      else: { maxLength: 0 },
    },
  },
};

const handWritten = Builder()
  .use(conditionalSchemaPlugin)
  .use(stringMinPlugin)
  .use(stringMaxPlugin)
  .use(requiredPlugin)
  .for<Holder>()
  .v("a", (b) =>
    b.string.conditionalSchema(
      (narrowed) => narrowed.string.min(2),
      (narrowed) => narrowed.string.min(4),
      (narrowed) => narrowed.string.max(0)
    )
  )
  .build();

const converted = fromJsonSchema(jsonSchemaBagFixture, SCHEMA);

describe("compose-conditional", () => {
  const samples: readonly unknown[] = [
    "abcd",
    "abc",
    "a",
    "",
    12,
    3,
    true,
    [],
    {},
  ];

  it.each(
    samples.map((sample) => [JSON.stringify(sample) ?? "undefined", sample])
  )("agrees with the hand-written chain on %s", (_label, sample) => {
    // The chain's `.min(2)` is a string rule and the document's is `minLength`
    // — the same plugin either way — so the two verdicts must match exactly.
    expect(converted.validate({ a: sample }).valid).toBe(
      handWritten.validate({ a: sample }).valid
    );
  });

  it("produces the composite the plugin itself produces", () => {
    const entries = buildFieldEntries(jsonSchemaBagFixture, SCHEMA);
    const rules = entries[0]?.collectRules({
      fieldPath: "a",
      declaredSiblingKeys: [],
      config: DEFAULT_GLOBAL_CONFIG,
    });
    const composites = (rules?.rules ?? []).filter(
      (rule) => rule.kind === "composite"
    );
    const conditional = composites.find((rule) => rule.code === "if");
    expect(conditional).toBeDefined();
    if (conditional === undefined || conditional.kind !== "composite") return;
    expect(conditional.branches.map((branch) => branch.label)).toEqual([
      "if",
      "then",
      "else",
    ]);
    expect(conditionalSchemaPlugin.subChainArguments).toEqual([0, 1, 2]);
  });

  it("omits the arm the document omits", () => {
    const entries = buildFieldEntries(jsonSchemaBagFixture, {
      properties: { a: { if: { type: "string" }, then: { minLength: 4 } } },
    });
    const rules = entries[0]?.collectRules({
      fieldPath: "a",
      declaredSiblingKeys: [],
      config: DEFAULT_GLOBAL_CONFIG,
    });
    const conditional = (rules?.rules ?? []).find(
      (rule) => rule.kind === "composite" && rule.code === "if"
    );
    expect(conditional).toBeDefined();
    if (conditional === undefined || conditional.kind !== "composite") return;
    expect(conditional.branches.map((branch) => branch.label)).toEqual([
      "if",
      "then",
    ]);
  });
});
