// ===========================================================================
// L7  src/plugins/string-iri/string-iri.ts
// `.iri()` and the Draft-07 `iri` format (RFC 3987, deliberately approximate).
//
// Order matters and is 1.x's: no control character or space anywhere, then the
// scheme shape, then `new URL()`, and — only if the platform parser refuses —
// a structural fallback of "scheme + non-empty remainder" so that a genuinely
// international IRI is not rejected for being non-ASCII.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { hasControlOrSpace } from "./control-character";

const IRI_SHAPE = /^[a-zA-Z][a-zA-Z0-9+.-]*:(?:\/\/)?[^\s]*$/;

function isParsableUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isIri(value: string): boolean {
  if (hasControlOrSpace(value)) return false;
  if (!IRI_SHAPE.test(value)) return false;
  if (isParsableUrl(value)) return true;
  const colon = value.indexOf(":");
  return colon > 0 && value.length > colon + 1;
}

export const stringIriPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringIri",
  method: "iri",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isIri(value) ? PASS : fail({ actual: value }),
      describe: () => "Value must be a valid IRI (RFC 3987)",
      buildMessageContext: () => ({}),
    }),
});
