// ===========================================================================
// L7  src/plugins/string-email/string-email.ts
// `.email(options?)` and the Draft-07 `email` format.
//
// The legacy `getErrorMessage` re-ran the regex AND the domain lookup to work
// out which reason to print, so validation ran twice on the failure path and
// the two copies could disagree. `run` returns the reason in the issue detail
// and `describe` only formats it; there is one decision site.
//
// No length cap on purpose: 1.x's documented composition is `.max(100).email()`.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";

const DEFAULT_EMAIL =
  /^[a-zA-Z0-9]([a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export interface EmailFormatOptions {
  /** Matched case-insensitively against the text after the LAST "@". */
  readonly allowedDomains?: readonly string[];
  /** Replaces the built-in pattern entirely. */
  readonly customRegex?: RegExp;
}

function readDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export const stringEmailPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [options?: EmailFormatOptions];
  out: Unchanged;
  context: { readonly reason: string };
}>()({
  name: "stringEmail",
  method: "email",
  slots: ["string"] as const,
  build: (ctx, options) => {
    const source = options?.customRegex;
    const pattern =
      source === undefined
        ? DEFAULT_EMAIL
        : new RegExp(source.source, source.flags.replace(/[gy]/g, ""));
    const allowed = options?.allowedDomains;
    const allowedSet =
      allowed === undefined
        ? undefined
        : new Set(allowed.map((domain) => domain.toLowerCase()));
    const allowedList = allowed === undefined ? "" : allowed.join(", ");
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isString(value)) return PASS;
        if (!pattern.test(value)) {
          return fail({ expected: "invalid format", actual: value });
        }
        if (allowedSet !== undefined && !allowedSet.has(readDomain(value))) {
          return fail({
            expected: `domain not allowed (allowed: ${allowedList})`,
            actual: value,
          });
        }
        return PASS;
      },
      describe: (detail) => `Invalid email: ${String(detail.expected)}`,
      buildMessageContext: (detail) => ({ reason: String(detail.expected) }),
    });
  },
});
