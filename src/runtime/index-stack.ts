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
import type { PathSegment } from "../path/path-segment.types";
import { formatIssuePath } from "../path/format-issue-path";

/**
 * A compiled template never contains a wildcard (createValueReader rejects
 * one), so rendering it needs no index. Passing none is what makes a stray
 * wildcard template throw here instead of silently rendering a second copy of
 * an index this stack has already written into the prefix.
 */
const NO_INDICES: readonly number[] = Object.freeze([]);

export class IndexStack {
  private readonly prefixes: string[] = [];
  private readonly openIndices: number[] = [];

  /** How many array levels are currently open. */
  get depth(): number {
    return this.openIndices.length;
  }

  /** The open indices, outermost first: `[0, 2]` inside `grid[0][2]`. */
  get indices(): readonly number[] {
    return this.openIndices;
  }

  /** `""` at the root, `items[0]` inside the first element of `items`. */
  get prefix(): string {
    return this.prefixes[this.prefixes.length - 1] ?? "";
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
    this.prefixes.push(`${joinIssuePath(this.prefix, nodePath)}[${index}]`);
    this.openIndices.push(index);
  }

  /** An unbalanced pop means a runner lost track of its own nesting. */
  pop(): void {
    if (this.openIndices.length === 0) {
      throw new RangeError("popped an array index that was never pushed");
    }
    this.prefixes.pop();
    this.openIndices.pop();
  }

  /** The issue path of a field read from the subject at the current level. */
  renderFieldPath(template: readonly PathSegment[]): string {
    return joinIssuePath(this.prefix, formatIssuePath(template, NO_INDICES));
  }
}

/** `""` is the root path, so it never contributes a separator dot. */
export function joinIssuePath(prefix: string, own: string): string {
  if (prefix === "") return own;
  if (own === "") return prefix;
  return `${prefix}.${own}`;
}
