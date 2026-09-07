import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { objectRecursivelyPlugin } from "../../../../src/plugins/object-recursively";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";

interface Node {
  readonly label: string;
  readonly children: readonly Node[];
}

const treeValidator = Builder()
  .use(objectRecursivelyPlugin)
  .use(probeMinCharsPlugin)
  .for<Node>()
  .v("label", (b) => b.string.minChars(2))
  .v("children", (b) => b.array.recursively("element"))
  .build();

describe("objectRecursively", () => {
  it("re-applies the whole plan to every element, at every depth", () => {
    expect(
      treeValidator.validate({
        label: "root",
        children: [{ label: "kid", children: [] }],
      }).valid
    ).toBe(true);
    const result = treeValidator.validate({
      label: "root",
      children: [{ label: "k", children: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "children[0].label",
    ]);
    expect(result.issues.map((issue) => issue.code)).toEqual(["probeMinChars"]);
  });

  it("keeps the index of every hop in the path", () => {
    const result = treeValidator.validate({
      label: "root",
      children: [
        { label: "ok", children: [] },
        { label: "ok", children: [{ label: "x", children: [] }] },
      ],
    });
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "children[1].children[0].label",
    ]);
  });

  // The runtime owns the descent: the plugin holds no loop, no depth counter
  // and no visited set. These two tests are what that buys.
  it("terminates on a cycle without reporting one", () => {
    const cyclic: { label: string; children: unknown[] } = {
      label: "root",
      children: [],
    };
    cyclic.children.push(cyclic);
    expect(treeValidator.validate(cyclic).valid).toBe(true);
  });

  it("reports reaching maxDepth instead of passing silently", () => {
    const shallow = Builder()
      .use(objectRecursivelyPlugin)
      .use(probeMinCharsPlugin)
      .for<Node>()
      .v("label", (b) => b.string.minChars(2))
      .v("children", (b) => b.array.recursively("element", { maxDepth: 1 }))
      .build();
    const deep = {
      label: "root",
      children: [
        { label: "kid", children: [{ label: "grandkid", children: [] }] },
      ],
    };
    expect(shallow.validate({ label: "root", children: [] }).valid).toBe(true);
    const result = shallow.validate(deep);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectRecursively",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Recursive validation stopped at the maximum depth of 1",
    ]);
  });

  it("re-enters the plan against the value itself for target 'self'", () => {
    interface Chain {
      readonly label: string;
      readonly next: Chain;
    }
    const selfValidator = Builder()
      .use(objectRecursivelyPlugin)
      .use(probeMinCharsPlugin)
      .for<Chain>()
      .v("label", (b) => b.string.minChars(2))
      .v("next", (b) => b.object.recursively("self"))
      .build();
    const result = selfValidator.validate({
      label: "ok",
      next: { label: "x", next: undefined },
    });
    expect(result.issues.map((issue) => issue.path)).toEqual(["next.label"]);
  });

  it("throws at BUILD time on a maxDepth that is not a depth", () => {
    expect(() =>
      Builder()
        .use(objectRecursivelyPlugin)
        .for<Node>()
        .v("children", (b) => b.array.recursively("element", { maxDepth: 0 }))
        .build()
    ).toThrow(PluginArgumentError);
  });
});
