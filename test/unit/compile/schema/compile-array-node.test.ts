// ===========================================================================
// The ArrayNode tree, asserted as a SHAPE.
//
// One array read however many element fields there are, and one level of
// nesting per `[*]` in the declaration. The shape is rendered to plain data
// below rather than snapshotted to a file, so a change to it has to be read
// and agreed to in the diff instead of accepted with `-u`.
// ===========================================================================
import { formatFieldPath, parseFieldPath } from "../../../../src/path";
import { compileArrayNode } from "../../../../src/compile/compile-array-node";
import type { NodeCompileContext } from "../../../../src/compile/compile-array-node";
import { groupArrayFields } from "../../../../src/compile/group-array-fields";
import type { RelativeDeclaration } from "../../../../src/compile/group-array-fields";
import type { ArrayNode } from "../../../../src/compile/validation-plan.types";
import {
  eraseCompositeToCheck,
  makeCheck,
  unresolvablePlanRef,
} from "../rule-fixtures";

const CONTEXT: NodeCompileContext = {
  planRef: unresolvablePlanRef(),
  eraseComposite: eraseCompositeToCheck,
};

function declare(path: string): RelativeDeclaration {
  return {
    template: parseFieldPath(path),
    rules: [makeCheck(path)],
    fieldPath: path,
    defaultOf: null,
    applyDefaultToNull: true,
  };
}

/** Compiles the ONE array group the given paths describe. */
function compileOneNode(paths: readonly string[]): ArrayNode {
  const grouped = groupArrayFields(paths.map(declare));
  const group = grouped.arrays[0];
  if (group === undefined) throw new Error("no array group was produced");
  return compileArrayNode(group, CONTEXT);
}

interface NodeShape {
  readonly array: string;
  readonly elements: readonly string[];
  readonly nested: readonly NodeShape[];
}

function shapeOf(node: ArrayNode): NodeShape {
  return {
    array: formatFieldPath(node.template),
    elements: node.elementFields.map((field) =>
      formatFieldPath(field.template)
    ),
    nested: node.nested.map(shapeOf),
  };
}

describe("three fields under one prefix become ONE node", () => {
  const node = compileOneNode([
    "addresses[*].type",
    "addresses[*].city",
    "addresses[*].zip",
  ]);

  it("has one array reader and three element fields", () => {
    expect(shapeOf(node)).toEqual({
      array: "addresses",
      elements: ["type", "city", "zip"],
      nested: [],
    });
  });

  it("reads the array once, whatever the element field count", () => {
    let reads = 0;
    const subject = {
      get addresses() {
        reads += 1;
        return [{ type: "home" }, { type: "work" }];
      },
    };
    const array = node.read(subject);
    expect(reads).toBe(1);
    expect(array).toHaveLength(2);
  });

  it("resolves a non-array to null and an empty array to []", () => {
    expect(node.read({ addresses: "nope" })).toBeNull();
    expect(node.read({})).toBeNull();
    expect(node.read({ addresses: [] })).toEqual([]);
  });

  it("gives every element field a reader relative to ONE element", () => {
    const readers = node.elementFields.map((field) =>
      field.read({ type: "home", city: "Kyoto", zip: "600" })
    );
    expect(readers).toEqual(["home", "Kyoto", "600"]);
  });
});

describe("nesting follows the wildcards", () => {
  it("nests two nodes for items[*].sub[*].x", () => {
    expect(shapeOf(compileOneNode(["items[*].sub[*].x"]))).toEqual({
      array: "items",
      elements: [],
      nested: [{ array: "sub", elements: ["x"], nested: [] }],
    });
  });

  it("compiles matrix[*][*] to two levels with an EMPTY inner template", () => {
    expect(shapeOf(compileOneNode(["matrix[*][*]"]))).toEqual({
      array: "matrix",
      elements: [],
      nested: [{ array: "", elements: [""], nested: [] }],
    });
  });

  it("reads the inner array of matrix[*][*] off the element itself", () => {
    const node = compileOneNode(["matrix[*][*]"]);
    const inner = node.nested[0]!;
    expect(inner.read([1, 2])).toEqual([1, 2]);
    expect(inner.read(7)).toBeNull();
    expect(inner.elementFields[0]!.read("cell")).toBe("cell");
  });

  it("keeps element fields and nested nodes side by side", () => {
    expect(
      shapeOf(compileOneNode(["items[*].name", "items[*].tags[*].label"]))
    ).toEqual({
      array: "items",
      elements: ["name"],
      nested: [{ array: "tags", elements: ["label"], nested: [] }],
    });
  });

  it("reaches three levels for a[*].b[*].c[*].d", () => {
    expect(shapeOf(compileOneNode(["a[*].b[*].c[*].d"]))).toEqual({
      array: "a",
      elements: [],
      nested: [
        {
          array: "b",
          elements: [],
          nested: [{ array: "c", elements: ["d"], nested: [] }],
        },
      ],
    });
  });
});

describe("the node is data, frozen and inert", () => {
  const node = compileOneNode(["items[*].name"]);

  it("freezes the node and both of its lists", () => {
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.elementFields)).toBe(true);
    expect(Object.isFrozen(node.nested)).toBe(true);
  });

  it("never resolved the PlanRef while compiling", () => {
    expect(() => compileOneNode(["items[*].name"])).not.toThrow();
  });

  it("runs no user check during compilation", () => {
    let runs = 0;
    const group = groupArrayFields([
      {
        template: parseFieldPath("items[*].name"),
        rules: [
          makeCheck("counted", () => {
            runs += 1;
            return { ok: true };
          }),
        ],
        fieldPath: "items[*].name",
        defaultOf: null,
        applyDefaultToNull: true,
      },
    ]).arrays[0]!;
    compileArrayNode(group, CONTEXT);
    expect(runs).toBe(0);
  });
});
