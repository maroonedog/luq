import { Builder } from "../../../src/index";
import { createPartialValidator, validateFields } from "../../../src/form";
import { customPlugin } from "../../../src/plugins/custom";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { compareFieldPlugin } from "../../../src/plugins/compare-field";
import { transformPlugin } from "../../../src/plugins/transform";
import { fromContextPlugin } from "../../../src/plugins/from-context";

describe("validateFields", () => {
  it("does not execute or read unselected fields", () => {
    const selected = jest.fn(() => true);
    const unrelated = jest.fn(() => false);
    const normalize = jest.fn((value: unknown) => value);
    const defaultValue = jest.fn(() => "default");
    const validator = Builder()
      .use(customPlugin)
      .for<{ email: string; other: string }>()
      .v("other", (b) => b.string.custom(unrelated), {
        normalize,
        default: defaultValue,
      })
      .v("email", (b) => b.string.custom(selected))
      .build();
    const values = {
      email: "ok",
      get other(): string {
        throw new Error("unselected read");
      },
    };
    const outcome = validateFields(validator, values, ["email"]);
    expect(outcome).toEqual({ valid: true, issues: [] });
    expect(selected).toHaveBeenCalledTimes(1);
    expect(unrelated).not.toHaveBeenCalled();
    expect(normalize).not.toHaveBeenCalled();
    expect(defaultValue).not.toHaveBeenCalled();
    expect("data" in outcome).toBe(false);
  });

  it("leaves pickAll's full-plan behavior intact", () => {
    const unrelated = jest.fn(() => false);
    const validator = Builder()
      .use(customPlugin)
      .for<{ email: string; other: string }>()
      .v("email", (b) => b.string.custom(() => true))
      .v("other", (b) => b.string.custom(unrelated))
      .build();
    const values = { email: "ok", other: "bad" };
    expect(validateFields(validator, values, ["email"]).valid).toBe(true);
    expect(unrelated).not.toHaveBeenCalled();
    expect(validator.pickAll(["email"]).validate(values).valid).toBe(true);
    expect(unrelated).toHaveBeenCalledTimes(1);
  });

  it("reads cross-field comparisons from current full values without validating their rules", () => {
    const passwordCheck = jest.fn(() => false);
    const validator = Builder()
      .use(compareFieldPlugin)
      .use(customPlugin)
      .for<{ password: string; confirm: string }>()
      .v("password", (b) => b.string.custom(passwordCheck))
      .v("confirm", (b) => b.string.compareField("password"))
      .build();
    const partial = createPartialValidator(validator, ["confirm"]);
    expect(
      partial.validate({ password: "secret", confirm: "different" }).issues[0]
        ?.path
    ).toBe("confirm");
    expect(partial.validate({ password: "new", confirm: "new" }).valid).toBe(
      true
    );
    expect(passwordCheck).not.toHaveBeenCalled();
  });

  it("applies selected defaults and normalization without transforms or input mutation", () => {
    const normalize = jest.fn((value: unknown) =>
      typeof value === "string" ? value.trim() : value
    );
    const transform = jest.fn((value: string) => value.toUpperCase());
    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(transformPlugin)
      .for<{ name: string }>()
      .v("name", (b) => b.string.required().min(3).transform(transform), {
        default: " Ada ",
        normalize,
      })
      .build();
    const values = Object.freeze({});
    expect(validateFields(validator, values, ["name"]).valid).toBe(true);
    expect(normalize).toHaveBeenCalledWith(" Ada ");
    expect(transform).not.toHaveBeenCalled();
    expect(values).toEqual({});
    expect(validateFields(validator, { name: " a " }, ["name"]).valid).toBe(
      false
    );
  });

  it("collects selected issues by default, respects options, and skips unrelated presence failures", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(customPlugin)
      .for<{ a: string; b: string; unrelated: string }>()
      .v("unrelated", (b) => b.string.required())
      .v("a", (b) => b.string.custom(() => false).custom(() => false))
      .v("b", (b) => b.string.required())
      .build();
    const values = { a: "bad" };
    expect(validateFields(validator, values, ["a", "b"]).issues).toHaveLength(
      3
    );
    expect(
      validateFields(validator, values, ["a", "b"], { abortEarly: true }).issues
    ).toHaveLength(2);
    expect(
      validateFields(validator, values, ["a", "b"], {
        abortEarly: true,
        abortEarlyOnEachField: true,
      }).issues
    ).toHaveLength(1);
    expect(
      validateFields(validator, values, ["a", "b"], {
        abortEarlyOnEachField: true,
      }).issues
    ).toHaveLength(2);
  });

  it("keeps warnings and external context", () => {
    const validator = Builder()
      .use(customPlugin)
      .use(fromContextPlugin)
      .for<{ name: string }>()
      .v("name", (b) =>
        b.string
          .custom(() => false, { severity: "warning" })
          .fromContext({
            check: (_value, context) => ({
              valid: context["allowed"] === true,
            }),
          })
      )
      .build();
    const outcome = validateFields(validator, { name: "Ada" }, ["name"], {
      external: { allowed: true },
    });
    expect(outcome.valid).toBe(true);
    expect(outcome.issues.map((issue) => issue.severity)).toEqual(["warning"]);
  });

  it("supports empty selections and retains root-missing configuration", () => {
    const check = jest.fn(() => false);
    const validator = Builder()
      .withConfig({ rootMissingMessage: "Form is missing" })
      .use(customPlugin)
      .for<{ name: string }>()
      .v("name", (b) => b.string.custom(check))
      .build();
    expect(validateFields(validator, {}, [])).toEqual({
      valid: true,
      issues: [],
    });
    expect(check).not.toHaveBeenCalled();
    expect(validateFields(validator, null, ["name"]).issues[0]?.message).toBe(
      "Form is missing"
    );
  });

  it("snapshots, freezes and deduplicates paths; rejects undeclared paths", () => {
    const check = jest.fn(() => true);
    const validator = Builder()
      .use(customPlugin)
      .for<{ name: string; age: number }>()
      .v("name", (b) => b.string.custom(check))
      .build();
    const paths: "name"[] = ["name", "name"];
    const partial = createPartialValidator(validator, paths);
    paths.pop();
    expect(Object.isFrozen(partial)).toBe(true);
    expect(Object.isFrozen(partial.paths)).toBe(true);
    expect(partial.paths).toEqual(["name", "name"]);
    partial.validate({ name: "Ada" });
    expect(check).toHaveBeenCalledTimes(1);
    expect(() => createPartialValidator(validator, ["age"])).toThrow(
      'No declared validation field matches "age"'
    );
  });
});
