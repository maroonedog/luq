import { Builder } from "../../../src/index";
import { createPartialValidator, validateFields } from "../../../src/form";
import { toStandardSchema } from "../../../src/standard-schema/to-standard-schema";
import { toStandardJsonSchema } from "../../../src/standard-schema/to-standard-json-schema";
import { addAsyncSupport } from "../../../src/async/async-validator";
import { requiredPlugin } from "../../../src/plugins/required";
import { customPlugin } from "../../../src/plugins/custom";
import { parseSelectionPath } from "../../../src/form/selection-path";

describe("partial validation boundaries", () => {
  const validator = Builder()
    .use(requiredPlugin)
    .for<{ name: string; other: string }>()
    .v("name", (b) => b.string.required())
    .v("other", (b) => b.string.required())
    .build();

  it("supports built-in decorators without changing their full validation", () => {
    for (const decorated of [
      toStandardSchema(validator),
      toStandardJsonSchema(validator),
      addAsyncSupport(validator),
      addAsyncSupport(toStandardSchema(validator)),
    ]) {
      expect(validateFields(decorated, { name: "Ada" }, ["name"]).valid).toBe(
        true
      );
      expect(decorated.validate({ name: "Ada" }).valid).toBe(false);
    }
  });

  it("rejects wrappers whose execution plan is unknown", () => {
    expect(() => createPartialValidator({ ...validator }, ["name"])).toThrow(
      "Partial validation requires a Luq-built validator"
    );
    expect(() =>
      createPartialValidator(toStandardSchema({ ...validator }), ["name"])
    ).toThrow("Partial validation requires a Luq-built validator");
  });

  it.each([
    "",
    "rows[-1].name",
    "rows[1.2].name",
    "rows[01].name",
    "rows[4294967295]",
    "rows[]",
    "rows[0",
    "rows..name",
  ])("rejects malformed selection %s", (path) => {
    expect(() => parseSelectionPath(path)).toThrow();
  });

  it("does not implicitly run ancestor constraints or read unrelated arrays", () => {
    const ancestor = jest.fn(() => false);
    const check = jest.fn(() => true);
    const normalizer = jest.fn((value: unknown) => value);
    const form = Builder()
      .use(customPlugin)
      .for<{
        profile: { name: string };
        rows: { name: string; other: string }[];
        untouched: string[];
      }>()
      .v("profile", (b) => b.object.custom(ancestor))
      .v("profile.name", (b) => b.string.custom(check))
      .v("rows[*].name", (b) => b.string.custom(check))
      .v("rows[*].other", (b) => b.string.custom(ancestor), {
        normalize: normalizer,
      })
      .v("untouched[*]", (b) => b.string.custom(ancestor))
      .build();
    const values = {
      profile: { name: "Ada" },
      rows: [
        {
          name: "ok",
          get other(): string {
            throw new Error("unselected field");
          },
        },
      ],
      get untouched(): string[] {
        throw new Error("unselected array");
      },
    };
    expect(
      validateFields(form, values, ["profile.name", "rows[0].name"]).valid
    ).toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
    expect(ancestor).not.toHaveBeenCalled();
    expect(normalizer).not.toHaveBeenCalled();
  });
});
