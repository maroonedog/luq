// ===========================================================================
// L7  src/plugins/custom/custom.ts — the arbitrary predicate.
//
// Legacy `custom` kept the message its validator returned in a MUTABLE closure
// variable (`dynamicMessage`) that `getErrorMessage` read back, so validating a
// second value could report the first value's message. It also called the user
// predicate twice: once to decide, once to build the message.
//
// Here the predicate runs EXACTLY ONCE and its message travels with the
// outcome, inside IssueDetail.causes. Nothing is stored between calls.
// ===========================================================================
import {
  PASS,
  fail,
  isPlainObject,
  isString,
  type IssueSeverity,
  type MessageContextExtra,
  type TypeName,
  type ValidationIssue,
} from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { SelfReader, Unchanged } from "../../plugin-kit/marker.types";

/** What a user predicate may answer: a verdict, or a verdict with a message. */
export type CustomOutcome =
  | boolean
  | { readonly valid: boolean; readonly message?: string };

const CUSTOM_SLOTS: readonly TypeName[] = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
];

function isAccepted(outcome: CustomOutcome): boolean {
  return typeof outcome === "boolean" ? outcome : outcome.valid;
}

function readOutcomeMessage(outcome: CustomOutcome): string | undefined {
  if (typeof outcome === "boolean") return undefined;
  return isString(outcome.message) ? outcome.message : undefined;
}

/** The predicate's own message, carried as the single cause of the failure. */
function toCauses(
  message: string | undefined,
  path: string,
  code: string,
  severity: IssueSeverity
): readonly ValidationIssue[] | undefined {
  if (message === undefined) return undefined;
  return [{ path, code, message, severity }];
}

function readCauseMessage(
  causes: readonly ValidationIssue[] | undefined
): string | undefined {
  const first = causes?.[0];
  return first === undefined ? undefined : first.message;
}

export const customPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [validate: SelfReader<CustomOutcome>];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "custom",
  method: "custom",
  slots: CUSTOM_SLOTS,
  build: (ctx, validate) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, ruleContext) => {
        const outcome = runPredicate(validate, value);
        if (isAccepted(outcome)) return PASS;
        return fail({
          actual: value,
          causes: toCauses(
            readOutcomeMessage(outcome),
            ruleContext.path,
            ctx.code,
            ctx.severity
          ),
        });
      },
      describe: (detail, messageContext) =>
        readCauseMessage(detail.causes) ??
        `${messageContext.path} custom validation failed`,
      buildMessageContext: () => ({}),
    }),
});

/** A predicate that throws is a FAILED validation, never a crashed validate(). */
function runPredicate(
  validate: (value: unknown) => CustomOutcome,
  value: unknown
): CustomOutcome {
  try {
    return validate(value);
  } catch (thrown) {
    return { valid: false, message: describeThrown(thrown) };
  }
}

function describeThrown(thrown: unknown): string | undefined {
  if (thrown instanceof Error) return thrown.message;
  return isPlainObject(thrown) ? undefined : String(thrown);
}
