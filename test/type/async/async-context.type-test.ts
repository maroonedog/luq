// ===========================================================================
// RESIDUAL 4 / item 1 — withAsyncContext at the CALL SITE.
// The documented 1.x line, compiled:
//   await validator.withAsyncContext(ctx).validate(data)
// ===========================================================================
import {
  accountValidator,
  type Account,
  type Assert,
  type Equals,
} from "../../support/config-model";
import {
  createAsyncContext,
  readAsyncContext,
  type AsyncContext,
} from "../../../src/async/async-context";
import {
  addAsyncSupport,
  withAsyncContext,
} from "../../../src/async/async-validator";
import type { ValidationResult } from "../../../src/types/validation-result.types";
import type { RuleContext } from "../../../src/types";

interface AccountChecks {
  readonly emailTaken: boolean;
  readonly remainingQuota: number;
}

export async function buildChecks(): Promise<AsyncContext<AccountChecks>> {
  return createAsyncContext()
    .set("emailTaken", Promise.resolve(false))
    .set("remainingQuota", Promise.resolve(7))
    .withOptions({ timeout: 250, continueOnError: false })
    .build();
}

/** `.set()` accumulates the context type; the result is not Record<string, unknown>. */
export async function readContextTypes(): Promise<number> {
  const ctx = await buildChecks();
  const taken: boolean = ctx.data.emailTaken;
  // @ts-expect-error remainingQuota is a number, not a string
  const asText: string = ctx.data.remainingQuota;
  // @ts-expect-error nothing named `nope` was ever set
  ctx.data.nope;
  void asText;
  return taken ? 0 : ctx.data.remainingQuota;
}

// ---- THE documented shape ---------------------------------------------------
export async function validateWithContext(
  input: unknown
): Promise<Account | undefined> {
  const ctx = await buildChecks();
  const outcome = await addAsyncSupport(accountValidator)
    .withAsyncContext(ctx)
    .validate(input);
  return outcome.valid ? outcome.data : undefined;
}

/** The wrapper really is async: forgetting the await is a compile error. */
export async function forgettingAwait(input: unknown): Promise<void> {
  const ctx = await buildChecks();
  const pending = addAsyncSupport(accountValidator)
    .withAsyncContext(ctx)
    .validate(input);
  // @ts-expect-error validate() returns a Promise here; `valid` is not on it
  pending.valid;
}

/** The free-function form, for callers that do not want the decorator. */
export async function validateWithFreeFunction(
  input: unknown
): Promise<ValidationResult<Account>> {
  const ctx = await buildChecks();
  return withAsyncContext(accountValidator, ctx).validate(input);
}

export type BoundValidateIsAsync = Assert<
  Equals<
    ReturnType<
      ReturnType<typeof addAsyncSupport<Account>>["withAsyncContext"]
    >["validate"] extends (value: unknown, options?: never) => infer R
      ? R
      : never,
    Promise<ValidationResult<Account>>
  >
>;

/** `context` replaces 1.x getContextType(): the context type is still reachable. */
export async function readBoundContext(): Promise<boolean> {
  const ctx = await buildChecks();
  return addAsyncSupport(accountValidator).withAsyncContext(ctx).context.data
    .emailTaken;
}

/** The decorator keeps every core method, so pick() still works after it. */
export async function pickAfterDecoration(): Promise<void> {
  const decorated = addAsyncSupport(accountValidator);
  const nick = decorated.pick("nick");
  const outcome = nick.validate("bo");
  void outcome;
  // @ts-expect-error the decorator does not widen the path vocabulary
  decorated.pick("nope");
}

// ---- the READ side: a rule reaching the resolved bag ------------------------
function isAccountChecks(value: unknown): value is AccountChecks {
  if (typeof value !== "object" || value === null) return false;
  const bag: Record<string, unknown> = { ...value };
  return (
    typeof bag["emailTaken"] === "boolean" &&
    typeof bag["remainingQuota"] === "number"
  );
}

export function readInsideRule(ctx: RuleContext): number {
  const checks = readAsyncContext(ctx, isAccountChecks);
  return checks === undefined ? -1 : checks.remainingQuota;
}

readAsyncContext<AccountChecks>(
  { root: {}, path: "" },
  // @ts-expect-error the guard must actually prove the shape; a bare predicate will not do
  (value: unknown) => value !== undefined
);
