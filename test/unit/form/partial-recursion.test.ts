import { Builder } from "../../../src/index";
import { validateFields } from "../../../src/form";
import { objectRecursivelyPlugin } from "../../../src/plugins/object-recursively";
import { requiredPlugin } from "../../../src/plugins/required";

describe("partial recursive declarations", () => {
  it("runs a selected recursive declaration as an indivisible rule", () => {
    interface Tree {
      name: string;
      children: Tree[];
    }
    const validator = Builder()
      .use(objectRecursivelyPlugin)
      .use(requiredPlugin)
      .for<Tree>()
      .v("name", (b) => b.string.required())
      .v("children", (b) => b.array.recursively("element"))
      .build();
    const outcome = validateFields(
      validator,
      {
        children: [{ children: [] }],
      },
      ["children"]
    );
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "children[0].name",
    ]);
  });

  it("detects recursion inside a selected array row", () => {
    interface Tree {
      name: string;
      rows: { child: Tree }[];
    }
    const validator = Builder()
      .use(objectRecursivelyPlugin)
      .use(requiredPlugin)
      .for<Tree>()
      .v("name", (b) => b.string.required())
      .v("rows[*].child", (b) => b.object.recursively("self"))
      .build();
    const outcome = validateFields(
      validator,
      {
        rows: [{ child: { rows: [] } }, { child: { rows: [] } }],
      },
      ["rows[1].child"]
    );
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.map((issue) => issue.path)).toEqual([
      "rows[1].child.name",
    ]);
  });
});
