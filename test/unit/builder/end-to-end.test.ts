// ===========================================================================
// The whole of L6 against the contract sample plugins: Builder -> use -> for ->
// v -> build -> validate/parse/pick/pickAll. Nothing is stubbed; the plan is
// the real compiler's and the engine is the real one.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { transformPlugin } from "../../../src/plugins/transform";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";
import { resetGlobalConfig } from "../../../src/builder/global-config-store";

interface Employee {
  readonly name: string;
  readonly age: number;
}

interface Company {
  readonly title: string;
  readonly employees: readonly Employee[];
}

const kit = () =>
  Builder()
    .use(requiredPlugin)
    .use(optionalPlugin)
    .use(stringMinPlugin)
    .use(numberMinPlugin)
    .use(transformPlugin);

afterEach(() => {
  resetGlobalConfig();
});

describe("build() returns an object, not a function", () => {
  const validator = kit()
    .for<Company>()
    .v("title", (b) => b.string.required().min(3))
    .v("employees[*].name", (b) => b.string.required().min(1))
    .v("employees[*].age", (b) => b.number.required().min(18))
    .build();

  it("exposes validate / parse / pick / pickAll and is not callable", () => {
    expect(typeof validator).toBe("object");
    expect(typeof validator.validate).toBe("function");
    expect(typeof validator.parse).toBe("function");
    expect(typeof validator.pick).toBe("function");
    expect(typeof validator.pickAll).toBe("function");
  });

  it("accepts a valid company and hands back the very object", () => {
    const company: Company = {
      title: "Acme",
      employees: [{ name: "Ada", age: 36 }],
    };
    const outcome = validator.validate(company);
    expect(outcome.valid).toBe(true);
    expect(outcome.valid && outcome.data).toBe(company);
  });

  it("reports array element paths as items[0].field", () => {
    const outcome = validator.validate(
      {
        title: "Acme",
        employees: [
          { name: "Ada", age: 36 },
          { name: "", age: 3 },
        ],
      },
      { abortEarly: false }
    );
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "employees[1].name",
      "employees[1].age",
    ]);
  });

  it("still honours the default abortEarly through the builder", () => {
    const outcome = validator.validate({
      title: "Acme",
      employees: [{ name: "", age: 3 }],
    });
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "employees[0].name",
    ]);
  });

  it("pick() validates one declared path with its siblings", () => {
    const title = validator.pick("title");
    expect(title.path).toBe("title");
    expect(title.validate("Acme").valid).toBe(true);
    const rejected = title.validate("no");
    expect(rejected.valid).toBe(false);
    expect(rejected.issues.map((issue) => issue.path)).toEqual(["title"]);
  });

  it("pick() reaches a wildcard path without a cast", () => {
    const employeeName = validator.pick("employees[*].name");
    expect(employeeName.validate("Ada").valid).toBe(true);
    expect(employeeName.validate("").valid).toBe(false);
  });

  it("pickAll() returns exactly the paths it was asked for", () => {
    const subset = validator.pickAll(["title", "employees[*].name"]);
    const outcome = subset.validate({
      title: "Acme",
      employees: [{ name: "Ada", age: 3 }],
    });
    expect(outcome.valid).toBe(true);
    expect(outcome.valid && outcome.data).toEqual({
      title: "Acme",
      "employees[*].name": ["Ada"],
    });
  });

  it("pickAll() ignores an issue on a path it did not ask for", () => {
    const subset = validator.pickAll(["title"]);
    const outcome = subset.validate({
      title: "Acme",
      employees: [{ name: "", age: 3 }],
    });
    expect(outcome.valid).toBe(true);
    expect(outcome.issues).toEqual([]);
  });
});

describe("validate never transforms, parse does", () => {
  const validator = kit()
    .for<{ readonly name: string }>()
    .v("name", (b) =>
      b.string.required().transform((value) => String(value).toUpperCase())
    )
    .build();

  it("leaves the value alone in validate()", () => {
    const outcome = validator.validate({ name: "ada" });
    expect(outcome.valid && outcome.data).toEqual({ name: "ada" });
  });

  it("applies the transform in parse(), copy-on-write", () => {
    const input = { name: "ada" };
    const outcome = validator.parse(input);
    expect(outcome.valid && outcome.data).toEqual({ name: "ADA" });
    expect(input).toEqual({ name: "ada" });
  });
});

describe("field defaults behave identically in validate and parse", () => {
  const validator = kit()
    .for<{ readonly language: string }>()
    .v("language", (b) => b.string.required().min(2), { default: "en" })
    .build();

  it("judges the default in validate() and does not write it back", () => {
    const outcome = validator.validate({});
    expect(outcome.valid).toBe(true);
    expect(outcome.valid && outcome.data).toEqual({});
  });

  it("judges the same default in parse() and writes it back", () => {
    const outcome = validator.parse({});
    expect(outcome.valid).toBe(true);
    expect(outcome.valid && outcome.data).toEqual({ language: "en" });
  });

  it("rejects a default that its own rules reject, in BOTH entry points", () => {
    const tooShort = kit()
      .for<{ readonly language: string }>()
      .v("language", (b) => b.string.required().min(5), { default: "en" })
      .build();
    expect(tooShort.validate({}).issues.map((issue) => issue.code)).toEqual([
      "stringMin",
    ]);
    expect(tooShort.parse({}).issues.map((issue) => issue.code)).toEqual([
      "stringMin",
    ]);
  });
});
