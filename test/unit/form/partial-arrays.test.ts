import { Builder } from "../../../src/index";
import { createPartialValidator, validateFields } from "../../../src/form";
import { customPlugin } from "../../../src/plugins/custom";
import { requiredPlugin } from "../../../src/plugins/required";
import { requiredIfPlugin } from "../../../src/plugins/required-if";

type Form = {
  lines: { name: string; quantity: number; children: { name: string }[] }[];
  line: string;
};

describe("partial array execution", () => {
  it.each(["lines[1].name", "lines.1.name"] as const)(
    "runs only %s and preserves its real issue index",
    (path) => {
      const name = jest.fn(() => false);
      const quantity = jest.fn(() => false);
      const validator = Builder()
        .use(customPlugin)
        .for<Form>()
        .v("lines[*].name", (b) => b.string.custom(name))
        .v("lines[*].quantity", (b) => b.number.custom(quantity))
        .build();
      const untouched = {
        get name(): string {
          throw new Error("unselected row");
        },
      };
      const values = {
        lines: [untouched, { name: "selected", quantity: 1 }, untouched],
      };
      const outcome = validateFields(validator, values, [path]);
      expect(name).toHaveBeenCalledTimes(1);
      expect(quantity).not.toHaveBeenCalled();
      expect(outcome.issues.map((issue) => issue.path)).toEqual([
        "lines[1].name",
      ]);
    }
  );

  it("selects a different field in each row without leaking rules across rows", () => {
    const name = jest.fn(() => false);
    const quantity = jest.fn(() => false);
    const validator = Builder()
      .use(customPlugin)
      .for<Form>()
      .v("lines[*].name", (b) => b.string.custom(name))
      .v("lines[*].quantity", (b) => b.number.custom(quantity))
      .build();
    const outcome = validateFields(
      validator,
      {
        lines: [
          { name: "a", quantity: 1 },
          { name: "b", quantity: 2 },
        ],
      },
      ["lines[0].name", "lines[1].quantity"]
    );
    expect(name.mock.calls).toHaveLength(1);
    expect(quantity.mock.calls).toHaveLength(1);
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "lines[0].name",
      "lines[1].quantity",
    ]);
  });

  it("merges wildcard and concrete selections without double-running overlapping rules", () => {
    const name = jest.fn(() => false);
    const quantity = jest.fn(() => false);
    const validator = Builder()
      .use(customPlugin)
      .for<Form>()
      .v("lines[*].name", (b) => b.string.custom(name))
      .v("lines[*].quantity", (b) => b.number.custom(quantity))
      .build();
    const outcome = validateFields(
      validator,
      {
        lines: [
          { name: "a", quantity: 1 },
          { name: "b", quantity: 2 },
        ],
      },
      ["lines[*].name", "lines[1].name", "lines[1].quantity"]
    );
    expect(name).toHaveBeenCalledTimes(2);
    expect(quantity).toHaveBeenCalledTimes(1);
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "lines[0].name",
      "lines[1].name",
      "lines[1].quantity",
    ]);
  });

  it("keeps nested indices and isolates selected descendants", () => {
    const name = jest.fn(() => false);
    const validator = Builder()
      .use(customPlugin)
      .for<Form>()
      .v("lines[*].children[*].name", (b) => b.string.custom(name))
      .build();
    const partial = createPartialValidator(validator, [
      "lines[1].children.0.name",
    ]);
    const values = {
      lines: [
        { children: [{ name: "untouched" }] },
        { children: [{ name: "bad" }, { name: "untouched" }] },
      ],
    };
    expect(partial.validate(values).issues.map((issue) => issue.path)).toEqual([
      "lines[1].children[0].name",
    ]);
    expect(name).toHaveBeenCalledTimes(1);
  });

  it("supports adjacent wildcards for matrix inputs", () => {
    const check = jest.fn(() => false);
    const validator = Builder()
      .use(customPlugin)
      .for<{ grid: string[][] }>()
      .v("grid[*][*]", (b) => b.string.custom(check))
      .build();
    expect(
      validateFields(
        validator,
        {
          grid: [
            ["a", "b"],
            ["c", "d"],
          ],
        },
        ["grid.1.0"]
      ).issues[0]?.path
    ).toBe("grid[1][0]");
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("passes the original array, row and root into conditional presence", () => {
    const when = jest.fn((_root, _context) => true);
    const validator = Builder()
      .use(requiredIfPlugin)
      .for<Form>()
      .v("lines[*].name", (b) => b.string.requiredIf(when))
      .build();
    const values = { lines: [{ name: "first" }, { name: "" }] };
    const outcome = validateFields(validator, values, ["lines[1].name"]);
    expect(when).toHaveBeenCalledTimes(1);
    expect(when.mock.calls[0]).toEqual([
      values,
      { index: 1, item: values.lines[1], array: values.lines },
    ]);
    expect(outcome.issues[0]?.path).toBe("lines[1].name");
  });

  it("selects container descendants but no similarly named sibling", () => {
    const unrelated = jest.fn(() => false);
    const validator = Builder()
      .use(requiredPlugin)
      .use(customPlugin)
      .for<Form>()
      .v("lines", (b) => b.array.required())
      .v("lines[*].name", (b) => b.string.required())
      .v("line", (b) => b.string.custom(unrelated))
      .build();
    const outcome = validateFields(
      validator,
      { lines: [{ name: "" }], line: "bad" },
      ["lines"]
    );
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "lines[0].name",
    ]);
    expect(unrelated).not.toHaveBeenCalled();
  });

  it("handles empty arrays, missing rows and holes without changing the input", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<Form>()
      .v("lines[*].name", (b) => b.string.required())
      .build();
    const partial = createPartialValidator(validator, ["lines[1].name"]);
    expect(partial.validate({ lines: [] }).valid).toBe(true);
    const lines = new Array(2);
    expect(partial.validate({ lines }).issues[0]?.path).toBe("lines[1].name");
    expect(1 in lines).toBe(false);
  });
});
