// ===========================================================================
// The claim this file exists to check is NOT visible to the type checker:
// "resolveGlobalConfig() is called once, at build(), and never again". So the
// real function is wrapped in a counting spy and the count is read.
// ===========================================================================
jest.mock("../../../src/types/global-config", () => {
  const actual = jest.requireActual("../../../src/types/global-config");
  return {
    ...actual,
    resolveGlobalConfig: jest.fn(actual.resolveGlobalConfig),
  };
});

import { compileDeclarations } from "../../../src/builder/compile-declarations";
import { createBuilderSurface } from "../../../src/builder/create-builder";
import { Builder } from "../../../src/builder/field-builder.types";
import { resetGlobalConfig } from "../../../src/builder/global-config-store";
import type { FieldEntry } from "../../../src/builder/field-entry.types";
import type { ChainBuildContext } from "../../../src/chain/create-chain-node";
import { check } from "../../../src/plugin-kit/create-rule";
import { definePlugin } from "../../../src/plugin-kit/plugin-definition";
import type { RuleBuildContext } from "../../../src/plugin-kit/rule-build-context";
import { PASS } from "../../../src/types";
import { resolveGlobalConfig } from "../../../src/types/global-config";
import { requiredPlugin } from "../../../src/plugins/required";

const resolveSpy = resolveGlobalConfig as unknown as jest.Mock;

const seenContexts: RuleBuildContext[] = [];

/** Records the RuleBuildContext it was built with, and checks nothing. */
const probePlugin = definePlugin<{
  args: readonly [];
  out: { readonly __unchanged: true };
  context: object;
}>()({
  name: "probe",
  method: "probe",
  slots: ["string", "object"] as const,
  build: (ctx) => {
    seenContexts.push(ctx);
    return check({
      code: ctx.code,
      severity: ctx.severity,
      run: () => PASS,
      describe: () => "probe",
      buildMessageContext: () => ({}),
    });
  },
});

function entryOf(path: string): FieldEntry {
  return {
    path,
    defaultOf: null,
    applyDefaultToNull: true,
    collectRules: (_context: ChainBuildContext) => [],
  };
}

beforeEach(() => {
  seenContexts.length = 0;
  resetGlobalConfig();
  resolveSpy.mockClear();
});

describe("the global config is resolved ONCE, at build()", () => {
  it("resolves exactly once however many fields are declared", () => {
    compileDeclarations([entryOf("a"), entryOf("b"), entryOf("c")], undefined);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it("does not resolve again on validate() or parse()", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<{ readonly name: string; readonly city: string }>()
      .v("name", (b) => b.string.required())
      .v("city", (b) => b.string.required())
      .build();
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    for (let call = 0; call < 5; call += 1) {
      validator.validate({ name: "Ada" });
      validator.parse({ name: "Ada" });
      validator.pick("name").validate("Ada");
      validator.pickAll(["name"]).validate({ name: "Ada" });
    }
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  it("resolves once per build(), so two builds get their own config", () => {
    const surface = Builder()
      .use(requiredPlugin)
      .for<{ readonly name: string }>()
      .v("name", (b) => b.string.required());
    surface.build();
    surface.build();
    expect(resolveSpy).toHaveBeenCalledTimes(2);
  });
});

describe("what the resolved config is made of", () => {
  it("layers withConfig() over the process-wide store, at build()", () => {
    const surface = createBuilderSurface();
    surface.use(probePlugin);
    surface.withConfig({ defaultSeverity: "warning" });
    surface
      .for()
      .v("name", (slots) => slots.string)
      .build();
    expect(seenContexts).toHaveLength(0);
    surface
      .for()
      .v("name", (slots) => Object(slots.string).probe())
      .build();
    expect(seenContexts[0]?.config.defaultSeverity).toBe("warning");
    expect(seenContexts[0]?.severity).toBe("warning");
  });

  it("hands each field the child keys DECLARED under its own path", () => {
    createBuilderSurface()
      .use(probePlugin)
      .for()
      .v("user", (slots) => Object(slots.object).probe())
      .v("user.name", (slots) => Object(slots.string).probe())
      .v("user.age", (slots) => Object(slots.string).probe())
      .build();
    expect(seenContexts.map((ctx) => ctx.fieldPath)).toEqual([
      "user",
      "user.name",
      "user.age",
    ]);
    expect(seenContexts[0]?.declaredSiblingKeys).toEqual(["name", "age"]);
    expect(seenContexts[1]?.declaredSiblingKeys).toEqual([]);
  });
});

describe("compileDeclarations", () => {
  it("runs every entry's collectRules exactly once, in declaration order", () => {
    const order: string[] = [];
    const entries: readonly FieldEntry[] = ["a", "b"].map((path) => ({
      path,
      defaultOf: null,
      applyDefaultToNull: true,
      collectRules: () => {
        order.push(path);
        return [];
      },
    }));
    compileDeclarations(entries, undefined);
    expect(order).toEqual(["a", "b"]);
  });

  it("throws at BUILD time on a malformed declared path", () => {
    expect(() =>
      compileDeclarations([entryOf("user..name")], undefined)
    ).toThrow(/user\.\.name/);
  });

  it("carries the declared default into the compiled plan", () => {
    const plan = compileDeclarations(
      [{ ...entryOf("a"), defaultOf: () => "x" }],
      undefined
    );
    expect(plan.hasDefaults).toBe(true);
    expect(compileDeclarations([entryOf("a")], undefined).hasDefaults).toBe(
      false
    );
  });
});
