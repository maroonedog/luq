// ===========================================================================
// 遅延する RuleContext。
//
// 見るのは三つ。**いつ組むか**、**何度組むか**、そして **何が見えなくなるか**。
//
// 三つ目が要る理由は、これが公開型の実装だからである。RuleContext は
// interface なので約束しているのはプロパティアクセスだけだが、`path` が own
// プロパティでなくなるのは観測できる差で、黙って持っていてよい差ではない。
// ここに書いてあるものが、この形で失われるものの全部である。
// ===========================================================================
import { FieldRuleContext } from "../../../src/runtime/field-rule-context";
import { IndexStack } from "../../../src/runtime/index-stack";

function contextAt(
  stack: IndexStack,
  ownPath: string,
  root: unknown = { lines: [] }
): FieldRuleContext {
  return new FieldRuleContext(root, stack, ownPath, undefined, undefined);
}

describe("the path is built when it is asked for, and not before", () => {
  it("renders nothing until path is read", () => {
    const stack = new IndexStack();
    let renders = 0;
    const counting = new (class extends IndexStack {
      override renderFieldPath(renderedPath: string): string {
        renders += 1;
        return super.renderFieldPath(renderedPath);
      }
    })();
    const context = contextAt(counting, "sku");
    expect(renders).toBe(0);
    expect(context.path).toBe("sku");
    expect(renders).toBe(1);
    void stack;
  });

  it("builds it once, however many times it is read", () => {
    let renders = 0;
    const counting = new (class extends IndexStack {
      override renderFieldPath(renderedPath: string): string {
        renders += 1;
        return super.renderFieldPath(renderedPath);
      }
    })();
    counting.push("lines", 3);
    const context = contextAt(counting, "sku");
    expect(context.path).toBe("lines[3].sku");
    expect(context.path).toBe("lines[3].sku");
    expect(context.path).toBe("lines[3].sku");
    expect(renders).toBe(1);
  });

  // スタックは可変で、要素が終われば畳まれる。掴んだ path が畳みに追随して
  // 変わるようでは、規則が受け取ったものと発行された issue が食い違う。
  it("pins the path it built, even after the stack has moved on", () => {
    const stack = new IndexStack();
    stack.push("lines", 0);
    const context = contextAt(stack, "sku");
    expect(context.path).toBe("lines[0].sku");
    stack.pop();
    stack.push("lines", 7);
    expect(context.path).toBe("lines[0].sku");
  });

  it("reads the stack as it is at the moment of the FIRST read", () => {
    const stack = new IndexStack();
    stack.push("lines", 2);
    const context = contextAt(stack, "sku");
    stack.pop();
    // 一度も読まないまま畳まれた場合は、畳んだ後の位置で組まれる。規則が
    // 自分の呼び出しの中で読むかぎり起きないが、起きたときに何が返るかは
    // 決めておく。
    expect(context.path).toBe("sku");
  });

  it("renders the root path as the field's own path, by identity", () => {
    const stack = new IndexStack();
    const context = contextAt(stack, "name");
    expect(context.path).toBe("name");
  });
});

describe("the declared members are ordinary properties", () => {
  it("carries root, item and external as given", () => {
    const stack = new IndexStack();
    const root = { lines: [{ sku: "SKU-1" }] };
    const item = { index: 0, item: root.lines[0], array: root.lines };
    const external = Object.freeze({ tenant: "acme" });
    const context = new FieldRuleContext(root, stack, "sku", item, external);
    expect(context.root).toBe(root);
    expect(context.item).toBe(item);
    expect(context.external).toBe(external);
  });

  it("answers destructuring and `in`, the two ways a rule reads a path", () => {
    const stack = new IndexStack();
    stack.push("lines", 1);
    const context = contextAt(stack, "sku");
    const { path } = context;
    expect(path).toBe("lines[1].sku");
    expect("path" in context).toBe(true);
  });
});

describe("what this shape gives up, stated exactly", () => {
  it("puts path on the prototype, so it is not an own property", () => {
    const stack = new IndexStack();
    const context = contextAt(stack, "sku");
    expect(Object.prototype.hasOwnProperty.call(context, "path")).toBe(false);
    expect(Object.keys(context)).not.toContain("path");
  });

  // spread は path を落とす。ただし **TypeScript がそれを知っている** —
  // `{ ...context }.path` は tsc がエラーにするので、型を通している利用者に
  // とってこの差は静かではない。ここで Record に落としているのは、その
  // コンパイルエラーを避けて実行時の姿を見るためである。
  it("loses path through a spread, which the type system already says", () => {
    const stack = new IndexStack();
    stack.push("lines", 0);
    const context = contextAt(stack, "sku");
    expect(context.path).toBe("lines[0].sku");
    const spread: Record<string, unknown> = { ...context };
    expect(spread["path"]).toBeUndefined();
    expect(spread["root"]).toEqual({ lines: [] });
  });

  // ログに流すのは現実にある使い方なので、そこだけは形を固定してある。
  it("keeps JSON to the four declared members, internals included nowhere", () => {
    const stack = new IndexStack();
    stack.push("lines", 4);
    const context = new FieldRuleContext(
      { lines: [] },
      stack,
      "sku",
      undefined,
      Object.freeze({ tenant: "acme" })
    );
    expect(JSON.parse(JSON.stringify(context))).toEqual({
      root: { lines: [] },
      path: "lines[4].sku",
      external: { tenant: "acme" },
    });
  });
});
