// ===========================================================================
// L2  src/plugin-kit/create-conditional-presence.ts
// The constructor for the one rule kind whose presence answer is not known
// until a root is in hand.
//
// It lives beside create-rule rather than inside it because create-rule is at
// the 200-line ceiling, and because this is the only constructor that takes
// TWO allowances: a predicate has two sides, and a plugin must be able to say
// "this side decides nothing" (null) instead of inventing a policy that would
// silently overrule the field's own `.required()`.
// ===========================================================================
import type {
  IssueSeverity,
  MessageContext,
  MessageContextExtra,
  MessageFactory,
} from "../types";
import { renderMessage } from "./rule-build-context";
import type {
  ConditionalPresenceRule,
  PresenceAllowance,
} from "./compiled-rule";
import type { RootPredicateFn } from "./runtime-args.types";

/** Rejects undefined, null and "" — legacy's emptiness, verbatim. */
export const REQUIRES_A_VALUE: PresenceAllowance = Object.freeze({
  allowUndefined: false,
  allowNull: false,
  emptyStringIsMissing: true,
});

/**
 * Permits undefined and null. "" stays PRESENT here, so a conditionally
 * optional field still runs its own checks against an empty string, exactly
 * as `.optional().min(3)` does.
 */
export const PERMITS_ABSENCE: PresenceAllowance = Object.freeze({
  allowUndefined: true,
  allowNull: true,
  emptyStringIsMissing: false,
});

export interface ConditionalPresenceSpec<C extends MessageContextExtra> {
  readonly code: string;
  readonly messageFactory?: MessageFactory<C>;
  readonly severity: IssueSeverity;
  /** The user's predicate. Stored by identity, never re-wrapped. */
  readonly when: RootPredicateFn;
  /** In force while the predicate holds; null defers to the merged policy. */
  readonly whenMet: PresenceAllowance | null;
  /** In force while it does not; null defers to the merged policy. */
  readonly whenUnmet: PresenceAllowance | null;
  describe(ctx: MessageContext): string;
  buildMessageContext(): C;
}

export function conditionalPresence<C extends MessageContextExtra>(
  spec: ConditionalPresenceSpec<C>
): ConditionalPresenceRule {
  return {
    kind: "conditionalPresence",
    code: spec.code,
    severity: spec.severity,
    when: spec.when,
    whenMet: spec.whenMet,
    whenUnmet: spec.whenUnmet,
    describe: (ctx) =>
      renderMessage(
        spec.messageFactory,
        ctx,
        spec.buildMessageContext(),
        spec.describe(ctx)
      ),
  };
}
