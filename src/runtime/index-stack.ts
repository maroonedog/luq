// ===========================================================================
// L5  src/runtime/index-stack.ts
// Where the runtime currently is, expressed as a concrete issue path.
//
// An issue path must read `items[0].name`, never the declaration pattern
// `items[*].name`. The legacy tree carried indices two different ways — the
// nested-array processor threaded them through its own recursion while
// validator-factory fell back to `error.path || elementPath` — which is how
// the pattern string leaked into user-visible errors. There is one stack here
// and every path a runner reports comes out of it.
//
// A CompiledField's template is RELATIVE to the subject it reads from, so an
// element field of `items[*]` has the template `name` and could never render
// `items[0].name` on its own. The array runner pushes the enclosing node and
// the index; the stack renders the prefix.
//
// The prefix is rendered ON DEMAND and remembered until the next push or pop.
// Entering used to build `items[0]` eagerly, which is one string per element
// that nothing reads unless a rule fails — and now nothing reads it even then
// until FieldRuleContext is asked for its path. Entering therefore costs two
// pushes and one assignment, and the first field that asks pays the render.
//
// It is deliberately MUTABLE and pushed/popped around an element loop: one
// stack lives for one validate() call, and 10k elements must not allocate 10k
// index arrays. It is also why FieldRuleContext remembers the path it built —
// this stack has moved on by the time a retained context could read it.
// ===========================================================================

export class IndexStack {
  private readonly nodePaths: string[] = [];
  private readonly openIndices: number[] = [];
  /**
   * The rendered prefix, or `null` when it has not been asked for since the
   * last push or pop. `null` and not `""` because the empty string is a real
   * answer — the root.
   *
   * Invalidating rather than recomputing on push is the point: an element that
   * raises no issue never renders its own prefix at all.
   */
  private currentPrefix: string | null = null;

  /** How many array levels are currently open. */
  get depth(): number {
    return this.openIndices.length;
  }

  /** The open indices, outermost first: `[0, 2]` inside `grid[0][2]`. */
  get indices(): readonly number[] {
    return this.openIndices;
  }

  /**
   * The prefix for the currently open frames — `""` when none are open,
   * `items[0]` inside one, `grid[0][2]` inside two.
   *
   * Indexed, never `nodePaths[nodePaths.length - 1]`. That expression at
   * depth 0 is `nodePaths[-1]`, which is not an element read at all: -1 is
   * outside the array, so V8 falls back to a named-property lookup and walks
   * the prototype chain. The `prefix` getter used to be written that way and
   * it took 12% of the array shape's self time.
   */
  private readTop(): string {
    const already = this.currentPrefix;
    if (already !== null) return already;
    let built = "";
    for (let i = 0; i < this.nodePaths.length; i += 1) {
      const nodePath = this.nodePaths[i];
      const index = this.openIndices[i];
      if (nodePath === undefined || index === undefined) continue;
      built = `${joinIssuePath(built, nodePath)}[${index}]`;
    }
    this.currentPrefix = built;
    return built;
  }

  /** `""` at the root, `items[0]` inside the first element of `items`. */
  get prefix(): string {
    return this.readTop();
  }

  /**
   * Enters element `index` of an array node. `nodePath` is the node's own path
   * relative to the subject it was read from, already rendered — the runner
   * renders it once per NODE, never once per element.
   *
   * A non-integer or negative index is a bug in the runner, not a data
   * condition: it would render `items[-1]`, a path no declaration can produce
   * and no consumer can match. It throws where the caller is still on the
   * stack rather than surfacing as a wrong path much later.
   */
  push(nodePath: string, index: number): void {
    if (!Number.isInteger(index) || index < 0) {
      throw new RangeError(
        `an array index must be a non-negative integer, received ${String(index)}`
      );
    }
    this.nodePaths.push(nodePath);
    this.openIndices.push(index);
    this.currentPrefix = null;
  }

  /** An unbalanced pop means a runner lost track of its own nesting. */
  pop(): void {
    if (this.openIndices.length === 0) {
      throw new RangeError("popped an array index that was never pushed");
    }
    this.nodePaths.pop();
    this.openIndices.pop();
    this.currentPrefix = null;
  }

  /**
   * The issue path of a field read from the subject at the current level.
   *
   * `renderedPath` was built once, at compile time. This used to walk the
   * template on every call, which for an array meant rebuilding the same
   * string once per element.
   */
  renderFieldPath(renderedPath: string): string {
    return joinIssuePath(this.readTop(), renderedPath);
  }
}

/** `""` is the root path, so it never contributes a separator dot. */
export function joinIssuePath(prefix: string, own: string): string {
  if (prefix === "") return own;
  if (own === "") return prefix;
  return `${prefix}.${own}`;
}
