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
// `items[0].name` on its own. The array runner pushes the enclosing node, and
// the rendered prefix is cached per frame: entering costs one string, and a
// field then pays one concatenation rather than re-walking the whole nesting.
//
// It is deliberately MUTABLE and pushed/popped around an element loop: one
// stack lives for one validate() call, and 10k elements must not allocate 10k
// index arrays.
// ===========================================================================

export class IndexStack {
  private readonly prefixes: string[] = [];
  private readonly openIndices: number[] = [];
  /**
   * The top of `prefixes`, held as a plain field.
   *
   * It was a getter reading `prefixes[prefixes.length - 1] ?? ""`, and a CPU
   * profile of the array shape put 12% of self time there: every field of
   * every element asks for the prefix, so 50 elements with 3 element fields
   * read the top of that array 150 times per validate() for a string that
   * only changes on push and pop. Maintaining it where it changes costs one
   * assignment per element and nothing per field.
   */
  private currentPrefix = "";

  /** How many array levels are currently open. */
  get depth(): number {
    return this.openIndices.length;
  }

  /** The open indices, outermost first: `[0, 2]` inside `grid[0][2]`. */
  get indices(): readonly number[] {
    return this.openIndices;
  }

  /**
   * The top of `prefixes`, or `""` when nothing is open.
   *
   * The length is tested BEFORE indexing. `prefixes[prefixes.length - 1]` at
   * depth 0 is `prefixes[-1]`, which is not an element read at all: -1 is
   * outside the array, so V8 falls back to a named-property lookup and walks
   * the prototype chain. That single expression was the whole reason the old
   * `prefix` getter took 12% of the array shape's self time.
   */
  private readTop(): string {
    const depth = this.prefixes.length;
    if (depth === 0) return "";
    const top = this.prefixes[depth - 1];
    return top === undefined ? "" : top;
  }

  /** `""` at the root, `items[0]` inside the first element of `items`. */
  get prefix(): string {
    return this.currentPrefix;
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
    const entered = `${joinIssuePath(this.currentPrefix, nodePath)}[${index}]`;
    this.prefixes.push(entered);
    this.openIndices.push(index);
    this.currentPrefix = entered;
  }

  /** An unbalanced pop means a runner lost track of its own nesting. */
  pop(): void {
    if (this.openIndices.length === 0) {
      throw new RangeError("popped an array index that was never pushed");
    }
    this.prefixes.pop();
    this.openIndices.pop();
    this.currentPrefix = this.readTop();
  }

  /**
   * The issue path of a field read from the subject at the current level.
   *
   * `renderedPath` was built once, at compile time. This used to walk the
   * template on every call, which for an array meant rebuilding the same
   * string once per element.
   */
  renderFieldPath(renderedPath: string): string {
    return joinIssuePath(this.currentPrefix, renderedPath);
  }
}

/** `""` is the root path, so it never contributes a separator dot. */
export function joinIssuePath(prefix: string, own: string): string {
  if (prefix === "") return own;
  if (own === "") return prefix;
  return `${prefix}.${own}`;
}
