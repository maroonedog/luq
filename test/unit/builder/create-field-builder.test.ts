import { Builder } from "../../../src/builder/field-builder.types";
import { createFieldBuilderSurface } from "../../../src/builder/create-field-builder";
import type { Validator } from "../../../src/builder/validator.types";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";

interface Person {
  readonly name: string;
  readonly age: string;
  readonly city: string;
}

const chainOf = () =>
  Builder()
    .use(requiredPlugin)
    .use(optionalPlugin)
    .use(stringMinPlugin)
    .for<Person>();

function issuePathsOf(validator: Validator<Person>): readonly string[] {
  return validator
    .validate({}, { abortEarly: false })
    .issues.map((issue) => issue.path);
}

describe(".v() is immutable", () => {
  it("returns a NEW surface and leaves the receiver alone", () => {
    const empty = chainOf();
    const withName = empty.v("name", (b) => b.string.required());
    expect(withName).not.toBe(empty);
    expect(issuePathsOf(empty.build())).toEqual([]);
    expect(issuePathsOf(withName.build())).toEqual(["name"]);
  });

  it("lets two chains branch from one receiver without contaminating it", () => {
    const base = chainOf().v("name", (b) => b.string.required());
    const withAge = base.v("age", (b) => b.string.required());
    const withCity = base.v("city", (b) => b.string.required());
    expect(issuePathsOf(base.build())).toEqual(["name"]);
    expect(issuePathsOf(withAge.build())).toEqual(["name", "age"]);
    expect(issuePathsOf(withCity.build())).toEqual(["name", "city"]);
  });
});

describe("the field callback runs exactly once, at build()", () => {
  it("has not run when .v() returns", () => {
    let runs = 0;
    const surface = chainOf().v("name", (b) => {
      runs += 1;
      return b.string.required();
    });
    expect(runs).toBe(0);
    surface.build();
    expect(runs).toBe(1);
  });

  it("does not run again for any number of validate / parse calls", () => {
    let runs = 0;
    const validator = chainOf()
      .v("name", (b) => {
        runs += 1;
        return b.string.required();
      })
      .build();
    for (let call = 0; call < 5; call += 1) {
      validator.validate({ name: "Ada" });
      validator.parse({ name: "Ada" });
    }
    expect(runs).toBe(1);
  });

  it("runs once PER build(), never once per builder", () => {
    let runs = 0;
    const surface = chainOf().v("name", (b) => {
      runs += 1;
      return b.string.required();
    });
    surface.build();
    surface.build();
    expect(runs).toBe(2);
  });
});

describe(".strict()", () => {
  it("returns the receiver: it has no runtime effect", () => {
    const surface = chainOf().v("name", (b) => b.string.required());
    expect(surface.strict()).toBe(surface);
  });

  it("does not reject an undeclared property at run time", () => {
    const validator = chainOf()
      .v("name", (b) => b.string.required())
      .v("age", (b) => b.string.optional())
      .v("city", (b) => b.string.optional())
      .strict()
      .build();
    expect(validator.validate({ name: "Ada", extra: 1 }).valid).toBe(true);
  });
});

describe("createFieldBuilderSurface", () => {
  it("declares nothing when it is handed no entries", () => {
    const validator = createFieldBuilderSurface(
      Object.freeze({}),
      undefined
    ).build();
    expect(validator.validate({}).valid).toBe(true);
    expect(validator.validate({}).issues).toEqual([]);
  });

  it("freezes every surface it hands out", () => {
    const surface = chainOf();
    expect(Object.isFrozen(surface)).toBe(true);
    expect(Object.isFrozen(surface.v("name", (b) => b.string.required()))).toBe(
      true
    );
  });
});
