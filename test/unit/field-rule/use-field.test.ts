// ===========================================================================
// useField(builder, path, rule) must be indistinguishable from writing the
// same chain inline at that path. The first describe proves that on the ISSUE
// ARRAY, which is the only observable the two share; the rest is the type-level
// gate that stops a rule reaching a builder that cannot run it.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import { resetGlobalConfig } from "../../../src/builder/global-config-store";
import { createPluginRegistry } from "../../../src/field-rule/create-plugin-registry";
import { useField } from "../../../src/field-rule/use-field";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";

interface Account {
  readonly email: string;
  readonly age: number;
  readonly owner: { readonly nick: string };
  readonly tags: readonly string[];
}

const kit = () =>
  Builder()
    .use(requiredPlugin)
    .use(optionalPlugin)
    .use(stringMinPlugin)
    .use(numberMinPlugin)
    .use(transformPlugin);

const registry = () =>
  createPluginRegistry()
    .use(requiredPlugin)
    .use(optionalPlugin)
    .use(stringMinPlugin)
    .use(numberMinPlugin)
    .use(transformPlugin);

const broken = {
  email: "ab",
  age: 3,
  owner: { nick: "x" },
  tags: ["a"],
};

afterEach(() => {
  resetGlobalConfig();
});

describe("one engine: useField vs an inline .v()", () => {
  const emailRule = registry().createFieldRule<string>((b) =>
    b.string.required().min(5)
  );
  const nickRule = registry().createFieldRule<string>((b) =>
    b.string.required().min(3)
  );

  const viaRule = useField(
    useField(kit().for<Account>(), "email", emailRule),
    "owner.nick",
    nickRule
  )
    .v("age", (b) => b.number.required().min(18))
    .build();

  const inline = kit()
    .for<Account>()
    .v("email", (b) => b.string.required().min(5))
    .v("owner.nick", (b) => b.string.required().min(3))
    .v("age", (b) => b.number.required().min(18))
    .build();

  it("produces BYTE-IDENTICAL issue arrays", () => {
    const options = { abortEarly: false };
    const left = viaRule.validate(broken, options);
    const right = inline.validate(broken, options);
    expect(left.valid).toBe(false);
    expect(JSON.stringify(left.issues)).toBe(JSON.stringify(right.issues));
    expect(left.issues.map((issue) => issue.path)).toEqual([
      "email",
      "owner.nick",
      "age",
    ]);
  });

  it("agrees on a value both accept, down to the returned identity", () => {
    const good = {
      email: "ada@example.com",
      age: 36,
      owner: { nick: "ada" },
      tags: [],
    };
    const left = viaRule.validate(good);
    expect(left.valid).toBe(true);
    expect(left.valid && left.data).toBe(good);
    expect(JSON.stringify(left.issues)).toBe(
      JSON.stringify(inline.validate(good).issues)
    );
  });

  it("carries the rule's own fieldOptions default to the declared path", () => {
    const defaulted = registry().createFieldRule<string>(
      (b) => b.string.required().min(2),
      { fieldOptions: { default: "unnamed" } }
    );
    const validator = useField(
      kit().for<Account>(),
      "owner.nick",
      defaulted
    ).build();
    const parsed = validator.parse({
      email: "x",
      age: 1,
      owner: {},
      tags: [],
    });
    expect(parsed.valid && parsed.data.owner.nick).toBe("unnamed");
  });

  it("splices into an array element path like any other declaration", () => {
    const tagRule = registry().createFieldRule<string>((b) =>
      b.string.required().min(2)
    );
    const validator = useField(
      kit().for<Account>(),
      "tags[*]",
      tagRule
    ).build();
    const outcome = validator.validate(
      { email: "x", age: 1, owner: { nick: "y" }, tags: ["ok", "a"] },
      { abortEarly: false }
    );
    expect(outcome.issues.map((issue) => issue.path)).toEqual(["tags[1]"]);
  });
});

describe("the gate that stops a rule reaching a builder that cannot run it", () => {
  const emailRule = registry().createFieldRule<string>((b) =>
    b.string.required().min(5)
  );
  const ageRule = registry().createFieldRule<number>((b) =>
    b.number.required().min(18)
  );

  it("accepts a builder carrying MORE plugins than the rule needs", () => {
    const lean = createPluginRegistry()
      .use(requiredPlugin)
      .createFieldRule<string>((b) => b.string.required());
    const validator = useField(kit().for<Account>(), "email", lean).build();
    expect(validator.validate({ ...broken, email: "" }).valid).toBe(false);
  });

  it("rejects a rule whose value type is not the field's", () => {
    // @ts-expect-error a FieldRule<number> may not be spliced onto a string
    useField(kit().for<Account>(), "email", ageRule);
  });

  it("rejects a path the object does not declare", () => {
    // @ts-expect-error "nope" is not a FieldPath<Account>
    useField(kit().for<Account>(), "nope", emailRule);
  });

  it("rejects a builder missing a plugin the rule was minted from", () => {
    const thin = Builder().use(requiredPlugin).for<Account>();
    // @ts-expect-error the builder's bag has no stringMin, the rule's has
    useField(thin, "email", emailRule);
  });
});
