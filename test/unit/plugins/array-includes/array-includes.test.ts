import { Builder } from "../../../../src/index";
import { arrayIncludesPlugin } from "../../../../src/plugins/array-includes";

type Bag = { readonly tags: readonly string[] };
type Numbers = { readonly scores: readonly number[] };

const validator = Builder()
  .use(arrayIncludesPlugin)
  .for<Bag>()
  .v("tags", (b) => b.array.includes("urgent"))
  .build();

describe("arrayIncludes", () => {
  it("accepts an array holding the element", () => {
    expect(validator.validate({ tags: ["new", "urgent"] }).valid).toBe(true);
  });

  it("rejects an array without it, with the legacy message", () => {
    const result = validator.validate({ tags: ["new"] });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(["arrayIncludes"]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      'Array must include "urgent"',
    ]);
  });

  // SameValueZero, exactly as Array.prototype.includes has it.
  it("finds NaN, which === never does", () => {
    const nanValidator = Builder()
      .use(arrayIncludesPlugin)
      .for<Numbers>()
      .v("scores", (b) => b.array.includes(Number.NaN))
      .build();
    expect(nanValidator.validate({ scores: [Number.NaN] }).valid).toBe(true);
    expect(nanValidator.validate({ scores: [1] }).valid).toBe(false);
  });

  it("treats 0 and -0 as the same element", () => {
    const zeroValidator = Builder()
      .use(arrayIncludesPlugin)
      .for<Numbers>()
      .v("scores", (b) => b.array.includes(0))
      .build();
    expect(zeroValidator.validate({ scores: [-0] }).valid).toBe(true);
  });

  it("compares objects by identity, as legacy did", () => {
    const marker = { id: 1 };
    const identityValidator = Builder()
      .use(arrayIncludesPlugin)
      .for<{ readonly rows: readonly unknown[] }>()
      .v("rows", (b) => b.array.includes(marker))
      .build();
    expect(identityValidator.validate({ rows: [marker] }).valid).toBe(true);
    expect(identityValidator.validate({ rows: [{ id: 1 }] }).valid).toBe(false);
  });

  it("passes a non-array through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ tags: "urgent" }).issues.map((issue) => issue.code)
    ).toEqual(["arrayType"]);
  });

  it("honours options.code and the {element} message context", () => {
    const custom = Builder()
      .use(arrayIncludesPlugin)
      .for<Bag>()
      .v("tags", (b) =>
        b.array.includes("urgent", {
          code: "MISSING_TAG",
          messageFactory: (context) => `need ${String(context.element)}`,
        })
      )
      .build();
    const result = custom.validate({ tags: [] });
    expect(result.issues.map((issue) => issue.code)).toEqual(["MISSING_TAG"]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "need urgent",
    ]);
  });
});
