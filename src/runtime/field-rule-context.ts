// ===========================================================================
// L5  src/runtime/field-rule-context.ts
// The RuleContext one field hands to its rules, with the issue path built only
// if something asks for it.
//
// WHY IT IS LAZY. The path was built eagerly, once per field per subject. At
// the root that costs nothing: joinIssuePath returns the field's own rendered
// path BY IDENTITY when no array is open, so a root-level field allocates no
// string. Inside an array every field has a prefix, so every one of them
// concatenates — 150 strings per validate() of a 50-element array with three
// element fields, and on an accepted value not one of them is read. Together
// with the lazy prefix in IndexStack this measured +26% on the accepted path.
//
// WHY A CLASS. Two contract-safe shapes were built and measured, and both are
// unusable. A getter written into the object literal in runField forces a
// closure context per call: -77%. Defining an own accessor per instance with
// Object.defineProperty forces a map transition per object: -54%. Only a
// getter on the prototype is free, and it is the one shape whose `path` is not
// an OWN property — which is the whole cost of this change, stated below.
//
// WHY `private` AND NOT `#`. The `#` form is the better JavaScript: real
// private slots that no consumer can enumerate. It is also wrong here. This
// package emits ES2020, and at that target TypeScript downlevels `#` to three
// WeakMaps plus __classPrivateFieldGet/Set helpers — 302 B gzip against 75 B,
// over every bundle-size ceiling, and three WeakMap lookups per field per
// element in the SHIPPED artifact. It measured the same as `private` only
// because the benchmark transpiles with esbuild, which keeps `#` native. The
// measurement did not transfer to dist/, and dist/ is what consumers run.
//
// WHAT THIS COSTS. `path` is on the prototype, so it is not an own property:
//   ctx.path              works
//   const { path } = ctx  works
//   "path" in ctx         works
//   JSON.stringify(ctx)   works — toJSON below pins the shape
//   Object.keys(ctx)      no longer lists "path", and lists the internals
//   { ...ctx }            loses "path", and copies the internals
// RuleContext is declared as an interface, which promises property ACCESS and
// nothing about own-enumerability, so a rule that spreads its context was
// relying on something never published. Nothing in this repository — 77
// plugins, the docs, the examples — spreads one.
// ===========================================================================
import type { ArrayItemContext, RuleContext } from "../types";
import type { IndexStack } from "./index-stack";

export class FieldRuleContext implements RuleContext {
  /**
   * The path once something has asked for it. `null` rather than `""` because
   * the empty string is a real path — the root.
   *
   * It is remembered because the index stack underneath is MUTABLE and is
   * popped when the element ends. A rule that kept its context and read `path`
   * afterwards would otherwise see wherever the runner had moved on to.
   * Reading it during the rule's own call — which is what every rule does —
   * pins it.
   */
  private rendered: string | null = null;

  constructor(
    readonly root: unknown,
    private readonly indices: IndexStack,
    /** Built at compile time, relative to the subject this field reads from. */
    private readonly ownPath: string,
    readonly item: ArrayItemContext | undefined,
    readonly external: Readonly<Record<string, unknown>> | undefined
  ) {}

  get path(): string {
    const already = this.rendered;
    if (already !== null) return already;
    const built = this.indices.renderFieldPath(this.ownPath);
    this.rendered = built;
    return built;
  }

  /**
   * Serialising a context is a thing people do when they log a failure, and a
   * prototype getter would silently drop `path` from the output. This pins the
   * JSON shape to the four DECLARED members and, as a side effect, stops the
   * internals above from reaching a log line.
   */
  toJSON(): Record<string, unknown> {
    return {
      root: this.root,
      path: this.path,
      item: this.item,
      external: this.external,
    };
  }
}
