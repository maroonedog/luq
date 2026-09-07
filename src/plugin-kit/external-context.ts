// ===========================================================================
// L2  src/plugin-kit/external-context.ts
// RESIDUAL 4 / item 1 — the READ side of the async story.
//
// It lives at L2, not at L9, for a layering reason found by compiling: the only
// consumer that matters is a PLUGIN (fromContext), and a plugin at L7 may not
// import L9. L9 re-exports this under the 1.x name so the public surface is
// unchanged, but the mechanism is a plain read of RuleContext.external, which
// is L0 vocabulary. Nothing in the engine knows the word "async".
//
// 1.x's getAsyncContext<C>(context) asserted the shape. Here the caller passes
// the guard that proves it — alternative 2 in the code standard, not
// alternative 4 — so a context that never resolved cannot masquerade as one
// that did.
// ===========================================================================
import { isPlainObject, type RuleContext } from "../types";

export function readExternalContext<C extends object>(
  ctx: RuleContext,
  isContext: (value: unknown) => value is C
): C | undefined {
  const external = ctx.external;
  if (external === undefined || !isPlainObject(external)) return undefined;
  return isContext(external) ? external : undefined;
}
