// The settled meaning of transform: validate first, transform after, and
// validate() transforms nothing. A previous release ran the two orders in
// opposite directions on its main path and its fallback.
import { Builder } from "../../../../src/index";
import { transformPlugin } from "../../../../src/plugins/transform/index";
import { compareFieldPlugin } from "../../../../src/plugins/compare-field/index";

interface Account {
  name: string;
  nick: string;
  score: number;
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return { name: "  ada  ", nick: "ada", score: 3, ...overrides };
}

describe("transform: only parse transforms", () => {
  const validator = Builder()
    .use(transformPlugin)
    .for<Account>()
    .v("name", (b) => b.string.transform((value) => value.trim()))
    .build();

  it("has validate return the original value untouched", () => {
    const result = validator.validate(makeAccount());
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual(makeAccount());
  });

  it("has parse return the transformed value", () => {
    const result = validator.parse(makeAccount());
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual(makeAccount({ name: "ada" }));
  });

  it("has parse leave the input object alone, being copy-on-write", () => {
    const input = makeAccount();
    validator.parse(input);
    expect(input.name).toBe("  ada  ");
  });
});

describe("transform: a chain composes in declaration order", () => {
  const validator = Builder()
    .use(transformPlugin)
    .for<Account>()
    .v("name", (b) =>
      b.string
        .transform((value) => value.trim())
        .transform((trimmed) => trimmed.length)
        .transform((length) => `len=${String(length)}`)
    )
    .build();

  it("gives a later step the earlier step's output", () => {
    const result = validator.parse(makeAccount());
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual(makeAccount({ name: "len=3" }));
  });
});

describe("transform: validate first, transform after", () => {
  let calls = 0;
  const validator = Builder()
    .use(transformPlugin)
    .use(compareFieldPlugin)
    .for<Account>()
    .v("nick", (b) =>
      b.string.compareField("name").transform((value) => {
        calls += 1;
        return value.toUpperCase();
      })
    )
    .build();

  it("does not transform when a check on the same field failed", () => {
    calls = 0;
    const result = validator.parse(makeAccount({ name: "zoe", nick: "ada" }));
    expect(result.valid).toBe(false);
    expect(calls).toBe(0);
  });

  it("has the checks see the value before transforming, whatever the chain order", () => {
    calls = 0;
    const result = validator.parse(makeAccount({ name: "ada", nick: "ada" }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual({ name: "ada", nick: "ADA", score: 3 });
    expect(calls).toBe(1);
  });

  it("has validate never call the transform at all", () => {
    calls = 0;
    const result = validator.validate(
      makeAccount({ name: "ada", nick: "ada" })
    );
    expect(result.valid).toBe(true);
    expect(calls).toBe(0);
  });
});

describe("transform: an exception propagates rather than being swallowed", () => {
  const validator = Builder()
    .use(transformPlugin)
    .for<Account>()
    .v("name", (b) =>
      b.string.transform((): string => {
        throw new Error("boom");
      })
    )
    .build();

  it("has parse throw", () => {
    expect(() => validator.parse(makeAccount())).toThrow("boom");
  });

  it("has validate not throw, never touching the transform", () => {
    expect(validator.validate(makeAccount()).valid).toBe(true);
  });
});

describe("transform: it works on the number slot too", () => {
  const validator = Builder()
    .use(transformPlugin)
    .for<Account>()
    .v("score", (b) => b.number.transform((value) => value * 2))
    .build();

  it("doubles the value in parse", () => {
    const result = validator.parse(makeAccount({ score: 21 }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data).toEqual(makeAccount({ score: 42 }));
  });
});
