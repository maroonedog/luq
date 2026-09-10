// ===========================================================================
// The L3 -> L10 inversion port.
//
// What is under test is the DEFAULT, not the implementation: with no recorder
// installed, the chain must build no DeclaredCall, thread no array, and still
// produce exactly the same rules. That is the whole reason the port exists —
// a user who never emits JSON Schema pays nothing for the bookkeeping.
//
// The other half is the handover: when a recorder IS installed, every chain
// step notifies it once, refine steps inherit instead of appending, and two
// chains branched from one node do not contaminate each other.
//
// The real implementation lives in standard-schema/declaration-recorder.ts and
// is exercised end to end by the toStandardJsonSchema suites. Here the
// recorder is a spy, so what is pinned is the contract the two agree on.
// ===========================================================================
import { createFieldSlots } from "../../../src/chain/create-field-slots";
import { collectFieldRules } from "../../../src/chain/collect-field-rules";
import type { DeclarationRecorder } from "../../../src/chain/declaration-recorder.port";
import * as port from "../../../src/chain/declaration-recorder.port";
import { installDeclarationRecorder } from "../../../src/chain/declaration-recorder.port";
import type { DeclaredCall } from "../../../src/chain/declared-call.types";
import type { ChainBuildContext } from "../../../src/chain/create-chain-node";
import {
  chainContext,
  numberMinPlugin,
  requiredPlugin,
  ruleCodes,
  stringMinPlugin,
} from "./slot-plugin-fixtures";

interface Model {
  readonly name: string;
}

const bag = {
  required: requiredPlugin,
  stringMin: stringMinPlugin,
  numberMin: numberMinPlugin,
};

function slots(context: ChainBuildContext = chainContext) {
  return createFieldSlots<Model, typeof bag, string>(bag, context);
}

/** The port's shape, kept honest by an implementation written to the type. */
function spyRecorder(): DeclarationRecorder & {
  readonly records: readonly string[];
} {
  const calls = new WeakMap<object, readonly DeclaredCall[]>();
  const records: string[] = [];
  return {
    records,
    record: (parent, child, plugin, slot, args) => {
      records.push(`record ${plugin.method}(${args.join(",")}) on ${slot}`);
      calls.set(child, [
        ...(calls.get(parent) ?? []),
        { pluginName: plugin.name, method: plugin.method, slot, args },
      ]);
    },
    inherit: (parent, child) => {
      records.push("inherit");
      const existing = calls.get(parent);
      if (existing !== undefined) calls.set(child, existing);
    },
    read: (node) => calls.get(node),
  };
}

// What is installed stays installed for the process. Restoring it after each
// case is what lets a later one still observe "nothing installed".
function withRecorder<T>(
  recorder: DeclarationRecorder | null,
  body: () => T
): T {
  const previous = port.declarationRecorder;
  installDeclarationRecorder(recorder);
  try {
    return body();
  } finally {
    installDeclarationRecorder(previous);
  }
}

describe("DeclarationRecorder, with nothing installed", () => {
  it("is null, so the chain notifies no one", () => {
    withRecorder(null, () => {
      expect(port.declarationRecorder).toBeNull();
    });
  });

  it("still produces the same rules, in the same order", () => {
    const outcome = withRecorder(null, () =>
      collectFieldRules<Model, typeof bag, string>(bag, chainContext, (b) =>
        b.string.required().min(3)
      )
    );
    expect(ruleCodes(outcome.rules)).toEqual(["required", "stringMin"]);
  });

  // null and the empty list are different answers. The empty list reads as
  // "no constraints", and a writer then emits a schema admitting everything.
  it("reports the declarations as null, NOT as an empty list", () => {
    const outcome = withRecorder(null, () =>
      collectFieldRules<Model, typeof bag, string>(bag, chainContext, (b) =>
        b.string.required().min(3)
      )
    );
    expect(outcome.calls).toBeNull();
  });
});

describe("DeclarationRecorder, once installed", () => {
  it("is notified once per chain step, with the resolved arguments", () => {
    const recorder = spyRecorder();
    withRecorder(recorder, () => slots().string.required().min(3));
    expect(recorder.records).toEqual([
      "record required() on string",
      "record min(3) on string",
    ]);
  });

  it("hands the collector the declarations in call order", () => {
    const recorder = spyRecorder();
    const outcome = withRecorder(recorder, () =>
      collectFieldRules<Model, typeof bag, string>(bag, chainContext, (b) =>
        b.string.required().min(3)
      )
    );
    expect(outcome.calls?.map((call) => [call.method, call.args])).toEqual([
      ["required", []],
      ["min", [3]],
    ]);
  });

  // The rules and the declarations are not the same length. This is what
  // stops an implementation being written that reads them in step.
  it("counts calls, not rules", () => {
    const recorder = spyRecorder();
    const outcome = withRecorder(recorder, () =>
      collectFieldRules<Model, typeof bag, string>(bag, chainContext, (b) =>
        b.string.required()
      )
    );
    expect(outcome.calls).toHaveLength(1);
  });

  it("keeps two chains branched from one node apart", () => {
    const recorder = spyRecorder();
    withRecorder(recorder, () => {
      const start = slots().string.required();
      const left = start.min(3);
      const right = start.min(9);
      expect(recorder.read(left)?.map((call) => call.args)).toEqual([[], [3]]);
      expect(recorder.read(right)?.map((call) => call.args)).toEqual([[], [9]]);
      expect(recorder.read(start)?.map((call) => call.args)).toEqual([[]]);
    });
  });

  // A refine step moves slot and adds no call. Adding one grows a constraint
  // in the emitted schema that nothing declared.
  it("inherits across a refine step instead of appending", () => {
    const recorder = spyRecorder();
    withRecorder(recorder, () => {
      const refined = slots().string.required().refineString();
      expect(recorder.records).toEqual([
        "record required() on string",
        "inherit",
      ]);
      expect(recorder.read(refined)?.map((call) => call.method)).toEqual([
        "required",
      ]);
    });
  });

  it("records nothing for a chain that called no method", () => {
    const recorder = spyRecorder();
    withRecorder(recorder, () => {
      const bare = slots().string;
      expect(recorder.records).toEqual([]);
      expect(recorder.read(bare)).toBeUndefined();
    });
  });

  // A node reached with a recorder installed and no call made means "nothing
  // was declared", not "no record was kept". Falling to null here breaks the
  // distinction above.
  it("turns an unrecorded chain into an empty list, not null", () => {
    const recorder = spyRecorder();
    const outcome = withRecorder(recorder, () =>
      collectFieldRules<Model, typeof bag, string>(
        bag,
        chainContext,
        (b) => b.string as never
      )
    );
    expect(outcome.calls).toEqual([]);
  });
});
