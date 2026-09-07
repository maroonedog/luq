// ===========================================================================
// The README's Quick Start, run. It is imported through the ROOT SUBPATH
// (src/index.ts) rather than through a deep path, because the point is that the
// single public entry point resolves and works.
//
// One correction is asserted here on purpose. The README shows
//     const validateUser = Builder()...build();
//     validateUser({ ... });
// build() has never returned a function — validator-factory always returned an
// object (docs/legacy-spec/public-api-surface.md §1.5), and the new
// implementation keeps the object. The README's call form is the documentation
// bug, not the implementation.
// ===========================================================================
import { Builder } from "../../../src/index";
import type { Validator } from "../../../src/index";
import {
  numberMinPlugin,
  stringMinPlugin,
} from "../../../src/plugins/check-plugins";
import { requiredPlugin } from "../../../src/plugins/presence-plugins";
import { stringFormatPlugin } from "../../../src/plugins/string/format";

type User = {
  name: string;
  age: number;
  email: string;
};

const emailCheckers = { email: (value: string) => value.includes("@") };

const userValidator: Validator<User> = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(stringFormatPlugin)
  .for<User>()
  .v("name", (b) => b.string.required().min(3))
  .v("age", (b) => b.number.required().min(18))
  .v("email", (b) => b.string.required().format("email", emailCheckers))
  .build();

describe("the README Quick Start", () => {
  it("accepts the documented happy path", () => {
    const outcome = userValidator.validate({
      name: "John",
      age: 25,
      email: "john@example.com",
    });
    expect(outcome.valid).toBe(true);
    expect(outcome.issues).toEqual([]);
  });

  it("exposes result.issues with a path, a code and a message", () => {
    const outcome = userValidator.validate(
      { name: "Jo", age: 12, email: "nope" },
      { abortEarly: false }
    );
    expect(outcome.valid).toBe(false);
    expect(outcome.issues).toEqual([
      {
        path: "name",
        code: "stringMin",
        message: "String must have at least 3 characters",
        severity: "error",
      },
      {
        path: "age",
        code: "numberMin",
        message: "Number must be at least 18",
        severity: "error",
      },
      {
        path: "email",
        code: "stringFormat",
        message: "String must be a valid email",
        severity: "error",
      },
    ]);
  });

  it("narrows on `valid` with no cast, and `data` is the declared type", () => {
    const outcome = userValidator.validate({
      name: "John",
      age: 25,
      email: "john@example.com",
    });
    if (!outcome.valid) throw new Error("expected the happy path");
    const name: string = outcome.data.name;
    const age: number = outcome.data.age;
    expect([name, age]).toEqual(["John", 25]);
  });

  it("returns an OBJECT, correcting the README's call form", () => {
    expect(typeof userValidator).toBe("object");
    expect(() => (userValidator as unknown as () => void)()).toThrow(TypeError);
  });
});
