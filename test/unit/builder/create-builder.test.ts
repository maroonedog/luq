import {
  NamelessPluginError,
  createBuilder,
  createBuilderSurface,
} from "../../../src/builder/create-builder";
import { Builder } from "../../../src/builder/field-builder.types";
import { definePlugin } from "../../../src/plugin-kit/plugin-definition";
import { check } from "../../../src/plugin-kit/create-rule";
import { PASS } from "../../../src/types";
import {
  requiredPlugin,
  optionalPlugin,
} from "../../../src/plugins/presence-plugins";
import { stringMinPlugin } from "../../../src/plugins/check-plugins";

/** Two plugins that share a NAME but not a method: first-wins is observable. */
const firstNamed = definePlugin<{
  args: readonly [];
  out: { readonly __unchanged: true };
  context: object;
}>()({
  name: "duplicate",
  method: "first",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      severity: ctx.severity,
      run: () => PASS,
      describe: () => "first",
      buildMessageContext: () => ({}),
    }),
});

const secondNamed = definePlugin<{
  args: readonly [];
  out: { readonly __unchanged: true };
  context: object;
}>()({
  name: "duplicate",
  method: "second",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      severity: ctx.severity,
      run: () => PASS,
      describe: () => "second",
      buildMessageContext: () => ({}),
    }),
});

function slotMethodNames(): readonly string[] {
  const surface = createBuilderSurface();
  surface.use(firstNamed);
  surface.use(secondNamed);
  const seen: string[] = [];
  surface
    .for()
    .v("name", (slots) => {
      seen.push(...Object.keys(Object(slots.string)));
      return slots.string;
    })
    .build();
  return seen;
}

describe("Builder()", () => {
  it("is the same function as createBuilder", () => {
    expect(Builder).toBe(createBuilder);
    expect(typeof Builder()).toBe("object");
  });

  it("hands back a use / withConfig / for surface", () => {
    const builder = Builder();
    expect(typeof builder.use).toBe("function");
    expect(typeof builder.withConfig).toBe("function");
    expect(typeof builder.for).toBe("function");
  });
});

describe("use()", () => {
  it("MUTATES: it returns the receiver, unlike a FieldRule registry", () => {
    const builder = Builder();
    expect(builder.use(requiredPlugin)).toBe(builder);
    expect(builder.use(optionalPlugin)).toBe(builder);
  });

  it("keeps the FIRST registration when a name is used twice", () => {
    const methods = slotMethodNames();
    expect(methods).toContain("first");
    expect(methods).not.toContain("second");
  });

  it("throws a NAMED error on a value that is not a plugin", () => {
    const surface = createBuilderSurface();
    const nameless: unknown[] = [undefined, null, 42, "required", {}];
    for (const candidate of nameless) {
      expect(() => surface.use(candidate as never)).toThrow(
        NamelessPluginError
      );
    }
  });

  it("names what it received in the message", () => {
    const surface = createBuilderSurface();
    expect(() => surface.use(undefined as never)).toThrow(/received undefined/);
    expect(() => surface.use({} as never)).toThrow(/an object with no name/);
  });

  it("rejects an object whose name is present but empty", () => {
    const surface = createBuilderSurface();
    expect(() => surface.use({ name: "", build: () => PASS } as never)).toThrow(
      NamelessPluginError
    );
  });

  it("rejects an object with a name but no build()", () => {
    const surface = createBuilderSurface();
    expect(() => surface.use({ name: "looksReal" } as never)).toThrow(
      NamelessPluginError
    );
  });
});

describe("for()", () => {
  it("SNAPSHOTS the bag: a later use() cannot reach a handed-out chain", () => {
    const surface = createBuilderSurface();
    surface.use(requiredPlugin);
    const chain = surface.for();
    surface.use(stringMinPlugin);
    expect(() =>
      chain
        .v("name", (slots) => {
          const stringSlot: Record<string, unknown> = Object(slots.string);
          expect(Object.keys(stringSlot)).not.toContain("min");
          return slots.string;
        })
        .build()
    ).not.toThrow();
  });

  it("starts with no declarations at all", () => {
    const validator = createBuilderSurface().for().build();
    expect(validator.validate({}).valid).toBe(true);
    expect(validator.validate({}).issues).toEqual([]);
  });
});
