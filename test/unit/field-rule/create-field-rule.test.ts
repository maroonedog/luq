// ===========================================================================
// A standalone FieldRule runs THE engine. Legacy's FieldRule.validate/parse
// were a third semantics that re-executed the user's callback on every call,
// used the plugin name as the error code and ignored the presence rules
// (docs/legacy-spec/plugin-contract.md:173). Each of those is asserted dead
// here, and the last test compares the issue array against the one the plain
// Builder produces for the same declaration.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import { resetGlobalConfig } from "../../../src/builder/global-config-store";
import { createFieldRule } from "../../../src/field-rule/create-field-rule";
import { createPluginRegistry } from "../../../src/field-rule/create-plugin-registry";
import {
  compareFieldPlugin,
  stringMinPlugin,
  transformPlugin,
} from "../../../src/plugins/check-plugins";
import { requiredPlugin } from "../../../src/plugins/presence-plugins";

const registry = () =>
  createPluginRegistry().use(requiredPlugin).use(stringMinPlugin);

afterEach(() => {
  resetGlobalConfig();
});

describe("standalone validate()", () => {
  const rule = registry().createFieldRule<string>((b) =>
    b.string.required().min(5)
  );

  it("reports the plugin's CODE, not its method name, under the subject key", () => {
    const outcome = rule.validate("ab");
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.map((issue) => [issue.path, issue.code])).toEqual([
      ["value", "stringMin"],
    ]);
  });

  it("honours the presence rule that legacy skipped", () => {
    expect(rule.validate(undefined).issues[0]?.code).toBe("required");
    expect(rule.validate(null).issues[0]?.code).toBe("required");
  });

  it("hands back the very value it was given", () => {
    const outcome = rule.validate("abcdef");
    expect(outcome.valid).toBe(true);
    expect(outcome.valid && outcome.data).toBe("abcdef");
  });

  it("runs the user's chain callback ONCE, not once per call", () => {
    let runs = 0;
    const counted = registry().createFieldRule<string>((b) => {
      runs += 1;
      return b.string.required().min(2);
    });
    expect(runs).toBe(1);
    counted.validate("abc");
    counted.validate("a");
    counted.parse("abc");
    expect(runs).toBe(1);
  });
});

describe("standalone parse()", () => {
  const trimmed = createPluginRegistry()
    .use(requiredPlugin)
    .use(transformPlugin)
    .use(stringMinPlugin)
    .createFieldRule<string>((b) =>
      b.string.required().transform((text) => text.trim())
    );

  it("returns the TRANSFORMED value while validate() returns the input", () => {
    const parsed = trimmed.parse("  hi  ");
    expect(parsed.valid && parsed.data).toBe("hi");
    const validated = trimmed.validate("  hi  ");
    expect(validated.valid && validated.data).toBe("  hi  ");
  });

  it("substitutes a declared default before the rules judge, writes on parse", () => {
    const named = registry().createFieldRule<string>(
      (b) => b.string.required().min(3),
      { name: "nickname", fieldOptions: { default: "anonymous" } }
    );
    expect(named.validate(undefined).valid).toBe(true);
    const parsed = named.parse(undefined);
    expect(parsed.valid && parsed.data).toBe("anonymous");
  });
});

describe("identity", () => {
  it("defaults the name to the subject key and carries a description", () => {
    const bare = registry().createFieldRule<string>((b) => b.string.required());
    expect(bare.name).toBe("value");
    expect(bare.description).toBeUndefined();
    const described = registry().createFieldRule<string>(
      (b) => b.string.required(),
      { name: "email", description: "a work address" }
    );
    expect(described.name).toBe("email");
    expect(described.description).toBe("a work address");
  });

  it("is frozen, so a caller cannot swap its define out from under a builder", () => {
    const rule = registry().createFieldRule<string>((b) => b.string.required());
    expect(Object.isFrozen(rule)).toBe(true);
  });
});

describe("a rule that does not know its root cannot name a sibling", () => {
  it("rejects a field reference, because FieldPath<unknown> is never", () => {
    const withCompare = createPluginRegistry()
      .use(requiredPlugin)
      .use(compareFieldPlugin);
    withCompare.createFieldRule<string>((b) =>
      // @ts-expect-error no path exists on a root the rule has not been given
      b.string.required().compareField("age", "eq")
    );
  });
});

describe("one engine", () => {
  it("produces the SAME issue array as the plain Builder for one field", () => {
    // No explicit TValue here: the free function infers the bag from the
    // builder, so naming TValue would mean naming the bag type too. The
    // registry method is the ergonomic path and takes TValue on its own.
    const rule = createFieldRule(
      Builder().use(requiredPlugin).use(stringMinPlugin),
      (b) => b.string.required().min(5)
    );
    const plain = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ value: string }>()
      .v("value", (b) => b.string.required().min(5))
      .build();
    expect(JSON.stringify(rule.validate("ab").issues)).toBe(
      JSON.stringify(plain.validate({ value: "ab" }).issues)
    );
  });
});
