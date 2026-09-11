// ===========================================================================
// One field's declared calls turned into one JSON Schema object, and the four
// answers it can give when it cannot.
//
// This module was reached by the emit tests only through the whole pipeline,
// which exercised the happy path and left every refusal branch unrun. A
// refusal that no test runs is one nobody notices becoming an acceptance —
// and here an acceptance means handing someone a schema that says less than
// the validator enforces, which is the failure the policy exists to prevent.
//
// The calls are written out as values rather than driven through a builder.
// A builder cannot produce some of these — a chain spanning two slots, a field
// with no recorded call at all — and those are exactly the shapes the code
// says it handles.
// ===========================================================================
import type { DeclaredCall } from "../../../src/chain/declared-call.types";
import { emitFieldSchema } from "../../../src/standard-schema/emit-field-schema";
import { UnrepresentableRuleError } from "../../../src/standard-schema/unrepresentable-rule-error";

/** A call as the recorder would have written it. */
function call(
  pluginName: string,
  slot: DeclaredCall["slot"],
  args: readonly unknown[] = []
): DeclaredCall {
  return { pluginName, method: pluginName, slot, args };
}

const REQUIRED_STRING = [
  call("required", "string"),
  call("stringMin", "string", [3]),
] as const;

describe("the type it writes", () => {
  it("takes the type from the slot the calls stood in", () => {
    expect(emitFieldSchema("name", REQUIRED_STRING, "throw").schema).toEqual({
      type: "string",
      minLength: 3,
    });
  });

  it("writes integer rather than number when the chain declared it", () => {
    // numberInteger adds no keyword of its own; it moves the type.
    const calls = [call("required", "number"), call("numberInteger", "number")];
    expect(emitFieldSchema("count", calls, "throw").schema).toEqual({
      type: "integer",
    });
  });

  it("spells nullable as a type list, integer included", () => {
    const calls = [call("numberInteger", "number"), call("nullable", "number")];
    expect(emitFieldSchema("count", calls, "throw").schema).toEqual({
      type: ["integer", "null"],
    });
  });

  it("ignores the any slot when deciding, so it does not block a type", () => {
    // `any` is not a claim about the type, so a chain that touches it and one
    // real slot still settles.
    const calls = [call("required", "any"), call("stringMin", "string", [1])];
    expect(emitFieldSchema("name", calls, "throw").schema).toEqual({
      type: "string",
      minLength: 1,
    });
  });
});

describe("a chain that settles on no JSON type", () => {
  const acrossTwoSlots = [
    call("stringMin", "string", [1]),
    call("numberMin", "number", [1]),
  ];

  it("refuses rather than picking one of them", () => {
    expect(() => emitFieldSchema("mixed", acrossTwoSlots, "throw")).toThrow(
      UnrepresentableRuleError
    );
    expect(() => emitFieldSchema("mixed", acrossTwoSlots, "throw")).toThrow(
      /"mixed".*one JSON type/s
    );
  });

  it("refuses a date, which is not a JSON type at all", () => {
    // Draft-07 convention writes a date as a string with a format, but the
    // date slot judges Date instances, which are not JSON values. Conflating
    // the two would emit a schema for a document that never carries one.
    expect(() =>
      emitFieldSchema("when", [call("required", "date")], "throw")
    ).toThrow(UnrepresentableRuleError);
  });

  it("under omit, drops the type and keeps what it could write", () => {
    const { schema } = emitFieldSchema("mixed", acrossTwoSlots, "omit");
    expect(schema["type"]).toBeUndefined();
    // The keywords themselves are still expressible, and omitting the type is
    // not a reason to lose them.
    expect(schema).toEqual({ minLength: 1, minimum: 1 });
  });
});

describe("a field with no declaration recorded", () => {
  it("refuses, because an empty schema would claim the field is unconstrained", () => {
    expect(() => emitFieldSchema("ghost", [], "throw")).toThrow(
      UnrepresentableRuleError
    );
    expect(() => emitFieldSchema("ghost", [], "throw")).toThrow(
      /"ghost".*builder chain/s
    );
  });

  it("under omit, returns an empty schema instead", () => {
    expect(emitFieldSchema("ghost", [], "omit").schema).toEqual({});
  });
});

describe("an argument the keyword table cannot express", () => {
  // A flagged pattern: Draft-07's `pattern` has nowhere to spell the flag.
  const flagged = [
    call("required", "string"),
    call("stringPattern", "string", [/^a$/i]),
  ];

  it("refuses, naming the plugin rather than the chain", () => {
    expect(() => emitFieldSchema("code", flagged, "throw")).toThrow(
      /"code".*stringPattern/s
    );
  });

  it("under omit, drops that keyword and keeps the rest of the field", () => {
    // The type and the other keywords survive; only the one that cannot be
    // written goes. Losing the whole field would be a second, larger lie.
    expect(emitFieldSchema("code", flagged, "omit").schema).toEqual({
      type: "string",
    });
  });
});

describe("whether the parent lists the field as required", () => {
  it("is required when the chain declared required", () => {
    expect(emitFieldSchema("name", REQUIRED_STRING, "throw").isRequired).toBe(
      true
    );
  });

  it("is not required when nothing declared it", () => {
    const calls = [call("stringMin", "string", [3])];
    expect(emitFieldSchema("name", calls, "throw").isRequired).toBe(false);
  });

  it("is not required when optional appears anywhere, not only first", () => {
    // Both orders, because reading only the first call would make one of them
    // wrong and the suite would still be green on the other.
    const optionalLast = [
      call("required", "string"),
      call("optional", "string"),
    ];
    const optionalFirst = [
      call("optional", "string"),
      call("required", "string"),
    ];
    expect(emitFieldSchema("name", optionalLast, "throw").isRequired).toBe(
      false
    );
    expect(emitFieldSchema("name", optionalFirst, "throw").isRequired).toBe(
      false
    );
  });
});
