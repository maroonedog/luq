// ===========================================================================
// L5  src/runtime/create-issue.ts
// One ValidationIssue, built once, on the failure path only.
//
// The message is rendered HERE and nowhere else, exactly once per issue. The
// legacy tree had `getErrorMessage` and `messageFactory` racing, plus a
// pre-computed "static message" optimisation that never fired because a
// fallback factory was always installed, so a message could be built two or
// three times for one failure.
//
// `severity` is COPIED from the rule that failed. It is never defaulted here:
// the chain resolved it at build time and CompiledCheck / PresencePolicy carry
// it as a required member, so a second resolution site — the thing that makes
// a user's severity override stop working — cannot exist.
// ===========================================================================
import type { IssueSeverity, MessageContext, ValidationIssue } from "../types";

export interface IssueRequest {
  /** Already rendered against the index stack: `items[0].name`, never `[*]`. */
  readonly path: string;
  readonly code: string;
  readonly severity: IssueSeverity;
  /** The value that failed; the plugin reads it on MessageContext.value. */
  readonly value: unknown;
  /**
   * Binds the failing rule to its detail. A check closes over the
   * `IssueDetail` its `run` returned — expected / actual / branch / index /
   * causes — and a presence policy closes over nothing; either way this layer
   * sees one call shape and needs no rule kind to dispatch on.
   */
  render(context: MessageContext): string;
}

/**
 * A plugin whose message factory throws must not take the validation down
 * with it: the failure being reported is the user's data, not the plugin's
 * formatting. The legacy contract is the same, and the wording is carried
 * over verbatim.
 */
export function renderFallbackMessage(path: string): string {
  return `Validation failed for ${path}`;
}

export function createIssue(request: IssueRequest): ValidationIssue {
  const context: MessageContext = {
    path: request.path,
    value: request.value,
    code: request.code,
  };
  return Object.freeze({
    path: request.path,
    code: request.code,
    message: renderMessageOrFallback(request, context),
    severity: request.severity,
  });
}

function renderMessageOrFallback(
  request: IssueRequest,
  context: MessageContext
): string {
  try {
    return request.render(context);
  } catch {
    return renderFallbackMessage(request.path);
  }
}
